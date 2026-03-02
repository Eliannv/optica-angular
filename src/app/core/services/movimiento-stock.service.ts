/**
 * Servicio central para la gestión del Kardex de inventario.
 * Registra movimientos de stock de tipo VENTA de forma atómica usando transacciones
 * Firestore para garantizar la consistencia entre el stock del producto y el Kardex.
 *
 * REGLAS DE NEGOCIO:
 * - Solo los ítems con esServicio !== true generan movimiento de stock.
 * - Solo productos con tipo_control_stock === 'NORMAL' actualizan el campo stock.
 * - Los productos ILIMITADO (p.ej. LUNAS) generan movimiento con stockAnterior/stockNuevo = 0.
 * - El campo stockNuevo nunca puede ser negativo.
 *
 * movimientos_stock es la fuente oficial del Kardex del sistema.
 * Los datos se persisten en la colección 'movimientos_stock' de Firestore.
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  collectionData,
  runTransaction,
  serverTimestamp,
  Timestamp,
  limit,
  startAfter,
  QueryDocumentSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { MovimientoStock, FiltrosKardex, ResumenKardex } from '../models/movimiento-stock.model';
import { ItemVenta } from '../models/item-venta.model';
import { Producto } from '../models/producto.model';

@Injectable({ providedIn: 'root' })
export class MovimientoStockService {
  private readonly fs = inject(Firestore);
  private readonly movimientosRef = collection(this.fs, 'movimientos_stock');
  private readonly productosRef = collection(this.fs, 'productos');

  // ─────────────────────────────────────────────────────────────────────────
  // ESCRITURA — integración con FacturasService
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra movimientos de stock VENTA para todos los ítems físicos de una factura.
   * Usa runTransaction() para garantizar atomicidad: el stock del producto
   * y el movimiento del Kardex se escriben o fallan juntos.
   *
   * - Omite ítems donde esServicio === true.
   * - Omite ítems sin productoId.
   * - Para productos ILIMITADO: crea el movimiento pero no modifica stock.
   * - Para productos NORMAL: descuenta la cantidad y actualiza producto.stock.
   *
   * @param facturaId       ID de la factura recién creada.
   * @param facturaFecha    Fecha de la factura (Date, Timestamp o serverTimestamp).
   * @param items           Array de ítems de la factura.
   * @param referenciaTipo  Método de pago (EFECTIVO, TARJETA, TRANSFERENCIA, etc.).
   * @param sucursalId      ID de sucursal (opcional).
   * @param usuarioId       ID del usuario que creó la factura (opcional).
   */
  async registrarMovimientosVenta(
    facturaId: string,
    facturaFecha: any,
    items: ItemVenta[],
    referenciaTipo?: string,
    sucursalId?: string,
    usuarioId?: string
  ): Promise<void> {
    // ── 1. Filtrar solo ítems físicos con productoId ──────────────────────
    const itemsConStock = (items || []).filter(
      (item) => !item.esServicio && item.productoId?.trim()
    );

    if (itemsConStock.length === 0) {
      console.log('ℹ️ Factura sin productos físicos; no se generan movimientos de stock.');
      return;
    }

    // ── 2. Preparar referencias ───────────────────────────────────────────
    const productoRefs = itemsConStock.map((item) =>
      doc(this.fs, `productos/${item.productoId}`)
    );

    // ── 3. Ejecutar transacción ───────────────────────────────────────────
    await runTransaction(this.fs, async (tx) => {
      // FASE LECTURA — todas las lecturas deben ir antes de cualquier escritura
      const productoSnaps = await Promise.all(
        productoRefs.map((ref) => tx.get(ref))
      );

      // FASE ESCRITURA
      for (let i = 0; i < itemsConStock.length; i++) {
        const item = itemsConStock[i];
        const snap = productoSnaps[i];

        if (!snap.exists()) {
          console.warn(
            `⚠️ Producto ${item.productoId} no encontrado en Firestore; se omite.`
          );
          continue;
        }

        const producto = snap.data() as Producto;
        const tipoControl = producto.tipo_control_stock ?? 'NORMAL';
        const esNormal = tipoControl === 'NORMAL';

        // Cálculo de stock
        const stockAnterior = esNormal ? (producto.stock ?? 0) : 0;
        const stockNuevo = esNormal
          ? Math.max(0, stockAnterior - item.cantidad)
          : 0;

        // Crear documento de movimiento con la nueva estructura
        const movRef = doc(this.movimientosRef);
        const movimiento: Record<string, any> = {
          productoId: item.productoId,
          productoNombre: producto.nombre ?? item.nombre ?? '',
          grupoProducto: producto.grupo ?? '',
          sucursalId: sucursalId || 'PASJO01',
          tipo: 'VENTA NORMAL',
          cantidad: item.cantidad,
          costoUnitario: producto.costo ?? 0,
          precioVenta: item.precioUnitario ?? 0,
          stockAnterior,
          stockNuevo,
          referenciaId: facturaId,
          referenciaTipo: referenciaTipo || 'FACTURA',
          usuarioId: usuarioId ?? '',
          createdAt: serverTimestamp(),
        };

        tx.set(movRef, movimiento);

        // Actualizar stock del producto si tipo NORMAL
        if (esNormal) {
          tx.update(productoRefs[i], {
            stock: stockNuevo,
            updatedAt: new Date(),
          });
        }
      }
    });

    console.log(
      `✅ Movimientos VENTA NORMAL registrados para factura ${facturaId} (${itemsConStock.length} ítems).`
    );
  }

  /**
   * Registra un ingreso de stock (importación o ingreso manual) y actualiza el stock del producto.
   */
  async registrarMovimientoIngreso(input: {
    productoId: string;
    cantidad: number;
    referenciaId: string;
    referenciaTipo: 'IMPORT_EXCEL' | 'INGRESO_MANUAL';
    sucursalId?: string;
    usuarioId?: string;
  }): Promise<void> {
    const productoRef = doc(this.fs, `productos/${input.productoId}`);

    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(productoRef);
      if (!snap.exists()) {
        throw new Error(`Producto ${input.productoId} no encontrado`);
      }

      const producto = snap.data() as Producto;
      const tipoControl = producto.tipo_control_stock ?? 'NORMAL';
      const esNormal = tipoControl === 'NORMAL';

      const stockAnterior = esNormal ? Number(producto.stock || 0) : 0;
      const stockNuevo = esNormal ? stockAnterior + Number(input.cantidad || 0) : 0;

      const movimientoRef = doc(this.movimientosRef);
      tx.set(movimientoRef, {
        cantidad: Number(input.cantidad || 0),
        costoUnitario: Number(producto.costo || 0),
        createdAt: serverTimestamp(),
        grupoProducto: producto.grupo || '',
        precioVenta: Number(producto.pvp1 || 0),
        productoId: input.productoId,
        productoNombre: producto.nombre || '',
        referenciaId: input.referenciaId,
        referenciaTipo: input.referenciaTipo,
        stockAnterior,
        stockNuevo,
        sucursalId: input.sucursalId || 'PASJO01',
        tipo: 'INGRESO',
        usuarioId: input.usuarioId || '',
      });

      if (esNormal) {
        tx.update(productoRef, {
          stock: stockNuevo,
          updatedAt: new Date(),
        });
      }
    });
  }

  /**
   * Registra un ingreso en Kardex sin modificar stock (útil para productos recién creados
   * cuyo stock inicial ya fue persistido previamente).
   */
  async registrarMovimientoIngresoSinActualizarStock(input: {
    productoId: string;
    cantidad: number;
    referenciaId: string;
    referenciaTipo: 'IMPORT_EXCEL' | 'INGRESO_MANUAL';
    sucursalId?: string;
    usuarioId?: string;
  }): Promise<void> {
    const productoRef = doc(this.fs, `productos/${input.productoId}`);
    const snap = await getDoc(productoRef);
    if (!snap.exists()) {
      throw new Error(`Producto ${input.productoId} no encontrado`);
    }

    const producto = snap.data() as Producto;
    const tipoControl = producto.tipo_control_stock ?? 'NORMAL';
    const esNormal = tipoControl === 'NORMAL';
    const stockNuevo = esNormal ? Number(producto.stock || 0) : 0;
    const stockAnterior = esNormal ? Math.max(0, stockNuevo - Number(input.cantidad || 0)) : 0;

    await addDoc(this.movimientosRef, {
      cantidad: Number(input.cantidad || 0),
      costoUnitario: Number(producto.costo || 0),
      createdAt: serverTimestamp(),
      grupoProducto: producto.grupo || '',
      precioVenta: Number(producto.pvp1 || 0),
      productoId: input.productoId,
      productoNombre: producto.nombre || '',
      referenciaId: input.referenciaId,
      referenciaTipo: input.referenciaTipo,
      stockAnterior,
      stockNuevo,
      sucursalId: input.sucursalId || 'PASJO01',
      tipo: 'INGRESO',
      usuarioId: input.usuarioId || '',
    } as any);
  }

  /**
   * Registra movimientos inversos por eliminación de factura y restaura stock.
   */
  async registrarEliminacionFactura(
    facturaId: string,
    items: ItemVenta[],
    referenciaTipo?: string,
    sucursalId?: string,
    usuarioId?: string
  ): Promise<void> {
    const itemsConStock = (items || []).filter(
      (item) => !item.esServicio && item.productoId?.trim() && Number(item.cantidad || 0) > 0
    );

    if (!itemsConStock.length) return;

    const productoRefs = itemsConStock.map((item) => doc(this.fs, `productos/${item.productoId}`));

    await runTransaction(this.fs, async (tx) => {
      const snaps = await Promise.all(productoRefs.map((ref) => tx.get(ref)));

      for (let index = 0; index < itemsConStock.length; index++) {
        const item = itemsConStock[index];
        const snap = snaps[index];
        if (!snap.exists()) continue;

        const producto = snap.data() as Producto;
        const tipoControl = producto.tipo_control_stock ?? 'NORMAL';
        const esNormal = tipoControl === 'NORMAL';

        const stockAnterior = esNormal ? Number(producto.stock || 0) : 0;
        const stockNuevo = esNormal ? stockAnterior + Number(item.cantidad || 0) : 0;

        const movimientoRef = doc(this.movimientosRef);
        tx.set(movimientoRef, {
          cantidad: Number(item.cantidad || 0),
          costoUnitario: Number(producto.costo || 0),
          createdAt: serverTimestamp(),
          grupoProducto: producto.grupo || '',
          precioVenta: Number(item.precioUnitario || producto.pvp1 || 0),
          productoId: item.productoId,
          productoNombre: producto.nombre || item.nombre || '',
          referenciaId: facturaId,
          referenciaTipo: referenciaTipo || 'ELIMINACION_FACTURA',
          stockAnterior,
          stockNuevo,
          sucursalId: sucursalId || 'PASJO01',
          tipo: 'ANULACION',
          usuarioId: usuarioId || '',
        });

        if (esNormal) {
          tx.update(productoRefs[index], {
            stock: stockNuevo,
            updatedAt: new Date(),
          });
        }
      }
    });
  }

  /**
   * Registra ajustes de stock por edición de factura según diferencia por producto.
   */
  async registrarAjustesEdicionFactura(
    facturaId: string,
    itemsOriginales: ItemVenta[],
    itemsNuevos: ItemVenta[],
    referenciaTipo?: string,
    sucursalId?: string,
    usuarioId?: string
  ): Promise<void> {
    const acumulado = new Map<string, { deltaVenta: number; nombre: string; precioVenta: number }>();

    for (const item of itemsOriginales || []) {
      if (item.esServicio || !item.productoId) continue;
      const key = item.productoId;
      const actual = acumulado.get(key) || { deltaVenta: 0, nombre: item.nombre || '', precioVenta: Number(item.precioUnitario || 0) };
      actual.deltaVenta -= Number(item.cantidad || 0);
      acumulado.set(key, actual);
    }

    for (const item of itemsNuevos || []) {
      if (item.esServicio || !item.productoId) continue;
      const key = item.productoId;
      const actual = acumulado.get(key) || { deltaVenta: 0, nombre: item.nombre || '', precioVenta: Number(item.precioUnitario || 0) };
      actual.deltaVenta += Number(item.cantidad || 0);
      actual.nombre = item.nombre || actual.nombre;
      actual.precioVenta = Number(item.precioUnitario || actual.precioVenta || 0);
      acumulado.set(key, actual);
    }

    const ajustes = [...acumulado.entries()]
      .filter(([, value]) => value.deltaVenta !== 0)
      .map(([productoId, value]) => ({ productoId, ...value }));

    if (!ajustes.length) return;

    const refs = ajustes.map((a) => doc(this.fs, `productos/${a.productoId}`));

    await runTransaction(this.fs, async (tx) => {
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

      for (let index = 0; index < ajustes.length; index++) {
        const ajuste = ajustes[index];
        const snap = snaps[index];
        if (!snap.exists()) continue;

        const producto = snap.data() as Producto;
        const tipoControl = producto.tipo_control_stock ?? 'NORMAL';
        const esNormal = tipoControl === 'NORMAL';

        const stockAnterior = esNormal ? Number(producto.stock || 0) : 0;
        const deltaStock = -ajuste.deltaVenta;
        const stockNuevo = esNormal ? Math.max(0, stockAnterior + deltaStock) : 0;

        const movimientoRef = doc(this.movimientosRef);
        tx.set(movimientoRef, {
          cantidad: deltaStock,
          costoUnitario: Number(producto.costo || 0),
          createdAt: serverTimestamp(),
          grupoProducto: producto.grupo || '',
          precioVenta: Number(ajuste.precioVenta || producto.pvp1 || 0),
          productoId: ajuste.productoId,
          productoNombre: producto.nombre || ajuste.nombre || '',
          referenciaId: facturaId,
          referenciaTipo: referenciaTipo || 'AJUSTE_FACTURA',
          stockAnterior,
          stockNuevo,
          sucursalId: sucursalId || 'PASJO01',
          tipo: 'AJUSTE',
          usuarioId: usuarioId || '',
        });

        if (esNormal) {
          tx.update(refs[index], {
            stock: stockNuevo,
            updatedAt: new Date(),
          });
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LECTURA — Kardex
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna todos los movimientos de un producto ordenados por fecha descendente.
   * Incluye INGRESOS y VENTAS — ideal para el Kardex completo.
   */
  getKardexProducto(productoId: string): Observable<MovimientoStock[]> {
    const q = query(
      this.movimientosRef,
      where('productoId', '==', productoId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  /**
   * Retorna los movimientos de un producto con paginación.
   *
   * @param productoId    ID del producto.
   * @param pageSize      Cantidad de registros por página (default: 50).
   * @param lastDoc       Último document snapshot (para siguiente página).
   */
  getKardexPaginado(
    productoId: string,
    pageSize = 50,
    lastDoc?: QueryDocumentSnapshot<any>
  ): Observable<MovimientoStock[]> {
    const q = lastDoc
      ? query(
          this.movimientosRef,
          where('productoId', '==', productoId),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(pageSize)
        )
      : query(
          this.movimientosRef,
          where('productoId', '==', productoId),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  /**
   * Retorna solo los movimientos VENTA de una factura específica.
   */
  getMovimientosPorFactura(facturaId: string): Observable<MovimientoStock[]> {
    const q = query(
      this.movimientosRef,
      where('referenciaId', '==', facturaId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  /**
   * Calcula el stock actual de un producto reconstruyéndolo desde el Kardex.
   * INGRESO suma, VENTA y SALIDA restan, AJUSTE sobreescribe stockNuevo.
   *
   * @returns Promise<number> Stock recalculado.
   */
  async calcularStockDesdeKardex(productoId: string): Promise<number> {
    const q = query(
      this.movimientosRef,
      where('productoId', '==', productoId),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    let stock = 0;
    snap.forEach((d) => {
      const m = d.data() as MovimientoStock;
      if (m.tipo === 'INGRESO' || m.tipo === 'ANULACION' || m.tipo === 'COMPRA_EDITADA') {
        stock += m.cantidad;
      } else if (m.tipo === 'VENTA NORMAL' || m.tipo === 'VENTA' || m.tipo === 'VENTA_EDITADA' || m.tipo === 'SALIDA') {
        stock = Math.max(0, stock - m.cantidad);
      } else if (m.tipo === 'AJUSTE') {
        stock = m.stockNuevo ?? stock;
      }
    });
    return stock;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Consulta Kardex con filtros múltiples (producto, sucursal, rango de fechas).
   * Retorna Observable de movimientos ordenados por fecha ascendente (ideal para tabla Kardex).
   *
   * ÍNDICE REQUERIDO EN FIRESTORE:
   * Collection: movimientos_stock
   * Fields: productoId (Ascending), createdAt (Ascending)
   * Fields: productoId (Ascending), sucursalId (Ascending), createdAt (Ascending)
   *
   * @param filtros - Criterios de búsqueda del Kardex
   * @returns Observable con array de movimientos
   */
  consultarKardex(filtros: FiltrosKardex): Observable<MovimientoStock[]> {
    const constraints: any[] = [];

    // Filtro por producto (recomendado para optimizar consulta)
    if (filtros.productoId) {
      constraints.push(where('productoId', '==', filtros.productoId));
    }

    // Filtro por sucursal
    if (filtros.sucursalId) {
      constraints.push(where('sucursalId', '==', filtros.sucursalId));
    }

    // Filtro por tipo de movimiento
    if (filtros.tipo) {
      constraints.push(where('tipo', '==', filtros.tipo));
    }

    // Filtro por rango de fechas (requiere que createdAt esté en el orderBy)
    if (filtros.fechaInicio) {
      const inicioTimestamp = Timestamp.fromDate(filtros.fechaInicio);
      constraints.push(where('createdAt', '>=', inicioTimestamp));
    }

    if (filtros.fechaFin) {
      const finTimestamp = Timestamp.fromDate(filtros.fechaFin);
      constraints.push(where('createdAt', '<=', finTimestamp));
    }

    // Ordenar por fecha ascendente para mostrar historial cronológico
    constraints.push(orderBy('createdAt', 'asc'));

    const q = query(this.movimientosRef, ...constraints);
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  /**
   * Consulta Kardex con paginación y filtros.
   * Útil para grandes volúmenes de movimientos.
   *
   * @param filtros - Criterios de búsqueda
   * @param pageSize - Cantidad de registros por página (default: 100)
   * @param lastDoc - Último documento para paginación
   */
  consultarKardexPaginado(
    filtros: FiltrosKardex,
    pageSize = 100,
    lastDoc?: QueryDocumentSnapshot<any>
  ): Observable<MovimientoStock[]> {
    const constraints: any[] = [];

    if (filtros.productoId) {
      constraints.push(where('productoId', '==', filtros.productoId));
    }

    if (filtros.sucursalId) {
      constraints.push(where('sucursalId', '==', filtros.sucursalId));
    }

    if (filtros.tipo) {
      constraints.push(where('tipo', '==', filtros.tipo));
    }

    if (filtros.fechaInicio) {
      const inicioTimestamp = Timestamp.fromDate(filtros.fechaInicio);
      constraints.push(where('createdAt', '>=', inicioTimestamp));
    }

    if (filtros.fechaFin) {
      const finTimestamp = Timestamp.fromDate(filtros.fechaFin);
      constraints.push(where('createdAt', '<=', finTimestamp));
    }

    constraints.push(orderBy('createdAt', 'asc'));

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    constraints.push(limit(pageSize));

    const q = query(this.movimientosRef, ...constraints);
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  /**
   * Obtiene todos los movimientos con filtros y calcula el resumen del Kardex.
   * Retorna Promise con array de movimientos y resumen calculado.
   *
   * @param filtros - Criterios de búsqueda
   * @returns Promise con movimientos y resumen
   */
  async obtenerKardexConResumen(
    filtros: FiltrosKardex
  ): Promise<{ movimientos: MovimientoStock[]; resumen: ResumenKardex }> {
    const constraints: any[] = [];

    if (filtros.productoId) {
      constraints.push(where('productoId', '==', filtros.productoId));
    }

    if (filtros.sucursalId) {
      constraints.push(where('sucursalId', '==', filtros.sucursalId));
    }

    if (filtros.tipo) {
      constraints.push(where('tipo', '==', filtros.tipo));
    }

    if (filtros.fechaInicio) {
      const inicioTimestamp = Timestamp.fromDate(filtros.fechaInicio);
      constraints.push(where('createdAt', '>=', inicioTimestamp));
    }

    if (filtros.fechaFin) {
      const finTimestamp = Timestamp.fromDate(filtros.fechaFin);
      constraints.push(where('createdAt', '<=', finTimestamp));
    }

    constraints.push(orderBy('createdAt', 'asc'));

    const q = query(this.movimientosRef, ...constraints);
    const snapshot = await getDocs(q);

    const movimientos: MovimientoStock[] = [];
    let totalEntradas = 0;
    let totalSalidas = 0;
    let stockFinal = 0;
    let utilidadTotal = 0;
    let costoTotalEntradas = 0;
    let valorTotalVentas = 0;

    snapshot.forEach((docSnap) => {
      const mov = { id: docSnap.id, ...docSnap.data() } as MovimientoStock;
      movimientos.push(mov);

      // Calcular totales según tipo de movimiento
      if (mov.tipo === 'INGRESO' || mov.tipo === 'ANULACION' || mov.tipo === 'COMPRA_EDITADA') {
        totalEntradas += mov.cantidad;
        costoTotalEntradas += (mov.costoUnitario ?? 0) * mov.cantidad;
      } else if (mov.tipo === 'VENTA NORMAL' || mov.tipo === 'VENTA' || mov.tipo === 'VENTA_EDITADA') {
        totalSalidas += mov.cantidad;
        const costo = mov.costoUnitario ?? 0;
        const precio = mov.precioVenta ?? 0;
        utilidadTotal += (precio - costo) * mov.cantidad;
        valorTotalVentas += precio * mov.cantidad;
      } else if (mov.tipo === 'SALIDA') {
        totalSalidas += mov.cantidad;
      } else if (mov.tipo === 'AJUSTE') {
        if (mov.cantidad >= 0) {
          totalEntradas += mov.cantidad;
        } else {
          totalSalidas += Math.abs(mov.cantidad);
        }
      }

      // El stock final es el último stockNuevo
      stockFinal = mov.stockNuevo ?? stockFinal;
    });

    const resumen: ResumenKardex = {
      totalEntradas,
      totalSalidas,
      stockFinal,
      utilidadTotal,
      costoTotalEntradas,
      valorTotalVentas,
      cantidadMovimientos: movimientos.length,
    };

    return { movimientos, resumen };
  }

  /**
   * Calcula el resumen de Kardex sin retornar los movimientos (más eficiente).
   *
   * @param filtros - Criterios de búsqueda
   * @returns Promise con resumen calculado
   */
  async calcularResumenKardex(filtros: FiltrosKardex): Promise<ResumenKardex> {
    const { resumen } = await this.obtenerKardexConResumen(filtros);
    return resumen;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Normaliza cualquier formato de fecha a Timestamp de Firestore.
   * Si la fecha no se puede convertir, usa la fecha actual.
   */
  private normalizarFecha(fecha: any): Timestamp {
    if (!fecha) return Timestamp.now();
    if (fecha instanceof Timestamp) return fecha;
    if (fecha instanceof Date) return Timestamp.fromDate(fecha);
    if (fecha?.seconds) return new Timestamp(fecha.seconds, fecha.nanoseconds ?? 0);
    try {
      return Timestamp.fromDate(new Date(fecha));
    } catch {
      return Timestamp.now();
    }
  }
}
