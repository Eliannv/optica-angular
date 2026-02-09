/**
 * Gestiona el ciclo de vida completo de las facturas de venta en el sistema.
 * Proporciona operaciones CRUD, generación de IDs secuenciales personalizados,
 * y funcionalidad avanzada para el manejo de pagos pendientes y deudas de clientes.
 *
 * Este servicio implementa un sistema de IDs de 10 dígitos (0000000001, 0000000002, etc.)
 * para facilitar la identificación manual de facturas. También gestiona estados de pago
 * (PENDIENTE/PAGADA) y mantiene trazabilidad de abonos y saldos pendientes.
 *
 * Los datos se persisten en la colección 'facturas' de Firestore y se integran con
 * los módulos de caja chica y caja banco según el método de pago.
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  doc,
  docData,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  updateDoc,
  writeBatch,
  orderBy,
  setDoc,
  deleteDoc,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  endBefore,
  limitToLast
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, shareReplay, map, tap, combineLatest } from 'rxjs';
import { Factura } from '../models/factura.model';
import { PaginationResult } from '../models/pagination.model';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private readonly fs: Firestore;
  private readonly facturasRef;
  private readonly facturasDeudaRef;

  // 🎯 CACHÉ con shareReplay
  private facturasCache$ = new BehaviorSubject<Factura[]>([]);
  private cachedAllFacturas$: Observable<Factura[]> | null = null;

  constructor() {
    this.fs = inject(Firestore);
    this.facturasRef = collection(this.fs, 'facturas');
    this.facturasDeudaRef = collection(this.fs, 'facturas_deudas');
  }

  /**
   * Genera un ID secuencial de 10 dígitos (0000000001, 0000000002, etc.)
   * Obtiene el número más alto actual y suma 1
   */
  private async generarIdSecuencial(): Promise<string> {
    // Obtener todas las facturas
    const snap = await getDocs(this.facturasRef);
    let maxNumero = 0;

    // Recorrer y buscar el número más alto
    snap.forEach(doc => {
      const data: any = doc.data();
      const idPersonalizado = data?.idPersonalizado;
      if (idPersonalizado) {
        const num = parseInt(idPersonalizado, 10);
        if (!isNaN(num) && num > maxNumero) {
          maxNumero = num;
        }
      }
    });

    // El siguiente ID es maxNumero + 1, con padding a 10 dígitos
    const nuevoNumero = maxNumero + 1;
    return nuevoNumero.toString().padStart(10, '0');
  }

  // EXISTENTE - MODIFICADO
  async crearFactura(factura: Omit<Factura, 'id'>) {
    // Generar ID secuencial personalizado
    const idPersonalizado = await this.generarIdSecuencial();

    // Convertir Date a Timestamp de Firestore
    const facturaParaGuardar: any = { ...factura };
    
    // Si fecha es un Date, convertirlo a Timestamp
    if (facturaParaGuardar.fecha instanceof Date) {
      facturaParaGuardar.fecha = Timestamp.fromDate(facturaParaGuardar.fecha);
      console.log('📅 Fecha convertida a Timestamp:', facturaParaGuardar.fecha);
    } else if (facturaParaGuardar.fecha) {
      console.warn('⚠️ Fecha no es Date:', typeof facturaParaGuardar.fecha, facturaParaGuardar.fecha);
    } else {
      console.error('❌ Fecha es undefined o null');
    }

    // Usar setDoc con el ID personalizado
    const docRef = doc(this.facturasRef, idPersonalizado);
    await setDoc(docRef, {
      ...facturaParaGuardar,
      idPersonalizado
    });

    console.log('✅ Factura guardada con ID:', idPersonalizado);
    return docRef;
  }

  // EXISTENTE - ACTUALIZADO CON CACHÉ
  getFacturas(): Observable<Factura[]> {
    if (!this.cachedAllFacturas$) {
      this.cachedAllFacturas$ = collectionData(this.facturasRef, { idField: 'id' }).pipe(
        map(data => data as Factura[]),
        tap(facturas => this.facturasCache$.next(facturas)),
        shareReplay(1) // 🎯 Compartir resultado entre suscriptores
      );
    }
    return this.cachedAllFacturas$;
  }

  /**
   * 🆕 Obtener facturas con paginación
   * @param pageSize - Cantidad de documentos por página (default: 50)
   * @param startAfterDoc - Documento desde el cual continuar (para siguiente página)
   */
  getFacturasPaginadas(
    pageSize: number = 50,
    startAfterDoc?: QueryDocumentSnapshot<any>
  ): Observable<PaginationResult<Factura>> {
    let q: any;

    if (startAfterDoc) {
      q = query(
        this.facturasRef,
        orderBy('fecha', 'desc'),
        startAfter(startAfterDoc),
        limit(pageSize + 1) // +1 para detectar si hay más páginas
      );
    } else {
      q = query(
        this.facturasRef,
        orderBy('fecha', 'desc'),
        limit(pageSize + 1)
      );
    }

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => {
        const hasNextPage = facturas.length > pageSize;
        const items = facturas.slice(0, pageSize);
        const lastDoc = items.length > 0 ? items[items.length - 1] : null;

        return {
          items: items as Factura[],
          pageSize,
          hasNextPage,
          cursor: {
            next: hasNextPage ? lastDoc : undefined
          }
        };
      })
    );
  }

  // 🎯 Recargar caché
  reloadFacturas() {
    this.cachedAllFacturas$ = null;
    return this.getFacturas();
  }

  // EXISTENTE
  getFacturaById(id: string): Observable<Factura> {
    const ref = doc(this.fs, `facturas/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<Factura>;
  }

  // =========================================================
  // NUEVO: DEUDA / PENDIENTES
  // =========================================================

  /**
   * Devuelve resumen rápido para mostrar badge en lista:
   * deudaTotal = suma de saldoPendiente de facturas PENDIENTES del cliente
   * pendientes = cantidad de facturas pendientes
   */
  async getResumenDeuda(clienteId: string): Promise<{ deudaTotal: number; pendientes: number; creditosActivos: number; creditoPersonalActivo: boolean }> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('estadoPago', '==', 'PENDIENTE')
    );

    const snap = await getDocs(q);
    const facturas = snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as any[];

    const pagosSnap = await getDocs(
      query(this.facturasDeudaRef, where('clienteId', '==', clienteId))
    );

    const pagosPorFactura = new Map<string, number>();
    pagosSnap.forEach(docSnap => {
      const data: any = docSnap.data();
      const facturaId = data?.facturaId;
      if (!facturaId) return;
      const monto = Number(data?.montoPagado || 0);
      pagosPorFactura.set(facturaId, (pagosPorFactura.get(facturaId) || 0) + monto);
    });

    let deudaTotal = 0;
    let pendientes = 0;
    let creditosActivos = 0;

    facturas
      .filter(f => f?.tipoFactura !== 'COBRO_DEUDA')
      .forEach(data => {
        const total = Number(data?.total || 0);
        const abonadoInicial = Number(data?.abonado || 0);
        const saldoBase = isFinite(Number(data?.saldoPendiente))
          ? Number(data?.saldoPendiente)
          : Math.max(0, +(total - abonadoInicial).toFixed(2));
        const pagado = Number(pagosPorFactura.get(data.id) || 0);
        const saldo = Math.max(0, +(saldoBase - pagado).toFixed(2));
        const esCreditoPersonal = Boolean(
          data?.esCredito ||
          (data?.tipoVenta && String(data.tipoVenta).toUpperCase() === 'CREDITO') ||
          (data?.estadoCredito && String(data.estadoCredito).toUpperCase() === 'ACTIVO')
        );
        if (saldo > 0) {
          deudaTotal += saldo;
          pendientes++;
          if (esCreditoPersonal) {
            creditosActivos++;
          }
        }
      });

    return {
      deudaTotal: +deudaTotal.toFixed(2),
      pendientes,
      creditosActivos,
      creditoPersonalActivo: creditosActivos > 0
    };
  }

  /**
   * Trae facturas pendientes de un cliente (para pantalla cobrar deuda)
   * Sin orderBy en Firestore para evitar necesidad de índice compuesto
   * Se ordena en el cliente (Angular)
   */
  getPendientesPorCliente(clienteId: string): Observable<any[]> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('estadoPago', '==', 'PENDIENTE')
      // Sin orderBy para evitar necesidad de índice compuesto
    );

    const pagosQuery = query(
      this.facturasDeudaRef,
      where('clienteId', '==', clienteId)
    );

    return combineLatest([
      collectionData(q, { idField: 'id' }),
      collectionData(pagosQuery, { idField: 'id' })
    ]).pipe(
      map(([facturas, pagos]: [any[], any[]]) => {
        const pagosPorFactura = new Map<string, number>();
        (pagos || []).forEach(p => {
          const facturaId = p?.facturaId;
          if (!facturaId) return;
          const monto = Number(p?.montoPagado || 0);
          pagosPorFactura.set(facturaId, (pagosPorFactura.get(facturaId) || 0) + monto);
        });

        const filtradas = (facturas || [])
          .filter(f => f?.tipoFactura !== 'COBRO_DEUDA')
          .map(f => {
            const total = Number(f?.total || 0);
            const abonadoInicial = Number(f?.abonado || 0);
            const saldoBase = isFinite(Number(f?.saldoPendiente))
              ? Number(f?.saldoPendiente)
              : Math.max(0, +(total - abonadoInicial).toFixed(2));
            const pagado = Number(pagosPorFactura.get(f?.id) || 0);
            const saldoRestante = Math.max(0, +(saldoBase - pagado).toFixed(2));
            const abonadoTotal = +(abonadoInicial + pagado).toFixed(2);

            return {
              ...f,
              abonado: abonadoTotal,
              saldoPendiente: saldoRestante
            };
          })
          .filter(f => Number(f?.saldoPendiente || 0) > 0);

        // Ordenar en el cliente en lugar de en Firestore
        return filtradas.sort((a, b) => {
          const fechaA = a?.fecha?.toDate?.() || new Date(a?.fecha || 0);
          const fechaB = b?.fecha?.toDate?.() || new Date(b?.fecha || 0);
          return fechaB.getTime() - fechaA.getTime(); // descendente
        });
      })
    ) as Observable<any[]>;
  }

  /**
   * Marca como PAGADA cualquier factura de cobro de deuda asociada a la original.
   * Útil para evitar múltiples cobros pendientes para la misma deuda.
   */
  async marcarCobrosDeudaComoPagados(facturaOriginalId: string): Promise<number> {
    const q = query(
      this.facturasRef,
      where('tipoFactura', '==', 'COBRO_DEUDA'),
      where('facturaOriginalId', '==', facturaOriginalId),
      where('estadoPago', '==', 'PENDIENTE')
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      return 0;
    }

    const batch = writeBatch(this.fs);
    snap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, {
        estadoPago: 'PAGADA'
      } as any);
    });

    await batch.commit();
    return snap.size;
  }

  /**
   * Actualiza pago: abonado/saldo/estado.
   * Ideal para registrar abonos.
   */
  async actualizarPagoFactura(facturaId: string, payload: {
    abonado?: number;
    saldoPendiente?: number;
    estadoPago?: 'PENDIENTE' | 'PAGADA';
    metodoPago?: string;
    ultimaActualizacionPago?: any;
  }) {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    await updateDoc(ref, {
      ...payload,
      // opcional: timestamp servidor para auditar
      ultimaActualizacionPago: serverTimestamp()
    } as any);
  }

  /**
   * Marca una factura como PAGADA sin modificar ningún otro campo.
   * NO modifica: total, abonado, saldoPendiente, fecha, items, cliente, impuestos, etc.
   * Solo actualiza el campo estadoPago para indicar que está saldada.
   */
  async marcarFacturaComoPagada(facturaId: string) {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    await updateDoc(ref, {
      estadoPago: 'PAGADA'
    } as any);
  }

  /**
   * Actualiza una factura completa.
   * Permite editar productos, montos, método de pago, etc.
   * NO modifica el historialSnapshot (registro clínico inmutable).
   */
  async actualizarFactura(facturaId: string, factura: Partial<Factura>) {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    
    // Convertir Date a Timestamp si es necesario
    const facturaParaGuardar: any = { ...factura };
    if (facturaParaGuardar.fecha instanceof Date) {
      facturaParaGuardar.fecha = Timestamp.fromDate(facturaParaGuardar.fecha);
    }

    // Remover campos que no deben actualizarse
    delete facturaParaGuardar.id;
    delete facturaParaGuardar.idPersonalizado;
    delete facturaParaGuardar.historialSnapshot; // NO modificar historial clínico

    await updateDoc(ref, {
      ...facturaParaGuardar,
      ultimaActualizacion: serverTimestamp()
    } as any);
    
    console.log('✅ Factura actualizada:', facturaId);
  }

  /**
   * Elimina permanentemente una factura.
   * IMPORTANTE: Esta acción no se puede deshacer.
   * Se recomienda validar que no tenga movimientos en cajas antes de eliminar.
   */
  async eliminarFactura(facturaId: string): Promise<void> {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    await deleteDoc(ref);
    console.log('✅ Factura eliminada permanentemente:', facturaId);
  }

  /**
   * 🚀 PAGINACIÓN REAL DESDE FIRESTORE
   * 
   * Obtiene facturas con paginación real usando cursores de Firestore.
   * Solo carga 10 facturas por consulta, reduciendo uso de memoria y lecturas.
   * 
   * @param options - Opciones de paginación
   * @param options.pageSize - Cantidad de facturas por página (default: 10)
   * @param options.lastVisible - Snapshot del último documento visible (para "siguiente")
   * @param options.firstVisible - Snapshot del primer documento visible (para "anterior")
   * @param options.direction - Dirección de navegación: 'next' | 'prev' (default: 'next')
   * @param options.terminoBusqueda - Término para buscar en múltiples campos
   * @param options.filtroTipoFactura - Filtro por tipo: 'TODAS' | 'NORMALES' | 'COBROS_DEUDA'
   * 
   * @returns Promise con productos, documentos snapshot y flag hasMore
   */
  async getFacturasPaginadasReal(options: {
    pageSize?: number;
    lastVisible?: DocumentSnapshot | null;
    firstVisible?: DocumentSnapshot | null;
    direction?: 'next' | 'prev';
    terminoBusqueda?: string;
    filtroTipoFactura?: 'TODAS' | 'NORMALES' | 'COBROS_DEUDA';
    currentPage?: number;
    startDate?: Date | null;
    endDate?: Date | null;
    fechaExacta?: Date | null;
  }): Promise<{
    facturas: Factura[];
    lastDoc: DocumentSnapshot | null;
    firstDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    const {
      pageSize = 10,
      lastVisible = null,
      firstVisible = null,
      direction = 'next',
      terminoBusqueda = '',
      filtroTipoFactura = 'TODAS',
      currentPage = 1,
      startDate = null,
      endDate = null,
      fechaExacta = null
    } = options;

    // 🔍 SI HAY BÚSQUEDA ACTIVA O FILTROS DE FECHA, traer TODOS y filtrar en cliente
    if (terminoBusqueda.trim() || startDate || endDate || fechaExacta) {
      return this.buscarFacturasSinPaginacion(
        terminoBusqueda, 
        filtroTipoFactura, 
        pageSize,
        currentPage,
        startDate, 
        endDate, 
        fechaExacta
      );
    }

    // ✅ Construir query base ordenado por fecha descendente
    let q;
    
    if (direction === 'prev' && firstVisible) {
      q = query(
        this.facturasRef,
        orderBy('fecha', 'desc'),
        endBefore(firstVisible),
        limitToLast(pageSize + 1)
      );
    } else if (direction === 'next' && lastVisible) {
      q = query(
        this.facturasRef,
        orderBy('fecha', 'desc'),
        startAfter(lastVisible),
        limit(pageSize + 1)
      );
    } else {
      // Primera carga
      q = query(
        this.facturasRef,
        orderBy('fecha', 'desc'),
        limit(pageSize + 1)
      );
    }

    // ✅ Ejecutar query
    const snapshot = await getDocs(q);
    let facturas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Factura[];

    // ✅ Aplicar filtro por tipo de factura
    if (filtroTipoFactura === 'NORMALES') {
      facturas = facturas.filter(f => f.tipoFactura === 'NORMAL' || !f.tipoFactura);
    } else if (filtroTipoFactura === 'COBROS_DEUDA') {
      facturas = facturas.filter(f => f.tipoFactura === 'COBRO_DEUDA');
    }

    // ✅ Detectar si hay más páginas
    const hasMore = facturas.length > pageSize;
    const facturasFinales = facturas.slice(0, pageSize);

    // ✅ Obtener snapshots de navegación
    const lastDoc = snapshot.docs[Math.min(pageSize - 1, snapshot.docs.length - 1)] || null;
    const firstDoc = snapshot.docs[0] || null;

    return {
      facturas: facturasFinales,
      lastDoc,
      firstDoc,
      hasMore
    };
  }

  /**
   * 🔍 Buscar facturas SIN paginación (trae todos y filtra en cliente)
   * Se usa cuando hay un término de búsqueda activo o filtros de fecha
   */
  private async buscarFacturasSinPaginacion(
    terminoBusqueda: string,
    filtroTipoFactura: 'TODAS' | 'NORMALES' | 'COBROS_DEUDA',
    pageSize: number,
    currentPage: number = 1,
    startDate: Date | null = null,
    endDate: Date | null = null,
    fechaExacta: Date | null = null
  ): Promise<{
    facturas: Factura[];
    lastDoc: DocumentSnapshot | null;
    firstDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    // Traer TODAS las facturas ordenadas por fecha
    const q = query(
      this.facturasRef,
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(q);
    let facturas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Factura[];

    // Aplicar filtro de tipo
    if (filtroTipoFactura === 'NORMALES') {
      facturas = facturas.filter(f => f.tipoFactura === 'NORMAL' || !f.tipoFactura);
    } else if (filtroTipoFactura === 'COBROS_DEUDA') {
      facturas = facturas.filter(f => f.tipoFactura === 'COBRO_DEUDA');
    }

    // 📅 Aplicar filtro de fecha exacta
    if (fechaExacta) {
      const fechaInicio = new Date(fechaExacta);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fechaExacta);
      fechaFin.setHours(23, 59, 59, 999);

      facturas = facturas.filter(f => {
        const fechaFactura = this.convertirADate(f.fecha);
        return fechaFactura >= fechaInicio && fechaFactura <= fechaFin;
      });
    }
    // 📅 Aplicar filtro de rango de fechas (periodo)
    else if (startDate || endDate) {
      facturas = facturas.filter(f => {
        const fechaFactura = this.convertirADate(f.fecha);
        
        if (startDate && endDate) {
          const inicio = new Date(startDate);
          inicio.setHours(0, 0, 0, 0);
          const fin = new Date(endDate);
          fin.setHours(23, 59, 59, 999);
          return fechaFactura >= inicio && fechaFactura <= fin;
        } else if (startDate) {
          const inicio = new Date(startDate);
          inicio.setHours(0, 0, 0, 0);
          return fechaFactura >= inicio;
        } else if (endDate) {
          const fin = new Date(endDate);
          fin.setHours(23, 59, 59, 999);
          return fechaFactura <= fin;
        }
        return true;
      });
    }

    // Aplicar búsqueda en múltiples campos
    const termino = terminoBusqueda.toLowerCase().trim();
    facturas = facturas.filter(f => {
      const clienteNombre = (f.clienteNombre || '').toLowerCase();
      const idPersonalizado = (f.idPersonalizado || '').toLowerCase();
      const id = (f.id || '').toLowerCase();

      return clienteNombre.includes(termino) ||
             idPersonalizado.includes(termino) ||
             id.includes(termino);
    });

    // Aplicar paginación manual (en memoria)
    const offset = (currentPage - 1) * pageSize;
    const hasMore = facturas.length > offset + pageSize;
    const facturasFinales = facturas.slice(offset, offset + pageSize);

    return {
      facturas: facturasFinales,
      lastDoc: null,
      firstDoc: null,
      hasMore
    };
  }

  /**
   * 🔧 Convierte un Timestamp de Firestore o cualquier fecha a Date
   */
  private convertirADate(fecha: any): Date {
    if (!fecha) return new Date();
    if (fecha instanceof Date) return fecha;
    if (fecha?.toDate) return fecha.toDate();
    if (fecha?.seconds) return new Date(fecha.seconds * 1000);
    return new Date(fecha);
  }
}
