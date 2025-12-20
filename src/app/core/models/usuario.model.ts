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
  createdAt?: any;
}
