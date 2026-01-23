/**
 * Representa un ingreso de mercadería o factura de compra a un proveedor.
 * Registra las compras de productos para el inventario, incluyendo detalles
 * fiscales, costos y condiciones de pago.
 *
 * Esta interfaz forma parte del módulo de inventario y gestión de compras.
 * Se relaciona con productos y proveedores para mantener trazabilidad.
 *
 * Los datos se persisten en la colección 'ingresos' de Firestore.
 */
export interface Ingreso {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** ID secuencial de 10 dígitos para identificación del ingreso (ej: 0000000001) */
  idPersonalizado?: string;

  /** Nombre del proveedor que emitió la factura */
  proveedor: string;

  /** Identificador del proveedor en la base de datos (opcional) */
  proveedorId?: string;

  /** Número de factura emitido por el proveedor */
  numeroFactura: string;

  /** Fecha de emisión de la factura del proveedor */
  fecha: Date;

  /** Tipo de compra realizada */
  tipoCompra: 'CONTADO' | 'CREDITO';

  /** Observaciones generales sobre el ingreso */
  observacion?: string;

  /** Descuento aplicado al total de la factura */
  descuento?: number;

  /** Costo de flete o transporte de la mercadería */
  flete?: number;

  /** Monto del IVA de la factura */
  iva?: number;

  /** Total de la factura (subtotal + flete + IVA - descuento) */
  total?: number;

  /** Estado del ingreso en el flujo de trabajo */
  estado?: 'BORRADOR' | 'FINALIZADO';

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;
}

/**
 * Representa un ítem o línea de producto dentro de un ingreso de mercadería.
 * Contiene los detalles del producto comprado, incluyendo información para
 * productos existentes y nuevos que se dan de alta con el ingreso.
 *
 * Esta interfaz soporta la creación de nuevos productos y la actualización
 * de stock de productos existentes, incluyendo reactivación de productos desactivados.
 *
 * Los detalles se persisten como subdocumentos en 'ingresos/{id}/detalles'.
 */
export interface DetalleIngreso {
  /** ID temporal para manejo en UI antes de guardar en Firestore */
  id?: string;

  /** Identificador del producto si ya existe en inventario */
  productoId?: string;

  /** Tipo de producto en el ingreso */
  tipo: 'EXISTENTE' | 'NUEVO';

  // Datos del producto

  /** Nombre descriptivo del producto */
  nombre: string;

  /** Modelo específico del producto */
  modelo?: string;

  /** Color o acabado del producto */
  color?: string;

  /** Grupo o categoría del producto */
  grupo?: string;

  /** Código de armazón o ID interno del sistema */
  codigo?: string;

  /** ID interno incremental para nuevos productos */
  idInterno?: number;

  // Datos del ingreso

  /** Cantidad de unidades compradas */
  cantidad: number;

  /** Costo unitario de adquisición */
  costoUnitario?: number;

  /** Observación específica del producto en este ingreso */
  observacion?: string;

  // Datos completos para productos nuevos

  /** Precio de venta sugerido para nuevos productos */
  pvp1?: number;

  /** Porcentaje de IVA del producto (ej: 15 para 15%) */
  iva?: number;

  /** Stock inicial para nuevos productos (igual a cantidad) */
  stockInicial?: number;

  // Campos para productos desactivados que se reactivan

  /** Indica si el producto estaba previamente desactivado */
  estaDesactivado?: boolean;

  /** Stock anterior del producto que debe sumarse al reactivar */
  stockActivoAnterior?: number;
}
