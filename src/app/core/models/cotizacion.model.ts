/**
 * Representa una cotización o presupuesto generado para un cliente.
 * Permite calcular el costo estimado de productos antes de realizar la venta.
 *
 * Esta interfaz se utiliza en el módulo de ventas para generar presupuestos
 * y facilitar la toma de decisiones de compra del cliente.
 *
 * Los datos se persisten en la colección 'cotizaciones' de Firestore.
 */
import { ItemVenta } from './item-venta.model';

export interface Cotizacion {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador del cliente al que se le genera la cotización */
  clienteId: string;

  /** Lista de productos incluidos en la cotización */
  items: ItemVenta[];

  /** Subtotal de todos los ítems antes de descuentos */
  subtotal: number;

  /** Identificador del descuento aplicado (opcional) */
  descuentoId?: string;

  /** Total final de la cotización (subtotal - descuento) */
  total: number;

  /** Fecha de creación de la cotización */
  fecha: Date;

  /** Identificador del usuario que generó la cotización */
  usuarioId: string;
}
