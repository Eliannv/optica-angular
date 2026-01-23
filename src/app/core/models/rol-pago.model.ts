/**
 * Representa un rol de pagos o nómina mensual para un empleado.
 * Contiene la información del salario base, horas extras y total a pagar.
 *
 * Esta interfaz se utiliza en el módulo de recursos humanos para
 * el cálculo y registro de pagos mensuales del personal.
 *
 * Los datos se persisten en la colección 'roles_pago' de Firestore.
 */
export interface RolPago {
  /** Identificador único de Firestore (auto-generado) */
  id?: string;

  /** Identificador del usuario/empleado al que corresponde el rol de pago */
  usuarioId: string;

  /** Salario base mensual del empleado */
  salario: number;

  /** Mes y año al que corresponde el pago (ej: "2025-01", "Enero 2025") */
  mes: string;

  /** Cantidad de horas extras trabajadas en el mes */
  horasExtras?: number;

  /** Monto total a pagar (salario + horas extras + bonificaciones - descuentos) */
  total: number;
}
