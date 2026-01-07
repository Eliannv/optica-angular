export interface HistoriaClinica {
  id?: string;
  clienteId: string;

  // Ojo derecho
  odEsfera: number | null;
  odCilindro: number | null;
  odEje: number | null;

  // Ojo izquierdo
  oiEsfera: number | null;
  oiCilindro: number | null;
  oiEje: number | null;

  dp: number;
  add?: number;

  de: string;
  altura: number | null;
  color: string;
  observacion: string;

  createdAt?: any;
  updatedAt?: any;
  doctor?: string;
}
