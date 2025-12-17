export interface GraduacionOjo {
  esfera: number;
  cilindro: number;
  eje: number;
}

export interface FichaMedica {
  id?: string;
  clienteId: string;
  ojoDerecho: GraduacionOjo;
  ojoIzquierdo: GraduacionOjo;
  observaciones?: string;
  fecha: Date;
}
