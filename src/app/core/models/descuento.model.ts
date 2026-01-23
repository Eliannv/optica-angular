/**
 * Define los tipos de descuento que se pueden aplicar en ventas y cotizaciones.
 */
export type TipoDescuento = 'porcentaje' | 'valor';

/**
 * Representa un descuento configurable para aplicar en ventas y cotizaciones.
 * Permite definir descuentos por porcentaje o valor fijo.
 *
 * Esta interfaz se utiliza en los módulos de ventas, cotizaciones y facturación
 * para calcular el monto final de las transacciones.
 *
 * Los descuentos se persisten en la colección 'descuentos' de Firestore.
 */
export interface Descuento {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Nombre descriptivo del descuento (ej: "Descuento Estudiante", "Promo 10%") */
  nombre: string;

  /** Tipo de descuento que determina cómo se calcula el valor */
  tipo: TipoDescuento;

  /** Valor del descuento (porcentaje 0-100 o monto fijo según tipo) */
  valor: number;

  /** Estado del descuento (true = disponible para uso, false = desactivado) */
  activo: boolean;
}
