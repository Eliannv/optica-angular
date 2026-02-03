/**
 * Representa un cobro o abono realizado a una factura.
 * Extrae información de las facturas para generar reportes de cobros.
 * 
 * Este modelo se deriva de las facturas donde se registran los abonos
 * y permite generar informes de cobros por cliente, fecha y método de pago.
 */
export interface Cobro {
  /** Identificador único del cobro (derivado del ID de factura) */
  id: string;

  /** Identificador de la factura asociada */
  facturaId: string;

  /** ID personalizado de la factura (10 dígitos) */
  facturaIdPersonalizado?: string;

  /** Identificador del cliente */
  clienteId: string;

  /** Nombre completo del cliente */
  clienteNombre: string;

  /** Teléfono del cliente (opcional) */
  clienteTelefono?: string;

  /** Fecha en que se realizó el cobro */
  fecha: Date;

  /** Monto cobrado en esta transacción */
  monto: number;

  /** Método de pago utilizado (Efectivo, Transferencia, Tarjeta) */
  metodoPago: string;

  /** Código de transferencia bancaria (si aplica) */
  codigoTransferencia?: string;

  /** Total de la factura original */
  totalFactura: number;

  /** Monto total abonado hasta el momento en la factura */
  totalAbonado: number;

  /** Saldo pendiente después de este cobro */
  saldoPendiente: number;

  /** Estado del pago de la factura (PENDIENTE, PAGADA) */
  estadoPago: 'PENDIENTE' | 'PAGADA';

  /** Indica si es crédito personal */
  esCredito?: boolean;

  /** Estado del crédito personal (si aplica) */
  estadoCredito?: 'ACTIVO' | 'CANCELADO';

  /** Identificador del usuario que registró el cobro */
  usuarioId?: string;

  /** Nombre del usuario que registró el cobro */
  usuarioNombre?: string;

  /** Fecha de creación del registro */
  createdAt?: Date;
}

/**
 * Filtros para consultar cobros
 */
export interface FiltrosCobros {
  /** Filtrar por rango de fechas - inicio */
  fechaInicio?: Date;

  /** Filtrar por rango de fechas - fin */
  fechaFin?: Date;

  /** Filtrar por cliente específico */
  clienteId?: string;

  /** Filtrar por método de pago */
  metodoPago?: string;

  /** Filtrar solo créditos personales */
  soloCreditoPersonal?: boolean;

  /** Filtrar por estado de pago */
  estadoPago?: 'PENDIENTE' | 'PAGADA' | 'TODAS';
}
