/**
 * Modelo de datos para Sucursales
 */
export interface Sucursal {
  id?: string;
  codigo: string; // Código único de la sucursal (ej: "MACH001", "PAS001")
  nombre: string; // Nombre de la sucursal
  activo: boolean; // Estado de la sucursal
  direccion?: string; // Dirección física (opcional)
  telefono?: string; // Teléfono de contacto (opcional)
  fechaCreacion?: Date; // Fecha de creación
  creadoPor?: string; // ID del usuario que creó la sucursal
}
