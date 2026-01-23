/**
 * Guards de autenticación para proteger rutas de la aplicación.
 * 
 * Este archivo contiene guards funcionales que validan el estado de autenticación
 * del usuario antes de permitir el acceso a rutas protegidas.
 * 
 * Guards disponibles:
 * - authGuard: Valida que el usuario esté autenticado
 * - adminGuard: Valida que el usuario sea administrador
 * 
 * Funcionamiento:
 * 1. Verifica el estado de autenticación mediante AuthService.authState$
 * 2. Si el usuario está autenticado, carga sus datos completos desde Firestore
 * 3. Permite o deniega el acceso según las validaciones
 * 4. Redirige a /login si no está autenticado
 * 5. adminGuard redirige a /dashboard si no es administrador
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, switchMap, of } from 'rxjs';

/**
 * Guard para proteger rutas que requieren autenticación.
 * 
 * Valida que exista un usuario autenticado y que sus datos estén disponibles
 * en Firestore. Si el usuario no está autenticado o no se pueden cargar sus
 * datos, redirige a la página de login.
 * 
 * Flujo de validación:
 * 1. Observa el estado de autenticación (authState$)
 * 2. Si no hay usuario, redirige a /login y retorna false
 * 3. Si hay usuario, carga sus datos completos mediante ensureUserData()
 * 4. Si los datos se cargan correctamente, permite el acceso (true)
 * 5. Si falla la carga de datos, redirige a /login y retorna false
 * 
 * @param route - Información de la ruta activada
 * @param state - Estado actual del router
 * @returns Observable<boolean> que indica si se permite el acceso
 * 
 * @example
 * ```typescript
 * {
 *   path: 'dashboard',
 *   component: DashboardComponent,
 *   canActivate: [authGuard]
 * }
 * ```
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authState$.pipe(
    switchMap(user => {
      if (!user) {
        router.navigate(['/login']);
        return of(false);
      }
      return authService.ensureUserData(user.uid).pipe(
        map(userData => {
          if (userData) {
            return true;
          }
          router.navigate(['/login']);
          return false;
        })
      );
    })
  );
};

/**
 * Guard para proteger rutas que solo pueden acceder los administradores.
 * 
 * Extiende la funcionalidad de authGuard agregando validación de rol.
 * Verifica que el usuario autenticado tenga permisos de administrador.
 * 
 * Flujo de validación:
 * 1. Observa el estado de autenticación (authState$)
 * 2. Si no hay usuario, redirige a /login y retorna false
 * 3. Si hay usuario, carga sus datos completos mediante ensureUserData()
 * 4. Valida que el usuario sea administrador usando isAdmin()
 * 5. Si es admin, permite el acceso (true)
 * 6. Si no es admin, redirige a /dashboard y retorna false
 * 
 * @param route - Información de la ruta activada
 * @param state - Estado actual del router
 * @returns Observable<boolean> que indica si se permite el acceso
 * 
 * @example
 * ```typescript
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [adminGuard]
 * }
 * ```
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authState$.pipe(
    switchMap(user => {
      if (!user) {
        router.navigate(['/login']);
        return of(false);
      }
      return authService.ensureUserData(user.uid).pipe(
        map(userData => {
          if (userData && authService.isAdmin()) {
            return true;
          }
          router.navigate(['/dashboard']);
          return false;
        })
      );
    })
  );
};
