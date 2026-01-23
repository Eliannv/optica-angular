/**
 * Representa un cliente registrado en el sistema de la óptica.
 * Contiene información demográfica, de contacto y ubicación del cliente.
 *
 * Esta interfaz se utiliza en los módulos de ventas, facturación, cotizaciones
 * y gestión de historiales clínicos. Implementa soft delete mediante el campo 'activo'.
 *
 * Los datos almacenados se persisten en la colección 'clientes' de Firestore.
 */
export interface Cliente {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Nombres del cliente */
  nombres: string;

  /** Apellidos del cliente */
  apellidos: string;

  /** Número de cédula de identidad o documento nacional */
  cedula: string;

  /** Número de teléfono de contacto */
  telefono?: string;

  /** Dirección de correo electrónico */
  email?: string;

  /** Fecha de nacimiento del cliente */
  fechaNacimiento?: Date;

  /** Dirección física o domicilio */
  direccion?: string;

  /** País de residencia */
  pais?: string;

  /** Provincia o estado */
  provincia?: string;

  /** Ciudad de residencia */
  ciudad?: string;

  /** Indicador de soft delete (true = activo, false = desactivado) */
  activo?: boolean;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;
}
