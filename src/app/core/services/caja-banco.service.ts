/**
 * Gestiona el ciclo de vida completo de las cajas banco mensuales del sistema financiero.
 * Maneja movimientos bancarios de alto nivel como transferencias de clientes, pagos con tarjeta,
 * cierres consolidados de cajas chicas diarias y otros movimientos que no se realizan en efectivo.
 *
 * Este servicio implementa:
 * - Apertura y cierre de cajas banco mensuales (manual o automático)
 * - Creación histórica: permite crear cajas con fechas pasadas
 * - Asociación por periodo (mes/año) en lugar de día exacto
 * - Registro de movimientos con trazabilidad de saldos (anterior/nuevo)
 * - Categorización de ingresos y egresos para reportes
 * - Herencia automática de saldos entre periodos cronológicos
 * - Validación de cajas ABIERTA para operaciones
 * - Soft delete para preservar historial
 * - Búsqueda eficiente de caja banco por periodo
 *
 * Los datos se persisten en 'cajas_banco' y 'movimientos_cajas_banco' de Firestore.
 * Se integra estrechamente con CajaChicaService para registrar los cierres diarios.
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
import { 
  normalizarFecha, 
  obtenerPeriodo, 
  mismoPeriodo, 
  rangoPeriodo,
  periodoAnterior,
  Periodo
} from '../utils/fecha-helpers';

@Injectable({
  providedIn: 'root',
})
export class CajaBancoService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  /**
   * Recupera todas las cajas banco activas del sistema ordenadas por fecha descendente.
   * Filtra automáticamente las cajas desactivadas (soft delete) en memoria y ejecuta
   * validación automática para cerrar cajas vencidas (mayores a 1 mes).
   *
   * @returns Observable<CajaBanco[]> Stream reactivo con las cajas banco activas.
   */
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
        
        // ❌ CIERRE AUTOMÁTICO DESHABILITADO - Ahora el cierre es MANUAL
        // El usuario debe cerrar las cajas manualmente cuando lo decida
        // this.verificarYCerrarCajasVencidas(cajasActivas);
        
        return cajasActivas;
      })
    ) as Observable<CajaBanco[]>;
  }
  /**
   * Recupera todas las cajas banco de un mes específico.
   * Utiliza un rango de fechas para consultas eficientes en Firestore.
   *
   * @param year Año calendario (ej: 2026).
   * @param monthIndex0 Índice del mes base 0 (0=Enero, 11=Diciembre).
   * @returns Observable<CajaBanco[]> Stream con las cajas del mes especificado.
   */
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

  /**
   * Recupera todos los movimientos de caja banco de un mes específico.
   * Los resultados se ordenan por timestamp de creación descendente en el cliente.
   *
   * @param year Año calendario.
   * @param monthIndex0 Índice del mes base 0.
   * @returns Observable<MovimientoCajaBanco[]> Stream con los movimientos del mes.
   */
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

  // Obtener TODAS las cajas banco (incluyendo desactivadas) - para cálculos totales
  getCajasBancoTodas(): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const q = query(
      cajasRef,
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<CajaBanco[]>;
  }

  // Obtener una caja banco por ID
  getCajaBancoById(id: string): Observable<CajaBanco> {
    const cajaDoc = doc(this.firestore, `cajas_banco/${id}`);
    return docData(cajaDoc, { idField: 'id' }) as Observable<CajaBanco>;
  }

  /**
   * Obtiene CUALQUIER caja banco ABIERTA (sin importar el periodo/mes).
   * Útil para registrar movimientos cuando se trabaja con cajas históricas.
   * 
   * @returns Promise<CajaBanco | null> Primera caja ABIERTA encontrada (más reciente) o null.
   */
  async getCajaBancoAbierta(): Promise<CajaBanco | null> {
    try {
      const cajasRef = collection(this.firestore, 'cajas_banco');
      const q = query(
        cajasRef,
        where('estado', '==', 'ABIERTA')
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Filtrar manualmente las cajas activas y ordenar por fecha
        const cajasActivas = snapshot.docs
          .map(doc => {
            const data = doc.data() as CajaBanco;
            data.id = doc.id;
            return data;
          })
          .filter(caja => caja.activo !== false)
          .sort((a, b) => {
            const fechaA = a.fecha instanceof Date ? a.fecha : (a.fecha as any).toDate?.() || new Date(a.fecha);
            const fechaB = b.fecha instanceof Date ? b.fecha : (b.fecha as any).toDate?.() || new Date(b.fecha);
            return fechaB.getTime() - fechaA.getTime(); // Descendente (más reciente primero)
          });
        
        return cajasActivas.length > 0 ? cajasActivas[0] : null;
      }
      
      return null;
    } catch (err) {
      console.error('Error al obtener caja banco abierta:', err);
      return null;
    }
  }

  /**
   * Obtiene la caja banco ABIERTA del mes actual.
   * Realiza búsqueda por rango de fecha y filtra en memoria por estado y soft delete.
   * Este método es crítico para operaciones que requieren una caja activa.
   *
   * @returns Promise<CajaBanco | null> Caja banco abierta o null si no existe.
   */
  async getCajaBancoActivaMes(): Promise<CajaBanco | null> {
    const hoy = new Date();
    const periodo = obtenerPeriodo(hoy);
    return this.getCajaBancoPorPeriodo(periodo.year, periodo.monthIndex0);
  }

  /**
   * Obtiene la caja banco ABIERTA de un periodo específico (mes/año).
   * Permite buscar cajas históricas por periodo, no solo del mes actual.
   * 
   * @param year Año del periodo.
   * @param monthIndex0 Mes del periodo (base 0: 0=Enero, 11=Diciembre).
   * @returns Promise<CajaBanco | null> Caja banco abierta del periodo o null.
   */
  async getCajaBancoPorPeriodo(year: number, monthIndex0: number): Promise<CajaBanco | null> {
    try {
      const { inicio, fin } = rangoPeriodo(year, monthIndex0);

      const cajasRef = collection(this.firestore, 'cajas_banco');
      const q = query(
        cajasRef,
        where('fecha', '>=', inicio),
        where('fecha', '<', fin)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.warn(`⚠️ No hay caja banco para el periodo ${year}-${monthIndex0 + 1}`);
        return null;
      }

      // Filtrar en memoria: solo activas y ABIERTA
      const cajasValidas = snapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as CajaBanco))
        .filter(c => c.activo !== false && c.estado === 'ABIERTA');

      if (cajasValidas.length === 0) {
        console.warn(`⚠️ No hay caja banco ABIERTA para el periodo ${year}-${monthIndex0 + 1}`);
        return null;
      }

      // Retornar la primera caja abierta encontrada (usualmente solo hay una por mes)
      return cajasValidas[0];
    } catch (error) {
      console.error('Error obteniendo caja banco por periodo:', error);
      throw error;
    }
  }

  // Verificar si existe al menos una caja banco en el sistema
  existeAlMenosUnaCajaBanco(): Observable<boolean> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const q = query(cajasRef);
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        return cajas && cajas.length > 0;
      })
    );
  }

  /**
   * Abre una nueva caja banco con fecha manual (histórica o actual).
   * Implementa herencia automática de saldo desde el periodo anterior cerrado cronológicamente.
   *
   * NUEVO COMPORTAMIENTO:
   * - Acepta cualquier fecha (pasada, presente)
   * - La caja representa TODO el mes/año de la fecha
   * - Busca la última caja banco CERRADA cronológicamente anterior
   * - Hereda automáticamente el saldo final como saldo inicial
   * - Permite override manual del saldo inicial si se proporciona
   *
   * Proceso:
   * 1. Normaliza la fecha a medianoche (día 1 del mes)
   * 2. Valida que no exista caja ABIERTA para ese periodo
   * 3. Busca la última caja cerrada cronológicamente anterior
   * 4. Hereda saldo o usa el proporcionado manualmente
   * 5. Crea la caja banco para ese periodo
   *
   * @param caja Datos de la caja banco (fecha manual requerida).
   * @returns Promise<string> ID de la caja creada.
   */
  async abrirCajaBanco(caja: CajaBanco): Promise<string> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    
    // Normalizar la fecha a medianoche del día 1 del mes
    const fecha = caja.fecha || new Date();
    const fechaNormalizada = normalizarFecha(fecha);
    const periodo = obtenerPeriodo(fechaNormalizada);
    
    // Usar día 1 del mes con la HORA ACTUAL (para trazabilidad histórica)
    const ahora = new Date();
    const fechaCajaBanco = new Date(
      periodo.year, 
      periodo.monthIndex0, 
      1, 
      ahora.getHours(), 
      ahora.getMinutes(), 
      ahora.getSeconds(), 
      ahora.getMilliseconds()
    );
    
    console.log(`📅 Creando caja banco para periodo: ${periodo.year}-${periodo.monthIndex1.toString().padStart(2, '0')}`);
    
    // VALIDACIÓN 1: Verificar que NO haya ninguna caja banco ABIERTA
    const qCajasAbiertas = query(
      cajasRef,
      where('estado', '==', 'ABIERTA')
    );
    const snapCajasAbiertas = await getDocs(qCajasAbiertas);
    
    const cajasAbiertas = snapCajasAbiertas.docs.filter(doc => {
      const c = doc.data() as CajaBanco;
      return c.activo !== false;
    });
    
    if (cajasAbiertas.length > 0) {
      const cajaAbierta = cajasAbiertas[0].data() as CajaBanco;
      const periodoAbierto = obtenerPeriodo(cajaAbierta.fecha);
      throw new Error(`Ya existe una caja banco ABIERTA para el periodo ${periodoAbierto.year}-${periodoAbierto.monthIndex1.toString().padStart(2, '0')}. Debes cerrarla antes de crear una nueva.`);
    }
    
    // VALIDACIÓN 2: Verificar que NO exista ya una caja para este periodo específico (ABIERTA o CERRADA)
    const { inicio, fin } = rangoPeriodo(periodo.year, periodo.monthIndex0);
    const qMismoPeriodo = query(
      cajasRef,
      where('fecha', '>=', inicio),
      where('fecha', '<', fin)
    );
    const snapMismoPeriodo = await getDocs(qMismoPeriodo);
    
    // Buscar TODAS las cajas activas del mismo periodo
    const cajasExistentes = snapMismoPeriodo.docs.filter(doc => {
      const c = doc.data() as CajaBanco;
      return c.activo !== false;
    });
    
    if (cajasExistentes.length > 0) {
      const estadoCaja = cajasExistentes[0].data() as CajaBanco;
      throw new Error(`Ya existe una caja banco para el periodo ${periodo.year}-${periodo.monthIndex1.toString().padStart(2, '0')} (Estado: ${estadoCaja.estado})`);
    }
    
    // Determinar saldo_inicial:
    // 1. Si se proporciona explícitamente (y es > 0), usarlo (creación inicial/manual)
    // 2. Si no, buscar la última caja CERRADA cronológicamente anterior
    let saldoInicial: number | undefined = undefined;
    
    // Solo usar saldo_inicial si es un número válido > 0 o exactamente 0 (inicio sin fondos)
    if (caja.saldo_inicial !== undefined && caja.saldo_inicial !== null && typeof caja.saldo_inicial === 'number') {
      saldoInicial = caja.saldo_inicial;
      console.log(`💵 Usando saldo inicial manual: ${saldoInicial}`);
    } else {
      // Buscar herencia de periodo anterior
      console.log('🔍 Buscando saldo de periodo anterior...');
      saldoInicial = await this.obtenerSaldoInicialDesdePeriodoAnterior(fechaCajaBanco);
    }
    
    // Si aún no hay saldo (primera caja del sistema), usar 0
    if (saldoInicial === undefined || saldoInicial === null) {
      saldoInicial = 0;
    }
    
    console.log(`💰 Saldo inicial determinado: ${saldoInicial}`);
    
    // Crear nueva caja banco para el periodo
    const nuevaCaja: CajaBanco = {
      fecha: fechaCajaBanco,
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
    console.log(`✅ Caja banco creada exitosamente con ID: ${docRef.id}`);
    
    return docRef.id;
  }

  /**
   * Obtiene el saldo final de la última caja banco CERRADA cronológicamente anterior a una fecha.
   * Busca en TODAS las cajas banco cerradas y retorna el saldo de la más reciente.
   * 
   * @param fechaReferencia Fecha de referencia para buscar periodos anteriores.
   * @returns Promise<number | undefined> Saldo final de la caja anterior o undefined.
   */
  private async obtenerSaldoInicialDesdePeriodoAnterior(fechaReferencia: Date): Promise<number | undefined> {
    try {
      const cajasRef = collection(this.firestore, 'cajas_banco');
      
      console.log(`🔍 Buscando cajas cerradas anteriores a ${fechaReferencia.toISOString()}`);
      
      // Obtener TODAS las cajas banco (sin filtros complejos para evitar problemas de índice)
      const q = query(cajasRef, where('estado', '==', 'CERRADA'));
      const snapshot = await getDocs(q);
      
      console.log(`📋 Encontradas ${snapshot.size} cajas cerradas en total`);
      
      if (snapshot.empty) {
        console.log('ℹ️ No hay cajas banco cerradas. Es la primera caja.');
        return undefined;
      }
      
      // Filtrar manualmente: activas, anteriores a fechaReferencia, ordenar cronológicamente
      const cajasAnteriores = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as CajaBanco))
        .filter(c => {
          const esActiva = c.activo !== false;
          const fechaCaja = normalizarFecha(c.fecha);
          const esAnterior = fechaCaja.getTime() < fechaReferencia.getTime();
          
          console.log(`  📦 Caja ${c.id}: ${fechaCaja.toISOString().split('T')[0]} - Activa: ${esActiva}, Anterior: ${esAnterior}, Saldo: ${c.saldo_actual}`);
          
          return esActiva && esAnterior;
        })
        .sort((a, b) => {
          const fechaA = normalizarFecha(a.fecha);
          const fechaB = normalizarFecha(b.fecha);
          return fechaB.getTime() - fechaA.getTime(); // Descendente (más reciente primero)
        });
      
      console.log(`✔️ ${cajasAnteriores.length} cajas cerradas válidas encontradas`);
      
      if (cajasAnteriores.length > 0) {
        const cajaAnterior = cajasAnteriores[0];
        const periodoAnterior = obtenerPeriodo(cajaAnterior.fecha);
        const saldoHeredado = cajaAnterior.saldo_actual ?? 0;
        
        console.log(`✅ Heredando saldo de periodo anterior: ${periodoAnterior.year}-${periodoAnterior.monthIndex1.toString().padStart(2, '0')} (${normalizarFecha(cajaAnterior.fecha).toISOString().split('T')[0]}) → ${saldoHeredado} USD`);
        
        return saldoHeredado;
      }
      
      console.log('⚠️ No se encontraron cajas anteriores válidas');
      return undefined;
    } catch (error) {
      console.error('❌ Error obteniendo saldo de periodo anterior:', error);
      return undefined;
    }
  }

  /**
   * Registra un movimiento financiero en la caja banco.
   * Valida que la caja esté ABIERTA, calcula nuevos saldos y actualiza la caja automáticamente.
   *
   * Flujo:
   * 1. Si tiene caja_banco_id: Valida estado ABIERTA
   * 2. Calcula nuevo saldo (+ ingreso / - egreso)
   * 3. Valida que no quede en negativo
   * 4. Registra movimiento con trazabilidad de saldos
   * 5. Actualiza saldo_actual de la caja
   *
   * @param movimiento Datos del movimiento a registrar.
   * @returns Promise<string> ID del movimiento creado.
   * @throws Error si la caja no existe, está cerrada o hay saldo insuficiente.
   */
  async registrarMovimiento(movimiento: MovimientoCajaBanco): Promise<string> {
    try {
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
      
      console.log('📝 Registrando movimiento:', {
        caja_banco_id: movimiento.caja_banco_id,
        tipo: movimiento.tipo,
        monto: movimiento.monto,
        categoria: movimiento.categoria
      });
      
      // Si el movimiento es ligado a una caja específica, validar que esté ABIERTA
      if (movimiento.caja_banco_id) {
        const cajaDoc = await getDoc(doc(this.firestore, `cajas_banco/${movimiento.caja_banco_id}`));
        const caja = cajaDoc.data() as CajaBanco;

        if (!caja) {
          throw new Error('La caja banco no existe');
        }

        if (caja.estado !== 'ABIERTA') {
          throw new Error(`❌ No se pueden registrar movimientos. La caja banco está ${caja.estado}. Solo se puede imprimir.`);
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

  /**
   * Cierra una caja banco cambiando su estado a CERRADA.
   * Opcionalmente permite ajustar el monto final.
   *
   * @param cajaBancoId ID de la caja a cerrar.
   * @param montoFinal Monto final opcional para ajuste de cierre.
   * @returns Promise<void> Se resuelve cuando el cierre se completa.
   */
  async cerrarCajaBanco(cajaBancoId: string, montoFinal?: number): Promise<void> {
    try {
      // Obtener usuario actual
      const usuarioActual = this.authService.getCurrentUser();
      
      await updateDoc(doc(this.firestore, `cajas_banco/${cajaBancoId}`), {
        estado: 'CERRADA',
        cerrado_en: Timestamp.now(),
        cerrado_por_id: usuarioActual?.id || '',
        cerrado_por_nombre: usuarioActual?.nombre || 'Usuario',
        updatedAt: Timestamp.now(),
        ...(montoFinal !== undefined && { saldo_actual: montoFinal }),
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Genera un resumen consolidado de los movimientos de una caja banco.
   * Calcula totales por tipo, categoría y balance final para reportes y auditoría.
   *
   * Incluye:
   * - Total de ingresos y egresos
   * - Saldo final actual
   * - Cantidad de movimientos
   * - Desglose por categoría (cierres, transferencias, pagos, etc.)
   *
   * @param cajaBancoId ID de la caja (opcional, si no se provee resume todos los movimientos).
   * @returns Promise<ResumenCajaBanco> Objeto con los totales calculados.
   */
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

  // Eliminar un movimiento
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

  /**
   * Registra el cierre de una caja chica como ingreso en la caja banco.
   * Este método se llama automáticamente cuando se cierra una caja chica diaria.
   *
   * @param cajaBancoId ID de la caja banco destino.
   * @param cajaChicaId ID de la caja chica que se cierra.
   * @param monto Monto final de la caja chica.
   * @param usuarioId ID del usuario que realiza el cierre.
   * @param usuarioNombre Nombre del usuario.
   * @returns Promise<string> ID del movimiento creado.
   */
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

  /**
   * Registra una transferencia bancaria de cliente como ingreso en cualquier caja banco ABIERTA.
   * Busca automáticamente la caja banco ABIERTA más reciente (puede ser histórica).
   *
   * @param monto Monto transferido.
   * @param codigoTransferencia Número de referencia de la transferencia.
   * @param ventaId ID de la venta asociada.
   * @param usuarioId ID del usuario que registra.
   * @param usuarioNombre Nombre del usuario.
   * @returns Promise<string> ID del movimiento creado.
   * @throws Error si no hay ninguna caja banco abierta.
   */
  async registrarTransferenciaCliente(
    monto: number,
    codigoTransferencia: string,
    ventaId: string,
    usuarioId?: string,
    usuarioNombre?: string,
    fecha?: Date
  ): Promise<string> {
    // Obtener CUALQUIER caja banco ABIERTA (histórica o actual)
    const cajaBancoActiva = await this.getCajaBancoAbierta();
    
    if (!cajaBancoActiva || !cajaBancoActiva.id) {
      throw new Error('No hay ninguna caja banco abierta. No se puede registrar la transferencia.');
    }

    const movimiento: MovimientoCajaBanco = {
      caja_banco_id: cajaBancoActiva.id,
      fecha: fecha || new Date(),  // Usar fecha proporcionada o actual
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

  // Registrar un pago por tarjeta de cliente
  async registrarPagoTarjeta(
    monto: number,
    ultimos4Digitos: string,
    ventaId: string,
    usuarioId?: string,
    usuarioNombre?: string,
    fecha?: Date
  ): Promise<string> {
    // Obtener CUALQUIER caja banco ABIERTA (histórica o actual)
    const cajaBancoActiva = await this.getCajaBancoAbierta();
    
    if (!cajaBancoActiva || !cajaBancoActiva.id) {
      throw new Error('No hay ninguna caja banco abierta. No se puede registrar el pago por tarjeta.');
    }

    const movimiento: MovimientoCajaBanco = {
      caja_banco_id: cajaBancoActiva.id,
      fecha: fecha || new Date(),  // Usar fecha proporcionada o actual
      tipo: 'INGRESO',
      categoria: 'TRANSFERENCIA_CLIENTE', // Se usa la misma categoría que transferencias
      descripcion: `Pago por tarjeta - Venta #${ventaId} (Últimos 4 dígitos: ${ultimos4Digitos})`,
      monto,
      referencia: `TARJETA_${ultimos4Digitos}`,
      venta_id: ventaId,
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
    };

    return this.registrarMovimiento(movimiento);
  }

  // Actualizar saldo de caja banco (para restar monto cuando se elimina caja chica)
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

  // Desactivar una caja banco (SOFT DELETE)
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

  // Reactivar una caja banco (reversible)
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

  // Eliminar una caja banco completa (SOFT DELETE)
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

  /**
   * Cierra todas las cajas banco abiertas de un mes y crea automáticamente
   * la caja del mes siguiente heredando el saldo final.
   *
   * Proceso:
   * 1. Encuentra todas las cajas ABIERTA del mes especificado
   * 2. Cierra cada caja encontrada
   * 3. Verifica si ya existe caja para el mes siguiente
   * 4. Si no existe, crea nueva caja con saldo heredado
   *
   * @param year Año del mes a cerrar.
   * @param monthIndex0 Índice del mes a cerrar (base 0).
   * @returns Promise<void> Se resuelve cuando el cierre y creación se completan.
   */
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

  // Asociar movimientos antiguos a cajas banco por fecha
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

  // Verificar automáticamente si hay cajas ABIERTA que hayan cumplido 1 mes y cerrarlas
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
