export interface Proveedor {
  id?: string;
  codigo?: string;
  nombre: string;
  representante?: string;
  ruc: string;
  telefonos?: {
    principal?: string;
    secundario?: string;
  };
  direccion?: {
    codigoLugar?: string;
    direccion?: string;
  };
  fechaIngreso?: Date;
  saldo?: number;
  activo?: boolean; // 🔹 Soft delete: true = activo, false = desactivado
  createdAt?: any;
  updatedAt?: any;
}
