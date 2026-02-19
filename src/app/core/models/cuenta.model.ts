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
   * ✅ NUEVO: Tipo específico para cuentas por pagar (Deuda o Préstamo).
   * Solo aplica si tipo === PAGAR.
   * - "Deuda": No genera movimiento en caja banco
   * - "Prestamo": Genera ingreso automático en caja banco
   */
  tipoCuentaPorPagar?: TipoCuentaPorPagar;

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
   * Nombre del usuario que creó la cuenta.
   */
  usuario_nombre?: string;

  /**
   * ID del usuario que creó la cuenta.
   */
  usuario_id?: string;

  /**
   * Fecha y hora de creación de la cuenta.
   */
  createdAt?: Date;

  /**
   * Historial de abonos realizados.
   */
  abonos?: AbonoCuenta[];

  /**
   * ID de la caja banco asociada al período contable.
   */
  cuentaBancoId?: string;

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
 * ✅ Tipos de cuentas por pagar (subtipificación).
 * - Deuda: Obligación normal, sin generación de movimiento en caja banco
 * - Prestamo: Préstamo recibido, genera ingreso automático en caja banco
 */
export enum TipoCuentaPorPagar {
  DEUDA = 'Deuda',
  PRESTAMO = 'Prestamo'
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
