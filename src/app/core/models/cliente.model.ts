export interface Cliente {
  id?: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono?: string;
  email?: string;
  fechaNacimiento?: Date;
  direccion?: string;
  createdAt?: any;
}
