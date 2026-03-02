/**
 * Representa un movimiento individual de stock (Kardex) para un producto.
 * Registra cambios en la cantidad disponible por ingresos, ventas, salidas, ajustes o anulaciones.
 *
 * Estructura oficial del Kardex — movimientos_stock es la fuente de verdad del inventario.
 * Los datos se persisten en la colección 'movimientos_stock' de Firestore.
 */
export interface MovimientoStock {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador de Firestore del producto afectado */
  productoId: string;

  /** Nombre del producto en el momento del movimiento (desnormalizado) */
  productoNombre?: string;

  /** Grupo o categoría del producto (ej: ARMAZONES, LUNAS, ACCESORIOS) */
  grupoProducto?: string;

  /** Identificador de la sucursal donde ocurrió el movimiento */
  sucursalId?: string;

  /** Tipo de movimiento que afecta el inventario */
  tipo: 'INGRESO' | 'AJUSTE' | 'ANULACION' | 'VENTA NORMAL' | 'VENTA' | 'SALIDA' | 'ELIMINACION' | 'VENTA_EDITADA' | 'COMPRA_EDITADA';

  /** Cantidad del movimiento (positiva para entradas, negativa para salidas) */
  cantidad: number;

  /** Costo unitario del producto en el momento del movimiento */
  costoUnitario?: number;

  /** Precio unitario al que se vendió el producto (solo tipo VENTA) */
  precioVenta?: number;

  /** Stock disponible antes de aplicar este movimiento */
  stockAnterior: number;

  /** Stock disponible después de aplicar este movimiento */
  stockNuevo: number;

  /**
   * ID del documento origen del movimiento:
   * - VENTA / ANULACION: ID de la factura
   * - INGRESO: ID del ingreso (compra al proveedor)
   * - AJUSTE: ID del documento de ajuste
   */
  referenciaId?: string;

  /**
   * Tipo de referencia del movimiento:
   * - Para VENTA: método de pago (EFECTIVO, TARJETA, TRANSFERENCIA, etc.)
   * - Para INGRESO: número de factura del proveedor
   * - Para AJUSTE: motivo del ajuste
   */
  referenciaTipo?: string;

  /** Observación o nota libre del movimiento */
  observacion?: string;

  /** Identificador del usuario que realizó el movimiento */
  usuarioId?: string;

  /** Fecha y hora del movimiento en Firestore */
  createdAt?: any;
}

/**
 * Filtros para consultas de Kardex con criterios múltiples.
 */
export interface FiltrosKardex {
  /** ID del producto (requerido para consultas óptimas) */
  productoId?: string;

  /** ID de la sucursal (opcional) */
  sucursalId?: string;

  /** Fecha inicial del rango (inclusive) */
  fechaInicio?: Date;

  /** Fecha final del rango (inclusive) */
  fechaFin?: Date;

  /** Tipo de movimiento a filtrar (opcional) */
  tipo?: 'INGRESO' | 'AJUSTE' | 'ANULACION' | 'VENTA NORMAL' | 'VENTA' | 'SALIDA' | 'ELIMINACION' | 'VENTA_EDITADA' | 'COMPRA_EDITADA';
}

/**
 * Resumen calculado del Kardex mostrando totalizaciones.
 */
export interface ResumenKardex {
  /** Total de unidades ingresadas */
  totalEntradas: number;

  /** Total de unidades salidas */
  totalSalidas: number;

  /** Stock final (último stockNuevo del período) */
  stockFinal: number;

  /** Utilidad total de ventas: sum((precioVenta - costoUnitario) * cantidad) */
  utilidadTotal: number;

  /** Costo total de entradas: sum(costoUnitario * cantidad) para INGRESO */
  costoTotalEntradas: number;

  /** Valor total de ventas: sum(precioVenta * cantidad) para VENTA */
  valorTotalVentas: number;

  /** Cantidad de movimientos procesados */
  cantidadMovimientos: number;
}
