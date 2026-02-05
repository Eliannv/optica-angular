/**
 * 📊 Modelo de Resumen Mensual
 * 
 * Este documento se almacena en Firestore para optimizar consultas de dashboards
 * sin necesidad de agregar cientos de documentos cada vez.
 * 
 * **Colección:** `resumenes`
 * **ID del documento:** `{año}-{mes}` (ej: `2026-02`)
 * 
 * **Generación:** Debe ejecutarse periódicamente (diario/semanal) mediante:
 * - Cloud Function programada
 * - Script manual
 * - Tarea automática del sistema
 */
export interface ResumenMensual {
  id?: string; // año-mes (ej: "2026-02")
  año: number;
  mes: number;
  
  // Totales principales
  totalVentas: number; // Suma de todas las facturas
  totalPagosDeuda: number; // Suma de pagos de deuda
  totalEgresos: number; // Suma de egresos
  totalIngresos?: number; // Suma de ingresos (opcional)
  
  // Desglose por método de pago
  totalesPorMetodo: { [metodo: string]: number }; // { "Efectivo": 1500, "Tarjeta": 800, ... }
  
  // Contadores
  cantidadFacturas: number;
  cantidadPagosDeuda: number;
  cantidadEgresos: number;
  cantidadIngresos?: number;
  
  // Metadata
  fechaGeneracion: Date; // Cuándo se generó este resumen
  rangoDesde: Date; // Inicio del período
  rangoHasta: Date; // Fin del período
  
  // Opcionales: estadísticas adicionales
  ventaPorDia?: { [dia: string]: number }; // { "1": 150, "2": 300, ... }
  clienteMasCompras?: {
    clienteId: string;
    clienteNombre: string;
    totalComprado: number;
  };
  productoMasVendido?: {
    productoId: string;
    productoNombre: string;
    cantidadVendida: number;
  };
}

/**
 * 📊 Filtros para Reportes Optimizados
 * 
 * Define los parámetros de filtrado que SIEMPRE deben incluir fechas
 * para evitar consultas masivas sin límites.
 */
export interface FiltrosReporte {
  // Obligatorios
  fechaDesde: Date;
  fechaHasta: Date;
  
  // Opcionales
  tipo?: 'INGRESO' | 'EGRESO' | 'VENTA' | 'PAGO_DEUDA';
  metodoPago?: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'TODOS';
  clienteId?: string;
  sucursalId?: string;
  cajaId?: string;
  
  // Paginación
  limite?: number; // Default: 100
  paginaActual?: number;
  ultimoDocumento?: any; // Para startAfter en Firestore
}

/**
 * 📊 Respuesta Paginada de Reportes
 */
export interface RespuestaPaginada<T> {
  documentos: T[];
  hasMore: boolean; // Hay más páginas disponibles
  lastVisible: any; // Último documento para siguiente página
  totalEncontrados?: number; // Total de documentos (si se conoce)
}

/**
 * 📊 Resumen Diario (más granular que mensual)
 * 
 * **Colección:** `resumenes_diarios`
 * **ID del documento:** `{año}-{mes}-{dia}` (ej: `2026-02-15`)
 */
export interface ResumenDiario {
  id?: string;
  fecha: Date;
  año: number;
  mes: number;
  dia: number;
  
  totalVentas: number;
  totalEgresos: number;
  totalIngresos: number;
  
  cantidadFacturas: number;
  cantidadMovimientos: number;
  
  totalesPorMetodo: { [metodo: string]: number };
  
  fechaGeneracion: Date;
}

/**
 * 📊 Estadísticas de Producto (para inventario/catálogo)
 * 
 * **Colección:** `estadisticas_productos`
 * **ID del documento:** `{productoId}_{año}_{mes}`
 */
export interface EstadisticasProducto {
  id?: string;
  productoId: string;
  productoNombre: string;
  año: number;
  mes: number;
  
  cantidadVendida: number;
  totalVendido: number; // Suma de ventas en dinero
  cantidadDevoluciones?: number;
  
  ventaPromedio: number; // Precio promedio de venta
  stockActual?: number; // Stock al final del período
  
  fechaGeneracion: Date;
}

/**
 * 📊 Estadísticas de Cliente (para análisis comercial)
 * 
 * **Colección:** `estadisticas_clientes`
 * **ID del documento:** `{clienteId}_{año}_{mes}`
 */
export interface EstadisticasCliente {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  año: number;
  mes: number;
  
  totalComprado: number;
  cantidadCompras: number;
  promedioCompra: number;
  
  saldoPendiente: number; // Deuda acumulada
  pagosPuntuales: number; // Cantidad de pagos realizados a tiempo
  
  metodoPagoFavorito: string; // Método más usado
  
  fechaGeneracion: Date;
}
