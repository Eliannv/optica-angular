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
  createdAt?: any;
}
