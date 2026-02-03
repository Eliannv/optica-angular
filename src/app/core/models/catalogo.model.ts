/**
 * Modelo de Catálogo - Ítems vendibles sin inventario ni deuda.
 *
 * Define los ítems que se pueden vender sin manejar stock real,
 * generación de compras ni deuda. Cada ítem tiene stock infinito
 * y no afecta inventario, caja/banco ni contabilidad.
 *
 * Categorías soportadas:
 * - LUNA: Tipos de lunas oftálmicas
 * - LENTE_CONTACTO: Lentes de contacto
 * - LIQUIDO: Líquidos para limpieza
 * - SERVICIO: Servicios varios (ajuste, corte, etc.)
 *
 * Los datos se persisten en la colección 'catalogo' de Firestore.
 */
export interface CatalogoItem {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Nombre o descripción del ítem */
  nombre: string;

  /** Categoría del ítem catálogo */
  categoria: 'LUNA' | 'LENTE_CONTACTO' | 'LIQUIDO' | 'SERVICIO';

  /** Precio base del ítem (opcional, se puede editar en venta según configuración) */
  precio?: number;

  /** IVA aplicable en porcentaje (ej: 15 para 15%) */
  iva?: number;

  /** Precio final con IVA incluido (calculado automáticamente) */
  precioConIVA?: number;

  /** Indicador de estado: true = activo, false = inactivo */
  activo: boolean;

  /** Observaciones o notas adicionales sobre el ítem */
  observacion?: string | null;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;
}

/**
 * Enum de categorías del catálogo para mejor type-safety
 */
export enum CategoriaCatalogo {
  LUNA = 'LUNA',
  LENTE_CONTACTO = 'LENTE_CONTACTO',
  LIQUIDO = 'LIQUIDO',
  SERVICIO = 'SERVICIO'
}

/**
 * Mapa de etiquetas de categorías para UI
 */
export const CATEGORIA_LABELS: Record<string, string> = {
  [CategoriaCatalogo.LUNA]: 'Tipos de Lunas',
  [CategoriaCatalogo.LENTE_CONTACTO]: 'Lentes de Contacto',
  [CategoriaCatalogo.LIQUIDO]: 'Líquidos Limpia Lunas',
  [CategoriaCatalogo.SERVICIO]: 'Servicios'
};
