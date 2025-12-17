import { ItemVenta } from './item-venta.model';

export interface Cotizacion {
  id?: string;
  clienteId: string;
  items: ItemVenta[];
  subtotal: number;
  descuentoId?: string;
  total: number;
  fecha: Date;
  usuarioId: string;
}
