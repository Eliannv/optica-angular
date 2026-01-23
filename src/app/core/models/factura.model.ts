/**
 * Captura los datos de la historia clínica del cliente en el momento de la venta.
 * Permite mantener un registro histórico de la graduación usada para cada factura,
 * independiente de cambios futuros en la historia clínica del cliente.
 *
 * Esta interfaz preserva la información médica relevante al momento de la venta.
 */
import { ItemVenta } from './item-venta.model';

export interface HistorialSnapshot {
  /** Esfera del ojo derecho */
  odEsfera: number | null;

  /** Cilindro del ojo derecho */
  odCilindro: number | null;

  /** Eje del ojo derecho */
  odEje: number | null;

  /** Esfera del ojo izquierdo */
  oiEsfera: number | null;

  /** Cilindro del ojo izquierdo */
  oiCilindro: number | null;

  /** Eje del ojo izquierdo */
  oiEje: number | null;

  /** Distancia entre pupilas */
  de: string;

  /** Altura del montaje del lente */
  altura: number | null;

  /** Color del armazón o lente */
  color: string;

  /** Observaciones adicionales sobre la graduación */
  observacion?: string;
}

/**
 * Representa una factura de venta completa emitida a un cliente.
 * Registra la transacción comercial con todos sus detalles: productos,
 * montos, método de pago y datos del cliente.
 *
 * Esta interfaz forma parte del módulo de facturación y se integra con
 * los módulos de inventario, caja chica y caja banco según el método de pago.
 *
 * Los datos se persisten en la colección 'facturas' de Firestore.
 */
export interface Factura {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** ID secuencial de 10 dígitos para identificación de factura (ej: 0000000001) */
  idPersonalizado?: string;

  /** Identificador del cliente que realiza la compra */
  clienteId: string;

  /** Nombre completo del cliente (para impresión y consultas rápidas) */
  clienteNombre?: string;

  /** Snapshot de la historia clínica del cliente al momento de la venta */
  historialSnapshot?: any;

  /** Lista de productos vendidos en esta factura */
  items: any[];

  /** Subtotal de todos los ítems antes de IVA y descuentos */
  subtotal: number;

  /** Monto del IVA aplicado a la venta */
  iva?: number;

  /** Identificador del descuento aplicado (opcional) */
  descuentoId?: string;

  /** Total final de la factura (subtotal + IVA - descuento) */
  total: number;

  /** Método de pago utilizado (efectivo, transferencia, tarjeta, etc.) */
  metodoPago: string;

  /** Código de transferencia bancaria cuando el pago es por transferencia */
  codigoTransferencia?: string;

  /** Fecha de emisión de la factura */
  fecha: any;

  /** Identificador del usuario que generó la factura */
  usuarioId: string;
}

/**
 * Extiende la interfaz Factura garantizando que el ID esté siempre presente.
 * Utilizada en la capa de presentación para operaciones que requieren
 * el ID como obligatorio (edición, eliminación, visualización).
 */
export interface FacturaUI extends Factura {
  /** Identificador único obligatorio de Firestore */
  id: string;
} 
