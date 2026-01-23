/**
 * Representa una caja chica diaria para la gestión de efectivo en ventas y gastos menores.
 * Registra el flujo de efectivo del día a día en la operación de la óptica.
 *
 * Esta interfaz forma parte del módulo financiero y se integra con el sistema de
 * caja banco cuando se realiza el cierre diario. Implementa soft delete y
 * mantiene trazabilidad del saldo mediante movimientos individuales.
 *
 * Los datos se persisten en la colección 'cajas_chicas' de Firestore.
 */
export interface CajaChica {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Fecha de apertura de la caja chica */
  fecha: Date;

  /** Monto en efectivo con el que se abre la caja */
  monto_inicial: number;

  /** Monto actual en efectivo (se actualiza con cada movimiento) */
  monto_actual: number;

  /** Estado actual de la caja chica */
  estado: 'ABIERTA' | 'CERRADA';

  /** Identificador del usuario que abrió la caja */
  usuario_id?: string;

  /** Nombre completo del usuario que abrió la caja */
  usuario_nombre?: string;

  /** Observaciones generales sobre la caja chica */
  observacion?: string;

  /** Indicador de soft delete (true = activo, false = desactivado) */
  activo?: boolean;

  /** Identificador de la caja banco asociada cuando se cierra esta caja */
  caja_banco_id?: string;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;

  /** Fecha y hora en que se cerró la caja chica */
  cerrado_en?: any;
}

/**
 * Representa un movimiento individual (ingreso o egreso) en la caja chica.
 * Registra transacciones en efectivo como ventas, compras pequeñas y gastos operativos.
 *
 * Cada movimiento afecta el monto actual de la caja chica y mantiene trazabilidad
 * del saldo anterior y nuevo para control y auditoría.
 *
 * Los datos se persisten como subdocumentos en 'cajas_chicas/{id}/movimientos'.
 */
export interface MovimientoCajaChica {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador de la caja chica a la que pertenece este movimiento */
  caja_chica_id: string;

  /** Fecha en que se realizó el movimiento */
  fecha: Date;

  /** Tipo de movimiento de efectivo */
  tipo: 'INGRESO' | 'EGRESO';

  /** Descripción del movimiento (ej: "Venta efectivo", "Compra pequeña") */
  descripcion: string;

  /** Monto del movimiento en efectivo */
  monto: number;

  /** Saldo en efectivo antes de aplicar este movimiento */
  saldo_anterior?: number;

  /** Saldo en efectivo después de aplicar este movimiento */
  saldo_nuevo?: number;

  /** Número de comprobante, venta, factura o ticket asociado */
  comprobante?: string;

  /** Identificador del usuario que realizó el movimiento */
  usuario_id?: string;

  /** Nombre completo del usuario que realizó el movimiento */
  usuario_nombre?: string;

  /** Observaciones adicionales sobre el movimiento */
  observacion?: string;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;
}

/**
 * Proporciona un resumen consolidado de los movimientos de una caja chica.
 * Incluye totales de ingresos, egresos y saldo final para reportes y cierre.
 *
 * Esta interfaz se utiliza en vistas de reportes y cierre de caja chica.
 */
export interface ResumenCajaChica {
  /** Identificador de la caja chica resumida */
  caja_id: string;

  /** Total acumulado de todos los ingresos en efectivo */
  total_ingresos: number;

  /** Total acumulado de todos los egresos en efectivo */
  total_egresos: number;

  /** Saldo final en efectivo (monto_inicial + ingresos - egresos) */
  saldo_final: number;

  /** Cantidad total de movimientos registrados */
  cantidad_movimientos: number;
}
