/**
 * Configuración global de la aplicación
 * Centraliza información de la empresa y configuraciones del sistema
 */

export const APP_CONFIG = {
  /**
   * Información de la empresa
   * IMPORTANTE: Este es el valor utilizado en todos los recibos e impresiones
   */
  empresa: {
    nombre: 'ÓPTICA MACÍAS PASAJE',
    nombreCorto: 'ÓPTICA MACÍAS',
    sucursal: 'PASAJE',
    ruc: '0912477528001',
    direccion: 'Pasaje - Ecuador',
    telefono: '', // Agregar si es necesario
  },

  /**
   * Configuración de impresión
   */
  impresion: {
    mostrarNombreCompleto: true, // Si es true usa 'nombre', si es false usa 'nombreCorto'
  },

  /**
   * Configuración del sistema
   */
  sistema: {
    version: '1.0.0',
    nombreSistema: 'Sistema de Gestión Integral',
  },
};

/**
 * Helper para obtener el nombre de la empresa según configuración
 */
export function getNombreEmpresa(): string {
  return APP_CONFIG.impresion.mostrarNombreCompleto
    ? APP_CONFIG.empresa.nombre
    : APP_CONFIG.empresa.nombreCorto;
}
