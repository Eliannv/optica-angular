/**
 * Representa un armazón (montura) de lentes dentro del catálogo de la óptica.
 * Esta interfaz define los atributos básicos de un armazón disponible para la venta,
 * incluyendo información de identificación, presentación y disponibilidad.
 *
 * Forma parte del módulo de inventario y se utiliza en procesos de ventas,
 * cotizaciones y gestión de stock.
 *
 * @deprecated Esta interfaz puede ser reemplazada por el modelo genérico Producto.
 */
export interface Armazon {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Marca comercial del armazón (ej: Ray-Ban, Oakley) */
  marca: string;

  /** Modelo específico del fabricante */
  modelo: string;

  /** Color o acabado del armazón */
  color: string;

  /** Precio de venta al público */
  precio: number;

  /** Cantidad disponible en inventario */
  stock: number;

  /** Indicador de soft delete (true = disponible, false = desactivado) */
  activo: boolean;
}
