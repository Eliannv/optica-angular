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
import { CajaBanco, MovimientoCajaBanco, ResumenCajaBanco } from '../models/caja-banco.model';

@Injectable({
  providedIn: 'root',
})
export class CajaBancoService {
  private firestore = inject(Firestore);

  // 🔹 Obtener todas las cajas banco (SOLO ACTIVAS)
  getCajasBanco(): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const q = query(
      cajasRef,
      where('activo', '!=', false),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<CajaBanco[]>;
  }
  // 🔹 Obtener cajas banco por mes (rango)
  getCajasBancoPorMes(year: number, monthIndex0: number): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const inicioMes = new Date(year, monthIndex0, 1);
    const inicioSiguienteMes = new Date(year, monthIndex0 + 1, 1);
    const q = query(
      cajasRef,
      where('fecha', '>=', inicioMes),
      where('fecha', '<', inicioSiguienteMes),
      orderBy('fecha', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<CajaBanco[]>;
  }

  // 🔹 Obtener movimientos de caja banco por mes (global + por caja)
  getMovimientosCajaBancoPorMes(year: number, monthIndex0: number): Observable<MovimientoCajaBanco[]> {
    const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
    const inicioMes = new Date(year, monthIndex0, 1);
    const inicioSiguienteMes = new Date(year, monthIndex0 + 1, 1);
    const q = query(
      movimientosRef,
      where('fecha', '>=', inicioMes),
      where('fecha', '<', inicioSiguienteMes)
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((movimientos: any[]) => {
        return (movimientos || []).sort((a, b) => {
          const timeA = a?.createdAt?.toMillis?.() || 0;
          const timeB = b?.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
      })
    ) as Observable<MovimientoCajaBanco[]>;
  }

  // 🔹 Obtener TODAS las cajas banco (incluyendo desactivadas) - para cálculos totales
  getCajasBancoTodas(): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const q = query(
      cajasRef,
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<CajaBanco[]>;
  }

  // 🔹 Obtener una caja banco por ID
  getCajaBancoById(id: string): Observable<CajaBanco> {
    const cajaDoc = doc(this.firestore, `cajas_banco/${id}`);
    return docData(cajaDoc, { idField: 'id' }) as Observable<CajaBanco>;
  }

  // 🔹 Abrir una nueva caja banco (o actualizar si ya existe para el día)
  async abrirCajaBanco(caja: CajaBanco): Promise<string> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    
    // Normalizar la fecha a medianoche
    const fecha = caja.fecha || new Date();
    const fechaNormalizada = new Date(fecha);
    fechaNormalizada.setHours(0, 0, 0, 0);
    
    // Buscar si ya existe una caja para este día
    const inicioDia = new Date(fechaNormalizada);
    const finDia = new Date(fechaNormalizada);
    finDia.setDate(finDia.getDate() + 1);

    const qMismoDia = query(
      cajasRef,
      where('fecha', '>=', inicioDia),
      where('fecha', '<', finDia)
    );
    const snapMismoDia = await getDocs(qMismoDia);

    // Si ya existe, actualizar; si no, crear
    if (!snapMismoDia.empty) {
      const cajaExistente = snapMismoDia.docs[0];
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaExistente.id}`), {
        saldo_actual: caja.saldo_actual ?? caja.saldo_inicial ?? 0,
        estado: caja.estado || 'ABIERTA',
        usuario_nombre: caja.usuario_nombre,
        observacion: caja.observacion || '',
        updatedAt: Timestamp.now(),
      });
      return cajaExistente.id;
    } else {
      // Crear nueva caja
      const nuevaCaja: CajaBanco = {
        fecha: fechaNormalizada,
        saldo_inicial: caja.saldo_inicial || 0,
        saldo_actual: caja.saldo_actual || caja.saldo_inicial || 0,
        estado: caja.estado || 'ABIERTA',
        usuario_id: caja.usuario_id,
        usuario_nombre: caja.usuario_nombre,
        observacion: caja.observacion || '',
        activo: true, // 🔹 Nueva caja siempre activa
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(cajasRef, nuevaCaja);
      return docRef.id;
    }
  }

  // 🔹 Registrar un movimiento en caja banco
  async registrarMovimiento(movimiento: MovimientoCajaBanco): Promise<string> {
    try {
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
      
      // Si el movimiento es ligado a una caja específica, validar saldo
      if (movimiento.caja_banco_id) {
        const cajaDoc = await getDoc(doc(this.firestore, `cajas_banco/${movimiento.caja_banco_id}`));
        const caja = cajaDoc.data() as CajaBanco;

        if (!caja || caja.estado !== 'ABIERTA') {
          throw new Error('La caja banco no está abierta');
        }

        const saldoAnterior = caja.saldo_actual;
        let nuevoSaldo = saldoAnterior;

        if (movimiento.tipo === 'INGRESO') {
          nuevoSaldo += movimiento.monto;
        } else if (movimiento.tipo === 'EGRESO') {
          nuevoSaldo -= movimiento.monto;
        }

        if (nuevoSaldo < 0) {
          throw new Error('La caja banco no tiene suficiente saldo para este egreso');
        }

        // Registrar movimiento
        const nuevoMovimiento: MovimientoCajaBanco = {
          ...movimiento,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: nuevoSaldo,
          createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(movimientosRef, nuevoMovimiento);

        // Actualizar saldo de la caja
        await updateDoc(doc(this.firestore, `cajas_banco/${movimiento.caja_banco_id}`), {
          saldo_actual: nuevoSaldo,
          updatedAt: Timestamp.now(),
        });

        return docRef.id;
      } else {
        // Si no tiene caja banco asignada, solo registrar sin validar saldo
        const nuevoMovimiento: MovimientoCajaBanco = {
          ...movimiento,
          createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(movimientosRef, nuevoMovimiento);
        return docRef.id;
      }
    } catch (error) {
      throw error;
    }
  }

  // 🔹 Obtener movimientos de caja banco
  getMovimientosCajaBanco(cajaBancoId?: string): Observable<MovimientoCajaBanco[]> {
    const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
    if (cajaBancoId) {
      const q = query(
        movimientosRef,
        where('caja_banco_id', '==', cajaBancoId)
        // Sin orderBy para evitar necesidad de índice compuesto
      );
      return collectionData(q, { idField: 'id' }).pipe(
        map((movimientos: any[]) => {
          return (movimientos || []).sort((a, b) => {
            const timeA = a?.createdAt?.toMillis?.() || 0;
            const timeB = b?.createdAt?.toMillis?.() || 0;
            return timeB - timeA; // descendente
          });
        })
      ) as Observable<MovimientoCajaBanco[]>;
    } else {
      // Si no hay caja específica, obtener todos los movimientos
      const q = query(movimientosRef);
      return collectionData(q, { idField: 'id' }).pipe(
        map((movimientos: any[]) => {
          return (movimientos || []).sort((a, b) => {
            const timeA = a?.createdAt?.toMillis?.() || 0;
            const timeB = b?.createdAt?.toMillis?.() || 0;
            return timeB - timeA; // descendente
          });
        })
      ) as Observable<MovimientoCajaBanco[]>;
    }
  }

  // 🔹 Cerrar una caja banco
  async cerrarCajaBanco(cajaBancoId: string, montoFinal?: number): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`), {
        estado: 'CERRADA',
        cerrado_en: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...(montoFinal !== undefined && { saldo_actual: montoFinal }),
      });
    } catch (error) {
      throw error;
    }
  }

  // 🔹 Obtener resumen de caja banco
  async getResumenCajaBanco(cajaBancoId?: string): Promise<ResumenCajaBanco> {
    try {
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
      let query_obj;
      if (cajaBancoId) {
        query_obj = query(movimientosRef, where('caja_banco_id', '==', cajaBancoId));
      } else {
        query_obj = query(movimientosRef);
      }

      // Usar collectionData en lugar de getDocs para evitar problemas de contexto
      const movimientos = await firstValueFrom(
        collectionData(query_obj, { idField: 'id' })
      ) as MovimientoCajaBanco[];

      let totalIngresos = 0;
      let totalEgresos = 0;
      const ingresosPorCategoria = {
        cierre_caja_chica: 0,
        transferencias_clientes: 0,
        otros_ingresos: 0,
      };
      const egresosPorCategoria = {
        pagos_trabajadores: 0,
        otros_egresos: 0,
      };

      (movimientos || []).forEach(movimiento => {
        if (movimiento.tipo === 'INGRESO') {
          totalIngresos += movimiento.monto;
          if (movimiento.categoria === 'CIERRE_CAJA_CHICA') {
            ingresosPorCategoria.cierre_caja_chica += movimiento.monto;
          } else if (movimiento.categoria === 'TRANSFERENCIA_CLIENTE') {
            ingresosPorCategoria.transferencias_clientes += movimiento.monto;
          } else {
            ingresosPorCategoria.otros_ingresos += movimiento.monto;
          }
        } else {
          totalEgresos += movimiento.monto;
          if (movimiento.categoria === 'PAGO_TRABAJADOR') {
            egresosPorCategoria.pagos_trabajadores += movimiento.monto;
          } else {
            egresosPorCategoria.otros_egresos += movimiento.monto;
          }
        }
      });

      let saldoFinal = totalIngresos - totalEgresos;
      if (cajaBancoId) {
        const cajaDoc = await getDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`));
        const caja = cajaDoc.data() as CajaBanco;
        saldoFinal = caja.saldo_actual;
      }

      return {
        caja_id: cajaBancoId,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        saldo_final: saldoFinal,
        cantidad_movimientos: (movimientos || []).length,
        ingresos_por_categoria: ingresosPorCategoria,
        egresos_por_categoria: egresosPorCategoria,
      };
    } catch (error) {
      throw error;
    }
  }

  // 🔹 Eliminar un movimiento
  async eliminarMovimiento(cajaBancoId: string, movimientoId: string): Promise<void> {
    try {
      const movimientoDoc = await getDoc(doc(this.firestore, `movimientos_cajas_banco/${movimientoId}`));
      const movimiento = movimientoDoc.data() as MovimientoCajaBanco;

      // Revertir efecto del movimiento
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`));
      const caja = cajaDoc.data() as CajaBanco;

      let nuevoSaldo = caja.saldo_actual;
      if (movimiento.tipo === 'INGRESO') {
        nuevoSaldo -= movimiento.monto;
      } else {
        nuevoSaldo += movimiento.monto;
      }

      // Actualizar caja
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`), {
        saldo_actual: nuevoSaldo,
        updatedAt: Timestamp.now(),
      });

      // Eliminar movimiento
      await deleteDoc(doc(this.firestore, `movimientos_cajas_banco/${movimientoId}`));
    } catch (error) {
      throw error;
    }
  }

  // 🔹 Registrar un cierre de Caja Chica en Caja Banco
  async registrarCierreCajaChica(
    cajaBancoId: string,
    cajaChicaId: string,
    monto: number,
    usuarioId?: string,
    usuarioNombre?: string
  ): Promise<string> {
    const movimiento: MovimientoCajaBanco = {
      caja_banco_id: cajaBancoId,
      fecha: new Date(),
      tipo: 'INGRESO',
      categoria: 'CIERRE_CAJA_CHICA',
      descripcion: `Cierre de Caja Chica del día`,
      monto,
      referencia: cajaChicaId,
      caja_chica_id: cajaChicaId,
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
    };

    return this.registrarMovimiento(movimiento);
  }

  // 🔹 Registrar una transferencia de cliente
  async registrarTransferenciaCliente(
    monto: number,
    codigoTransferencia: string,
    ventaId: string,
    usuarioId?: string,
    usuarioNombre?: string
  ): Promise<string> {
    const movimiento: MovimientoCajaBanco = {
      fecha: new Date(),
      tipo: 'INGRESO',
      categoria: 'TRANSFERENCIA_CLIENTE',
      descripcion: `Transferencia de cliente - Venta #${ventaId}`,
      monto,
      referencia: codigoTransferencia,
      venta_id: ventaId,
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
    };

    return this.registrarMovimiento(movimiento);
  }

  // 🔹 Actualizar saldo de caja banco (para restar monto cuando se elimina caja chica)
  async actualizarSaldoCajaBanco(cajaBancoId: string, nuevoSaldo: number): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`), {
        saldo_actual: nuevoSaldo,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al actualizar saldo de caja banco:', error);
      throw error;
    }
  }

  // 🔹 Desactivar una caja banco (SOFT DELETE)
  async desactivarCajaBanco(cajaBancoId: string): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`), {
        activo: false,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al desactivar caja banco:', error);
      throw error;
    }
  }

  // 🔹 Reactivar una caja banco (reversible)
  async activarCajaBanco(cajaBancoId: string): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`), {
        activo: true,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al activar caja banco:', error);
      throw error;
    }
  }

  // 🔹 Eliminar una caja banco completa (SOFT DELETE)
  async eliminarCajaBanco(cajaBancoId: string): Promise<void> {
    try {
      // 🔹 SOFT DELETE: Solo marcar como inactivo
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`), {
        activo: false,
        updatedAt: Timestamp.now(),
      });
      console.log('✅ Caja banco desactivada (soft delete):', cajaBancoId);
    } catch (error) {
      console.error('Error al desactivar caja banco:', error);
      throw error;
    }
  }

  // 🔹 Cerrar mes completo y abrir nuevo periodo
  async cerrarMesCompleto(year: number, monthIndex0: number): Promise<void> {
    try {
      // 1. Obtener todas las cajas banco del mes
      const inicioMes = new Date(year, monthIndex0, 1);
      const inicioSiguienteMes = new Date(year, monthIndex0 + 1, 1);
      
      const cajasRef = collection(this.firestore, 'cajas_banco');
      const q = query(
        cajasRef,
        where('fecha', '>=', inicioMes),
        where('fecha', '<', inicioSiguienteMes)
      );
      
      const snapshot = await getDocs(q);
      
      // 2. Cerrar todas las cajas del mes (filtrar activas en código)
      const promises = snapshot.docs
        .filter(docSnap => {
          const caja = docSnap.data() as CajaBanco;
          return caja.activo !== false && caja.estado === 'ABIERTA';
        })
        .map(async (docSnap) => {
          const caja = docSnap.data() as CajaBanco;
          await this.cerrarCajaBanco(docSnap.id, caja.saldo_actual);
        });
      
      await Promise.all(promises);
      
      // 3. Crear nueva caja banco para el mes actual
      const hoy = new Date();
      const inicioDiaActual = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);
      
      // Verificar si ya existe caja para hoy
      const cajasHoyRef = collection(this.firestore, 'cajas_banco');
      const qHoy = query(
        cajasHoyRef,
        where('fecha', '>=', inicioDiaActual),
        where('fecha', '<', new Date(inicioDiaActual.getTime() + 24 * 60 * 60 * 1000))
      );
      
      const snapshotHoy = await getDocs(qHoy);
      const cajasActivasHoy = snapshotHoy.docs.filter(doc => {
        const caja = doc.data() as CajaBanco;
        return caja.activo !== false;
      });
      
      if (cajasActivasHoy.length === 0) {
        // No existe caja para hoy, crear una nueva
        await this.abrirCajaBanco({
          fecha: inicioDiaActual,
          saldo_inicial: 0,
          saldo_actual: 0,
          estado: 'ABIERTA',
          observacion: `Caja banco creada automáticamente al cerrar mes de ${this.getNombreMes(monthIndex0)} ${year}`
        });
      }
      
      console.log('✅ Mes cerrado y nueva caja banco creada');
    } catch (error) {
      console.error('Error al cerrar mes completo:', error);
      throw error;
    }
  }

  private getNombreMes(index: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[index] || '';
  }
}
