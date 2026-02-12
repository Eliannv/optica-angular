import { RolUsuario, Usuario } from '../models/usuario.model';

export function puedeModificarCaja(caja: { estado: string }, usuario: Pick<Usuario, 'rol'>): boolean {
  return caja.estado === 'ABIERTA' || usuario.rol === RolUsuario.ADMINISTRADOR;
}
