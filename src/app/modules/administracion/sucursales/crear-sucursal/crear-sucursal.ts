import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { SucursalesService } from '../../../../core/services/sucursales.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Sucursal } from '../../../../core/models/sucursal.model';

@Component({
  selector: 'app-crear-sucursal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './crear-sucursal.html',
  styleUrl: './crear-sucursal.css'
})
export class CrearSucursal implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sucursalesSrv = inject(SucursalesService);
  private authSrv = inject(AuthService);

  sucursalForm!: FormGroup;
  guardando = false;
  modoEdicion = false;
  sucursalId?: string;
  codigoOriginal?: string;
  validandoCodigo = false;

  ngOnInit(): void {
    this.inicializarFormulario();
    
    // Verificar si estamos editando (viene ID en la ruta)
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.modoEdicion = true;
        this.sucursalId = params['id'];
        this.cargarSucursal(params['id']);
      }
    });
  }

  async cargarSucursal(id: string): Promise<void> {
    try {
      this.guardando = true;
      const sucursales = await new Promise<Sucursal[]>((resolve) => {
        this.sucursalesSrv.getSucursales().subscribe(resolve);
      });
      
      const sucursal = sucursales.find(s => s.id === id);
      if (sucursal) {
        this.codigoOriginal = sucursal.codigo;
        this.sucursalForm.patchValue({
          codigo: sucursal.codigo,
          nombre: sucursal.nombre,
          activo: sucursal.activo,
          direccion: sucursal.direccion || '',
          telefono: sucursal.telefono || ''
        });
        // Deshabilitar el campo código en modo edición
        this.sucursalForm.get('codigo')?.disable();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se encontró la sucursal',
          confirmButtonColor: '#3085d6'
        });
        this.router.navigate(['/administracion/sucursales']);
      }
    } catch (error) {
      console.error('Error cargando sucursal:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la sucursal',
        confirmButtonColor: '#3085d6'
      });
    } finally {
      this.guardando = false;
    }
  }

  inicializarFormulario(sucursal?: Sucursal): void {
    this.sucursalForm = this.fb.group({
      codigo: [sucursal?.codigo || '', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/)]],
      nombre: [sucursal?.nombre || '', [Validators.required, Validators.minLength(3)]],
      activo: [sucursal?.activo ?? true],
      direccion: [sucursal?.direccion || ''],
      telefono: [sucursal?.telefono || '']
    });
  }

  async validarCodigoUnico(): Promise<void> {
    const codigo = this.sucursalForm.get('codigo')?.value?.toUpperCase();
    
    if (!codigo || codigo.length < 3) {
      return;
    }

    // No validar si estamos en modo edición (campo deshabilitado)
    if (this.modoEdicion) {
      return;
    }

    this.validandoCodigo = true;
    try {
      const existe = await this.sucursalesSrv.existeCodigo(codigo);
      if (existe) {
        this.sucursalForm.get('codigo')?.setErrors({ codigoDuplicado: true });
      }
    } finally {
      this.validandoCodigo = false;
    }
  }

  async guardarSucursal(): Promise<void> {
    if (this.sucursalForm.invalid) {
      this.marcarCamposInvalidos();
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor complete todos los campos requeridos',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    // En modo edición, obtener el código del valor original (el campo está deshabilitado)
    const codigo = this.modoEdicion 
      ? this.codigoOriginal! 
      : this.sucursalForm.value.codigo.toUpperCase();
    
    // Verificar código único solo si es nuevo
    if (!this.modoEdicion) {
      const existe = await this.sucursalesSrv.existeCodigo(codigo);
      if (existe) {
        Swal.fire({
          icon: 'error',
          title: 'Código duplicado',
          text: `El código ${codigo} ya está registrado`,
          confirmButtonColor: '#3085d6'
        });
        return;
      }
    }

    const result = await Swal.fire({
      icon: 'question',
      title: this.modoEdicion ? '¿Actualizar sucursal?' : '¿Guardar sucursal?',
      text: this.modoEdicion 
        ? `Se actualizará la sucursal ${this.sucursalForm.value.nombre}`
        : `Se creará la sucursal ${this.sucursalForm.value.nombre}`,
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: this.modoEdicion ? 'Sí, actualizar' : 'Sí, guardar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.guardando = true;
    
    try {
      const usuario = this.authSrv.getCurrentUser();
      const sucursalData = {
        ...this.sucursalForm.value,
        codigo: codigo
      };

      if (this.modoEdicion && this.sucursalId) {
        // Actualizar sucursal existente
        await this.sucursalesSrv.actualizarSucursal(this.sucursalId, sucursalData);
      } else {
        // Crear nueva sucursal
        await this.sucursalesSrv.guardarSucursal(sucursalData, usuario?.id);
      }

      await Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: this.modoEdicion ? 'Sucursal actualizada correctamente' : 'Sucursal creada correctamente',
        confirmButtonColor: '#3085d6'
      });

      this.router.navigate(['/administracion/sucursales']);
    } catch (error: any) {
      console.error('Error al guardar sucursal:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo guardar la sucursal',
        confirmButtonColor: '#3085d6'
      });
    } finally {
      this.guardando = false;
    }
  }

  private marcarCamposInvalidos(): void {
    Object.keys(this.sucursalForm.controls).forEach(key => {
      const control = this.sucursalForm.get(key);
      if (control?.invalid) {
        control.markAsTouched();
      }
    });
  }

  get codigoInvalido(): boolean {
    // En modo edición el campo está deshabilitado, no mostrar como inválido
    if (this.modoEdicion) {
      return false;
    }
    const control = this.sucursalForm.get('codigo');
    return !!(control?.invalid && (control?.dirty || control?.touched));
  }

  get nombreInvalido(): boolean {
    const control = this.sucursalForm.get('nombre');
    return !!(control?.invalid && (control?.dirty || control?.touched));
  }
}
