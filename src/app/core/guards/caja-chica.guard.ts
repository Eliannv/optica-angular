/**
 * Guard de validación de caja chica para operaciones de venta.
 * 
 * Este archivo contiene un guard que verifica la existencia de una caja chica
 * abierta antes de permitir el acceso a rutas que requieren registro de transacciones.
 * Es esencial para mantener la integridad del sistema de control financiero.
 * 
 * Características:
 * - Guard asíncrono (usa async/await para consultas a Firestore)
 * - Validación dual: localStorage + Firestore
 * - Notificación al usuario mediante SweetAlert2
 * - Redirección automática a la sección de caja chica
 * 
 * Flujo de validación:
 * 1. Verifica si existe ID de caja en localStorage (validación rápida)
 * 2. Si no hay en localStorage, consulta Firestore
 * 3. Si no existe caja abierta, muestra alerta y redirige
 * 4. Si existe caja abierta, permite el acceso
 * 
 * Uso típico:
 * - Rutas de ventas (POS)
 * - Rutas de registro de egresos/ingresos
 * - Cualquier operación que afecte el flujo de efectivo
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import Swal from 'sweetalert2';
import { CajaChicaService } from '../services/caja-chica.service';

/**
 * Guard para proteger rutas que requieren una caja chica abierta.
 * 
 * Valida que exista una caja chica activa para el día actual antes de permitir
 * operaciones que involucren movimientos de efectivo. Esto garantiza que todas
 * las transacciones queden registradas en la caja correspondiente.
 * 
 * Proceso de validación:
 * 1. Busca el ID de caja chica en localStorage ('cajaChicaAbierta')
 * 2. Si no existe en localStorage, consulta a Firestore mediante existeCajaAbiertaHoy()
 * 3. Si no hay caja abierta:
 *    - Muestra SweetAlert2 con mensaje informativo
 *    - Ofrece botón para ir a la sección de caja chica
 *    - No permite cancelar (allowOutsideClick: false)
 *    - Redirige a /caja-chica al confirmar
 * 4. Si existe caja abierta, permite el acceso a la ruta
 * 
 * @param route - Información de la ruta activada
 * @param state - Estado actual del router
 * @returns Promise<boolean> que indica si se permite el acceso
 * 
 * @example
 * ```typescript
 * // Proteger ruta de ventas
 * {
 *   path: 'ventas/nueva',
 *   component: NuevaVentaComponent,
 *   canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR]), cajaChicaGuard]
 * }
 * 
 * // Proteger ruta de egresos
 * {
 *   path: 'caja-chica/egreso',
 *   component: RegistrarEgresoComponent,
 *   canActivate: [cajaChicaGuard]
 * }
 * ```
 */
export const cajaChicaGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const cajaChicaService = inject(CajaChicaService);

  // Verificar si hay una caja chica abierta en localStorage (validación rápida)
  let cajaChicaAbierta = localStorage.getItem('cajaChicaAbierta');
  
  // Si localStorage no tiene ID, buscar en Firestore (validación definitiva)
  if (!cajaChicaAbierta) {
    const existeEnFirestore = await cajaChicaService.existeCajaAbiertaHoy();
    if (!existeEnFirestore) {
      // Mostrar alerta informativa con opción de ir a caja chica
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
