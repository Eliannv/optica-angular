/**
 * Modelos para métricas y estadísticas de empleados.
 * 
 * IMPORTANTE: Cada métrica usa UNA SOLA FUENTE DE DATOS para evitar duplicados:
 * - Ventas: colección 'facturas' (campo usuarioId)
 * - Cobros de deuda: colección 'facturas_deudas' (campo usuarioId)
 * - Movimientos de caja: colecciones 'movimientos_cajas_*' (campo usuario_id)
 * - Pagos a empleado: movimientos_cajas_banco (categoria = PAGO_TRABAJADOR)
 */

/**
 * Métricas comerciales del empleado basadas ÚNICAMENTE en facturas.
 */
export interface MetricasVentas {
  /** Total de ventas realizadas por el empleado */
  totalVentas: number;
  
  /** Monto total vendido en el período */
  montoTotalVendido: number;
  
  /** Promedio por venta */
  promedioPorVenta: number;
  
  /** Monto abonado por el empleado (suma de campo 'abonado' de facturas) */
  montoAbonado: number;
  
  /** Promedio de monto abonado por venta */
  promedioAbonado: number;
  
  /** Comparación con mes anterior (porcentaje) */
  variacionMesAnterior?: number;
  
  /** Tendencia: 'up' | 'down' | 'stable' */
  tendencia?: 'up' | 'down' | 'stable';
}

/**
 * Métricas de cobros de deuda realizados por el empleado.
 * Fuente ÚNICA: facturas_deudas
 */
export interface MetricasCobros {
  /** Total de cobros realizados */
  totalCobros: number;
  
  /** Monto total cobrado */
  montoCobrado: number;
  
  /** Cantidad de cobros realizados */
  cantidadCobros: number;
  
  /** Saldo restante total de las deudas */
  saldoRestante: number;
}

/**
 * Pagos recibidos por el empleado.
 * Fuente ÚNICA: movimientos_cajas_banco (categoria = PAGO_TRABAJADOR)
 */
export interface MetricasPagos {
  /** Total pagado al empleado en el período */
  totalPagado: number;
  
  /** Cantidad de pagos recibidos */
  cantidadPagos: number;
  
  /** Historial de pagos */
  historialPagos: PagoEmpleado[];
}

/**
 * Detalle de un pago individual a empleado.
 */
export interface PagoEmpleado {
  /** Fecha del pago */
  fecha: Date;
  
  /** Monto pagado */
  monto: number;
  
  /** Referencia del pago */
  referencia?: string;
  
  /** Observación */
  observacion?: string;
}

/**
 * Métricas de ingresos registrados por el empleado.
 * Fuente: movimientos_cajas_chicas y movimientos_cajas_banco (tipo = INGRESO)
 */
export interface MetricasIngresos {
  /** Monto total de ingresos en caja chica */
  montoCajaChica: number;
  
  /** Cantidad de ingresos en caja chica */
  cantidadCajaChica: number;
  
  /** Monto total de ingresos en caja banco */
  montoCajaBanco: number;
  
  /** Cantidad de ingresos en caja banco */
  cantidadCajaBanco: number;
  
  /** Total de ingresos (suma de ambas cajas) */
  montoTotal: number;
  
  /** Cantidad total de ingresos */
  cantidadTotal: number;
}

/**
 * Resumen mensual del rendimiento del empleado.
 */
export interface ResumenMensual {
  /** Mes (formato: YYYY-MM) */
  mes: string;
  
  /** Nombre del mes para mostrar (ej: "Enero 2025") */
  mesNombre: string;
  
  /** Métricas de ventas del mes */
  ventas: MetricasVentas;
  
  /** Métricas de cobros del mes */
  cobros: MetricasCobros;
  
  /** Métricas de pagos del mes */
  pagos: MetricasPagos;
  
  /** Métricas de ingresos registrados del mes */
  ingresos: MetricasIngresos;
}

/**
 * Información extendida del empleado con métricas calculadas.
 */
export interface EmpleadoConMetricas {
  /** ID del empleado */
  id: string;
  
  /** Nombre completo */
  nombre: string;
  
  /** Email */
  email: string;
  
  /** Rol (1 = Admin, 2 = Operador) */
  rol: number;
  
  /** Sucursal asignada */
  sucursal?: string;
  
  /** Estado activo */
  activo: boolean;
  
  /** Fecha de creación */
  createdAt?: Date;
  
  /** Antigüedad en meses */
  antiguedadMeses?: number;
  
  /** Antigüedad en formato legible (ej: "2 años 3 meses") */
  antiguedadTexto?: string;
  
  /** Métricas del período actual */
  metricasActuales?: ResumenMensual;
  
  /** Comparación con mes anterior */
  comparacionAnterior?: {
    ventasDiff: number;
    montoDiff: number;
  };
}

/**
 * Card de métrica global del sistema.
 */
export interface MetricaGlobal {
  /** Título de la métrica */
  titulo: string;
  
  /** Valor principal */
  valor: string | number;
  
  /** Subtítulo o descripción */
  subtitulo?: string;
  
  /** Icono a mostrar */
  icono?: string;
  
  /** Tipo de card (success, warning, info, danger) */
  tipo?: 'success' | 'warning' | 'info' | 'danger';
  
  /** Variación porcentual */
  variacion?: number;
}

/**
 * Item de ranking de empleados.
 */
export interface RankingItem {
  /** Posición en el ranking (1, 2, 3...) */
  posicion: number;
  
  /** ID del empleado */
  empleadoId: string;
  
  /** Nombre del empleado */
  empleadoNombre: string;
  
  /** Valor de la métrica */
  valor: number;
  
  /** Texto a mostrar */
  textoValor: string;
  
  /** Sucursal del empleado */
  sucursal?: string;
}

/**
 * Filtros para consultas de métricas.
 */
export interface FiltrosMetricas {
  /** Filtro por sucursal */
  sucursal?: string;
  
  /** Filtro por rol */
  rol?: number;
  
  /** Filtro por estado */
  estado?: 'activos' | 'inactivos' | 'todos';
  
  /** Fecha de inicio del período */
  fechaInicio?: Date;
  
  /** Fecha de fin del período */
  fechaFin?: Date;
  
  /** Mes específico (formato YYYY-MM) */
  mes?: string;
}
