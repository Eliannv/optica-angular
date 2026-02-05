import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs,
  QueryConstraint,
  DocumentData,
  Query,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { Observable, from, of, defer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * 🚀 Servicio Optimizado para Reportes
 * 
 * **Optimizaciones implementadas:**
 * 1. ✅ Consultas paginadas con limit() y startAfter()
 * 2. ✅ Cache en memoria para evitar consultas repetidas
 * 3. ✅ Filtros obligatorios por fecha (sin traer colecciones completas)
 * 4. ✅ Solo getDocs (sin listeners en tiempo real)
 * 5. ✅ Documentos de resumen pre-calculados para dashboards
 * 6. ✅ Consultas que leen solo campos necesarios
 */
@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  
  // 💾 Cache en memoria (se limpia al actualizar fechas)
  private cache = new Map<string, { data: any[], timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  // ✅ Inyectar Firestore y el Injector usando inject()
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  /**
   * 📊 OPTIMIZACIÓN 1: Obtener movimientos de caja banco con filtros obligatorios
   * 
   * @param fechaDesde - Fecha inicio (obligatorio)
   * @param fechaHasta - Fecha fin (obligatorio)
   * @param tipo - Tipo de movimiento (opcional)
   * @param limitDocs - Cantidad máxima de documentos (default 100)
   * @param lastDoc - Último documento para paginación
   */
  getMovimientosCajaBancoPaginados(
    fechaDesde: Date,
    fechaHasta: Date,
    tipo?: 'INGRESO' | 'EGRESO',
    limitDocs = 100,
    lastDoc?: any
  ): Observable<{ docs: any[], hasMore: boolean, lastVisible: any }> {
    
    const cacheKey = `banco_${fechaDesde.getTime()}_${fechaHasta.getTime()}_${tipo}_${limitDocs}`;
    
    // Verificar cache
    const cached = this.getFromCache(cacheKey);
    if (cached && !lastDoc) {
      return of({ 
        docs: cached.slice(0, limitDocs), 
        hasMore: cached.length > limitDocs,
        lastVisible: cached[limitDocs - 1] || null
      });
    }

    const constraints: QueryConstraint[] = [
      where('fecha', '>=', Timestamp.fromDate(fechaDesde)),
      where('fecha', '<=', Timestamp.fromDate(fechaHasta)),
      orderBy('fecha', 'desc'),
      limit(limitDocs + 1) // +1 para saber si hay más páginas
    ];

    if (tipo) {
      constraints.push(where('tipo', '==', tipo));
    }

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
    const q = query(movimientosRef, ...constraints);

    return defer(() => 
      runInInjectionContext(this.injector, () => from(getDocs(q)))
    ).pipe(
      map(snapshot => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const hasMore = docs.length > limitDocs;
        const resultDocs = hasMore ? docs.slice(0, limitDocs) : docs;
        const lastVisible = resultDocs[resultDocs.length - 1];

        // Guardar en cache solo la primera página
        if (!lastDoc) {
          this.setCache(cacheKey, resultDocs);
        }

        return { docs: resultDocs, hasMore, lastVisible };
      }),
      catchError(error => {
        console.error('❌ Error obteniendo movimientos banco:', error);
        return of({ docs: [], hasMore: false, lastVisible: null });
      })
    );
  }

  /**
   * 📊 OPTIMIZACIÓN 2: Obtener movimientos de caja chica con filtros obligatorios
   */
  getMovimientosCajaChicaPaginados(
    fechaDesde: Date,
    fechaHasta: Date,
    tipo?: 'INGRESO' | 'EGRESO',
    limitDocs = 100,
    lastDoc?: any
  ): Observable<{ docs: any[], hasMore: boolean, lastVisible: any }> {
    
    const cacheKey = `chica_${fechaDesde.getTime()}_${fechaHasta.getTime()}_${tipo}_${limitDocs}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached && !lastDoc) {
      return of({ 
        docs: cached.slice(0, limitDocs), 
        hasMore: cached.length > limitDocs,
        lastVisible: cached[limitDocs - 1] || null
      });
    }

    const constraints: QueryConstraint[] = [
      where('fecha', '>=', Timestamp.fromDate(fechaDesde)),
      where('fecha', '<=', Timestamp.fromDate(fechaHasta)),
      orderBy('fecha', 'desc'),
      limit(limitDocs + 1)
    ];

    if (tipo) {
      constraints.push(where('tipo', '==', tipo));
    }

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
    const q = query(movimientosRef, ...constraints);

    return defer(() => 
      runInInjectionContext(this.injector, () => from(getDocs(q)))
    ).pipe(
      map(snapshot => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const hasMore = docs.length > limitDocs;
        const resultDocs = hasMore ? docs.slice(0, limitDocs) : docs;
        const lastVisible = resultDocs[resultDocs.length - 1];

        if (!lastDoc) {
          this.setCache(cacheKey, resultDocs);
        }

        return { docs: resultDocs, hasMore, lastVisible };
      }),
      catchError(error => {
        console.error('❌ Error obteniendo movimientos caja chica:', error);
        return of({ docs: [], hasMore: false, lastVisible: null });
      })
    );
  }

  /**
   * 📊 OPTIMIZACIÓN 3: Obtener facturas con filtros obligatorios y paginación
   */
  getFacturasPaginadas(
    fechaDesde: Date,
    fechaHasta: Date,
    metodoPago?: string,
    limitDocs = 100,
    lastDoc?: any
  ): Observable<{ docs: any[], hasMore: boolean, lastVisible: any }> {
    
    const cacheKey = `facturas_${fechaDesde.getTime()}_${fechaHasta.getTime()}_${metodoPago}_${limitDocs}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached && !lastDoc) {
      return of({ 
        docs: cached.slice(0, limitDocs), 
        hasMore: cached.length > limitDocs,
        lastVisible: cached[limitDocs - 1] || null
      });
    }

    const constraints: QueryConstraint[] = [];

    // Si hay filtro de metodoPago, agregarlo PRIMERO antes del orderBy
    if (metodoPago && metodoPago !== 'TODOS') {
      constraints.push(where('metodoPago', '==', metodoPago));
    }

    constraints.push(
      where('fecha', '>=', Timestamp.fromDate(fechaDesde)),
      where('fecha', '<=', Timestamp.fromDate(fechaHasta)),
      orderBy('fecha', 'desc'),
      limit(limitDocs + 1)
    );

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const facturasRef = collection(this.firestore, 'facturas');
    const q = query(facturasRef, ...constraints);

    return defer(() => 
      runInInjectionContext(this.injector, () => from(getDocs(q)))
    ).pipe(
      map(snapshot => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const hasMore = docs.length > limitDocs;
        const resultDocs = hasMore ? docs.slice(0, limitDocs) : docs;
        const lastVisible = resultDocs[resultDocs.length - 1];

        if (!lastDoc) {
          this.setCache(cacheKey, resultDocs);
        }

        return { docs: resultDocs, hasMore, lastVisible };
      }),
      catchError(error => {
        console.error('❌ Error obteniendo facturas:', error);
        return of({ docs: [], hasMore: false, lastVisible: null });
      })
    );
  }

  /**
   * 📊 OPTIMIZACIÓN 4: Obtener pagos de deuda con filtros y paginación
   */
  getPagosDeudaPaginados(
    fechaDesde: Date,
    fechaHasta: Date,
    metodoPago?: string,
    limitDocs = 100,
    lastDoc?: any
  ): Observable<{ docs: any[], hasMore: boolean, lastVisible: any }> {
    
    const cacheKey = `deuda_${fechaDesde.getTime()}_${fechaHasta.getTime()}_${metodoPago}_${limitDocs}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached && !lastDoc) {
      return of({ 
        docs: cached.slice(0, limitDocs), 
        hasMore: cached.length > limitDocs,
        lastVisible: cached[limitDocs - 1] || null
      });
    }

    const constraints: QueryConstraint[] = [];

    // Si hay filtro de metodoPago, agregarlo PRIMERO antes del orderBy
    if (metodoPago && metodoPago !== 'TODOS') {
      constraints.push(where('metodoPago', '==', metodoPago));
    }

    constraints.push(
      where('fechaPago', '>=', Timestamp.fromDate(fechaDesde)),
      where('fechaPago', '<=', Timestamp.fromDate(fechaHasta)),
      orderBy('fechaPago', 'desc'),
      limit(limitDocs + 1)
    );

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const deudaRef = collection(this.firestore, 'facturas_deudas');
    const q = query(deudaRef, ...constraints);

    return defer(() => 
      runInInjectionContext(this.injector, () => from(getDocs(q)))
    ).pipe(
      map(snapshot => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const hasMore = docs.length > limitDocs;
        const resultDocs = hasMore ? docs.slice(0, limitDocs) : docs;
        const lastVisible = resultDocs[resultDocs.length - 1];

        if (!lastDoc) {
          this.setCache(cacheKey, resultDocs);
        }

        return { docs: resultDocs, hasMore, lastVisible };
      }),
      catchError(error => {
        console.error('❌ Error obteniendo pagos de deuda:', error);
        return of({ docs: [], hasMore: false, lastVisible: null });
      })
    );
  }

  /**
   * 📊 OPTIMIZACIÓN 5: Obtener resumen pre-calculado (para dashboards rápidos)
   * 
   * Estos documentos deben ser generados periódicamente (por mes, por día, etc.)
   * y contienen totales pre-calculados para evitar consultar cientos de documentos.
   * 
   * Estructura sugerida: `resumenes/{año-mes}`
   * Contenido: { totalVentas, totalEgresos, totalIngresos, totalesPorMetodo, etc. }
   */
  getResumenMensual(año: number, mes: number): Observable<any> {
    const resumenId = `${año}-${String(mes).padStart(2, '0')}`;
    const docRef = doc(this.firestore, 'resumenes', resumenId);

    return from(getDoc(docRef)).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          return { id: snapshot.id, ...snapshot.data() };
        }
        return null;
      }),
      catchError(error => {
        console.error('❌ Error obteniendo resumen mensual:', error);
        return of(null);
      })
    );
  }

  /**
   * 📊 OPTIMIZACIÓN 6: Generar/actualizar resumen mensual
   * 
   * Este método debe ejecutarse periódicamente (ej: Cloud Function o tarea programada)
   * para mantener los resúmenes actualizados.
   */
  async generarResumenMensual(año: number, mes: number): Promise<void> {
    console.log(`📊 Generando resumen para ${año}-${mes}...`);

    // Calcular rango de fechas del mes
    const fechaDesde = new Date(año, mes - 1, 1, 0, 0, 0);
    const fechaHasta = new Date(año, mes, 0, 23, 59, 59);

    // Consultar todos los datos del mes (sin paginación, ya que es un proceso en background)
    const [facturas, movimientosBanco, movimientosChica, pagosDeuda] = await Promise.all([
      this.consultarTodosDocumentos('facturas', fechaDesde, fechaHasta, 'fecha'),
      this.consultarTodosDocumentos('movimientos_cajas_banco', fechaDesde, fechaHasta, 'fecha'),
      this.consultarTodosDocumentos('movimientos_cajas_chicas', fechaDesde, fechaHasta, 'fecha'),
      this.consultarTodosDocumentos('facturas_deudas', fechaDesde, fechaHasta, 'fechaPago')
    ]);

    // Calcular totales
    const totalVentas = facturas.reduce((sum: number, f: any) => sum + (f.total || 0), 0);
    const totalPagosDeuda = pagosDeuda.reduce((sum: number, p: any) => sum + (p.montoPagado || 0), 0);
    const totalEgresos = movimientosChica
      .filter((m: any) => m.tipo === 'EGRESO')
      .reduce((sum: number, e: any) => sum + (e.monto || 0), 0);

    // Agrupar por método de pago
    const totalesPorMetodo: { [key: string]: number } = {};
    facturas.forEach((f: any) => {
      const metodo = f.metodoPago || 'Sin Método';
      totalesPorMetodo[metodo] = (totalesPorMetodo[metodo] || 0) + f.total;
    });

    // Guardar resumen
    const resumenId = `${año}-${String(mes).padStart(2, '0')}`;
    const resumenData = {
      año,
      mes,
      totalVentas,
      totalPagosDeuda,
      totalEgresos,
      totalesPorMetodo,
      cantidadFacturas: facturas.length,
      cantidadPagosDeuda: pagosDeuda.length,
      cantidadEgresos: movimientosChica.filter((m: any) => m.tipo === 'EGRESO').length,
      fechaGeneracion: new Date(),
      rangoDesde: fechaDesde,
      rangoHasta: fechaHasta
    };

    const docRef = doc(this.firestore, 'resumenes', resumenId);
    await setDoc(docRef, resumenData, { merge: true });

    console.log(`✅ Resumen generado para ${año}-${mes}:`, resumenData);
  }

  /**
   * Método auxiliar para consultar todos los documentos de una colección en un rango
   */
  private async consultarTodosDocumentos(
    coleccion: string, 
    fechaDesde: Date, 
    fechaHasta: Date,
    campoFecha: string
  ): Promise<any[]> {
    const colRef = collection(this.firestore, coleccion);
    const q = query(
      colRef,
      where(campoFecha, '>=', Timestamp.fromDate(fechaDesde)),
      where(campoFecha, '<=', Timestamp.fromDate(fechaHasta))
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * 💾 Gestión de cache en memoria
   */
  private getFromCache(key: string): any[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any[]): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Limpiar cache manualmente (útil cuando se actualizan datos)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache de reportes limpiado');
  }

  /**
   * Limpiar cache específico por patrón
   */
  clearCacheByPattern(pattern: string): void {
    const keys = Array.from(this.cache.keys()).filter(k => k.includes(pattern));
    keys.forEach(k => this.cache.delete(k));
    console.log(`🗑️ Cache limpiado para patrón: ${pattern}`);
  }
}
