/**
 * Representa un cobro/pago de una deuda pendiente de una factura.
 * 
 * Cada documento FacturaDeuda es una transacción independiente que registra
 * un abono parcial o total a una factura original.
 * 
 * La factura original permanece inmutable. Los pagos se registran como
 * documentos separados para máxima trazabilidad y auditoría.
 * 
 * Los datos se persisten en la colección 'facturas_deudas' de Firestore.
 */
export interface FacturaDeuda {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** ID de la factura original a la que corresponde este pago */
  facturaId: string;

  /** ID personalizado de la factura original (10 dígitos) */
  facturaIdPersonalizado?: string;

  /** Identificador del cliente */
  clienteId: string;

  /** Nombre completo del cliente - DESNORMALIZADO para evitar lookup extra */
  clienteNombre: string;

  /** Método de pago utilizado - DESNORMALIZADO para evitar lookup extra */
  metodoPago: string;

  /** Teléfono del cliente (opcional) */
  clienteTelefono?: string;

  /** Fecha en que se realizó el pago de la deuda */
  fechaPago: Date;

  /** Monto pagado en este abono */
  montoPagado: number;

  /** Total original de la factura */
  totalFactura: number;

  /** Saldo restante DESPUÉS de este pago */
  saldoRestante: number;

  /** Código de transferencia bancaria (si aplica) */
  codigoTransferencia?: string;

  /** Últimos 4 dígitos de la tarjeta (si aplica) */
  ultimosCuatroTarjeta?: string;

  /** Estado de la factura original después de este pago (PENDIENTE, PAGADA) */
  estadoPago: 'PENDIENTE' | 'PAGADA';

  /** Indica si la factura original es crédito personal */
  esCredito?: boolean;

  /** Identificador del usuario que registró el pago */
  usuarioId?: string;

  /** Nombre del usuario que registró el pago */
  usuarioNombre?: string;

  /** Observaciones adicionales sobre el pago */
  observacion?: string;

  /** Tipo de movimiento para clasificación (siempre PAGO_DEUDA) */
  tipoMovimiento: 'PAGO_DEUDA';

  /** Origen del movimiento (CAJA_CHICA o CAJA_BANCO) */
  origenCaja: 'CAJA_CHICA' | 'CAJA_BANCO';

  /** ID de la caja chica donde se registró el pago (si es CAJA_CHICA) */
  cajaChicaId?: string;

  /** ID del movimiento en caja chica/banco para referencia cruzada */
  movimientoId?: string;

  /** Fecha de creación del registro */
  createdAt?: Date;

  /** Última fecha de actualización */
  updatedAt?: Date;
}
