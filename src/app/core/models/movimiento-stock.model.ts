export interface MovimientoStock {
  id?: string; // ID de Firestore (auto-generado)
  productoId: string; // ID del producto
  ingresoId?: string; // ID del ingreso (si aplica)
  tipo: 'INGRESO' | 'SALIDA' | 'AJUSTE' | 'VENTA'; // Tipo de movimiento
  cantidad: number; // Cantidad (positivo para ingreso, negativo para salida)
  costoUnitario?: number; // Costo unitario en el momento del movimiento
  stockAnterior: number; // Stock antes del movimiento
  stockNuevo: number; // Stock después del movimiento
  observacion?: string; // Observaciones
  usuarioId?: string; // Usuario que realizó el movimiento
  createdAt?: any; // Timestamp del movimiento
}
