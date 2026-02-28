/**
 * Componente de redirección para ver la caja chica actual con sus movimientos.
 * 
 * Detecta si hay una caja chica abierta y redirige a su vista de detalle que incluye:
 * - Información de la caja chica (saldo inicial, saldo actual, estado)
 * - Todos los movimientos registrados (ingresos/egresos)
 * - Resumen financiero
 * - Opciones para registrar nuevos movimientos
 * 
 * Si no hay caja chica abierta, muestra mensaje y redirige al listado.
 */

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CajaChicaService } from '../../core/services/caja-chica.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ver-caja-chica-actual',
  standalone: true,
  template: `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
      <div style="text-align: center;">
        <div class="spinner-border" role="status"></div>
        <p style="margin-top: 1rem;">Buscando caja chica actual...</p>
      </div>
    </div>
  `
})
export class VerCajaChicaActualComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.buscarYRedirigir();
  }

  private async buscarYRedirigir(): Promise<void> {
    try {
      const cajaChicaAbierta = await this.cajaChicaService.getCajaAbierta();
      
      if (cajaChicaAbierta && cajaChicaAbierta.id) {
        this.router.navigate(['/caja-chica/ver', cajaChicaAbierta.id]);
        return;
      }

      // No hay caja chica abierta
      await Swal.fire({
        icon: 'info',
        title: 'Sin caja chica abierta',
        html: `
          <p>No hay ninguna caja chica abierta en este momento.</p>
          <p class="text-muted mb-0">Puedes abrir una nueva caja chica desde el listado.</p>
        `,
        confirmButtonText: 'Ir al listado',
        allowOutsideClick: false
      });

      this.router.navigate(['/caja-chica']);
      
    } catch (error) {
      console.error('Error buscando caja chica:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al buscar la caja chica actual.',
        confirmButtonText: 'Aceptar'
      });
      this.router.navigate(['/caja-chica/ver']);
    }
  }
}
