/**
 * Representa un egreso (salida) de mercadería del inventario.
 * 
 * Los egresos pueden ser por diferentes motivos:
 * - Devolución a proveedor
 * - Producto dañado/defectuoso
 * - Ajuste de inventario
 * - Donación
 * - Uso interno
 * - Pérdida o robo
 * 
 * Cada egreso reduce el stock del producto y queda registrado
 * para trazabilidad y control de inventario.
 * 
 * NUEVO: Ahora soporta múltiples productos por egreso y relación con proveedor
 */
export interface EgresoMercaderia {
  /** ID único de Firestore */
  id?: string;

  /** DEPRECATED: ID del producto que egresa - usar productosEgresados */
  productoId?: string;

  /** DEPRECATED: ID interno del producto - usar productosEgresados */
  productoIdInterno?: number;

  /** DEPRECATED: Nombre del producto - usar productosEgresados */
  productoNombre?: string;

  /** DEPRECATED: Modelo del producto - usar productosEgresados */
  productoModelo?: string;

  /** DEPRECATED: Color del producto - usar productosEgresados */
  productoColor?: string;

  /** DEPRECATED: Grupo del producto - usar productosEgresados */
  productoGrupo?: string;

  /** DEPRECATED: Cantidad de unidades - usar productosEgresados */
  cantidad?: number;

  /** DEPRECATED: Costo unitario - usar productosEgresados */
  costoUnitario?: number;

  /** Lista de productos egresados (nuevo sistema multi-producto) */
  productosEgresados: DetalleProductoEgreso[];

  /** Motivo del egreso */
  motivo: MotivoEgreso;

  /** Descripción detallada o comentarios adicionales */
  descripcion: string;

  /** Fecha y hora del egreso */
  fecha: Date;

  /** ID del usuario que registró el egreso */
  usuarioId: string;

  /** Nombre del usuario que registró el egreso */
  usuarioNombre: string;

  /** Costo total del egreso (suma de todos los productos) */
  costoTotal: number;

  /** ID del proveedor asociado (si aplica) */
  proveedorId?: string;

  /** Nombre del proveedor (copiado para historial) */
  proveedorNombre?: string;

  /** ID de la sucursal donde se registró el egreso */
  sucursalId?: string;

  /** Nombre de la sucursal */
  sucursalNombre?: string;

  /** Documento de referencia (opcional, ej: número de devolución) */
  documentoReferencia?: string;

  /** Indicador de egreso activo (para soft delete) */
  activo?: boolean;

  /** Fecha de creación del registro */
  createdAt?: Date;

  /** Fecha de última modificación */
  updatedAt?: Date;
}

/**
 * Detalle de un producto egresado dentro de un egreso
 */
export interface DetalleProductoEgreso {
  /** ID del producto */
  productoId: string;

  /** ID interno del producto (opcional) */
  productoIdInterno?: number;

  /** Nombre del producto */
  productoNombre: string;

  /** Código del producto */
  productoCodigo?: string;

  /** Marca del producto (opcional) */
  productoMarca?: string;

  /** Modelo del producto (opcional) */
  productoModelo?: string;

  /** Color del producto (opcional) */
  productoColor?: string;

  /** Grupo del producto (opcional) */
  productoGrupo?: string;

  /** Cantidad de unidades que egresan */
  cantidad: number;

  /** Costo unitario del producto al momento del egreso */
  costoUnitario: number;

  /** Costo total (cantidad * costoUnitario) */
  costoTotal: number;
}

/**
 * Motivos posibles para el egreso de mercadería
 */
export type MotivoEgreso = 
  | 'DEVOLUCION_PROVEEDOR'
  | 'PRODUCTO_DANADO'
  | 'PRODUCTO_DEFECTUOSO'
  | 'AJUSTE_INVENTARIO'
  | 'DONACION'
  | 'USO_INTERNO'
  | 'PERDIDA'
  | 'ROBO'
  | 'VENCIMIENTO'
  | 'OTRO';

/**
 * Etiquetas legibles para los motivos de egreso
 */
export const MOTIVOS_EGRESO: Record<MotivoEgreso, string> = {
  DEVOLUCION_PROVEEDOR: 'Devolución a Proveedor',
  PRODUCTO_DANADO: 'Producto Dañado',
  PRODUCTO_DEFECTUOSO: 'Producto Defectuoso',
  AJUSTE_INVENTARIO: 'Ajuste de Inventario',
  DONACION: 'Donación',
  USO_INTERNO: 'Uso Interno',
  PERDIDA: 'Pérdida',
  ROBO: 'Robo',
  VENCIMIENTO: 'Vencimiento',
  OTRO: 'Otro'
};

/**
 * Filtros para consultar egresos de mercadería
 */
export interface FiltrosEgresoMercaderia {
  /** Filtrar por rango de fechas - inicio */
  fechaInicio?: Date;

  /** Filtrar por rango de fechas - fin */
  fechaFin?: Date;

  /** Filtrar por motivo específico */
  motivo?: MotivoEgreso;

  /** Filtrar por producto (búsqueda por código o nombre) */
  productoBusqueda?: string;

  /** Filtrar por usuario que registró */
  usuarioId?: string;

  /** Filtrar por sucursal */
  sucursalId?: string;

  /** Incluir solo egresos activos */
  soloActivos?: boolean;
}

/**
 * Resumen estadístico de egresos
 */
export interface ResumenEgresos {
  /** Total de egresos en el período */
  totalEgresos: number;

  /** Cantidad total de unidades egresadas */
  totalUnidades: number;

  /** Costo total de mercadería egresada */
  costoTotal: number;

  /** Egresos agrupados por motivo */
  porMotivo: Record<MotivoEgreso, {
    cantidad: number;
    unidades: number;
    costo: number;
  }>;

  /** Productos más egresados */
  productosMasEgresados: ProductoEgresado[];
}

/**
 * Representa un producto egresado con sus estadísticas
 */
export interface ProductoEgresado {
  productoId: string;
  productoIdInterno?: number;
  productoNombre: string;
  cantidadEgresos: number;
  unidadesTotales: number;
  costoTotal: number;
}
