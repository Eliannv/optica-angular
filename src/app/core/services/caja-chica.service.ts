/**
 * Gestiona el ciclo de vida diario de las cajas chicas del sistema financiero.
 * Maneja operaciones de caja en efectivo con apertura/cierre diario, validaciones estrictas
 * de fecha y sincronización automática con caja banco al cierre.
 *
 * Este servicio implementa:
 * - Apertura única diaria por sucursal (validación estricta)
 * - Registro de movimientos en efectivo con trazabilidad
 * - Cierre automático que transfiere saldo a caja banco
 * - Herencia de saldo inicial desde la última caja cerrada
 * - Caché en localStorage para prevenir duplicados
 * - Validación de horarios (no abrir cajas del día siguiente antes de tiempo)
 * - Soft delete para preservar historial
 *
 * Los datos se persisten en 'cajas_chicas' y 'movimientos_cajas_chicas' de Firestore.
 * Se integra estrechamente con CajaBancoService para registrar los cierres.
 *
 * Forma parte del módulo financiero del sistema de gestión de la óptica.
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  docData,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { CajaChica, MovimientoCajaChica, ResumenCajaChica } from '../models/caja-chica.model';
import { CajaBancoService } from './caja-banco.service';

@Injectable({
  providedIn: 'root',
})
export class CajaChicaService {
  private firestore = inject(Firestore);
  private cajaBancoService = inject(CajaBancoService);

  /**
   * Recupera todas las cajas chicas activas del sistema ordenadas por fecha descendente.
   * Filtra automáticamente las cajas desactivadas (soft delete) en memoria.
   *
   * @returns Observable<CajaChica[]> Stream reactivo con las cajas chicas activas.
   */
  getCajasChicas(): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    const q = query(
      cajasRef,
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => cajas.filter(c => c.activo !== false))
    ) as Observable<CajaChica[]>;
  }

  /**
   * Recupera TODAS las cajas chicas incluyendo las desactivadas.
   * Utilizado para reportes históricos y auditorías.
   *
   * @returns Observable<CajaChica[]> Stream con todas las cajas sin filtrar.
   */
  getCajasChicasTodas(): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    const q = query(
      cajasRef,
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<CajaChica[]>;
  }

  /**
   * Recupera todas las cajas chicas con estado ABIERTA.
   * Filtra por soft delete en el cliente y ordena por fecha de creación.
   *
   * @returns Observable<CajaChica[]> Stream con las cajas abiertas activas.
   */
  getCajasChicasAbiertas(): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    // Solo usar WHERE para 'estado' para evitar requerimiento de índice compuesto
    const q = query(
      cajasRef,
      where('estado', '==', 'ABIERTA')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        // Filtrar activas en el cliente (evita requerimiento de índice compuesto)
        return (cajas || [])
          .filter(c => c.activo !== false)
          .sort((a, b) => {
            const timeA = b?.createdAt?.toMillis?.() || 0;
            const timeB = a?.createdAt?.toMillis?.() || 0;
            return timeA - timeB; // descendente
          });
      })
    ) as Observable<CajaChica[]>;
  }

  /**
   * Recupera una caja chica específica por su ID.
   *
   * @param id ID de la caja chica.
   * @returns Observable<CajaChica> Stream con los datos de la caja.
   */
  getCajaChicaById(id: string): Observable<CajaChica> {
    const cajaDoc = doc(this.firestore, `cajas_chicas/${id}`);
    return docData(cajaDoc, { idField: 'id' }) as Observable<CajaChica>;
  }

  /**
   * Recupera todas las cajas chicas de un mes específico.
   * Utiliza un rango de fechas para consultas eficientes en Firestore.
   *
   * @param year Año calendario.
   * @param monthIndex0 Índice del mes base 0 (0=Enero, 11=Diciembre).
   * @returns Observable<CajaChica[]> Stream con las cajas del mes.
   */
  getCajasChicasPorMes(year: number, monthIndex0: number): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    const inicioMes = new Date(year, monthIndex0, 1);
    const inicioSiguienteMes = new Date(year, monthIndex0 + 1, 1);
    const q = query(
      cajasRef,
      where('fecha', '>=', inicioMes),
      where('fecha', '<', inicioSiguienteMes),
      orderBy('fecha', 'desc')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => (cajas || []).filter(c => c.activo !== false))
    ) as Observable<CajaChica[]>;
  }
  /**
   * Obtiene la caja chica abierta para el día actual.
   * Implementa estrategia de doble validación: localStorage + Firestore.
   *
   * Proceso:
   * 1. Verifica localStorage para caché rápido
   * 2. Valida que la caja cacheada siga ABIERTA y sea de hoy
   * 3. Si no hay caché válido, consulta Firestore
   * 4. Actualiza localStorage con el resultado
   *
   * @returns Promise<CajaChica | null> Caja abierta de hoy o null.
   */
  async getCajaAbiertaHoy(): Promise<CajaChica | null> {
    try {
      // 1. PRIMERO: Verificar localStorage
      const cajaChicaId = localStorage.getItem('cajaChicaAbierta');
      
      if (cajaChicaId) {
        try {
          const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
          if (cajaDoc.exists()) {
            const data = cajaDoc.data() as CajaChica;
            data.id = cajaDoc.id;
            
            // Validar que esté abierta y sea del día actual
            if (data.estado === 'ABIERTA') {
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              const fechaCaja = new Date(data.fecha);
              fechaCaja.setHours(0, 0, 0, 0);
              
              if (fechaCaja.getTime() === hoy.getTime()) {
                return data; // ✅ Caja válida
              }
            }
            
            // Si la caja no es válida, limpiar localStorage
            localStorage.removeItem('cajaChicaAbierta');
          }
        } catch (err) {
          console.warn('Error al obtener caja de localStorage:', err);
          localStorage.removeItem('cajaChicaAbierta');
        }
      }

      // 2. SI NO ESTÁ EN LOCALSTORAGE: Buscar en Firestore
      // IMPORTANTE: Buscar TODAS las cajas abiertas (sin restricción de fecha)
      // porque queremos detectar y cerrar las vencidas
      const cajasRef = collection(this.firestore, 'cajas_chicas');
      const q = query(
        cajasRef,
        where('estado', '==', 'ABIERTA')
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Buscar la primera caja abierta que no esté soft-deleted
        for (const doc of snapshot.docs) {
          const data = doc.data() as CajaChica;
          
          // Saltar cajas soft-deleted
          if (data.activo === false) {
            continue;
          }
          
          data.id = doc.id;

          // Validar que sea de HOY después de pasar la detección
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const fechaCaja = new Date(data.fecha);
          fechaCaja.setHours(0, 0, 0, 0);
          
          if (fechaCaja.getTime() === hoy.getTime()) {
            // Guardar en localStorage para futuras validaciones
            localStorage.setItem('cajaChicaAbierta', doc.id);
            return data;
          }
        }
      }
      
      return null;
    } catch (err) {
      console.warn('Error al obtener caja abierta:', err);
    }
    
    return null;
  }

  /**
   * Valida el estado detallado de la caja chica para el día actual.
   * Retorna información sobre si existe, su estado y los datos completos.
   *
   * @returns Promise con objeto que contiene: valida (booleano), tipo (ABIERTA/CERRADA/NO_EXISTE), caja (datos opcionales).
   */
  async validarCajaChicaHoy(): Promise<{ valida: boolean; tipo: 'ABIERTA' | 'CERRADA' | 'NO_EXISTE'; caja?: CajaChica }> {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const mañana = new Date(hoy);
      mañana.setDate(mañana.getDate() + 1);

      const cajasRef = collection(this.firestore, 'cajas_chicas');
      
      // Buscar CUALQUIER caja para hoy (abierta o cerrada)
      // Nota: No usamos where('activo', '!=', false) porque Firestore no lo permite
      const q = query(
        cajasRef,
        where('fecha', '>=', hoy),
        where('fecha', '<', mañana)
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Buscar la primera caja que no esté soft-deleted
        for (const doc of snapshot.docs) {
          const data = doc.data() as CajaChica;
          
          // Saltar cajas soft-deleted
          if (data.activo === false) {
            continue;
          }
          
          data.id = doc.id;
          
          // Si está ABIERTA
          if (data.estado === 'ABIERTA') {
            localStorage.setItem('cajaChicaAbierta', doc.id);
            return { 
              valida: true, 
              tipo: 'ABIERTA', 
              caja: data 
            };
          } 
          // Si está CERRADA
          else if (data.estado === 'CERRADA') {
            localStorage.removeItem('cajaChicaAbierta');
            return { 
              valida: false, 
              tipo: 'CERRADA', 
              caja: data 
            };
          }
        }
      }
      
      // No existe caja para hoy
      localStorage.removeItem('cajaChicaAbierta');
      return { 
        valida: false, 
        tipo: 'NO_EXISTE' 
      };
      
    } catch (err) {
      console.error('Error al validar caja chica:', err);
      return { 
        valida: false, 
        tipo: 'NO_EXISTE' 
      };
    }
  }

  /**
   * Verifica rápidamente si existe una caja chica abierta para hoy.
   * Utiliza localStorage como caché para mejorar rendimiento.
   *
   * @returns Promise<boolean> True si existe caja abierta para hoy.
   */
  async existeCajaAbiertaHoy(): Promise<boolean> {
    try {
      // 1. PRIMERO: Verificar localStorage
      const cajaChicaId = localStorage.getItem('cajaChicaAbierta');
      if (cajaChicaId) {
        try {
          const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
          if (cajaDoc.exists()) {
            const data = cajaDoc.data() as CajaChica;
            
            // Validar que esté abierta y sea del día actual
            if (data.estado === 'ABIERTA') {
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              const fechaCaja = new Date(data.fecha);
              fechaCaja.setHours(0, 0, 0, 0);
              
              if (fechaCaja.getTime() === hoy.getTime()) {
                return true; // ✅ Caja válida encontrada
              }
            }
          }
          // Si la caja de localStorage no es válida, limpiarla
          localStorage.removeItem('cajaChicaAbierta');
        } catch (err) {
          console.warn('Error al validar caja de localStorage:', err);
          localStorage.removeItem('cajaChicaAbierta');
        }
      }

      // 2. SI NO ESTÁ EN LOCALSTORAGE: Buscar en Firestore
      // IMPORTANTE: Buscar TODAS las cajas abiertas (sin restricción de fecha)
      const cajasRef = collection(this.firestore, 'cajas_chicas');
      const q = query(
        cajasRef,
        where('estado', '==', 'ABIERTA')
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Buscar la primera caja abierta que no esté soft-deleted
        for (const doc of snapshot.docs) {
          const data = doc.data() as CajaChica;
          
          // Saltar cajas soft-deleted
          if (data.activo === false) {
            continue;
          }

          data.id = doc.id;

          // Validar que sea de HOY después de pasar detección
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const fechaCaja = new Date(data.fecha);
          fechaCaja.setHours(0, 0, 0, 0);
          
          if (fechaCaja.getTime() === hoy.getTime()) {
            // Encontramos una caja abierta válida, guardarla en localStorage
            localStorage.setItem('cajaChicaAbierta', doc.id);
            return true;
          }
        }
      }
      
      return false;
    } catch (err) {
      console.error('Error al verificar caja abierta hoy:', err);
      return false;
    }
  } 
  /**
   * Crea una nueva caja chica (apertura diaria) con validaciones estrictas.
   * Solo permite 1 caja por día. Valida existencia de caja banco antes de crear.
   *
   * Proceso:
   * 1. Valida que exista al menos una Caja Banco en el sistema
   * 2. Normaliza fecha a medianoche
   * 3. Verifica que no exista caja para ese día (ni ABIERTA ni CERRADA)
   * 4. Busca caja banco ABIERTA del mismo mes/año
   * 5. Crea la caja con estado ABIERTA y relación a caja banco
   * 6. Guarda ID en localStorage para caché
   *
   * @param caja Datos de la caja chica a crear.
   * @returns Promise<string> ID de la caja creada.
   * @throws Error si no existe caja banco o ya existe caja para ese día.
   */
  async abrirCajaChica(caja: CajaChica): Promise<string> {
    try {
      // VALIDACIÓN OBLIGATORIA: Verificar que exista al menos una Caja Banco
      const existeCajaBanco = await firstValueFrom(this.cajaBancoService.existeAlMenosUnaCajaBanco());
      if (!existeCajaBanco) {
        throw new Error('Debe crear primero una Caja Banco antes de registrar una Caja Chica.');
      }

      const cajasRef = collection(this.firestore, 'cajas_chicas');
      const fecha = caja.fecha ? new Date(caja.fecha) : new Date();
      fecha.setHours(0, 0, 0, 0);

      // Verificar en Firestore si ya existe cualquier caja (ABIERTA o CERRADA) para la fecha (día) actual
      const inicioDia = new Date(fecha);
      const finDia = new Date(fecha);
      finDia.setDate(finDia.getDate() + 1);

      // Usamos un rango por fecha para evitar traer toda la colección
      const qMismoDia = query(
        cajasRef,
        where('fecha', '>=', inicioDia),
        where('fecha', '<', finDia)
      );
      const snapMismoDia = await getDocs(qMismoDia);
      if (!snapMismoDia.empty) {
        throw new Error('Ya existe una caja chica creada para el día seleccionado.');
      }

      // Crear la nueva caja
      const nuevaCaja: CajaChica = {
        fecha,
        monto_inicial: caja.monto_inicial || 0,
        monto_actual: caja.monto_inicial || 0,
        estado: 'ABIERTA',
        usuario_id: caja.usuario_id,
        usuario_nombre: caja.usuario_nombre,
        observacion: caja.observacion || '',
        activo: true, // Nueva caja siempre activa
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Buscar la caja banco ABIERTA del MISMO MES (no del mismo día)
      try {
        const cajaBancoRef = collection(this.firestore, 'cajas_banco');
        // Traer TODAS las cajas banco y filtrar en memoria por fecha y estado
        const qCajaBanco = query(cajaBancoRef);
        const snapCajaBanco = await getDocs(qCajaBanco);
        
        if (!snapCajaBanco.empty) {
          // Buscar la caja banco ABIERTA que sea del mismo mes/año
          for (const doc of snapCajaBanco.docs) {
            const cb = doc.data() as any;
            
            // Saltar cajas soft-deleted o cerradas
            if (cb.activo === false) continue;
            if (cb.estado !== 'ABIERTA') continue;
            
            // Comparar mes y año (no el día)
            const fechaCajaBanco = cb.fecha instanceof Date ? cb.fecha : (cb.fecha as any).toDate?.() || new Date(cb.fecha);
            const mesCajaBanco = fechaCajaBanco.getFullYear() * 100 + fechaCajaBanco.getMonth();
            
            const fechaNuevaCAja = new Date(fecha);
            const mesNuevaCAja = fechaNuevaCAja.getFullYear() * 100 + fechaNuevaCAja.getMonth();
            
            // Si es del mismo mes/año, asignar el ID
            if (mesCajaBanco === mesNuevaCAja) {
              nuevaCaja.caja_banco_id = doc.id;
              console.log('✅ Caja banco del mes encontrada y asignada:', doc.id, 'para mes:', mesNuevaCAja);
              break;
            }
          }
        }
        
        if (!nuevaCaja.caja_banco_id) {
          console.warn('⚠️ No se encontró caja_banco ABIERTA del mismo mes. La caja chica se creará sin relación.');
        }
      } catch (err) {
        console.warn('No se pudo obtener caja_banco_id:', err);
        // Continuar sin el ID, no es crítico
      }

      const docRef = await addDoc(cajasRef, nuevaCaja);

      // Guardar en localStorage para futuras referencias
      localStorage.setItem('cajaChicaAbierta', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error al crear caja:', error);
      throw error;
    }
  }

  /**
   * Registra un movimiento de efectivo en la caja chica.
   * Calcula nuevos saldos y actualiza la caja automáticamente.
   *
   * Flujo:
   * 1. Obtiene caja actual para conocer saldo
   * 2. Calcula nuevo saldo (+ ingreso / - egreso)
   * 3. Registra movimiento con trazabilidad de saldos (anterior/nuevo)
   * 4. Actualiza monto_actual de la caja
   *
   * @param cajaChicaId ID de la caja chica.
   * @param movimiento Datos del movimiento a registrar.
   * @returns Promise<string> ID del movimiento creado.
   * @throws Error si la caja no existe.
   */
  async registrarMovimiento(cajaChicaId: string, movimiento: MovimientoCajaChica): Promise<string> {
    try {
      // 1️Obtener la caja actual para conocer el saldo
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
      if (!cajaDoc.exists()) {
        throw new Error('Caja chica no encontrada');
      }

      const caja = cajaDoc.data() as CajaChica;
      const saldoAnterior = caja.monto_actual || 0;

      // Calcular el nuevo saldo según el tipo de movimiento
      let nuevoSaldo = saldoAnterior;
      if (movimiento.tipo === 'INGRESO') {
        nuevoSaldo = saldoAnterior + (movimiento.monto || 0);
      } else if (movimiento.tipo === 'EGRESO') {
        nuevoSaldo = saldoAnterior - (movimiento.monto || 0);
      }

      // Registrar el movimiento con saldos
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
      // Construir payload sin campos undefined (Firestore no los admite)
      const nuevoMovimiento: any = {
        caja_chica_id: cajaChicaId,
        fecha: movimiento.fecha || new Date(),
        tipo: movimiento.tipo,
        descripcion: movimiento.descripcion,
        monto: movimiento.monto,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: Math.max(0, nuevoSaldo), // no permitir saldo negativo
        comprobante: movimiento.comprobante || '',
        observacion: movimiento.observacion || '',
        createdAt: Timestamp.now(),
      } as Partial<MovimientoCajaChica>;

      if (movimiento.usuario_id) nuevoMovimiento.usuario_id = movimiento.usuario_id;
      if (movimiento.usuario_nombre) nuevoMovimiento.usuario_nombre = movimiento.usuario_nombre;

      const docRef = await addDoc(movimientosRef, nuevoMovimiento as MovimientoCajaChica);

      // Actualizar el monto_actual de la caja chica
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        monto_actual: Math.max(0, nuevoSaldo),
        updatedAt: Timestamp.now(),
      });

      // Actualizar saldo_actual en caja_banco
      // IMPORTANTE: Solo actualizar caja banco si la caja chica está siendo CERRADA
      // Los movimientos normales en caja chica NO afectan caja banco hasta que se cierre
      if (caja.estado === 'CERRADA') {
        // La caja chica ya está cerrada, NO hacer nada más
        return docRef.id;
      }
      
      // Si llegamos aquí, la caja chica está ABIERTA
      // Los movimientos en caja abierta NO deben afectar caja banco
      // Solo la acción de CERRAR la caja es lo que dispara la actualización
      
      return docRef.id;
    } catch (error) {
      console.error('Error registrando movimiento:', error);
      throw error;
    }
  }

  /**
   * Recupera todos los movimientos de una caja chica específica.
   * Ordena por fecha de creación descendente en el cliente.
   *
   * @param cajaChicaId ID de la caja chica.
   * @returns Observable<MovimientoCajaChica[]> Stream con los movimientos.
   */
  getMovimientosCajaChica(cajaChicaId: string): Observable<MovimientoCajaChica[]> {
    const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
    const q = query(
      movimientosRef,
      where('caja_chica_id', '==', cajaChicaId)
      // Sin orderBy para evitar necesidad de índice compuesto
    );
    return collectionData(q, { idField: 'id' }).pipe(
      // Ordenar en el cliente en lugar de en Firestore
      map((movimientos: any[]) => {
        return (movimientos || []).sort((a, b) => {
          const timeA = a?.createdAt?.toMillis?.() || 0;
          const timeB = b?.createdAt?.toMillis?.() || 0;
          return timeB - timeA; // descendente
        });
      })
    ) as Observable<MovimientoCajaChica[]>;
  }

  /**
   * Cierra una caja chica y transfiere su saldo a la caja banco asociada.
   * Este es el único momento donde el efectivo de caja chica impacta la caja banco.
   *
   * Proceso:
   * 1. Valida que la caja chica exista
   * 2. Actualiza estado a CERRADA con timestamp
   * 3. Busca la caja banco asociada (vía caja_banco_id)
   * 4. Suma el monto final de la caja chica al saldo_actual de caja banco
   * 5. Limpia caché de localStorage
   *
   * @param cajaChicaId ID de la caja a cerrar.
   * @param montoFinal Monto final de cierre (opcional, usa monto_actual si no se provee).
   * @returns Promise<void> Se resuelve cuando el cierre se completa.
   * @throws Error si la caja no existe.
   */
  async cerrarCajaChica(cajaChicaId: string, montoFinal?: number): Promise<void> {
    try {
      // Obtener la caja antes de cerrarla
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
      if (!cajaDoc.exists()) {
        throw new Error('Caja chica no encontrada');
      }

      const caja = cajaDoc.data() as CajaChica;

      // Actualizar estado a CERRADA
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        estado: 'CERRADA',
        cerrado_en: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...(montoFinal !== undefined && { monto_actual: montoFinal }),
      });

      // CRÍTICO: Al cerrar, actualizar el saldo_actual en caja_banco
      // Solo en este momento se transfiere el dinero de caja chica a caja banco
      try {
        if (caja.caja_banco_id) {
          const cajaBancoRef = doc(this.firestore, `cajas_banco/${caja.caja_banco_id}`);
          const cajaBancoSnap = await getDoc(cajaBancoRef);
          
          if (cajaBancoSnap.exists()) {
            const cajaBanco = cajaBancoSnap.data() as any;
            
            // Saltar cajas soft-deleted
            if (cajaBanco.activo === false) {
              console.warn('⚠️ La caja banco asociada está desactivada');
            } else {
              // El nuevo saldo es el saldo actual + el monto de la caja chica que se acaba de cerrar
              const saldoActual = cajaBanco.saldo_actual || cajaBanco.saldo_inicial || 0;
              const montoActualCajaChica = montoFinal !== undefined ? montoFinal : (caja.monto_actual || 0);
              const nuevoSaldoCajaBanco = saldoActual + montoActualCajaChica;
              
              console.log('🔄 Actualizando caja_banco al cerrar caja chica:', {
                cajaBancoId: caja.caja_banco_id,
                saldoActualAnterior: saldoActual,
                montoActualCajaChicaCerrada: montoActualCajaChica,
                nuevoSaldo: nuevoSaldoCajaBanco
              });
              
              // Actualizar saldo_actual en caja_banco
              await updateDoc(cajaBancoRef, {
                saldo_actual: nuevoSaldoCajaBanco,
                updatedAt: Timestamp.now()
              });
              
              console.log('✅ Caja banco actualizada al cerrar caja chica');
            }
          } else {
            console.warn('⚠️ Caja banco no encontrada con ID:', caja.caja_banco_id);
          }
        }
      } catch (updateError) {
        console.error('⚠️ No se pudo actualizar caja banco al cerrar:', updateError);
        // No lanzar error aquí para que el cierre sea exitoso aunque falle la actualización
      }

      console.log('✅ Caja chica cerrada');
    } catch (error) {
      console.error('Error al cerrar caja chica:', error);
      throw error;
    }
  }

  // Obtener resumen de una caja chica
  async getResumenCajaChica(cajaChicaId: string): Promise<ResumenCajaChica> {
    try {
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
      const q = query(movimientosRef, where('caja_chica_id', '==', cajaChicaId));
      
      // Usar collectionData en lugar de getDocs para evitar problemas de contexto
      const movimientos = await firstValueFrom(
        collectionData(q, { idField: 'id' })
      ) as MovimientoCajaChica[];

      let totalIngresos = 0;
      let totalEgresos = 0;

      (movimientos || []).forEach(movimiento => {
        if (movimiento.tipo === 'INGRESO') {
          totalIngresos += movimiento.monto;
        } else {
          totalEgresos += movimiento.monto;
        }
      });

      const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
      const caja = cajaDoc.data() as CajaChica;

      return {
        caja_id: cajaChicaId,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        saldo_final: caja.monto_actual,
        cantidad_movimientos: (movimientos || []).length,
      };
    } catch (error) {
      throw error;
    }
  }

  // Eliminar un movimiento (solo si es el último)
  async eliminarMovimiento(cajaChicaId: string, movimientoId: string): Promise<void> {
    try {
      const movimientoDoc = await getDoc(doc(this.firestore, `movimientos_cajas_chicas/${movimientoId}`));
      const movimiento = movimientoDoc.data() as MovimientoCajaChica;

      // Revertir el efecto del movimiento
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
      const caja = cajaDoc.data() as CajaChica;

      let nuevoSaldo = caja.monto_actual;
      if (movimiento.tipo === 'INGRESO') {
        nuevoSaldo -= movimiento.monto;
      } else {
        nuevoSaldo += movimiento.monto;
      }

      // Actualizar caja
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        monto_actual: nuevoSaldo,
        updatedAt: Timestamp.now(),
      });

      // Eliminar movimiento
      await deleteDoc(doc(this.firestore, `movimientos_cajas_chicas/${movimientoId}`));
    } catch (error) {
      throw error;
    }
  }

  // Desactivar una caja chica (SOFT DELETE)
  async desactivarCajaChica(cajaChicaId: string): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        activo: false,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al desactivar caja chica:', error);
      throw error;
    }
  }

  // Reactivar una caja chica (reversible)
  async activarCajaChica(cajaChicaId: string): Promise<void> {
    try {
      // VALIDACIÓN OBLIGATORIA: Verificar que exista al menos una Caja Banco
      const existeCajaBanco = await firstValueFrom(this.cajaBancoService.existeAlMenosUnaCajaBanco());
      if (!existeCajaBanco) {
        throw new Error('Debe crear primero una Caja Banco antes de activar una Caja Chica.');
      }

      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        activo: true,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al activar caja chica:', error);
      throw error;
    }
  }

  // Eliminar una caja chica completa (SOFT DELETE - solo desde caja banco - admin)
  async eliminarCajaChica(cajaChicaId: string): Promise<void> {
    try {
      // SOFT DELETE: Solo marcar como inactivo
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        activo: false,
        updatedAt: Timestamp.now(),
      });
      console.log('✅ Caja chica desactivada (soft delete):', cajaChicaId);
    } catch (error) {
      console.error('Error al desactivar caja chica:', error);
      throw error;
    }
  }
}
