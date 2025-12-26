// Roles del sistema
export enum RolUsuario {
  ADMINISTRADOR = 1,
  OPERADOR = 2
}

export interface Usuario {
  id?: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  sucursal?: string;  // Sucursal asignada al usuario (PASAJE, CENTRO, etc.)
  machineId?: string; // ID único de la máquina autorizada
  createdAt?: any;
  // Datos adicionales para edición/registro
  cedula?: string;
  apellido?: string;
  fechaNacimiento?: string; // ISO yyyy-MM-dd desde input type="date"
}
