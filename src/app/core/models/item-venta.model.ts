/**
 * Representa un ítem o línea de producto dentro de una venta, cotización o factura.
 * Contiene la información del producto vendido, cantidad y cálculo de totales.
 *
 * Esta interfaz se utiliza en los módulos de ventas, cotizaciones y facturación
 * para desglosar los productos incluidos en cada transacción.
 *
 * Nota: Anteriormente se usaba 'armazonId', ahora se usa 'productoId' para mayor flexibilidad.
 */
export interface ItemVenta {
  /** Identificador del producto vendido (reemplaza armazonId) */
  productoId: string;

  /** Nombre del producto (para mostrar en impresiones y reportes) */
  nombre: string;

  /** Tipo de producto (ej: marco, luna, accesorio) - opcional */
  tipo?: string;

  /** Cantidad de unidades vendidas del producto */
  cantidad: number;

  /** Precio unitario del producto al momento de la venta */
  precioUnitario: number;

  /** Total del ítem (cantidad × precioUnitario) */
  total: number;
}
