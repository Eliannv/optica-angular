import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors, FormGroup } from '@angular/forms';
import { EmpleadosService } from '../../core/services/empleados.service';
import { EnterNextDirective } from '../../shared/directives/enter-next.directive';
import { Usuario } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, EnterNextDirective],
  templateUrl: './empleados.component.html',
  styleUrls: ['./empleados.component.css']
})
export class EmpleadosComponent implements OnInit {
  private empleadosService = inject(EmpleadosService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  empleados: Usuario[] = [];
  empleadosFiltrados: Usuario[] = [];
  cargando = true;
  error: string | null = null;
  
  // Filtros
  filtroNombre = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' | 'sinAcceso' = 'todos';

  // Modal
  modalAbierto = false;
  empleadoSeleccionado: Usuario | null = null;
  accionModal: 'editar' | 'autorizar' | 'cambiarPass' | null = null;
  // Reactive form
  formEditar!: FormGroup;

  // Machine ID actual
  machineIdActual: string | null = null;
  sucursalActual: string = 'PASAJE';

  ngOnInit() {
    this.cargarEmpleados();
    this.machineIdActual = this.empleadosService.getMachineIdActual();
    this.sucursalActual = this.empleadosService.getSucursalActual();
  }

  cargarEmpleados() {
    this.cargando = true;
    this.error = null;

    this.empleadosService.getEmpleados().subscribe({
      next: (empleados) => {
        this.empleados = empleados;
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cargar empleados: ' + err.message;
        this.cargando = false;
      }
    });
  }

  aplicarFiltros() {
    let filtrados = [...this.empleados];

    // Filtro por nombre
    if (this.filtroNombre.trim()) {
      const termino = this.filtroNombre.toLowerCase();
      filtrados = filtrados.filter(emp => 
        emp.nombre.toLowerCase().includes(termino) ||
        emp.email.toLowerCase().includes(termino)
      );
    }

    // Filtro por estado
    switch (this.filtroEstado) {
      case 'activos':
        filtrados = filtrados.filter(emp => emp.activo);
        break;
      case 'inactivos':
        filtrados = filtrados.filter(emp => !emp.activo);
        break;
    }

    this.empleadosFiltrados = filtrados;
  }

  toggleEstado(empleado: Usuario) {
    const nuevoEstado = !empleado.activo;
    
    // Si se va a desbloquear, verificar que tengamos machineId
    if (nuevoEstado && !this.machineIdActual) {
      Swal.fire({ icon: 'error', title: 'Machine ID no disponible', text: 'Asegúrate de estar ejecutando la aplicación empaquetada.' });
      return;
    }

    const texto = nuevoEstado 
      ? `Desbloquear a ${empleado.nombre}.\nSe asignará:\nMachine ID: ${this.machineIdActual}\nSucursal: ${this.sucursalActual}`
      : `¿Estás seguro de bloquear a ${empleado.nombre}?\nSe quitarán Machine ID y Sucursal.`;

    Swal.fire({
      icon: 'question',
      title: empleado.activo ? 'Bloquear empleado' : 'Desbloquear empleado',
      text: texto,
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No'
    }).then(res => {
      if (res.isConfirmed) {
        // Al desbloquear, asignar machineId y sucursal
        // Al bloquear, quitar machineId y sucursal
        const datosActualizacion = nuevoEstado 
          ? { activo: nuevoEstado, machineId: this.machineIdActual!, sucursal: this.sucursalActual }
          : { activo: nuevoEstado, machineId: undefined, sucursal: undefined };

        this.empleadosService.toggleEstadoEmpleado(empleado.id!, datosActualizacion)
          .then(() => {
            empleado.activo = nuevoEstado;
            if (nuevoEstado) {
              empleado.machineId = this.machineIdActual!;
              empleado.sucursal = this.sucursalActual;
            } else {
              empleado.machineId = undefined;
              empleado.sucursal = undefined;
            }
            Swal.fire({ icon: 'success', title: 'Listo', text: `Empleado ${nuevoEstado ? 'desbloqueado' : 'bloqueado'} exitosamente` });
          })
          .catch(err => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
      }
    });
  }

  abrirModalEditar(empleado: Usuario) {
    this.empleadoSeleccionado = { ...empleado };
    this.accionModal = 'editar';
    this.modalAbierto = true;

    // Construir formulario reactivo con validaciones
    this.formEditar = this.fb.group({
      cedula: [empleado.cedula || '', {
        validators: [
          Validators.required, 
          Validators.pattern(/^\d{10}$/)
        ],
        asyncValidators: [this.uniqueCedulaValidator(empleado.id!)],
        updateOn: 'blur'
      }],
      nombre: [empleado.nombre || '', [
        Validators.required, 
        Validators.minLength(2),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
      ]],
      apellido: [empleado.apellido || '', [
        Validators.required, 
        Validators.minLength(2),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
      ]],
      fechaNacimiento: [empleado.fechaNacimiento || '', [
        Validators.required,
        this.edadMinimaValidator(18)
      ]],
      email: [empleado.email || '', {
        validators: [Validators.required, Validators.email],
        asyncValidators: [this.uniqueEmailValidator(empleado.id!)],
        updateOn: 'blur'
      }]
    });
  }

  eliminarEmpleado(empleado: Usuario) {
    Swal.fire({
      icon: 'warning',
      title: 'Eliminar empleado',
      text: `Esta acción NO se puede deshacer. Escribe el nombre completo para confirmar:`,
      input: 'text',
      inputPlaceholder: empleado.nombre,
      showCancelButton: true
    }).then(res => {
      const confirmacion = res.value as string;
      if (res.isConfirmed && confirmacion === empleado.nombre) {
        this.empleadosService.eliminarEmpleado(empleado.id!)
          .then(() => {
            Swal.fire({ icon: 'success', title: 'Eliminado', text: 'Empleado eliminado exitosamente' });
            this.cargarEmpleados();
          })
          .catch(err => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
      } else if (res.isConfirmed) {
        Swal.fire({ icon: 'info', title: 'Cancelado', text: 'El nombre no coincide. Eliminación cancelada.' });
      }
    });
  }

  guardarEdicion() {
    if (!this.empleadoSeleccionado || !this.empleadoSeleccionado.id) return;

    if (!this.formEditar || this.formEditar.invalid) {
      this.formEditar.markAllAsTouched();
      // Evitar alertas: el usuario verá los errores en cada campo.
      return;
    }

    const v = this.formEditar.value;
    const datos: any = {
      nombre: v.nombre,
      email: v.email,
      cedula: v.cedula || null,
      apellido: v.apellido || null,
      fechaNacimiento: v.fechaNacimiento || null
    };

    this.empleadosService.actualizarEmpleado(this.empleadoSeleccionado.id, datos)
    .then(() => {
      // Confirmación discreta opcional
      Swal.fire({ icon: 'success', title: 'Actualizado', text: 'Empleado actualizado exitosamente.' });
      this.cerrarModal();
      this.cargarEmpleados();
    })
    .catch(err => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
  }

  // Métodos auxiliares para validación
  esInvalido(campo: string): boolean {
    const control = this.formEditar?.get(campo);
    return !!(control?.invalid && (control?.touched || control?.dirty));
  }

  getMensajeError(campo: string): string {
    const control = this.formEditar?.get(campo);
    
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    
    if (campo === 'nombre' || campo === 'apellido') {
      if (control?.hasError('minlength')) {
        return 'Debe tener al menos 2 caracteres';
      }
      if (control?.hasError('pattern')) {
        return 'Solo se permiten letras y espacios';
      }
    }
    
    if (campo === 'cedula') {
      if (control?.hasError('pattern')) {
        return 'La cédula debe tener exactamente 10 dígitos';
      }
      if (control?.hasError('cedulaTomada')) {
        return 'Esta cédula ya está registrada en el sistema';
      }
    }
    
    if (campo === 'email') {
      if (control?.hasError('email')) {
        return 'Ingrese un correo electrónico válido';
      }
      if (control?.hasError('emailTomado')) {
        return 'Este correo ya está registrado en el sistema';
      }
    }
    
    if (campo === 'fechaNacimiento') {
      if (control?.hasError('edadMinima')) {
        return `El empleado debe tener al menos ${control.errors?.['edadMinima'].edadRequerida} años`;
      }
    }
    
    return '';
  }

  // Validador de edad mínima
  edadMinimaValidator(edadMinima: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const fechaNac = new Date(control.value);
      const hoy = new Date();
      let edad = hoy.getFullYear() - fechaNac.getFullYear();
      const mes = hoy.getMonth() - fechaNac.getMonth();
      
      if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
        edad--;
      }
      
      return edad < edadMinima 
        ? { edadMinima: { edadRequerida: edadMinima, edadActual: edad } }
        : null;
    };
  }

  // Validadores asíncronos de unicidad
  uniqueEmailValidator(excluirId: string): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').toLowerCase();
      if (!value) return null;
      const existe = await this.empleadosService.existeEmail(value, excluirId);
      return existe ? { emailTomado: true } : null;
    };
  }

  uniqueCedulaValidator(excluirId: string): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').trim();
      if (!value) return null;
      const existe = await this.empleadosService.existeCedula(value, excluirId);
      return existe ? { cedulaTomada: true } : null;
    };
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.empleadoSeleccionado = null;
    this.accionModal = null;
  }

  getEstadoBadge(empleado: Usuario): string {
    if (!empleado.activo) return 'bg-danger';
    if (!empleado.machineId) return 'bg-warning';
    return 'bg-success';
  }

  getEstadoTexto(empleado: Usuario): string {
    if (!empleado.activo) return 'Bloqueado';
    if (!empleado.machineId) return 'Sin Acceso';
    return 'Activo';
  }
}
