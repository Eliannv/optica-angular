export interface RolPago {
  id?: string;
  usuarioId: string;
  salario: number;
  mes: string;
  horasExtras?: number;
  total: number;
}
