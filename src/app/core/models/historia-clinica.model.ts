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

  // Medidas del armazón (montura)
  armazonH?: number | null;        // Horizontal / A (ancho del aro)
  armazonV?: number | null;        // Vertical / B (alto del aro)
  armazonDM?: number | null;       // Diagonal mayor
  armazonP?: number | null;        // Puente
  armazonTipo?: string;            // Completo / Ranurado / Al Aire
  armazonDNP_OD?: number | null;   // DNP Ojo Derecho
  armazonDNP_OI?: number | null;   // DNP Ojo Izquierdo
  armazonAltura?: number | null;   // Altura del armazón

  createdAt?: any;
  updatedAt?: any;
  doctor?: string;
}
