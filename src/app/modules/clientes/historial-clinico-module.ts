export interface HistoriaClinica {
  clienteId: string;

  // Medidas
  dp: number;
  add?: number;
  altura?: number;

  // Ojo derecho
  odEsfera?: number;
  odCilindro?: number;
  odEje?: number;

  // Ojo izquierdo
  oiEsfera?: number;
  oiCilindro?: number;
  oiEje?: number;

  // Extra
  de: string;
  color: string;
  observacion?: string;

  createdAt?: any;
  updatedAt?: any;
  doctor?: string;
}
