/**
 * Representa un producto del inventario de la óptica.
 * Incluye armazones, lentes de contacto y otros artículos comercializables.
 *
 * Esta interfaz unifica la gestión de inventario permitiendo el control de stock,
 * costos, precios y relación con proveedores. Implementa soft delete y mantiene
 * campos legacy para compatibilidad con datos históricos.
 *
 * Los datos se persisten en la colección 'productos' de Firestore.
 */
export interface Producto {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** ID incremental interno del sistema (ej: 1001, 1002) */
  idInterno?: number;

  /** Código de armazón o identificador para el trabajador */
  codigo: string;

  /** Nombre descriptivo del producto */
  nombre: string;

  /** Modelo específico del producto */
  modelo?: string;

  /** Color o acabado del producto */
  color?: string;

  /** Grupo o categoría del producto (ej: GAFAS, LENTES DE CONTACTO) */
  grupo?: string;

  /** Cantidad disponible en inventario */
  stock?: number;

  /** Costo unitario de adquisición del producto */
  costo?: number;

  /** Precio de venta público sugerido */
  pvp1?: number;

  /** Porcentaje de IVA aplicable (ej: 15 para 15%) */
  iva?: number;

  /** Precio final con IVA incluido (usado en ventas) */
  precioConIVA?: number;

  /** Nombre del proveedor principal */
  proveedor?: string;

  /** Identificador del ingreso/factura de donde proviene este producto */
  ingresoId?: string;

  /** Observaciones o notas adicionales sobre el producto */
  observacion?: string | null;

  /** Indicador de soft delete (true = activo, false = desactivado) */
  activo?: boolean;

  // Campos legacy - mantener para compatibilidad con datos existentes

  /** Código alternativo del producto (legacy) */
  nuevoCodigo?: string;

  /** Campo numérico genérico (legacy) */
  genera?: number;

  /** Unidad de medida (legacy) */
  unidad?: string;

  /** Estructura de costos detallada (legacy) */
  costos?: {
    /** Costo por caja (legacy) */
    caja?: string;
    /** Costo por unidad (legacy) */
    unidad?: string;
  };

  /** Datos adicionales estructurados (legacy) */
  datos?: {
    /** Campo de dato 1 (legacy) */
    dato1?: string;
    /** Campo de dato 2 (legacy) */
    dato2?: string;
  };

  /** Estructura de precios múltiples (legacy) */
  precios?: {
    /** Precio por caja (legacy) */
    caja?: string;
    /** Precio de venta público 1 (legacy) */
    pvp1?: string;
    /** Precio de venta público 2 (legacy) */
    pvp2?: string;
    /** Precio por unidad (legacy) */
    unidad?: string;
  };

  /** Múltiples proveedores (legacy) */
  proveedores?: {
    /** Proveedor principal (legacy) */
    principal?: string;
    /** Proveedor secundario (legacy) */
    secundario?: string;
    /** Proveedor terciario (legacy) */
    terciario?: string;
  };

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;
}
