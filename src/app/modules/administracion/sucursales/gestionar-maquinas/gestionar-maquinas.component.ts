import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MaquinasAutorizadasService } from '../../../../core/services/maquinas-autorizadas.service';
import { SucursalesService } from '../../../../core/services/sucursales.service';
import { MaquinaAutorizada } from '../../../../core/models/maquina-autorizada.model';
import { Sucursal } from '../../../../core/models/sucursal.model';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestionar-maquinas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gestionar-maquinas.component.html',
  styleUrls: ['./gestionar-maquinas.component.css'],
})
export class GestionarMaquinasComponent implements OnInit {
  maquinas = signal<MaquinaAutorizada[]>([]);
  sucursales = signal<Sucursal[]>([]);
  maquinaForm!: FormGroup;
  mostrarFormulario = signal(false);
  modoEdicion = signal(false);
  cargando = signal(false);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private maquinasService: MaquinasAutorizadasService,
    private sucursalesService: SucursalesService,
    private authService: AuthService
  ) {
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.cargarMaquinas();
    this.cargarSucursales();
  }

  inicializarFormulario(): void {
    this.maquinaForm = this.fb.group({
      id: [''],
      machineId: ['', [Validators.required, Validators.minLength(16), Validators.maxLength(16)]],
      sucursal: ['', Validators.required],
      nombreMaquina: ['', Validators.required],
      activo: [true],
      observaciones: [''],
    });
  }

  cargarMaquinas(): void {
    this.cargando.set(true);
    this.maquinasService.getMaquinasAutorizadas().subscribe({
      next: (maquinas) => {
        this.maquinas.set(maquinas);
        this.cargando.set(false);
      },
      error: (error) => {
        console.error('Error cargando máquinas:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al cargar las máquinas',
          confirmButtonText: 'Cerrar'
        });
        this.cargando.set(false);
      },
    });
  }

  cargarSucursales(): void {
    this.sucursalesService.getSucursalesActivas().subscribe({
      next: (sucursales) => {
        this.sucursales.set(sucursales);
      },
      error: (error) => {
        console.error('Error cargando sucursales:', error);
      },
    });
  }

  nuevaMaquina(): void {
    this.modoEdicion.set(false);
    this.maquinaForm.reset({ activo: true });
    this.mostrarFormulario.set(true);
  }

  editarMaquina(maquina: MaquinaAutorizada): void {
    this.modoEdicion.set(true);
    this.maquinaForm.patchValue(maquina);
    this.mostrarFormulario.set(true);
  }

  async guardarMaquina(): Promise<void> {
    if (this.maquinaForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor complete todos los campos requeridos',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    this.cargando.set(true);
    const usuario = this.authService.getCurrentUser();

    try {
      await this.maquinasService.guardarMaquina(
        this.maquinaForm.value,
        usuario?.id
      );

      await Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: this.modoEdicion() ? 'Máquina actualizada correctamente' : 'Máquina registrada correctamente',
        timer: 2000,
        showConfirmButton: false
      });
      this.cancelar();
      this.cargarMaquinas();
    } catch (error) {
      console.error('Error guardando máquina:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al guardar la máquina',
        confirmButtonText: 'Cerrar'
      });
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarEstado(maquina: MaquinaAutorizada): Promise<void> {
    const nuevoEstado = !maquina.activo;
    
    const result = await Swal.fire({
      icon: 'question',
      title: `¿Está seguro de ${nuevoEstado ? 'ACTIVAR' : 'DESACTIVAR'} la máquina?`,
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p><strong>Máquina:</strong> ${maquina.nombreMaquina}</p>
          <p><strong>Sucursal:</strong> ${maquina.sucursal}</p>
          <p><strong>Machine ID:</strong> <code>${maquina.machineId}</code></p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: nuevoEstado ? 'Sí, Activar' : 'Sí, Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: nuevoEstado ? '#28a745' : '#dc3545'
    });

    if (!result.isConfirmed) return;

    try {
      await this.maquinasService.cambiarEstadoMaquina(maquina.id!, nuevoEstado);
      await Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: `Máquina ${nuevoEstado ? 'activada' : 'desactivada'} correctamente`,
        timer: 2000,
        showConfirmButton: false
      });
      this.cargarMaquinas();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al cambiar el estado de la máquina',
        confirmButtonText: 'Cerrar'
      });
    }
  }

  async eliminarMaquina(maquina: MaquinaAutorizada): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: '⚠️ ¿Eliminar permanentemente?',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p><strong>Máquina:</strong> ${maquina.nombreMaquina}</p>
          <p style="color: #dc3545; font-weight: 600;">Esta acción NO se puede deshacer.</p>
          <p style="color: #6c757d; font-style: italic;">Recomendación: Mejor DESACTIVAR la máquina para mantener el historial.</p>
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
      await this.maquinasService.eliminarMaquina(maquina.id!);
      await Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Máquina eliminada correctamente',
        timer: 2000,
        showConfirmButton: false
      });
      this.cargarMaquinas();
    } catch (error) {
      console.error('Error eliminando máquina:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al eliminar la máquina',
        confirmButtonText: 'Cerrar'
      });
    }
  }

  async registrarMaquinasIniciales(): Promise<void> {
    const result = await Swal.fire({
      icon: 'info',
      title: 'Registrar Máquinas Iniciales',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p>Esta acción registrará las 4 máquinas iniciales:</p>
          <ul style="margin-top: 1rem;">
            <li>PC Desarrollo 1</li>
            <li>PC Desarrollo 2</li>
            <li>PC Sucursal Pasaje</li>
            <li>PC Sede Principal Machala</li>
          </ul>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3498db'
    });

    if (!result.isConfirmed) return;

    this.cargando.set(true);
    const usuario = this.authService.getCurrentUser();

    try {
      await this.maquinasService.registrarMaquinasIniciales(usuario?.id || 'system');
      await Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Máquinas iniciales registradas correctamente',
        timer: 2000,
        showConfirmButton: false
      });
      this.cargarMaquinas();
    } catch (error) {
      console.error('Error registrando máquinas iniciales:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al registrar las máquinas iniciales',
        confirmButtonText: 'Cerrar'
      });
    } finally {
      this.cargando.set(false);
    }
  }

  volverASucursales(): void {
    this.router.navigate(['/administracion/sucursales']);
  }

  cancelar(): void {
    this.mostrarFormulario.set(false);
    this.maquinaForm.reset({ activo: true });
  }

  formatearFecha(fecha: Date | undefined): string {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleString('es-EC');
  }

  getEstadoBadgeClass(activo: boolean): string {
    return activo ? 'badge bg-success' : 'badge bg-danger';
  }

  getSucursalBadgeClass(sucursal: string): string {
    // Clase base para todas las sucursales
    return 'badge bg-info';
  }

  // Métodos calculados para estadísticas
  get totalMaquinas(): number {
    return this.maquinas().length;
  }

  get maquinasActivas(): number {
    return this.maquinas().filter(m => m.activo).length;
  }

  get maquinasInactivas(): number {
    return this.maquinas().filter(m => !m.activo).length;
  }

  get totalSucursales(): number {
    return this.sucursales().length;
  }
}
