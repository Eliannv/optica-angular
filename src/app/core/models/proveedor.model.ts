/**
 * Representa un proveedor o distribuidor de productos de la óptica.
 * Almacena información fiscal, de contacto y comercial del proveedor.
 *
 * Esta interfaz se utiliza en los módulos de ingresos, inventario y gestión de compras.
 * Implementa soft delete mediante el campo 'activo'.
 *
 * Los datos se persisten en la colección 'proveedores' de Firestore.
 */
export interface Proveedor {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Código interno del proveedor (opcional) */
  codigo?: string;

  /** Razón social o nombre comercial del proveedor */
  nombre: string;

  /** Nombre del representante o contacto principal */
  representante?: string;

  /** Registro Único de Contribuyentes o identificador fiscal */
  ruc: string;

  /** Números de teléfono del proveedor */
  telefonos?: {
    /** Número telefónico principal */
    principal?: string;
    /** Número telefónico alternativo */
    secundario?: string;
  };

  /** Información de ubicación física del proveedor */
  direccion?: {
    /** Código postal o identificador de lugar */
    codigoLugar?: string;
    /** Dirección completa */
    direccion?: string;
  };

  /** Fecha de registro del proveedor en el sistema */
  fechaIngreso?: Date;

  /** Saldo pendiente o estado de cuenta con el proveedor */
  saldo?: number;

  /** Indicador de soft delete (true = activo, false = desactivado) */
  activo?: boolean;

  /** Fecha de creación del registro en Firestore */
  createdAt?: any;

  /** Fecha de última actualización del registro */
  updatedAt?: any;
}
