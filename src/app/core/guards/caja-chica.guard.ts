import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import Swal from 'sweetalert2';
import { CajaChicaService } from '../services/caja-chica.service';

/**
 * Guard para proteger rutas que requieren una caja chica abierta
 * Valida primero en localStorage, luego en Firestore
 */
export const cajaChicaGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const cajaChicaService = inject(CajaChicaService);

  // Verificar si hay una caja chica abierta en localStorage
  let cajaChicaAbierta = localStorage.getItem('cajaChicaAbierta');
  
  // Si localStorage no tiene ID, buscar en Firestore
  if (!cajaChicaAbierta) {
    const existeEnFirestore = await cajaChicaService.existeCajaAbiertaHoy();
    if (!existeEnFirestore) {
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
  }

  return true;
};
