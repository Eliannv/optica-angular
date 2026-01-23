/**
 * Define los roles disponibles en el sistema de gestión de la óptica.
 * Los valores numéricos permiten realizar comparaciones y validaciones de permisos.
 */
export enum RolUsuario {
  /** Acceso total al sistema con permisos de configuración y administración */
  ADMINISTRADOR = 1,
  /** Acceso operativo básico para ventas y consultas */
  OPERADOR = 2
}

/**
 * Representa un usuario del sistema con sus credenciales y permisos de acceso.
 * Contiene información de autenticación, autorización y asignación de sucursal.
 *
 * Esta interfaz se utiliza en los módulos de autenticación, autorización,
 * control de acceso y auditoría del sistema.
 *
 * Implementa control de acceso mediante roles y validación de máquina autorizada.
 * Los datos se persisten en la colección 'usuarios' de Firestore y en Firebase Authentication.
 */
export interface Usuario {
  /** Identificador único de Firestore (coincide con UID de Firebase Auth) */
  id?: string;

  /** Nombre completo del usuario */
  nombre: string;

  /** Dirección de correo electrónico (usada para autenticación) */
  email: string;

  /** Rol asignado que determina los permisos del usuario */
  rol: RolUsuario;

  /** Estado del usuario (true = puede acceder, false = bloqueado) */
  activo: boolean;

  /** Sucursal asignada (ej: PASAJE, CENTRO, etc.) */
  sucursal?: string;

  /** Identificador único de la máquina autorizada para este usuario */
  machineId?: string;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Número de cédula de identidad (usado en registro) */
  cedula?: string;

  /** Apellido del usuario (dato adicional para identificación) */
  apellido?: string;

  /** Fecha de nacimiento en formato ISO (yyyy-MM-dd) desde input type="date" */
  fechaNacimiento?: string;
}
