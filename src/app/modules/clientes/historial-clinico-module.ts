/**
 * Modelo de datos para el historial clínico oftalmológico.
 *
 * Define la estructura de información médica almacenada para cada cliente,
 * incluyendo datos de refracción ocular (OD/OI), agudeza visual, y medidas
 * específicas para la prescripción de lentes.
 *
 * Este modelo se almacena en Firestore en la ruta:
 * clientes/{clienteId}/historialClinico/main
 */

export interface HistoriaClinica {
  clienteId: string;

  dp: number;
  add?: number;
  altura?: number;

  odEsfera?: number;
  odCilindro?: number;
  odEje?: number;

  oiEsfera?: number;
  oiCilindro?: number;
  oiEje?: number;

  de: string;
  color: string;
  observacion?: string;

  createdAt?: any;
  updatedAt?: any;
  doctor?: string;
}
