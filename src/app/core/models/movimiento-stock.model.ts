/**
 * Representa un movimiento individual de stock para un producto en el inventario.
 * Registra cambios en la cantidad disponible por ingresos, salidas, ajustes o ventas.
 *
 * Esta interfaz mantiene la trazabilidad completa del inventario permitiendo
 * auditoría y reconciliación de existencias. Cada movimiento registra el stock
 * anterior y nuevo para validación.
 *
 * Los datos se persisten en la colección 'movimientos_stock' de Firestore.
 */
export interface MovimientoStock {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador del producto afectado por este movimiento */
  productoId: string;

  /** Identificador del ingreso relacionado (si aplica) */
  ingresoId?: string;

  /** Tipo de movimiento que afecta el inventario */
  tipo: 'INGRESO' | 'SALIDA' | 'AJUSTE' | 'VENTA';

  /** Cantidad del movimiento (positivo para ingreso, negativo para salida) */
  cantidad: number;

  /** Costo unitario del producto en el momento del movimiento */
  costoUnitario?: number;

  /** Stock disponible antes de aplicar este movimiento */
  stockAnterior: number;

  /** Stock disponible después de aplicar este movimiento */
  stockNuevo: number;

  /** Observaciones o motivo del movimiento */
  observacion?: string;

  /** Identificador del usuario que realizó el movimiento */
  usuarioId?: string;

  /** Fecha y hora del movimiento en Firestore */
  createdAt?: any;
}
