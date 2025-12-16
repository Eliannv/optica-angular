export type RolUsuario = 'admin' | 'empleado';

export interface Usuario {
  id?: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt?: any;
}
