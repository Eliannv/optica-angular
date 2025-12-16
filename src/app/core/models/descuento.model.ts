export type TipoDescuento = 'porcentaje' | 'valor';

export interface Descuento {
  id?: string;
  nombre: string;
  tipo: TipoDescuento;
  valor: number;
  activo: boolean;
}
