import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import Swal from 'sweetalert2';

/**
 * Guard para proteger rutas que requieren una caja chica abierta
 */
export const cajaChicaGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  // Verificar si hay una caja chica abierta en localStorage
  const cajaChicaAbierta = localStorage.getItem('cajaChicaAbierta');
  
  if (!cajaChicaAbierta) {
    Swal.fire({
      icon: 'error',
      title: 'Caja Chica Requerida',
      text: 'Debe crear primero la caja chica de este día para empezar con una nueva venta',
      confirmButtonText: 'Ir a Caja Chica',
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then((result) => {
      if (result.isConfirmed) {
        router.navigate(['/caja-chica']);
      }
    });
    return false;
  }

  return true;
};
