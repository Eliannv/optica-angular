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
  createdAt?: any;
  updatedAt?: any;
}
