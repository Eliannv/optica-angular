/**
 * Gestiona el ciclo de vida diario de las cajas chicas del sistema financiero.
 * Maneja operaciones de caja en efectivo con apertura/cierre, validaciones estrictas
 * de fecha y sincronización automática con caja banco al cierre.
 *
 * Este servicio implementa:
 * - Apertura con fecha manual (histórica o actual)
 * - Asociación automática por periodo (mes/año) a caja banco
 * - Registro de movimientos en efectivo con trazabilidad
 * - Cierre que transfiere saldo a caja banco del periodo
 * - Herencia de saldo inicial desde la última caja cerrada
 * - Caché en localStorage para prevenir duplicados
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
import { AuthService } from './auth.service';
import { 
  normalizarFecha, 
  obtenerPeriodo, 
  rangoPeriodo 
} from '../utils/fecha-helpers';

@Injectable({
  providedIn: 'root',
})
export class CajaChicaService {
  private firestore = inject(Firestore);
  private cajaBancoService = inject(CajaBancoService);  private authService = inject(AuthService);
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
   * Valida si existe ALGUNA caja chica ABIERTA (sin importar la fecha).
   * Útil para validaciones de ventas con cajas históricas.
   * 
   * @returns Promise con objeto que contiene: valida (true si hay caja ABIERTA), caja (datos opcionales).
   */
  async validarCajaAbierta(): Promise<{ valida: boolean; caja?: CajaChica }> {
    try {
      const caja = await this.getCajaAbierta();
      console.log('🔍 validarCajaAbierta() - Caja encontrada:', caja);
      return {
        valida: caja !== null,
        caja: caja || undefined
      };
    } catch (err) {
      console.error('❌ Error al validar caja abierta:', err);
      return { valida: false };
    }
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
   * Obtiene la primera caja chica ABIERTA (sin importar la fecha).
   * Útil para permitir operaciones con cajas históricas.
   * 
   * Diferencia con getCajaAbiertaHoy():
   * - getCajaAbiertaHoy() → solo cajas del día actual
   * - getCajaAbierta() → CUALQUIER caja ABIERTA (histórica o actual)
   * 
   * @returns Promise<CajaChica | null> Primera caja ABIERTA encontrada o null.
   */
  async getCajaAbierta(): Promise<CajaChica | null> {
    try {
      console.log('🔍 getCajaAbierta() - Buscando cajas ABIERTAS...');
      const cajasRef = collection(this.firestore, 'cajas_chicas');
      // Solo filtrar por estado para evitar necesidad de índice compuesto
      const q = query(
        cajasRef,
        where('estado', '==', 'ABIERTA')
      );

      const snapshot = await getDocs(q);
      console.log('📊 getCajaAbierta() - Documentos encontrados:', snapshot.size);
      
      if (!snapshot.empty) {
        // Filtrar manualmente las cajas activas y ordenar por fecha
        const cajasActivas = snapshot.docs
          .map(doc => {
            const data = doc.data() as CajaChica;
            data.id = doc.id;
            return data;
          })
          .filter(caja => {
            const esActiva = caja.activo !== false;
            console.log(`  📦 Caja ${caja.id}: activo=${caja.activo}, esActiva=${esActiva}`);
            return esActiva;
          })
          .sort((a, b) => {
            const fechaA = a.fecha instanceof Date ? a.fecha : (a.fecha as any).toDate?.() || new Date(a.fecha);
            const fechaB = b.fecha instanceof Date ? b.fecha : (b.fecha as any).toDate?.() || new Date(b.fecha);
            return fechaB.getTime() - fechaA.getTime(); // Descendente (más reciente primero)
          });
        
        console.log('✅ getCajaAbierta() - Cajas activas encontradas:', cajasActivas.length);
        if (cajasActivas.length > 0) {
          console.log('✅ Retornando caja:', cajasActivas[0].id, cajasActivas[0].fecha);
        }
        return cajasActivas.length > 0 ? cajasActivas[0] : null;
      }
      
      console.log('⚠️ getCajaAbierta() - No se encontraron cajas ABIERTAS');
      return null;
    } catch (err) {
      console.error('❌ Error al obtener caja abierta:', err);
      return null;
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
   * Abre una nueva caja chica con fecha manual (histórica o actual).
   * Asocia automáticamente la caja chica a la caja banco del mismo periodo (mes/año).
   *
   * NUEVO COMPORTAMIENTO:
   * - Acepta cualquier fecha (pasada, presente)
   * - Busca la caja banco del MISMO PERIODO (mes/año), no del mismo día
   * - Asocia automáticamente caja_banco_id por periodo
   * - Valida que no exista caja chica para ese día específico
   * - Requiere que exista al menos una caja banco en el sistema
   *
   * Proceso:
   * 1. Valida existencia de al menos una caja banco
   * 2. Normaliza la fecha a medianoche
   * 3. Valida que no exista caja chica para ese día
   * 4. Busca caja banco ABIERTA del mismo periodo (mes/año)
   * 5. Asocia automáticamente caja_banco_id
   * 6. Crea la caja chica
   *
   * @param caja Datos de la caja chica (fecha manual requerida).
   * @returns Promise<string> ID de la caja chica creada.
   * @throws Error si no existe caja banco o ya existe caja para ese día.
   */
  async abrirCajaChica(caja: CajaChica): Promise<string> {
    try {
      const cajasRef = collection(this.firestore, 'cajas_chicas');
      // No volver a convertir con new Date() - la fecha ya viene normalizada del componente
      const fechaNormalizada = caja.fecha ? normalizarFecha(caja.fecha) : normalizarFecha(new Date());
      const periodo = obtenerPeriodo(fechaNormalizada);

      console.log(`📅 Creando caja chica para fecha: ${fechaNormalizada.toLocaleDateString()} (periodo: ${periodo.year}-${periodo.monthIndex1.toString().padStart(2, '0')})`);

      // VALIDACIÓN DE SEGURIDAD: Operadores solo pueden crear cajas con fecha actual (evitar manipulación de fecha del PC)
      const usuarioActual = await this.authService.getCurrentUser();
      if (usuarioActual && !this.authService.isAdmin()) {
        // Usuario es operador - validar que la fecha sea HOY usando timestamp del servidor
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaCaja = new Date(fechaNormalizada);
        fechaCaja.setHours(0, 0, 0, 0);
        
        if (fechaCaja.getTime() !== hoy.getTime()) {
          throw new Error('Los operadores solo pueden crear cajas chicas para el día actual. Contacte con un administrador para crear cajas históricas.');
        }
      }

      // VALIDACIÓN CRÍTICA: Verificar que exista una Caja Banco ABIERTA para el mismo periodo
      const cajaBancoPeriodo = await this.cajaBancoService.getCajaBancoPorPeriodo(
        periodo.year,
        periodo.monthIndex0
      );
      
      if (!cajaBancoPeriodo) {
        throw new Error(`No existe una caja banco para el periodo ${periodo.monthIndex1.toString().padStart(2, '0')}/${periodo.year}. Debes crear primero una caja banco para ese mes.`);
      }
      
      if (cajaBancoPeriodo.estado !== 'ABIERTA') {
        throw new Error(`La caja banco del periodo ${periodo.monthIndex1.toString().padStart(2, '0')}/${periodo.year} está CERRADA. Solo puedes crear cajas chicas en periodos con caja banco ABIERTA.`);
      }
      
      console.log(`✅ Caja banco del periodo encontrada y ABIERTA: ${cajaBancoPeriodo.id} (${periodo.year}-${periodo.monthIndex1.toString().padStart(2, '0')})`);

      // VALIDACIÓN 1: Verificar que NO exista ninguna caja chica ABIERTA en el sistema
      const qCajasAbiertas = query(
        cajasRef,
        where('estado', '==', 'ABIERTA')
      );
      const snapCajasAbiertas = await getDocs(qCajasAbiertas);
      
      const cajasAbiertas = snapCajasAbiertas.docs.filter(doc => {
        const c = doc.data() as CajaChica;
        return c.activo !== false;
      });
      
      if (cajasAbiertas.length > 0) {
        const cajaAbierta = cajasAbiertas[0].data() as CajaChica;
        const fechaAbierta = cajaAbierta.fecha instanceof Date 
          ? cajaAbierta.fecha 
          : (cajaAbierta.fecha as any).toDate 
            ? (cajaAbierta.fecha as any).toDate() 
            : new Date(cajaAbierta.fecha);
        throw new Error(`Ya existe una caja chica ABIERTA para el día ${fechaAbierta.toLocaleDateString()}. Debes cerrarla antes de abrir una nueva.`);
      }

      // VALIDACIÓN 2: Verificar en Firestore si ya existe cualquier caja (ABIERTA o CERRADA) para la fecha (día) exacta
      const inicioDia = new Date(fechaNormalizada);
      inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(fechaNormalizada);
      finDia.setHours(23, 59, 59, 999);

      console.log(`🔍 Buscando cajas existentes entre ${inicioDia.toISOString()} y ${finDia.toISOString()}`);

      const qMismoDia = query(
        cajasRef,
        where('fecha', '>=', inicioDia),
        where('fecha', '<=', finDia)
      );
      const snapMismoDia = await getDocs(qMismoDia);
      
      // Filtrar cajas activas (no soft-deleted) y loggear resultados
      const cajasExistentes = snapMismoDia.docs.filter(doc => {
        const c = doc.data() as CajaChica;
        const esActiva = c.activo !== false;
        console.log(`📋 Caja encontrada: ${doc.id}, fecha: ${c.fecha}, activo: ${esActiva}, estado: ${c.estado}`);
        return esActiva;
      });
      
      console.log(`📊 Total cajas activas encontradas para la fecha: ${cajasExistentes.length}`);
      
      if (cajasExistentes.length > 0) {
        const cajaExistente = cajasExistentes[0].data() as CajaChica;
        throw new Error(`Ya existe una caja chica para el día ${fechaNormalizada.toLocaleDateString()} (Estado: ${cajaExistente.estado})`);
      }

      // Crear la nueva caja con hora actual (combina fecha seleccionada + hora actual)
      const ahora = new Date();
      const fechaConHoraActual = new Date(
        fechaNormalizada.getFullYear(),
        fechaNormalizada.getMonth(),
        fechaNormalizada.getDate(),
        ahora.getHours(),
        ahora.getMinutes(),
        ahora.getSeconds(),
        ahora.getMilliseconds()
      );
      
      const nuevaCaja: CajaChica = {
        fecha: fechaConHoraActual,
        monto_inicial: caja.monto_inicial || 0,
        monto_actual: caja.monto_inicial || 0,
        estado: 'ABIERTA',
        usuario_id: caja.usuario_id,
        usuario_nombre: caja.usuario_nombre,
        observacion: caja.observacion || '',
        caja_banco_id: cajaBancoPeriodo.id, // Asociar a la caja banco validada
        activo: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(cajasRef, nuevaCaja);
      console.log(`✅ Caja chica creada exitosamente con ID: ${docRef.id}`);

      // Guardar en localStorage solo si es del día actual
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fechaNormalizada.getTime() === hoy.getTime()) {
        localStorage.setItem('cajaChicaAbierta', docRef.id);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error al crear caja chica:', error);
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
      // Obtener usuario actual
      const usuarioActual = this.authService.getCurrentUser();
      
      // Obtener la caja antes de cerrarla
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
      if (!cajaDoc.exists()) {
        throw new Error('Caja chica no encontrada');
      }

      const caja = cajaDoc.data() as CajaChica;

      // Actualizar estado a CERRADA con información del usuario
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        estado: 'CERRADA',
        cerrado_en: Timestamp.now(),
        cerrado_por_id: usuarioActual?.id || '',
        cerrado_por_nombre: usuarioActual?.nombre || 'Usuario',
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

  // Actualizar movimiento por ID de factura
  async actualizarMovimientoPorFactura(
    cajaChicaId: string, 
    facturaId: string, 
    nuevoMonto: number,
    nuevaFecha?: Date,
    nuevaDescripcion?: string
  ): Promise<void> {
    try {
      // Buscar el movimiento con comprobante = facturaId
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
      const q = query(
        movimientosRef,
        where('caja_chica_id', '==', cajaChicaId),
        where('comprobante', '==', facturaId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const movimientoDoc = snapshot.docs[0];
        const movimientoActual = movimientoDoc.data() as MovimientoCajaChica;
        const montoAnterior = movimientoActual.monto;
        
        // Calcular diferencia para ajustar saldo de caja
        const diferencia = nuevoMonto - montoAnterior;
        
        // Actualizar saldo de la caja
        const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
        const caja = cajaDoc.data() as CajaChica;
        const nuevoSaldoCaja = caja.monto_actual + diferencia;
        
        // Actualizar caja
        await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
          monto_actual: nuevoSaldoCaja,
          updatedAt: Timestamp.now(),
        });
        
        // Actualizar el movimiento específico
        const datosActualizacion: any = {
          monto: nuevoMonto,
          updatedAt: Timestamp.now(),
        };
        
        if (nuevaFecha) {
          datosActualizacion.fecha = nuevaFecha;
        }
        
        if (nuevaDescripcion) {
          datosActualizacion.descripcion = nuevaDescripcion;
        }
        
        await updateDoc(doc(this.firestore, `movimientos_cajas_chicas/${movimientoDoc.id}`), datosActualizacion);
        
        // ✅ RECALCULAR SALDOS DE TODOS LOS MOVIMIENTOS
        await this.recalcularSaldosMovimientos(cajaChicaId);
        
        console.log('✅ Movimiento actualizado y saldos recalculados:', facturaId, '| Diferencia:', diferencia);
      } else {
        console.log('⚠️ No se encontró movimiento para actualizar, se creará uno nuevo');
        throw new Error('NO_ENCONTRADO');
      }
    } catch (error) {
      console.error('Error actualizando movimiento por factura:', error);
      throw error;
    }
  }

  // Recalcular saldos acumulativos de todos los movimientos de una caja
  private async recalcularSaldosMovimientos(cajaChicaId: string): Promise<void> {
    try {
      console.log('🔄 Iniciando recalcularSaldosMovimientos para caja:', cajaChicaId);
      
      // Obtener la caja para el monto inicial
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
      const caja = cajaDoc.data() as CajaChica;
      
      console.log('📊 Monto inicial de caja:', caja.monto_inicial);
      
      // Obtener todos los movimientos ordenados por fecha
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
      const q = query(
        movimientosRef,
        where('caja_chica_id', '==', cajaChicaId),
        orderBy('fecha', 'asc')
      );
      const snapshot = await getDocs(q);
      
      console.log('📋 Total movimientos a recalcular:', snapshot.docs.length);
      
      // Calcular saldos acumulativos
      let saldoAcumulado = caja.monto_inicial || 0;
      const promesasActualizacion: Promise<void>[] = [];
      
      snapshot.docs.forEach((movDoc, index) => {
        const mov = movDoc.data() as MovimientoCajaChica;
        const saldoAnterior = saldoAcumulado;
        
        // Calcular nuevo saldo según tipo
        if (mov.tipo === 'INGRESO') {
          saldoAcumulado += mov.monto;
        } else {
          saldoAcumulado -= mov.monto;
        }
        
        console.log(`  [${index + 1}] ${mov.tipo} $${mov.monto} → Saldo: ${saldoAnterior} → ${saldoAcumulado}`);
        
        // Actualizar saldos del movimiento si cambiaron
        const promesa = updateDoc(doc(this.firestore, `movimientos_cajas_chicas/${movDoc.id}`), {
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoAcumulado
        });
        promesasActualizacion.push(promesa);
      });
      
      // Ejecutar todas las actualizaciones en paralelo
      await Promise.all(promesasActualizacion);
      console.log(`✅ Saldos recalculados para ${promesasActualizacion.length} movimientos. Saldo final: ${saldoAcumulado}`);
      
    } catch (error) {
      console.error('Error recalculando saldos:', error);
    }
  }

  // Eliminar movimiento por ID de factura
  async eliminarMovimientoPorFactura(cajaChicaId: string, facturaId: string): Promise<void> {
    try {
      // Buscar el movimiento con comprobante = facturaId
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
      const q = query(
        movimientosRef,
        where('caja_chica_id', '==', cajaChicaId),
        where('comprobante', '==', facturaId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const movimientoDoc = snapshot.docs[0];
        await this.eliminarMovimiento(cajaChicaId, movimientoDoc.id);
        console.log('✅ Movimiento de factura eliminado:', facturaId);
      }
    } catch (error) {
      console.error('Error eliminando movimiento por factura:', error);
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
