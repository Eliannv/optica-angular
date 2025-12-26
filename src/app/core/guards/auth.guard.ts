import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, switchMap, of } from 'rxjs';

/**
 * Guard para proteger rutas que requieren autenticación
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
 * Guard para proteger rutas que solo pueden acceder los administradores
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
