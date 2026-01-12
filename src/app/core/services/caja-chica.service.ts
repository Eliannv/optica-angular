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

@Injectable({
  providedIn: 'root',
})
export class CajaChicaService {
  private firestore = inject(Firestore);

  // 🔹 Obtener todas las cajas chicas
  getCajasChicas(): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    const q = query(cajasRef, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<CajaChica[]>;
  }

  // 🔹 Obtener cajas chicas abiertas
  getCajasChicasAbiertas(): Observable<CajaChica[]> {
    const cajasRef = collection(this.firestore, 'cajas_chicas');
    const q = query(cajasRef, where('estado', '==', 'ABIERTA'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        return (cajas || []).sort((a, b) => {
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

  // 🔹 Obtener la caja abierta para el día actual (desde localStorage)
  async getCajaAbiertaHoy(): Promise<CajaChica | null> {
    // Usar localStorage para evitar query con índice
    const cajaChicaId = localStorage.getItem('cajaChicaAbierta');
    
    if (!cajaChicaId) {
      return null;
    }

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
            return data;
          }
        }
        
        // Si la caja no es válida, limpiar localStorage
        localStorage.removeItem('cajaChicaAbierta');
      }
    } catch (err) {
      console.warn('Error al obtener caja abierta:', err);
    }
    
    return null;
  }  // 🔹 Obtener la última caja chica abierta
  // 🔹 Crear una nueva caja chica (apertura)
  // Solo permite 1 caja por día (abierta o cerrada). Si ya existe una caja con la misma fecha, lanza error.
  async abrirCajaChica(caja: CajaChica): Promise<string> {
    try {
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
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

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

      // 4️⃣ Actualizar el monto_actual de la caja
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        monto_actual: Math.max(0, nuevoSaldo),
        updatedAt: Timestamp.now(),
      });

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
      await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
        estado: 'CERRADA',
        cerrado_en: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...(montoFinal !== undefined && { monto_actual: montoFinal }),
      });
    } catch (error) {
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
}
