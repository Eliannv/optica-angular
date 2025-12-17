import { ItemVenta } from './item-venta.model';

export interface Factura {
  id?: string;
  clienteId: string;
  items: ItemVenta[];
  subtotal: number;
  descuentoId?: string;
  total: number;
  metodoPago: string;
  fecha: Date;
  usuarioId: string;
}
