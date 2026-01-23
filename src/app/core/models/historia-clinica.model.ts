/**
 * Representa el historial clínico completo de un cliente en la óptica.
 * Incluye graduación de lentes, agudeza visual, medidas del armazón
 * y características de la prescripción óptica.
 *
 * Esta interfaz centraliza toda la información médica y técnica necesaria
 * para fabricar y ajustar lentes correctivos. Se utiliza en el módulo de
 * atención médica y ventas.
 *
 * Los datos se persisten en la colección 'clientes/{id}/historialClinico/main' de Firestore.
 * Nota: Se almacena como un único documento 'main' por cliente.
 */
export interface HistoriaClinica {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador del cliente al que pertenece este historial */
  clienteId: string;

  // Graduación del ojo derecho

  /** Esfera del ojo derecho (corrección de miopía o hipermetropía) */
  odEsfera: number | null;

  /** Cilindro del ojo derecho (corrección de astigmatismo) */
  odCilindro: number | null;

  /** Eje del cilindro del ojo derecho (0-180 grados) */
  odEje: number | null;

  /** Agudeza Visual Sin Corrección del ojo derecho */
  odAVSC?: number | null;

  /** Agudeza Visual Con Corrección del ojo derecho */
  odAVCC?: number | null;

  // Graduación del ojo izquierdo

  /** Esfera del ojo izquierdo (corrección de miopía o hipermetropía) */
  oiEsfera: number | null;

  /** Cilindro del ojo izquierdo (corrección de astigmatismo) */
  oiCilindro: number | null;

  /** Eje del cilindro del ojo izquierdo (0-180 grados) */
  oiEje: number | null;

  /** Agudeza Visual Sin Corrección del ojo izquierdo */
  oiAVSC?: number | null;

  /** Agudeza Visual Con Corrección del ojo izquierdo */
  oiAVCC?: number | null;

  // Medidas adicionales

  /** Distancia pupilar (DP) - separación entre pupilas en milímetros */
  dp: number;

  /** Adición para lentes progresivos o bifocales */
  add?: number;

  /** Tipo de lente o material (ej: CR-39, Policarbonato, etc.) */
  de: string;

  /** Altura del montaje del lente en el armazón */
  altura: number | null;

  /** Color del armazón o lente */
  color: string;

  /** Observaciones médicas o técnicas adicionales */
  observacion: string;

  // Medidas del armazón (montura)

  /** Medida horizontal / A - ancho del aro en milímetros */
  armazonH?: number | null;

  /** Medida vertical / B - alto del aro en milímetros */
  armazonV?: number | null;

  /** Diagonal mayor del aro */
  armazonDM?: number | null;

  /** Medida del puente del armazón */
  armazonP?: number | null;

  /** Tipo de montaje (ej: Completo, Ranurado, Al Aire) */
  armazonTipo?: string;

  /** Distancia Naso-Pupilar del ojo derecho */
  armazonDNP_OD?: number | null;

  /** Distancia Naso-Pupilar del ojo izquierdo */
  armazonDNP_OI?: number | null;

  /** Altura del armazón desde el centro del aro */
  armazonAltura?: number | null;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;

  /** Nombre del médico u optometrista que realizó la prescripción */
  doctor?: string;
}
