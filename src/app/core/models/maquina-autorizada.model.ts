/**
 * Modelo para máquinas autorizadas
 * Permite control centralizado de acceso por sucursal
 */
export interface MaquinaAutorizada {
  id?: string; // ID del documento en Firestore
  machineId: string; // ID único de la máquina (hash del sistema)
  sucursal: 'MACHALA' | 'PASAJE' | 'DESARROLLO_1' | 'DESARROLLO_2';
  nombreMaquina: string; // Nombre descriptivo (ej: "PC Recepción Pasaje")
  activo: boolean; // Si la máquina está autorizada
  fechaRegistro: Date;
  ultimoAcceso?: Date; // Última vez que se conectó
  observaciones?: string;
  autorizadoPor?: string; // UID del admin que autorizó
}

export type Sucursal = 'MACHALA' | 'PASAJE' | 'DESARROLLO_1' | 'DESARROLLO_2';

export const SUCURSALES: readonly Sucursal[] = [
  'MACHALA',
  'PASAJE',
  'DESARROLLO_1',
  'DESARROLLO_2',
] as const;
