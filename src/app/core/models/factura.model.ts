import { ItemVenta } from './item-venta.model';

export interface HistorialSnapshot {
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
}

export interface Factura {
  id?: string;
  idPersonalizado?: string; // ID secuencial de 10 dígitos (0000000001, etc)
  clienteId: string;
  clienteNombre?: string;
  historialSnapshot?: any;
  items: any[];
  subtotal: number;
  iva?: number;
  descuentoId?: string;
  total: number;
  metodoPago: string;
  codigoTransferencia?: string; // Código de transferencia bancaria (si aplica)
  fecha: any;
  usuarioId: string;
}
export interface FacturaUI extends Factura {
  id: string;
} 
