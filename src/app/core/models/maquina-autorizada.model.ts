/**
 * Modelo para máquinas autorizadas
 * Permite control centralizado de acceso por sucursal
 */
export interface MaquinaAutorizada {
  id?: string; // ID del documento en Firestore
  machineId: string; // ID único de la máquina (hash del sistema)
  sucursal: string; // Código de la sucursal (ej: "MACH001", "PASJ001")
  nombreMaquina: string; // Nombre descriptivo (ej: "PC Recepción Pasaje")
  activo: boolean; // Si la máquina está autorizada
  fechaRegistro: Date;
  ultimoAcceso?: Date; // Última vez que se conectó
  observaciones?: string;
  autorizadoPor?: string; // UID del admin que autorizó
}
