/**
 * Componente de redirección para ver la caja banco actual con sus movimientos.
 * 
 * Detecta si hay una caja banco abierta y redirige a su vista de detalle que incluye:
 * - Información de la caja banco (saldo inicial, saldo actual, estado)
 * - Todos los movimientos registrados (ingresos/egresos)
 * - Cajas chicas asociadas al periodo
 * - Resumen financiero completo
 * - Opciones para registrar nuevos movimientos
 * 
 * Si no hay caja banco abierta, muestra mensaje y redirige al listado.
 */

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CajaBancoService } from '../../core/services/caja-banco.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ver-caja-banco-actual',
  standalone: true,
  template: `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
      <div style="text-align: center;">
        <div class="spinner-border" role="status"></div>
        <p style="margin-top: 1rem;">Buscando caja banco actual...</p>
      </div>
    </div>
  `
})
export class VerCajaBancoActualComponent implements OnInit {
  private cajaBancoService = inject(CajaBancoService);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.buscarYRedirigir();
  }

  private async buscarYRedirigir(): Promise<void> {
    try {
      const cajaBancoAbierta = await this.cajaBancoService.getCajaBancoAbierta();
      
      if (cajaBancoAbierta && cajaBancoAbierta.id) {
        this.router.navigate(['/caja-banco', cajaBancoAbierta.id, 'ver']);
        return;
      }

      // No hay caja banco abierta
      await Swal.fire({
        icon: 'info',
        title: 'Sin caja banco abierta',
        html: `
          <p>No hay ninguna caja banco abierta en este momento.</p>
          <p class="text-muted mb-0">Puedes abrir una nueva caja banco desde el listado.</p>
        `,
        confirmButtonText: 'Ir al listado',
        allowOutsideClick: false
      });

      this.router.navigate(['/caja-banco/ver']);
      
    } catch (error) {
      console.error('Error buscando caja banco:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al buscar la caja banco actual.',
        confirmButtonText: 'Aceptar'
      });
      this.router.navigate(['/caja-banco/ver']);
    }
  }
}
