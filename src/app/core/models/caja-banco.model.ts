export interface CajaBanco {
  id?: string; // ID de Firestore (auto-generado)
  fecha: Date; // Fecha de apertura de la caja
  saldo_inicial?: number; // Saldo inicial (opcional, para cierre de caja chica)
  saldo_actual: number; // Saldo actual
  estado: 'ABIERTA' | 'CERRADA'; // Estado
  usuario_id?: string; // ID del usuario que abrió
  usuario_nombre?: string; // Nombre del usuario
  observacion?: string; // Observaciones
  createdAt?: any; // Timestamp de creación
  updatedAt?: any; // Timestamp de actualización
  cerrado_en?: any; // Timestamp de cierre
}

export interface MovimientoCajaBanco {
  id?: string; // ID de Firestore (auto-generado)
  caja_banco_id?: string; // ID de la caja banco (si aplica, es opcional)
  fecha: Date; // Fecha del movimiento
  tipo: 'INGRESO' | 'EGRESO'; // Tipo de movimiento
  categoria: 'CIERRE_CAJA_CHICA' | 'TRANSFERENCIA_CLIENTE' | 'PAGO_TRABAJADOR' | 'OTRO_INGRESO' | 'OTRO_EGRESO'; // Categoría del movimiento
  descripcion: string; // Descripción del movimiento
  monto: number; // Monto del movimiento
  saldo_anterior?: number; // Saldo antes del movimiento
  saldo_nuevo?: number; // Saldo después del movimiento
  referencia?: string; // Referencia: número de transferencia, ID de venta, etc.
  caja_chica_id?: string; // ID de la caja chica (si es cierre de caja)
  venta_id?: string; // ID de la venta (si es transferencia de cliente)
  usuario_id?: string; // ID del usuario que realizó el movimiento
  usuario_nombre?: string; // Nombre del usuario
  observacion?: string; // Observaciones adicionales
  createdAt?: any; // Timestamp de creación
}

export interface ResumenCajaBanco {
  caja_id?: string;
  total_ingresos: number;
  total_egresos: number;
  saldo_final: number;
  cantidad_movimientos: number;
  ingresos_por_categoria: {
    cierre_caja_chica: number;
    transferencias_clientes: number;
    otros_ingresos: number;
  };
  egresos_por_categoria: {
    pagos_trabajadores: number;
    otros_egresos: number;
  };
}
