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

  // 🔹 Obtener todas las cajas chicas (SOLO ACTIVAS)
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

  // 🔹 Obtener TODAS las cajas chicas (incluyendo desactivadas)
  getCajasChicasTodas(): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    const q = query(
      cajasRef,
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<CajaChica[]>;
  }

  // 🔹 Obtener cajas chicas abiertas (SOLO ACTIVAS)
  getCajasChicasAbiertas(): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    // 🔹 Solo usar WHERE para 'estado' para evitar requerimiento de índice compuesto
    const q = query(
      cajasRef,
      where('estado', '==', 'ABIERTA')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        // 🔹 Filtrar activas en el cliente (evita requerimiento de índice compuesto)
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

  // 🔹 Obtener una caja chica por ID
  getCajaChicaById(id: string): Observable<CajaChica> {
    const cajaDoc = doc(this.firestore, `cajas_chicas/${id}`);
    return docData(cajaDoc, { idField: 'id' }) as Observable<CajaChica>;
  }

  // 🔹 Obtener cajas chicas por mes (rango)
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

  // 🔹 Obtener la caja abierta para el día actual (desde localStorage)
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
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const mañana = new Date(hoy);
      mañana.setDate(mañana.getDate() + 1);

      const cajasRef = collection(this.firestore, 'cajas_chicas');
      const q = query(
        cajasRef,
        where('fecha', '>=', hoy),
        where('fecha', '<', mañana),
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
          
          // Guardar en localStorage para futuras validaciones
          localStorage.setItem('cajaChicaAbierta', doc.id);
          return data;
        }
      }
      
      return null;
    } catch (err) {
      console.warn('Error al obtener caja abierta:', err);
    }
    
    return null;
  }

  // 🔹 NUEVO: Validar estado detallado de la caja chica para hoy
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

  // 🔹 NUEVO: Obtener caja abierta directamente de Firestore (busca por fecha de hoy)
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
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const mañana = new Date(hoy);
      mañana.setDate(mañana.getDate() + 1);

      const cajasRef = collection(this.firestore, 'cajas_chicas');
      const q = query(
        cajasRef,
        where('fecha', '>=', hoy),
        where('fecha', '<', mañana),
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
          
          // Encontramos una caja abierta válida, guardarla en localStorage
          localStorage.setItem('cajaChicaAbierta', doc.id);
          return true;
        }
      }
      
      return false;
    } catch (err) {
      console.error('Error al verificar caja abierta hoy:', err);
      return false;
    }
  }  // 🔹 Obtener la última caja chica abierta
  // 🔹 Crear una nueva caja chica (apertura)
  // Solo permite 1 caja por día (abierta o cerrada). Si ya existe una caja con la misma fecha, lanza error.
  async abrirCajaChica(caja: CajaChica): Promise<string> {
    try {
      // 🔒 VALIDACIÓN OBLIGATORIA: Verificar que exista al menos una Caja Banco
      const existeCajaBanco = await firstValueFrom(this.cajaBancoService.existeAlMenosUnaCajaBanco());
      if (!existeCajaBanco) {
        throw new Error('Debe crear primero una Caja Banco antes de registrar una Caja Chica.');
      }

      const cajasRef = collection(this.firestore, 'cajas_chicas');
      const fecha = caja.fecha ? new Date(caja.fecha) : new Date();
      fecha.setHours(0, 0, 0, 0);

      // 🔍 Verificar en Firestore si ya existe cualquier caja (ABIERTA o CERRADA) para la fecha (día) actual
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
        activo: true, // 🔹 Nueva caja siempre activa
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // 🔹 Buscar la caja banco ABIERTA del MISMO MES (no del mismo día)
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

  // 🔹 Registrar un movimiento en la caja chica
  async registrarMovimiento(cajaChicaId: string, movimiento: MovimientoCajaChica): Promise<string> {
    try {
      // 1️⃣ Obtener la caja actual para conocer el saldo
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
      if (!cajaDoc.exists()) {
        throw new Error('Caja chica no encontrada');
      }

      const caja = cajaDoc.data() as CajaChica;
      const saldoAnterior = caja.monto_actual || 0;

      // 2️⃣ Calcular el nuevo saldo según el tipo de movimiento
      let nuevoSaldo = saldoAnterior;
      if (movimiento.tipo === 'INGRESO') {
        nuevoSaldo = saldoAnterior + (movimiento.monto || 0);
      } else if (movimiento.tipo === 'EGRESO') {
        nuevoSaldo = saldoAnterior - (movimiento.monto || 0);
      }

      // 3️⃣ Registrar el movimiento con saldos
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

      // 4️⃣ Actualizar el monto_actual de la caja chica
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        monto_actual: Math.max(0, nuevoSaldo),
        updatedAt: Timestamp.now(),
      });

      // 5️⃣ 🆕 Actualizar saldo_actual en caja_banco
      try {
        // 🔹 Si la caja chica tiene caja_banco_id, usar ese ID directamente (MEJOR)
        // Si no, buscar por fecha (fallback para cajas antiguas)
        if (caja.caja_banco_id) {
          // RUTA 1️⃣: Usar el caja_banco_id explícito (más seguro y rápido)
          const cajaBancoRef = doc(this.firestore, `cajas_banco/${caja.caja_banco_id}`);
          const cajaBancoSnap = await getDoc(cajaBancoRef);
          
          if (cajaBancoSnap.exists()) {
            const cajaBanco = cajaBancoSnap.data() as any;
            
            // Saltar cajas soft-deleted
            if (cajaBanco.activo === false) {
              console.warn('⚠️ La caja banco asociada está desactivada');
              return docRef.id; // Retornar el ID del movimiento sin actualizar caja banco
            }
            
            // Obtener TODAS las cajas chicas cerradas de esta caja_banco
            const cajasChicasRef = collection(this.firestore, 'cajas_chicas');
            const qCajasChicas = query(cajasChicasRef);
            const snapshotCajasChicas = await getDocs(qCajasChicas);
            let totalIngresosCajasChicas = 0;
            
            snapshotCajasChicas.docs.forEach(docSnap => {
              const cc = docSnap.data() as any;
              
              // Filtrar: solo activas, cerradas, y que pertenezcan a esta caja_banco
              if (cc.activo !== false && cc.estado === 'CERRADA' && cc.caja_banco_id === caja.caja_banco_id) {
                // Sumar el monto_actual de todas las cajas cerradas
                totalIngresosCajasChicas += cc.monto_actual || 0;
              }
            });
            
            // Calcular nuevo saldo: saldo_inicial + total de cajas chicas cerradas
            const nuevoSaldoCajaBanco = (cajaBanco.saldo_inicial || 0) + totalIngresosCajasChicas;
            
            console.log('🔄 Actualizando caja_banco (por caja_banco_id):', {
              cajaBancoId: caja.caja_banco_id,
              saldoInicial: cajaBanco.saldo_inicial,
              totalIngresosCajasChicas,
              nuevoSaldo: nuevoSaldoCajaBanco,
              cajasCerradasCount: snapshotCajasChicas.docs.filter(d => {
                const cc = d.data() as any;
                return cc.activo !== false && cc.estado === 'CERRADA' && cc.caja_banco_id === caja.caja_banco_id;
              }).length
            });
            
            // Actualizar saldo_actual en caja_banco
            await updateDoc(cajaBancoRef, {
              saldo_actual: nuevoSaldoCajaBanco,
              updatedAt: Timestamp.now()
            });
            
            console.log('✅ Caja banco actualizada exitosamente');
          } else {
            console.warn('⚠️ Caja banco no encontrada con ID:', caja.caja_banco_id);
          }
        } else {
          // RUTA 2️⃣: Fallback para cajas antiguas sin caja_banco_id (buscar por fecha)
          const fechaCaja = caja.fecha instanceof Date ? caja.fecha : (caja.fecha as any).toDate?.() || new Date(caja.fecha);
          const hoy = new Date(fechaCaja);
          hoy.setHours(0, 0, 0, 0);
          
          const mañana = new Date(hoy);
          mañana.setDate(mañana.getDate() + 1);

          const cajasRef = collection(this.firestore, 'cajas_banco');
          const q = query(
            cajasRef,
            where('fecha', '>=', hoy),
            where('fecha', '<', mañana)
          );

          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const cajaDoc = snapshot.docs[0];
            const cajaBanco = cajaDoc.data() as any;
            
            // Saltar cajas soft-deleted
            if (cajaBanco.activo === false) {
              console.warn('⚠️ La caja banco del día está desactivada');
              return docRef.id; // Retornar el ID del movimiento sin actualizar caja banco
            }
            
            // Obtener TODAS las cajas chicas cerradas del mismo mes
            const cajasChicasRef = collection(this.firestore, 'cajas_chicas');
            const qCajasChicas = query(cajasChicasRef);
            const snapshotCajasChicas = await getDocs(qCajasChicas);
            let totalIngresosCajasChicas = 0;
            
            snapshotCajasChicas.docs.forEach(docSnap => {
              const cc = docSnap.data() as any;
              
              if (cc.activo !== false && cc.estado === 'CERRADA') {
                // Para cajas antiguas, comparar por mes y año
                const fechaCajaChica = cc.fecha instanceof Date ? cc.fecha : (cc.fecha as any).toDate?.() || new Date(cc.fecha);
                if (fechaCajaChica.getFullYear() === hoy.getFullYear() && fechaCajaChica.getMonth() === hoy.getMonth()) {
                  totalIngresosCajasChicas += cc.monto_actual || 0;
                }
              }
            });
            
            const nuevoSaldoCajaBanco = (cajaBanco.saldo_inicial || 0) + totalIngresosCajasChicas;
            
            console.log('🔄 Actualizando caja_banco (fallback por fecha):', {
              cajaBancoId: cajaDoc.id,
              saldoInicial: cajaBanco.saldo_inicial,
              totalIngresosCajasChicas,
              nuevoSaldo: nuevoSaldoCajaBanco
            });
            
            await updateDoc(cajaDoc.ref, {
              saldo_actual: nuevoSaldoCajaBanco,
              updatedAt: Timestamp.now()
            });
            
            console.log('✅ Caja banco actualizada exitosamente');
          }
        }
      } catch (err) {
        console.warn('Advertencia: No se pudo actualizar caja_banco:', err);
        // No lanzar error, solo advertencia, para no afectar el flujo principal
      }

      return docRef.id;
    } catch (error) {
      console.error('Error registrando movimiento:', error);
      throw error;
    }
  }

  // 🔹 Obtener movimientos de una caja chica
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

  // 🔹 Cerrar una caja chica
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

      // 🔹 CRÍTICO: Registrar un movimiento final para que se actualice caja_banco
      // Esto dispara automáticamente la actualización del saldo_actual en caja_banco
      const movimientoFinal: MovimientoCajaChica = {
        caja_chica_id: cajaChicaId,
        fecha: new Date(),
        tipo: 'INGRESO', // Usar INGRESO para que se acumule en caja_banco
        descripcion: 'Cierre de Caja Chica',
        monto: 0, // Monto 0 porque solo queremos dispara la actualización
        comprobante: 'CIERRE',
        observacion: `Cierre de caja chica con saldo final de $${montoFinal || caja.monto_actual || 0}`,
        usuario_id: '',
        usuario_nombre: 'Sistema'
      };

      // Llamar a registrarMovimiento para que actualice el saldo en caja_banco
      await this.registrarMovimiento(cajaChicaId, movimientoFinal);

      console.log('✅ Caja chica cerrada y saldo de caja_banco actualizado');
    } catch (error) {
      console.error('Error al cerrar caja chica:', error);
      throw error;
    }
  }

  // 🔹 Obtener resumen de una caja chica
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

  // 🔹 Eliminar un movimiento (solo si es el último)
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

  // 🔹 Desactivar una caja chica (SOFT DELETE)
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

  // 🔹 Reactivar una caja chica (reversible)
  async activarCajaChica(cajaChicaId: string): Promise<void> {
    try {
      // 🔒 VALIDACIÓN OBLIGATORIA: Verificar que exista al menos una Caja Banco
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

  // 🔹 Eliminar una caja chica completa (SOFT DELETE - solo desde caja banco - admin)
  async eliminarCajaChica(cajaChicaId: string): Promise<void> {
    try {
      // 🔹 SOFT DELETE: Solo marcar como inactivo
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
