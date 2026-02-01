import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { SucursalesService } from '../../../../core/services/sucursales.service';
import { Sucursal } from '../../../../core/models/sucursal.model';

@Component({
  selector: 'app-listar-sucursales',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './listar-sucursales.html',
  styleUrl: './listar-sucursales.css'
})
export class ListarSucursales implements OnInit {
  private router = inject(Router);
  private sucursalesSrv = inject(SucursalesService);

  sucursales = signal<Sucursal[]>([]);
  cargando = signal(false);

  ngOnInit(): void {
    this.cargarSucursales();
  }

  cargarSucursales(): void {
    this.cargando.set(true);
    this.sucursalesSrv.getSucursales().subscribe({
      next: (data) => {
        this.sucursales.set(data);
        this.cargando.set(false);
      },
      error: (error) => {
        console.error('Error cargando sucursales:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las sucursales',
          confirmButtonColor: '#3085d6'
        });
        this.cargando.set(false);
      }
    });
  }

  irACrearSucursal(): void {
    this.router.navigate(['/administracion/crear-sucursal']);
  }

  irAGestionarMaquinas(): void {
    this.router.navigate(['/administracion/gestionar-maquinas']);
  }

  editarSucursal(sucursal: Sucursal): void {
    this.router.navigate(['/administracion/crear-sucursal'], {
      queryParams: { id: sucursal.id }
    });
  }

  async cambiarEstado(sucursal: Sucursal): Promise<void> {
    const nuevoEstado = !sucursal.activo;
    
    const result = await Swal.fire({
      icon: 'question',
      title: `¿${nuevoEstado ? 'Activar' : 'Desactivar'} sucursal?`,
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p><strong>Sucursal:</strong> ${sucursal.nombre}</p>
          <p><strong>Código:</strong> ${sucursal.codigo}</p>
          ${!nuevoEstado ? '<p style="color: #dc3545;">Las máquinas de esta sucursal no podrán seleccionarse.</p>' : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: nuevoEstado ? 'Sí, Activar' : 'Sí, Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: nuevoEstado ? '#28a745' : '#dc3545'
    });

    if (!result.isConfirmed) return;

    try {
      await this.sucursalesSrv.cambiarEstadoSucursal(sucursal.id!, nuevoEstado);
      await Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: `Sucursal ${nuevoEstado ? 'activada' : 'desactivada'} correctamente`,
        timer: 2000,
        showConfirmButton: false
      });
      this.cargarSucursales();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cambiar el estado de la sucursal',
        confirmButtonColor: '#3085d6'
      });
    }
  }

  async eliminarSucursal(sucursal: Sucursal): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: '⚠️ ¿Eliminar permanentemente?',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p><strong>Sucursal:</strong> ${sucursal.nombre}</p>
          <p><strong>Código:</strong> ${sucursal.codigo}</p>
          <p style="color: #dc3545; font-weight: 600;">Esta acción NO se puede deshacer.</p>
          <p style="color: #6c757d; font-style: italic;">Recomendación: Mejor DESACTIVAR la sucursal.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) return;

    try {
      await this.sucursalesSrv.eliminarSucursal(sucursal.id!);
      await Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: 'Sucursal eliminada correctamente',
        timer: 2000,
        showConfirmButton: false
      });
      this.cargarSucursales();
    } catch (error) {
      console.error('Error eliminando sucursal:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo eliminar la sucursal',
        confirmButtonColor: '#3085d6'
      });
    }
  }

  formatearFecha(fecha: Date | undefined): string {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  get totalSucursales(): number {
    return this.sucursales().length;
  }

  get sucursalesActivas(): number {
    return this.sucursales().filter(s => s.activo).length;
  }

  get sucursalesInactivas(): number {
    return this.sucursales().filter(s => !s.activo).length;
  }
}
