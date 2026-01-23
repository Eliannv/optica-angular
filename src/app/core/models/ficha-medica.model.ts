/**
 * Representa la graduación óptica de un ojo (derecho o izquierdo).
 * Contiene los valores de la prescripción médica para corrección visual.
 */
export interface GraduacionOjo {
  /** Valor de esfera (corrección de miopía o hipermetropía) */
  esfera: number;

  /** Valor de cilindro (corrección de astigmatismo) */
  cilindro: number;

  /** Ángulo de eje del cilindro (0-180 grados) */
  eje: number;
}

/**
 * Representa una ficha médica o prescripción óptica de un cliente.
 * Registra la graduación de ambos ojos y observaciones del optometrista.
 *
 * Esta interfaz se utiliza en el módulo de atención médica para
 * documentar las prescripciones y generar historiales clínicos.
 *
 * Los datos se persisten en la colección 'fichas_medicas' de Firestore.
 *
 * @deprecated Esta interfaz puede ser reemplazada por HistoriaClinica que incluye más campos.
 */
export interface FichaMedica {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador del cliente al que pertenece la ficha */
  clienteId: string;

  /** Graduación del ojo derecho */
  ojoDerecho: GraduacionOjo;

  /** Graduación del ojo izquierdo */
  ojoIzquierdo: GraduacionOjo;

  /** Observaciones del optometrista o médico */
  observaciones?: string;

  /** Fecha de la consulta o prescripción */
  fecha: Date;
}
