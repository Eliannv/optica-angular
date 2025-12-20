export interface Producto {
  id?: string;
  codigo: string;
  nombre: string;
  nuevoCodigo?: string;
  grupo?: string;
  genera?: number;
  iva: boolean;
  observacion?: string | null;
  unidad?: string;
  stock?: number;
  costos: {
    caja?: string;
    unidad?: string;
  };
  datos: {
    dato1?: string;
    dato2?: string;
  };
  precios: {
    caja?: string;
    pvp1?: string;
    pvp2?: string;
    unidad?: string;
  };
  proveedores: {
    principal?: string;
    secundario?: string;
    terciario?: string;
  };
  createdAt?: any;
  updatedAt?: any;
}
