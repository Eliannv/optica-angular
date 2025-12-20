import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RolUsuario } from '../models/usuario.model';
import Swal from 'sweetalert2';

/**
 * Guard para proteger rutas según el rol del usuario
 * Uso: canActivate: [roleGuard([RolUsuario.ADMINISTRADOR])]
 */
export const roleGuard = (rolesPermitidos: RolUsuario[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    
    const currentUser = authService.getCurrentUser();
    
    // Si no hay usuario autenticado
    if (!currentUser) {
      router.navigate(['/login']);
      return false;
    }
    
    // Verificar si el usuario tiene un rol permitido
    if (!rolesPermitidos.includes(currentUser.rol)) {
      Swal.fire({
        icon: 'error',
        title: 'Acceso Denegado',
        text: 'No tienes permisos para acceder a esta página.',
        confirmButtonColor: '#d33',
      });
      
      // Redirigir según el rol
      if (currentUser.rol === RolUsuario.ADMINISTRADOR) {
        router.navigate(['/productos']);
      } else if (currentUser.rol === RolUsuario.OPERADOR) {
        router.navigate(['/clientes/historial-clinico']);
      }
      
      return false;
    }
    
    return true;
  };
};
