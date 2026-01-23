/**
 * Guard de autorización basado en roles de usuario.
 * 
 * Este archivo contiene un guard funcional paramétrico que valida si el usuario
 * autenticado tiene uno de los roles permitidos para acceder a una ruta específica.
 * 
 * Características:
 * - Guard paramétrico que acepta una lista de roles permitidos
 * - Validación síncrona (no requiere consultas a Firestore)
 * - Notificación al usuario mediante SweetAlert2 en caso de acceso denegado
 * - Redirección inteligente según el rol del usuario
 * 
 * Roles soportados:
 * - RolUsuario.ADMINISTRADOR: Acceso completo al sistema
 * - RolUsuario.OPERADOR: Acceso limitado a operaciones básicas
 * 
 * Flujo de validación:
 * 1. Obtiene el usuario actual desde AuthService
 * 2. Si no hay usuario, redirige a /login
 * 3. Verifica si el rol del usuario está en la lista de roles permitidos
 * 4. Si no tiene permisos, muestra alerta y redirige según su rol
 * 5. Si tiene permisos, permite el acceso
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RolUsuario } from '../models/usuario.model';
import Swal from 'sweetalert2';

/**
 * Crea un guard que protege rutas según el rol del usuario.
 * 
 * Este guard es una factory function que retorna un CanActivateFn configurado
 * con los roles permitidos. Permite crear guards personalizados para diferentes
 * niveles de acceso sin duplicar código.
 * 
 * Validaciones:
 * - Usuario debe estar autenticado (getCurrentUser() no null)
 * - Rol del usuario debe estar en la lista de rolesPermitidos
 * - Si falla, muestra alerta SweetAlert2 con mensaje de error
 * 
 * Redirecciones:
 * - Sin usuario autenticado: /login
 * - Administrador sin permisos: /productos (dashboard admin)
 * - Operador sin permisos: /clientes/historial-clinico (dashboard operador)
 * 
 * @param rolesPermitidos - Array de roles que tienen acceso a la ruta
 * @returns CanActivateFn configurado con los roles permitidos
 * 
 * @example
 * ```typescript
 * // Solo administradores
 * {
 *   path: 'productos',
 *   component: ProductosComponent,
 *   canActivate: [roleGuard([RolUsuario.ADMINISTRADOR])]
 * }
 * 
 * // Administradores y operadores
 * {
 *   path: 'ventas',
 *   component: VentasComponent,
 *   canActivate: [roleGuard([RolUsuario.ADMINISTRADOR, RolUsuario.OPERADOR])]
 * }
 * ```
 */
export const roleGuard = (rolesPermitidos: RolUsuario[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    
    const currentUser = authService.getCurrentUser();
    
    // Validar que exista un usuario autenticado
    if (!currentUser) {
      router.navigate(['/login']);
      return false;
    }
    
    // Verificar si el usuario tiene un rol permitido
    if (!rolesPermitidos.includes(currentUser.rol)) {
      // Mostrar alerta de acceso denegado
      Swal.fire({
        icon: 'error',
        title: 'Acceso Denegado',
        text: 'No tienes permisos para acceder a esta página.',
        confirmButtonColor: '#d33',
      });
      
      // Redirigir a la página principal según el rol del usuario
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
