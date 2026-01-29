/**
 * Utilidades para manejo de fechas y periodos en el sistema de cajas.
 * 
 * Proporciona funciones helper para:
 * - Normalización de fechas a medianoche
 * - Extracción de periodos (mes/año)
 * - Conversión de fechas de Firestore
 * - Comparación de periodos mensuales
 * 
 * Estas utilidades son esenciales para el sistema de creación histórica
 * de cajas banco y cajas chicas, permitiendo asociaciones correctas
 * por periodo mensual independientemente de la fecha de creación.
 */

/**
 * Representa un periodo mensual (año + mes).
 */
export interface Periodo {
  /** Año completo (ej: 2025, 2026) */
  year: number;
  
  /** Mes base 0 (0 = Enero, 11 = Diciembre) */
  monthIndex0: number;
  
  /** Mes base 1 para mostrar al usuario (1 = Enero, 12 = Diciembre) */
  monthIndex1: number;
  
  /** Clave única del periodo en formato YYYYMM (ej: 202511 para nov 2025) */
  key: number;
}

/**
 * Normaliza una fecha a medianoche (00:00:00.000).
 * Útil para comparaciones de fechas ignorando la hora.
 * 
 * Maneja correctamente strings en formato ISO (YYYY-MM-DD) evitando
 * problemas de timezone que ocurren con new Date(string).
 * 
 * @param fecha Fecha a normalizar (Date, Timestamp de Firestore, o string ISO).
 * @returns Nueva fecha normalizada a medianoche.
 */
export function normalizarFecha(fecha: Date | any | string): Date {
  let fechaNormalizada: Date;
  
  // Si es Timestamp de Firestore
  if (fecha && typeof fecha.toDate === 'function') {
    fechaNormalizada = fecha.toDate();
  } 
  // Si es Date
  else if (fecha instanceof Date) {
    fechaNormalizada = new Date(fecha);
  } 
  // Si es string en formato ISO (YYYY-MM-DD)
  else if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    // Parsear manualmente para evitar problemas de timezone
    const [year, month, day] = fecha.split('-').map(Number);
    fechaNormalizada = new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  // Si es string o número (otros formatos)
  else {
    fechaNormalizada = new Date(fecha);
  }
  
  fechaNormalizada.setHours(0, 0, 0, 0);
  return fechaNormalizada;
}

/**
 * Obtiene el periodo (año/mes) de una fecha dada.
 * 
 * @param fecha Fecha de la cual extraer el periodo.
 * @returns Objeto Periodo con año, mes (base 0 y 1) y clave única.
 */
export function obtenerPeriodo(fecha: Date | any): Periodo {
  const fechaNorm = normalizarFecha(fecha);
  const year = fechaNorm.getFullYear();
  const monthIndex0 = fechaNorm.getMonth();
  
  return {
    year,
    monthIndex0,
    monthIndex1: monthIndex0 + 1,
    key: year * 100 + monthIndex0
  };
}

/**
 * Compara dos fechas para determinar si pertenecen al mismo periodo mensual.
 * 
 * @param fecha1 Primera fecha.
 * @param fecha2 Segunda fecha.
 * @returns true si ambas fechas pertenecen al mismo mes/año.
 */
export function mismoPeriodo(fecha1: Date | any, fecha2: Date | any): boolean {
  const p1 = obtenerPeriodo(fecha1);
  const p2 = obtenerPeriodo(fecha2);
  return p1.key === p2.key;
}

/**
 * Obtiene la fecha de inicio de un periodo mensual (día 1 a medianoche).
 * 
 * @param year Año del periodo.
 * @param monthIndex0 Mes del periodo (base 0).
 * @returns Fecha del primer día del mes a las 00:00:00.
 */
export function inicioMes(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0, 1, 0, 0, 0, 0);
}

/**
 * Obtiene la fecha de inicio del siguiente mes (útil para rangos de consulta).
 * 
 * @param year Año del periodo.
 * @param monthIndex0 Mes del periodo (base 0).
 * @returns Fecha del primer día del mes siguiente a las 00:00:00.
 */
export function inicioMesSiguiente(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0 + 1, 1, 0, 0, 0, 0);
}

/**
 * Obtiene el periodo del mes anterior a una fecha dada.
 * 
 * @param fecha Fecha de referencia.
 * @returns Periodo del mes anterior.
 */
export function periodoAnterior(fecha: Date | any): Periodo {
  const fechaNorm = normalizarFecha(fecha);
  const mesAnterior = new Date(fechaNorm);
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  return obtenerPeriodo(mesAnterior);
}

/**
 * Formatea un periodo como string legible para el usuario.
 * 
 * @param periodo Periodo a formatear.
 * @returns String en formato "Mes YYYY" (ej: "Noviembre 2025").
 */
export function formatearPeriodo(periodo: Periodo): string {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${meses[periodo.monthIndex0]} ${periodo.year}`;
}

/**
 * Obtiene el rango completo de fechas de un periodo mensual.
 * Útil para consultas en Firestore con where fecha >= inicio && fecha < fin.
 * 
 * @param year Año del periodo.
 * @param monthIndex0 Mes del periodo (base 0).
 * @returns Objeto con fecha de inicio y fin del periodo.
 */
export function rangoPeriodo(year: number, monthIndex0: number): { inicio: Date; fin: Date } {
  return {
    inicio: inicioMes(year, monthIndex0),
    fin: inicioMesSiguiente(year, monthIndex0)
  };
}
