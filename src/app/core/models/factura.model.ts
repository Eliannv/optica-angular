import { ItemVenta } from './item-venta.model';

export interface Factura {
  id?: string;

  // Cliente
  clienteId: string;
  clienteNombre: string;      // ✅ para ticket

  // Historial clínico snapshot
  historialSnapshot?: {
    odEsfera: number | null;
    odCilindro: number | null;
    odEje: number | null;

    oiEsfera: number | null;
    oiCilindro: number | null;
    oiEje: number | null;

    de: string;
    altura: number | null;
    color: string;
    observacion?: string;
  } | null;

  // Items
  items: ItemVenta[];

  // Totales
  subtotal: number;
  descuentoId?: string;
  descuentoValor?: number;    // ✅ opcional
  iva?: number;               // ✅ si lo manejas
  total: number;

  // Pago
  metodoPago: string;

  // Auditoría
  fecha: Date;
  usuarioId: string;
}
