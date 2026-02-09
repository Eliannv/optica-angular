/**
 * Representa una venta pagada con tarjeta cuyo ingreso llega del banco en diferido.
 * Se maneja como cuenta por cobrar al banco, sin afectar caja al momento de la venta.
 */
export interface VentaTarjeta {
  /** ID del documento (usa el ID de la factura) */
  id?: string;

  /** ID de la factura original */
  facturaId: string;

  /** ID personalizado de la factura (10 digitos) */
  facturaIdPersonalizado?: string;

  /** Identificador del cliente */
  clienteId: string;

  /** Nombre completo del cliente */
  clienteNombre: string;

  /** Fecha de la venta */
  fechaVenta: Date;

  /** Monto total de la venta */
  montoTotal: number;

  /** Monto recibido acumulado desde el banco */
  montoRecibido: number;

  /** Saldo pendiente por recibir del banco */
  saldoPendiente: number;

  /** Estado de cobro al banco */
  estado: 'PENDIENTE' | 'LIQUIDADA';

  /** Ultimos 4 digitos de la tarjeta (opcional) */
  ultimosCuatroTarjeta?: string;

  /** Banco reportado por el usuario (opcional) */
  banco?: string;

  /** Numero de lote o referencia (opcional) */
  numeroLote?: string;

  /** Observacion general (opcional) */
  observacion?: string;

  /** ID de la caja banco del periodo de la venta */
  cuentaBancoId?: string;

  /** Historial de ingresos recibidos del banco */
  abonos?: AbonoVentaTarjeta[];

  /** Fecha de creacion */
  createdAt?: Date;

  /** Fecha de ultima actualizacion */
  updatedAt?: Date;
}

/**
 * Representa un ingreso recibido del banco por una venta con tarjeta.
 */
export interface AbonoVentaTarjeta {
  /** Fecha real del deposito del banco */
  fecha: Date;

  /** Monto recibido */
  monto: number;

  /** Banco (opcional) */
  banco?: string;

  /** Numero de lote o referencia (opcional) */
  numeroLote?: string;

  /** Observacion del ingreso (opcional) */
  observacion?: string;

  /** Saldo restante luego del ingreso */
  saldoRestante: number;
}
