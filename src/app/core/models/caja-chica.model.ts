export interface CajaChica {
  id?: string; // ID de Firestore (auto-generado)
  fecha: Date; // Fecha de apertura de la caja
  monto_inicial: number; // Monto inicial de la caja
  monto_actual: number; // Monto actual (se actualiza con cada movimiento)
  estado: 'ABIERTA' | 'CERRADA'; // Estado de la caja
  usuario_id?: string; // ID del usuario que abrió la caja
  usuario_nombre?: string; // Nombre del usuario que abrió la caja
  observacion?: string; // Observaciones generales
  createdAt?: any; // Timestamp de creación
  updatedAt?: any; // Timestamp de actualización
  cerrado_en?: any; // Timestamp de cierre
}

export interface MovimientoCajaChica {
  id?: string; // ID de Firestore (auto-generado)
  caja_chica_id: string; // ID de la caja chica
  fecha: Date; // Fecha del movimiento
  tipo: 'INGRESO' | 'EGRESO'; // Tipo de movimiento
  descripcion: string; // Descripción del movimiento (ej: "Venta efectivo", "Compra pequeña", etc.)
  monto: number; // Monto del movimiento
  saldo_anterior?: number; // Saldo antes del movimiento
  saldo_nuevo?: number; // Saldo después del movimiento
  comprobante?: string; // Referencia a número de venta/factura/ticket
  usuario_id?: string; // ID del usuario que realizó el movimiento
  usuario_nombre?: string; // Nombre del usuario que realizó el movimiento
  observacion?: string; // Observaciones adicionales
  createdAt?: any; // Timestamp de creación
}

export interface ResumenCajaChica {
  caja_id: string;
  total_ingresos: number;
  total_egresos: number;
  saldo_final: number;
  cantidad_movimientos: number;
}
