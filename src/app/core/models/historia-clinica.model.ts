export interface HistoriaClinica {
  id?: string;
  clienteId: string;

  // Ojo derecho
  odEsfera: number | null;
  odCilindro: number | null;
  odEje: number | null;
  odAVSC?: number | null;  // Agudeza Visual Sin Corrección
  odAVCC?: number | null;  // Agudeza Visual Con Corrección

  // Ojo izquierdo
  oiEsfera: number | null;
  oiCilindro: number | null;
  oiEje: number | null;
  oiAVSC?: number | null;  // Agudeza Visual Sin Corrección
  oiAVCC?: number | null;  // Agudeza Visual Con Corrección

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
