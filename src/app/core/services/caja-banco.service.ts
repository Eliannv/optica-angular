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
import { map, switchMap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { CajaBanco, MovimientoCajaBanco, ResumenCajaBanco } from '../models/caja-banco.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class CajaBancoService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // 🔹 Obtener todas las cajas banco (SOLO ACTIVAS)
  getCajasBanco(): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    // Obtener todas las cajas sin filtros de desigualdad para evitar requerir índices
    const q = query(
      cajasRef,
      orderBy('fecha', 'desc')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        // Filtrar cajas activas en memoria
        const cajasActivas = (cajas || []).filter(c => c.activo !== false);
        
        // 🔄 Verificar automáticamente si hay cajas que deben cerrarse (después de 1 mes)
        this.verificarYCerrarCajasVencidas(cajasActivas);
        
        return cajasActivas;
      })
    ) as Observable<CajaBanco[]>;
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

  // 🔹 Verificar si existe al menos una caja banco en el sistema
  existeAlMenosUnaCajaBanco(): Observable<boolean> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const q = query(cajasRef);
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        return cajas && cajas.length > 0;
      })
    );
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
      // Determinar saldo_inicial:
      // 1. Si se proporciona explícitamente, usarlo
      // 2. Si no, buscar la caja anterior cerrada (auto-herencia)
      let saldoInicial = caja.saldo_inicial !== undefined && caja.saldo_inicial !== null 
        ? caja.saldo_inicial 
        : undefined;
      
      // Si no se proporciono saldo_inicial, intentar heredar del mes anterior
      if (saldoInicial === undefined) {
        const mesAnterior = new Date(fechaNormalizada);
        mesAnterior.setMonth(mesAnterior.getMonth() - 1);
        
        const inicioMesAnterior = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1);
        const inicioMesActual = new Date(fechaNormalizada.getFullYear(), fechaNormalizada.getMonth(), 1);
        
        const qMesAnterior = query(
          cajasRef,
          where('fecha', '>=', inicioMesAnterior),
          where('fecha', '<', inicioMesActual),
          where('estado', '==', 'CERRADA')
        );
        
        const snapMesAnterior = await getDocs(qMesAnterior);
        if (!snapMesAnterior.empty) {
          // Obtener la caja más reciente del mes anterior (cerrada)
          const cajasOrdenadas = snapMesAnterior.docs
            .map(doc => doc.data() as CajaBanco)
            .sort((a, b) => {
              const timeA = (a.fecha as any).toMillis?.() || 0;
              const timeB = (b.fecha as any).toMillis?.() || 0;
              return timeB - timeA;
            });
          
          if (cajasOrdenadas.length > 0) {
            saldoInicial = cajasOrdenadas[0].saldo_actual || 0;
          }
        }
      }
      
      // Si aún no hay saldo, usar 0
      if (saldoInicial === undefined) {
        saldoInicial = 0;
      }
      
      // Crear nueva caja
      const nuevaCaja: CajaBanco = {
        fecha: fechaNormalizada,
        saldo_inicial: saldoInicial,
        saldo_actual: saldoInicial,
        estado: caja.estado || 'ABIERTA',
        usuario_id: caja.usuario_id,
        usuario_nombre: caja.usuario_nombre,
        observacion: caja.observacion || '',
        activo: true,
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
      
      console.log('📝 Registrando movimiento:', {
        caja_banco_id: movimiento.caja_banco_id,
        tipo: movimiento.tipo,
        monto: movimiento.monto,
        categoria: movimiento.categoria
      });
      
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

        console.log('✅ Movimiento a guardar con caja_banco_id:', nuevoMovimiento.caja_banco_id);

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
      // Obtener movimientos con caja_banco_id específica
      const q = query(
        movimientosRef,
        where('caja_banco_id', '==', cajaBancoId)
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
      
      // 2. Encontrar la caja ABIERTA del mes
      let cajaCerrada: CajaBanco | undefined = undefined;
      let cajaCerradaId: string | undefined = undefined;
      
      const cajasAbertas = snapshot.docs.filter(docSnap => {
        const caja = docSnap.data() as CajaBanco;
        return caja.activo !== false && caja.estado === 'ABIERTA';
      });
      
      // 3. Cerrar todas las cajas ABIERTA del mes
      for (const docSnap of cajasAbertas) {
        const caja = docSnap.data() as CajaBanco;
        cajaCerrada = caja;
        cajaCerradaId = docSnap.id;
        await this.cerrarCajaBanco(docSnap.id, caja.saldo_actual);
      }
      
      // 4. Crear nueva caja banco para el mes siguiente
      if (cajaCerrada && cajaCerradaId) {
        const siguienteMes = new Date(year, monthIndex0 + 1, 1);
        const inicioDiaSiguienteMes = new Date(siguienteMes.getFullYear(), siguienteMes.getMonth(), 1, 0, 0, 0, 0);
        
        // Verificar si ya existe caja para el primer día del mes siguiente
        const cajasProximaMesRef = collection(this.firestore, 'cajas_banco');
        const qProximaMes = query(
          cajasProximaMesRef,
          where('fecha', '>=', inicioDiaSiguienteMes),
          where('fecha', '<', new Date(inicioDiaSiguienteMes.getTime() + 24 * 60 * 60 * 1000))
        );
        
        const snapshotProximaMes = await getDocs(qProximaMes);
        const cajasProximaMes = snapshotProximaMes.docs.filter(doc => {
          const caja = doc.data() as CajaBanco;
          return caja.activo !== false;
        });
        
        if (cajasProximaMes.length === 0) {
          // No existe caja para el mes siguiente, crear una nueva con el saldo final de la caja cerrada
          const usuarioActual = this.authService.getCurrentUser();
          const saldoInicial = cajaCerrada.saldo_actual || 0;
          
          await this.abrirCajaBanco({
            fecha: inicioDiaSiguienteMes,
            saldo_inicial: saldoInicial,
            saldo_actual: saldoInicial,
            estado: 'ABIERTA',
            usuario_id: usuarioActual?.id,
            usuario_nombre: usuarioActual?.nombre || 'Sistema',
            observacion: `Caja banco creada automáticamente. Saldo anterior: ${saldoInicial}`
          } as CajaBanco);
        }
      }
      
      console.log('✅ Mes cerrado y nueva caja banco creada automáticamente');
    } catch (error) {
      console.error('Error al cerrar mes completo:', error);
      throw error;
    }
  }

  private getNombreMes(index: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[index] || '';
  }

  // 🔹 Asociar movimientos antiguos a cajas banco por fecha
  async asociarMovimientosAntiguos(cajaBancoId: string): Promise<void> {
    try {
      const cajaDoc = await getDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`));
      if (!cajaDoc.exists()) return;

      const caja = cajaDoc.data() as CajaBanco;
      const cajaFecha = caja.fecha instanceof Date ? caja.fecha : (caja.fecha as any).toDate?.() || new Date(caja.fecha);
      
      const inicioDelDia = new Date(cajaFecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      const finDelDia = new Date(inicioDelDia);
      finDelDia.setDate(finDelDia.getDate() + 1);

      // Obtener todos los movimientos del mismo día sin caja_banco_id
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
      const snapshot = await getDocs(movimientosRef);
      
      const batch: Promise<void>[] = [];
      snapshot.docs.forEach((docSnap) => {
        const mov = docSnap.data() as MovimientoCajaBanco;
        if (!mov.caja_banco_id && mov.fecha) {
          const movFecha = mov.fecha instanceof Date ? mov.fecha : (mov.fecha as any).toDate?.() || new Date(mov.fecha);
          movFecha.setHours(0, 0, 0, 0);
          
          if (movFecha.getTime() === inicioDelDia.getTime()) {
            batch.push(
              updateDoc(doc(this.firestore, `movimientos_cajas_banco/${docSnap.id}`), {
                caja_banco_id: cajaBancoId,
              })
            );
          }
        }
      });

      await Promise.all(batch);
    } catch (error) {
      console.error('Error asociando movimientos antiguos:', error);
    }
  }

  // 🔄 Verificar automáticamente si hay cajas ABIERTA que hayan cumplido 1 mes y cerrarlas
  private async verificarYCerrarCajasVencidas(cajas: CajaBanco[]): Promise<void> {
    try {
      const ahora = new Date();
      const cajasAbertas = cajas.filter(c => c.estado === 'ABIERTA');

      for (const caja of cajasAbertas) {
        // Calcular si ha pasado 1 mes desde la apertura
        const fechaCaja = (caja.fecha as any).toDate?.() || new Date(caja.fecha);
        const fechaVencimiento = new Date(fechaCaja);
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);

        // Si la caja cumplió 1 mes y estamos en un mes diferente, cerrar automáticamente
        if (ahora.getTime() >= fechaVencimiento.getTime() && ahora.getMonth() !== fechaCaja.getMonth()) {
          console.log(`⏰ Cerrando automáticamente caja de ${fechaCaja.toLocaleDateString()}`);
          
          const year = fechaCaja.getFullYear();
          const mes = fechaCaja.getMonth();
          
          // Cerrar el mes completo (esto cierra la caja y crea la nueva)
          await this.cerrarMesCompleto(year, mes);
        }
      }
    } catch (error) {
      console.error('Error verificando cajas vencidas:', error);
      // No lanzar el error para que no interfiera con la carga de datos
    }
  }
}
