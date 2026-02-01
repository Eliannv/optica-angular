/**
 * Modelo que representa una cuenta por pagar o por cobrar en el sistema.
 *
 * Las cuentas pueden ser:
 * - PAGAR: Deudas que tenemos con terceros (al registrar, suma a caja/banco)
 * - COBRAR: Deudas que terceros tienen con nosotros (al registrar, descuenta de caja/banco)
 *
 * Estados:
 * - ACTIVA: Cuenta con saldo pendiente
 * - CANCELADA: Cuenta completamente pagada/cobrada (saldo = 0)
 */

export interface Cuenta {
  /**
   * ID único del documento en Firestore.
   */
  id?: string;

  /**
   * Fecha de creación de la cuenta.
   */
  fecha: Date;

  /**
   * Tipo de cuenta (PAGAR o COBRAR).
   */
  tipo: TipoCuenta;

  /**
   * Monto total inicial de la cuenta.
   */
  montoTotal: number;

  /**
   * Monto total abonado hasta el momento.
   */
  montoAbonado: number;

  /**
   * Saldo pendiente (montoTotal - montoAbonado).
   */
  saldo: number;

  /**
   * Estado actual de la cuenta.
   */
  estado: EstadoCuenta;

  /**
   * Descripción o motivo de la cuenta.
   */
  observacion: string;

  /**
   * Historial de abonos realizados.
   */
  abonos?: AbonoCuenta[];

  /**
   * Fecha de última modificación.
   */
  fechaModificacion?: Date;
}

/**
 * Tipos de cuenta disponibles.
 */
export enum TipoCuenta {
  PAGAR = 'PAGAR',
  COBRAR = 'COBRAR'
}

/**
 * Estados posibles de una cuenta.
 */
export enum EstadoCuenta {
  ACTIVA = 'ACTIVA',
  CANCELADA = 'CANCELADA'
}

/**
 * Representa un abono/pago realizado a una cuenta.
 */
export interface AbonoCuenta {
  /**
   * Fecha del abono.
   */
  fecha: Date;

  /**
   * Monto del abono.
   */
  monto: number;

  /**
   * Observación del abono (opcional).
   */
  observacion?: string;

  /**
   * Saldo restante después del abono.
   */
  saldoRestante: number;
}
