/**
 * Constantes y tipos para el sistema multi-sucursal
 */

/**
 * Valor especial que indica "todas las sucursales"
 * Solo disponible para usuarios ADMINISTRADOR
 */
export const TODAS_LAS_SUCURSALES = 'TODAS';

/**
 * Tipo para el identificador de sucursal
 * Puede ser un ID específico o el valor especial "TODAS"
 */
export type SucursalId = string | typeof TODAS_LAS_SUCURSALES;

/**
 * Interfaz para información de sucursal seleccionada
 */
export interface SucursalSeleccionada {
  id: SucursalId;
  nombre: string;
  esTodas: boolean;
}
