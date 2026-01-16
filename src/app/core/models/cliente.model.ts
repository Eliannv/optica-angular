export interface Cliente {
  id?: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono?: string;
  email?: string;
  fechaNacimiento?: Date;
  direccion?: string;
  pais?: string;
  provincia?: string;
  ciudad?: string;
  activo?: boolean; // 🔹 Soft delete: true = activo, false = desactivado
  createdAt?: any;
  updatedAt?: any;
}
