/**
 * Representa una caja banco mensual para la gestión de movimientos financieros
 * que no se manejan en efectivo, como transferencias bancarias, pagos con tarjeta
 * y cierres consolidados de cajas chicas diarias.
 *
 * Esta interfaz forma parte del módulo financiero del sistema y se integra con Firestore
 * para el registro persistente de transacciones de alto nivel.
 *
 * Los datos se persisten en la colección 'cajas_banco' de Firestore.
 */
export interface CajaBanco {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Fecha de apertura de la caja banco */
  fecha: Date;

  /** Saldo inicial al abrir la caja (opcional, para cierres de caja chica) */
  saldo_inicial?: number;

  /** Saldo actual de la caja banco (se actualiza con cada movimiento) */
  saldo_actual: number;

  /** Estado de la caja banco */
  estado: 'ABIERTA' | 'CERRADA';

  /** Identificador del usuario que abrió la caja */
  usuario_id?: string;

  /** Nombre completo del usuario que abrió la caja */
  usuario_nombre?: string;

  /** Observaciones generales sobre la caja banco */
  observacion?: string;

  /** Indicador de soft delete (true = activo, false = desactivado) */
  activo?: boolean;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;

  /** Fecha y hora en que se cerró la caja banco */
  cerrado_en?: any;
}

/**
 * Representa un movimiento individual (ingreso o egreso) en la caja banco.
 * Registra transacciones financieras como transferencias de clientes,
 * cierres de caja chica, pagos a trabajadores y otros movimientos bancarios.
 *
 * Cada movimiento afecta el saldo de la caja banco y mantiene trazabilidad
 * del saldo anterior y nuevo para auditoría.
 *
 * Los datos se persisten como subdocumentos en 'cajas_banco/{id}/movimientos'.
 */
export interface MovimientoCajaBanco {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador de la caja banco asociada (opcional en algunos contextos) */
  caja_banco_id?: string;

  /** Fecha en que se realizó el movimiento */
  fecha: Date;

  /** Tipo de movimiento financiero */
  tipo: 'INGRESO' | 'EGRESO';

  /** Categoría específica del movimiento para clasificación y reportes */
  categoria: 'CIERRE_CAJA_CHICA' | 'TRANSFERENCIA_CLIENTE' | 'PAGO_TRABAJADOR' | 'OTRO_INGRESO' | 'OTRO_EGRESO';

  /** Descripción detallada del movimiento */
  descripcion: string;

  /** Monto del movimiento en la moneda local */
  monto: number;

  /** Saldo de la caja banco antes de aplicar este movimiento */
  saldo_anterior?: number;

  /** Saldo de la caja banco después de aplicar este movimiento */
  saldo_nuevo?: number;

  /** Número de referencia (transferencia, venta, etc.) */
  referencia?: string;

  /** Identificador de la caja chica si el movimiento es un cierre */
  caja_chica_id?: string;

  /** Identificador de la venta si el movimiento es una transferencia de cliente */
  venta_id?: string;

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
 * Proporciona un resumen consolidado de los movimientos de una caja banco.
 * Incluye totales por tipo, categoría y balance final para reportes y auditoría.
 *
 * Esta interfaz se utiliza en vistas de reportes y cierre de caja banco.
 */
export interface ResumenCajaBanco {
  /** Identificador de la caja banco resumida */
  caja_id?: string;

  /** Total acumulado de todos los ingresos */
  total_ingresos: number;

  /** Total acumulado de todos los egresos */
  total_egresos: number;

  /** Saldo final de la caja banco (saldo_inicial + ingresos - egresos) */
  saldo_final: number;

  /** Cantidad total de movimientos registrados */
  cantidad_movimientos: number;

  /** Desglose de ingresos por categoría */
  ingresos_por_categoria: {
    /** Total de ingresos por cierres de cajas chicas */
    cierre_caja_chica: number;
    /** Total de transferencias recibidas de clientes */
    transferencias_clientes: number;
    /** Total de otros ingresos no categorizados */
    otros_ingresos: number;
  };

  /** Desglose de egresos por categoría */
  egresos_por_categoria: {
    /** Total de pagos realizados a trabajadores */
    pagos_trabajadores: number;
    /** Total de otros egresos no categorizados */
    otros_egresos: number;
  };
}
