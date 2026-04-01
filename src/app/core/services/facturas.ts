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
  getDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  runTransaction,
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
import { MovimientoStockService } from './movimiento-stock.service';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private readonly fs: Firestore;
  private readonly facturasRef;
  private readonly facturasDeudaRef;
  private readonly clientesRef;
  private readonly movimientosStockRef;
  private readonly movimientoStockSrv: MovimientoStockService;

  // 🎯 CACÉ con shareReplay
  private facturasCache$ = new BehaviorSubject<Factura[]>([]);
  private cachedAllFacturas$: Observable<Factura[]> | null = null;

  constructor() {
    this.fs = inject(Firestore);
    this.facturasRef = collection(this.fs, 'facturas');
    this.facturasDeudaRef = collection(this.fs, 'facturas_deudas');
    this.clientesRef = collection(this.fs, 'clientes');
    this.movimientosStockRef = collection(this.fs, 'movimientos_stock');
    this.movimientoStockSrv = inject(MovimientoStockService);
  }

  /**
   * Inicia la edición temporal de una factura restaurando stock original SIN generar movimientos.
   */
  async iniciarEdicionFacturaTemporal(facturaId: string): Promise<void> {
    const facturaRef = doc(this.fs, `facturas/${facturaId}`);

    await runTransaction(this.fs, async (tx) => {
      const facturaSnap = await tx.get(facturaRef);
      if (!facturaSnap.exists()) {
        throw new Error('Factura no encontrada para iniciar edición');
      }

      const facturaData: any = facturaSnap.data();
      if (facturaData?.edicionTemporalStockActiva) {
        return;
      }

      const itemsOriginales = (facturaData?.items || []).filter(
        (item: any) => !item?.esServicio && item?.productoId && Number(item?.cantidad || 0) > 0
      );

      const refs = itemsOriginales.map((item: any) => doc(this.fs, `productos/${item.productoId}`));
      const snaps = await Promise.all(refs.map((ref: any) => tx.get(ref)));

      for (let index = 0; index < itemsOriginales.length; index++) {
        const item = itemsOriginales[index];
        const productoSnap = snaps[index];
        if (!productoSnap.exists()) {
          continue;
        }

        const productoData: any = productoSnap.data();
        const tipoControl = productoData?.tipo_control_stock || 'NORMAL';
        if (tipoControl !== 'NORMAL') {
          continue;
        }

        const stockActual = Number(productoData?.stock || 0);
        const stockNuevo = stockActual + Number(item?.cantidad || 0);
        tx.update(refs[index], {
          stock: stockNuevo,
          updatedAt: new Date(),
        });
      }

      tx.update(facturaRef, {
        edicionTemporalStockActiva: true,
        edicionTemporalStockAt: serverTimestamp(),
      } as any);
    });
  }

  /**
   * Cancela la edición temporal de una factura reaplicando el descuento original SIN generar movimientos.
   */
  async cancelarEdicionFacturaTemporal(facturaId: string): Promise<void> {
    const facturaRef = doc(this.fs, `facturas/${facturaId}`);

    await runTransaction(this.fs, async (tx) => {
      const facturaSnap = await tx.get(facturaRef);
      if (!facturaSnap.exists()) {
        return;
      }

      const facturaData: any = facturaSnap.data();
      if (!facturaData?.edicionTemporalStockActiva) {
        return;
      }

      const itemsOriginales = (facturaData?.items || []).filter(
        (item: any) => !item?.esServicio && item?.productoId && Number(item?.cantidad || 0) > 0
      );

      const refs = itemsOriginales.map((item: any) => doc(this.fs, `productos/${item.productoId}`));
      const snaps = await Promise.all(refs.map((ref: any) => tx.get(ref)));

      for (let index = 0; index < itemsOriginales.length; index++) {
        const item = itemsOriginales[index];
        const productoSnap = snaps[index];
        if (!productoSnap.exists()) {
          continue;
        }

        const productoData: any = productoSnap.data();
        const tipoControl = productoData?.tipo_control_stock || 'NORMAL';
        if (tipoControl !== 'NORMAL') {
          continue;
        }

        const stockActual = Number(productoData?.stock || 0);
        const cantidad = Number(item?.cantidad || 0);
        const stockNuevo = stockActual - cantidad;
        if (stockNuevo < 0) {
          throw new Error(`No se pudo restaurar stock original en ${item?.nombre || item?.productoId}`);
        }

        tx.update(refs[index], {
          stock: stockNuevo,
          updatedAt: new Date(),
        });
      }

      tx.update(facturaRef, {
        edicionTemporalStockActiva: false,
        edicionTemporalStockAt: null,
      } as any);
    });
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

    // 📦 Registrar movimientos de stock VENTA (no bloquea si falla)
    try {
      await this.movimientoStockSrv.registrarMovimientosVenta(
        idPersonalizado,
        facturaParaGuardar.fecha,
        factura.items ?? [],
        factura.metodoPago,
        (factura as any).sucursalId,
        factura.usuarioId
      );
    } catch (err) {
      console.error('⚠️ Error al registrar movimientos de stock (factura guardada correctamente):', err);
    }

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

  /**
   * Obtiene una factura por ID de forma asíncrona (Promise)
   * Útil para obtener datos de factura sin suscripción
   */
  async getFacturaByIdAsync(id: string): Promise<any> {
    const ref = doc(this.fs, `facturas/${id}`);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
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
   * Trae TODAS las facturas con estadoPago === 'PENDIENTE' sin filtro de fecha ni cliente.
   * Usado para el panel de créditos pendientes globales en estadísticas.
   */
  async getAllFacturasPendientes(): Promise<any[]> {
    const q = query(
      this.facturasRef,
      where('estadoPago', '==', 'PENDIENTE')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((f: any) => Number(f?.saldoPendiente || 0) > 0)
      .sort((a: any, b: any) => Number(b?.saldoPendiente || 0) - Number(a?.saldoPendiente || 0));
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
   * ✅ NUEVO: Obtiene todas las facturas de un cliente (pendientes y pagadas)
   * Útil para mostrar historial completo de ventas en la ficha del cliente
   */
  getFacturasPorCliente(clienteId: string): Observable<Factura[]> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      orderBy('fecha', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(data => data as Factura[])
    );
  }

  /**
   * Obtiene todas las facturas que usan un historial clínico específico,
   * ordenadas por fecha (más reciente primero).
   */
  getFacturasPorHistorialClinico(clienteId: string, historialClinicoId: string): Observable<Factura[]> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('historialClinicoId', '==', historialClinicoId),
      orderBy('fecha', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(data => data as Factura[])
    );
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
    const facturaActualSnap = await getDoc(ref);
    const facturaActual = facturaActualSnap.exists() ? (facturaActualSnap.data() as Factura) : null;

    // Convertir Date a Timestamp si es necesario
    const facturaParaGuardar: any = { ...factura };
    if (facturaParaGuardar.fecha instanceof Date) {
      facturaParaGuardar.fecha = Timestamp.fromDate(facturaParaGuardar.fecha);
    }

    // Remover campos que no deben actualizarse
    delete facturaParaGuardar.id;
    delete facturaParaGuardar.idPersonalizado;
    delete facturaParaGuardar.historialSnapshot; // NO modificar historial clínico

    if (facturaActual && (facturaActual as any).edicionTemporalStockActiva && Array.isArray(facturaParaGuardar.items)) {
      const itemsNuevos = (facturaParaGuardar.items || []).filter(
        (item: any) => !item?.esServicio && item?.productoId && Number(item?.cantidad || 0) > 0
      );

      const mapaCantidades = new Map<string, { cantidad: number; nombre: string; precioUnitario: number }>();
      for (const item of itemsNuevos) {
        const key = String(item.productoId);
        const actual = mapaCantidades.get(key) || {
          cantidad: 0,
          nombre: String(item.nombre || ''),
          precioUnitario: Number(item.precioUnitario || 0),
        };
        actual.cantidad += Number(item.cantidad || 0);
        actual.nombre = String(item.nombre || actual.nombre || '');
        actual.precioUnitario = Number(item.precioUnitario || actual.precioUnitario || 0);
        mapaCantidades.set(key, actual);
      }

      const ajustes = [...mapaCantidades.entries()].map(([productoId, value]) => ({
        productoId,
        cantidad: value.cantidad,
        nombre: value.nombre,
        precioUnitario: value.precioUnitario,
      }));

      await runTransaction(this.fs, async (tx) => {
        const refs = ajustes.map((item) => doc(this.fs, `productos/${item.productoId}`));
        const snaps = await Promise.all(refs.map((productoRef) => tx.get(productoRef)));

        for (let index = 0; index < ajustes.length; index++) {
          const ajuste = ajustes[index];
          const productoSnap = snaps[index];
          if (!productoSnap.exists()) {
            throw new Error(`Producto no encontrado: ${ajuste.productoId}`);
          }

          const productoData: any = productoSnap.data();
          const tipoControl = productoData?.tipo_control_stock || 'NORMAL';
          const esNormal = tipoControl === 'NORMAL';

          const stockAnterior = esNormal ? Number(productoData?.stock || 0) : 0;
          const stockNuevo = esNormal
            ? stockAnterior - Number(ajuste.cantidad || 0)
            : 0;

          if (esNormal && stockNuevo < 0) {
            throw new Error(`Stock insuficiente para ${ajuste.nombre || ajuste.productoId}`);
          }

          const movRef = doc(this.movimientosStockRef);
          tx.set(movRef, {
            cantidad: Number(ajuste.cantidad || 0),
            costoUnitario: Number(productoData?.costo || 0),
            createdAt: serverTimestamp(),
            grupoProducto: String(productoData?.grupo || ''),
            precioVenta: Number(ajuste.precioUnitario || productoData?.pvp1 || 0),
            productoId: ajuste.productoId,
            productoNombre: String(productoData?.nombre || ajuste.nombre || ''),
            referenciaId: facturaId,
            referenciaTipo: (facturaParaGuardar as any).metodoPago || (facturaActual as any)?.metodoPago || 'FACTURA_EDITADA',
            stockAnterior,
            stockNuevo,
            sucursalId: (facturaParaGuardar as any).sucursalId || (facturaActual as any)?.sucursalId || 'PASJO01',
            tipo: 'AJUSTE',
            usuarioId: facturaParaGuardar.usuarioId || facturaActual?.usuarioId || '',
          });

          if (esNormal) {
            tx.update(refs[index], {
              stock: stockNuevo,
              updatedAt: new Date(),
            });
          }
        }

        tx.update(ref, {
          ...facturaParaGuardar,
          ultimaActualizacion: serverTimestamp(),
          edicionTemporalStockActiva: false,
          edicionTemporalStockAt: null,
        } as any);
      });

      console.log('✅ Factura actualizada con edición temporal:', facturaId);
      return;
    }

    if (facturaActual && Array.isArray(facturaParaGuardar.items)) {
      await this.movimientoStockSrv.registrarAjustesEdicionFactura(
        facturaId,
        (facturaActual.items || []) as any[],
        (facturaParaGuardar.items || []) as any[],
        (facturaParaGuardar as any).metodoPago || (facturaActual as any).metodoPago,
        (facturaParaGuardar as any).sucursalId || (facturaActual as any).sucursalId,
        facturaParaGuardar.usuarioId || facturaActual.usuarioId
      );
    }

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
    const facturaSnap = await getDoc(ref);

    if (facturaSnap.exists()) {
      const factura = facturaSnap.data() as Factura;
      await this.movimientoStockSrv.registrarEliminacionFactura(
        facturaId,
        (factura.items || []) as any[],
        (factura as any).metodoPago,
        (factura as any).sucursalId,
        factura.usuarioId
      );
    }

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
    filtroMetodoPago?: string;
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
      fechaExacta = null,
      filtroMetodoPago = 'TODAS'
    } = options;

    // 🔍 SI HAY BÚSQUEDA ACTIVA, FILTROS DE FECHA O MÉTODO DE PAGO, traer TODOS y filtrar en cliente
    if (terminoBusqueda.trim() || startDate || endDate || fechaExacta || (filtroMetodoPago && filtroMetodoPago !== 'TODAS')) {
      return this.buscarFacturasSinPaginacion(
        terminoBusqueda,
        filtroTipoFactura,
        pageSize,
        currentPage,
        startDate,
        endDate,
        fechaExacta,
        filtroMetodoPago
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
    fechaExacta: Date | null = null,
    filtroMetodoPago: string = 'TODAS'
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
    const tokens = termino.split(/\s+/).filter(Boolean);
    const clienteIdsPorCedula = termino
      ? await this.obtenerClienteIdsPorCedula(terminoBusqueda.trim())
      : new Set<string>();
    facturas = facturas.filter(f => {
      const clienteNombre = (f.clienteNombre || '').toLowerCase();
      const idPersonalizado = (f.idPersonalizado || '').toLowerCase();
      const id = (f.id || '').toLowerCase();
      const clienteId = String(f.clienteId || '');
      const matchNombre = tokens.length
        ? tokens.every(token => clienteNombre.includes(token))
        : false;

      return matchNombre ||
             idPersonalizado.includes(termino) ||
             id.includes(termino) ||
             (clienteId && clienteIdsPorCedula.has(clienteId));
    });

    // Aplicar filtro de método de pago (normalizado para cubrir variantes de mayúsculas/minúsculas)
    if (filtroMetodoPago && filtroMetodoPago !== 'TODAS') {
      facturas = facturas.filter(f => {
        const mp = (f.metodoPago || '').toLowerCase();
        switch (filtroMetodoPago) {
          case 'Tarjeta':       return mp.includes('tarj');
          case 'Transferencia': return mp.includes('trans');
          case 'Crédito':       return mp.includes('cred');
          case 'Efectivo':      return !mp.includes('tarj') && !mp.includes('trans') && !mp.includes('cred');
          default:              return true;
        }
      });
    }

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

  private async obtenerClienteIdsPorCedula(cedula: string): Promise<Set<string>> {
    if (!cedula) return new Set<string>();
    const q = query(this.clientesRef, where('cedula', '==', cedula));
    const snap = await getDocs(q);
    return new Set(snap.docs.map(docSnap => docSnap.id));
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
