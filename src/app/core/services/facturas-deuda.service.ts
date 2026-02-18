/**
 * Servicio para gestionar pagos de deudas de facturas.
 * 
 * Cada pago de deuda crea un documento independiente en la colección 'facturas_deudas'.
 * Las facturas originales nunca se modifican, garantizando inmutabilidad del historial.
 * 
 * Este servicio proporciona:
 * - Crear registros de pago de deuda
 * - Consultar pagos de una factura específica
 * - Obtener todos los pagos de deuda de un cliente
 * - Calcular saldo restante considerando todos los pagos
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  endBefore,
  limitToLast
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FacturaDeuda } from '../models/factura-deuda.model';
import { SucursalQueryHelperService } from './sucursal-query-helper.service';

@Injectable({ providedIn: 'root' })
export class FacturasDeudaService {
  private fs = inject(Firestore);
  private sucursalHelper = inject(SucursalQueryHelperService);
  private facturasDeudaRef = collection(this.fs, 'facturas_deudas');
  private clientesRef = collection(this.fs, 'clientes');

  /**
   * Crea un nuevo registro de pago de deuda.
   * No modifica la factura original (es inmutable).
   * 
   * @param deuda Datos del pago de deuda
   * @returns Referencia al documento creado
   */
  async crearPagoDeuda(deuda: Omit<FacturaDeuda, 'id' | 'createdAt' | 'updatedAt'>) {
    // Convertir Date a Timestamp de Firestore
    const deudaParaGuardar: any = { ...deuda };
    
    if (deudaParaGuardar.fechaPago instanceof Date) {
      deudaParaGuardar.fechaPago = Timestamp.fromDate(deudaParaGuardar.fechaPago);
    }

    const docRef = await addDoc(this.facturasDeudaRef, {
      ...deudaParaGuardar,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Pago de deuda registrado:', docRef.id);
    return docRef;
  }

  /**
   * Obtiene un pago de deuda por su ID
   */
  getPagoDeudaById(id: string): Observable<any> {
    const q = query(this.facturasDeudaRef, where('__name__', '==', id));
    return collectionData(q, { idField: 'id' }).pipe(
      map(pagos => pagos[0] || null)
    );
  }

  /**
   * Obtiene todos los pagos de una factura específica.
   * 
   * @param facturaId ID de la factura
   * @returns Observable con array de pagos ordenados por fecha
   */
  getPagosPorFactura(facturaId: string): Observable<FacturaDeuda[]> {
    const q = query(
      this.facturasDeudaRef,
      where('facturaId', '==', facturaId),
      orderBy('fechaPago', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((pagos: any[]) => 
        pagos.map(pago => ({
          ...pago,
          fechaPago: pago.fechaPago?.toDate ? pago.fechaPago.toDate() : new Date(pago.fechaPago)
        }))
      )
    ) as Observable<FacturaDeuda[]>;
  }

  /**
   * Obtiene todos los pagos de un cliente específico.
   * 
   * @param clienteId ID del cliente
   * @returns Observable con array de pagos ordenados por fecha
   */
  getPagosPorCliente(clienteId: string): Observable<FacturaDeuda[]> {
    const q = query(
      this.facturasDeudaRef,
      where('clienteId', '==', clienteId),
      orderBy('fechaPago', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((pagos: any[]) => 
        pagos.map(pago => ({
          ...pago,
          fechaPago: pago.fechaPago?.toDate ? pago.fechaPago.toDate() : new Date(pago.fechaPago)
        }))
      )
    ) as Observable<FacturaDeuda[]>;
  }

  /**
   * Obtiene todos los pagos de deuda (sin filtro).
   * Útil para reportes generales.
   * 
   * @returns Observable con array de todos los pagos
   */
  getTodosPagos(): Observable<FacturaDeuda[]> {
    const q = query(
      this.facturasDeudaRef,
      orderBy('fechaPago', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((pagos: any[]) => 
        pagos.map(pago => ({
          ...pago,
          fechaPago: pago.fechaPago?.toDate ? pago.fechaPago.toDate() : new Date(pago.fechaPago)
        }))
      )
    ) as Observable<FacturaDeuda[]>;
  }

  /**
   * Calcula el saldo restante de una factura considerando todos los pagos realizados.
   * 
   * Fórmula: totalFactura - suma(montoPagado de todos los pagos)
   * 
   * @param facturaId ID de la factura
   * @param totalFactura Monto total original de la factura
   * @returns Promise con el saldo restante
   */
  async calcularSaldoRestante(facturaId: string, totalFactura: number): Promise<number> {
    const q = query(
      this.facturasDeudaRef,
      where('facturaId', '==', facturaId)
    );

    const snap = await getDocs(q);
    let totalPagado = 0;

    snap.forEach(doc => {
      const deuda: any = doc.data();
      totalPagado += deuda.montoPagado || 0;
    });

    const saldoRestante = Math.max(0, totalFactura - totalPagado);
    return +saldoRestante.toFixed(2);
  }

  /**
   * Obtiene el último pago registrado para una factura.
   * Útil para determinar el estado actual.
   * 
   * @param facturaId ID de la factura
   * @returns Promise con el pago más reciente o null
   */
  async getUltimoPago(facturaId: string): Promise<FacturaDeuda | null> {
    const q = query(
      this.facturasDeudaRef,
      where('facturaId', '==', facturaId),
      orderBy('fechaPago', 'desc')
    );

    const snap = await getDocs(q);
    
    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    const data: any = doc.data();
    
    return {
      ...data,
      id: doc.id,
      fechaPago: data.fechaPago?.toDate ? data.fechaPago.toDate() : new Date(data.fechaPago)
    } as FacturaDeuda;
  }

  /**
   * Actualiza SOLO el estado de todos los pagos de deuda asociados a una factura.
   * No modifica montos, fechas, cliente ni ningun otro campo.
   *
   * @param facturaId ID de la factura original
   * @param estado Nuevo estado (PENDIENTE o PAGADA)
   * @returns Cantidad de documentos actualizados
   */
  async actualizarEstadoPagosDeuda(facturaId: string, estado: 'PENDIENTE' | 'PAGADA'): Promise<number> {
    const q = query(
      this.facturasDeudaRef,
      where('facturaId', '==', facturaId)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      return 0;
    }

    const batch = writeBatch(this.fs);
    snap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, {
        estadoPago: estado
      } as any);
    });

    await batch.commit();
    return snap.size;
  }

  /**
   * 🚀 PAGINACIÓN REAL DESDE FIRESTORE
   * 
   * Obtiene pagos de deuda con paginación real usando cursores de Firestore.
   * Solo carga 10 pagos por consulta, reduciendo uso de memoria y lecturas.
   * 
   * @param options - Opciones de paginación
   * @param options.pageSize - Cantidad de pagos por página (default: 10)
   * @param options.lastVisible - Snapshot del último documento visible (para "siguiente")
   * @param options.firstVisible - Snapshot del primer documento visible (para "anterior")
   * @param options.direction - Dirección de navegación: 'next' | 'prev' (default: 'next')
   * @param options.terminoBusqueda - Término para buscar en múltiples campos
   * 
   * @returns Promise con pagos, documentos snapshot y flag hasMore
   */
  async getPagosDeudaPaginadosReal(options: {
    pageSize?: number;
    lastVisible?: DocumentSnapshot | null;
    firstVisible?: DocumentSnapshot | null;
    direction?: 'next' | 'prev';
    terminoBusqueda?: string;
    currentPage?: number;
    startDate?: Date | null;
    endDate?: Date | null;
    fechaExacta?: Date | null;
  }): Promise<{
    pagos: any[];
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
      currentPage = 1,
      startDate = null,
      endDate = null,
      fechaExacta = null
    } = options;

    // 🔍 SI HAY BÚSQUEDA ACTIVA O FILTROS DE FECHA, traer TODOS y filtrar en cliente
    if (terminoBusqueda.trim() || startDate || endDate || fechaExacta) {
      return this.buscarPagosSinPaginacion(terminoBusqueda, pageSize, currentPage, startDate, endDate, fechaExacta);
    }

    // ✅ Construir query base ordenado por fecha descendente
    let q;
    
    if (direction === 'prev' && firstVisible) {
      q = this.sucursalHelper.agregarFiltroSucursal(
        this.facturasDeudaRef,
        orderBy('fechaPago', 'desc'),
        endBefore(firstVisible),
        limitToLast(pageSize + 1)
      );
    } else if (direction === 'next' && lastVisible) {
      q = this.sucursalHelper.agregarFiltroSucursal(
        this.facturasDeudaRef,
        orderBy('fechaPago', 'desc'),
        startAfter(lastVisible),
        limit(pageSize + 1)
      );
    } else {
      // Primera carga
      q = this.sucursalHelper.agregarFiltroSucursal(
        this.facturasDeudaRef,
        orderBy('fechaPago', 'desc'),
        limit(pageSize + 1)
      );
    }

    // ✅ Ejecutar query
    const snapshot = await getDocs(q);
    let pagos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fechaPago: doc.data()['fechaPago']?.toDate ? doc.data()['fechaPago'].toDate() : new Date(doc.data()['fechaPago'])
    }));

    // ✅ Detectar si hay más páginas
    const hasMore = pagos.length > pageSize;
    const pagosFinales = pagos.slice(0, pageSize);

    // ✅ Obtener snapshots de navegación
    const lastDoc = snapshot.docs[Math.min(pageSize - 1, snapshot.docs.length - 1)] || null;
    const firstDoc = snapshot.docs[0] || null;

    return {
      pagos: pagosFinales,
      lastDoc,
      firstDoc,
      hasMore
    };
  }

  /**
   * 🔍 Buscar pagos SIN paginación (trae todos y filtra en cliente)
   * Se usa cuando hay un término de búsqueda activo o filtros de fecha
   */
  private async buscarPagosSinPaginacion(
    terminoBusqueda: string,
    pageSize: number,
    currentPage: number = 1,
    startDate: Date | null = null,
    endDate: Date | null = null,
    fechaExacta: Date | null = null
  ): Promise<{
    pagos: any[];
    lastDoc: DocumentSnapshot | null;
    firstDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    // Traer pagos filtrados por sucursal ordenados por fecha
    const q = this.sucursalHelper.agregarFiltroConLimite(
      this.facturasDeudaRef,
      500,
      orderBy('fechaPago', 'desc')
    );

    const snapshot = await getDocs(q);
    let pagos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fechaPago: doc.data()['fechaPago']?.toDate ? doc.data()['fechaPago'].toDate() : new Date(doc.data()['fechaPago'])
    }));

    // 📅 Aplicar filtro de fecha exacta
    if (fechaExacta) {
      const fechaInicio = new Date(fechaExacta);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fechaExacta);
      fechaFin.setHours(23, 59, 59, 999);

      pagos = pagos.filter((p: any) => {
        const fechaPago = p.fechaPago instanceof Date ? p.fechaPago : new Date(p.fechaPago);
        return fechaPago >= fechaInicio && fechaPago <= fechaFin;
      });
    }
    // 📅 Aplicar filtro de rango de fechas (periodo)
    else if (startDate || endDate) {
      pagos = pagos.filter((p: any) => {
        const fechaPago = p.fechaPago instanceof Date ? p.fechaPago : new Date(p.fechaPago);
        
        if (startDate && endDate) {
          const inicio = new Date(startDate);
          inicio.setHours(0, 0, 0, 0);
          const fin = new Date(endDate);
          fin.setHours(23, 59, 59, 999);
          return fechaPago >= inicio && fechaPago <= fin;
        } else if (startDate) {
          const inicio = new Date(startDate);
          inicio.setHours(0, 0, 0, 0);
          return fechaPago >= inicio;
        } else if (endDate) {
          const fin = new Date(endDate);
          fin.setHours(23, 59, 59, 999);
          return fechaPago <= fin;
        }
        return true;
      });
    }

    // Aplicar búsqueda en múltiples campos
    if (terminoBusqueda.trim()) {
      const termino = terminoBusqueda.toLowerCase().trim();
      const tokens = termino.split(/\s+/).filter(Boolean);
      const clienteIdsPorCedula = await this.obtenerClienteIdsPorCedula(terminoBusqueda.trim());
      pagos = pagos.filter((p: any) => {
        const clienteNombre = (p.clienteNombre || '').toLowerCase();
        const facturaIdPersonalizado = (p.facturaIdPersonalizado || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const clienteId = String(p.clienteId || '');
        const matchNombre = tokens.length
          ? tokens.every(token => clienteNombre.includes(token))
          : false;

        return matchNombre ||
               facturaIdPersonalizado.includes(termino) ||
               id.includes(termino) ||
               (clienteId && clienteIdsPorCedula.has(clienteId));
      });
    }

    // Aplicar paginación manual (en memoria)
    const offset = (currentPage - 1) * pageSize;
    const hasMore = pagos.length > offset + pageSize;
    const pagosFinales = pagos.slice(offset, offset + pageSize);

    return {
      pagos: pagosFinales,
      lastDoc: null,
      firstDoc: null,
      hasMore
    };
  }

  private async obtenerClienteIdsPorCedula(cedula: string): Promise<Set<string>> {
    if (!cedula) return new Set<string>();
    const q = query(this.clientesRef, where('cedula', '==', cedula));
    const snap = await getDocs(q);
    return new Set(snap.docs.map(docSnap => docSnap.id));
  }
}
