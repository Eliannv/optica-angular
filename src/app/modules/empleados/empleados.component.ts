/**
 * Componente para la gestión y administración de empleados.
 * 
 * Responsabilidades:
 * - Listar todos los empleados con filtros dinámicos (nombre, estado)
 * - Editar datos de empleados (cédula, nombre, apellido, email, fecha nacimiento)
 * - Bloquear/desbloquear empleados y asignar automáticamente Machine ID y sucursal
 * - Validar datos en tiempo real mediante formularios reactivos
 * 
 * Integración:
 * - Conecta con EmpleadosService para operaciones CRUD
 * - Utiliza Firestore para persistencia de datos
 * - Emplea formularios reactivos de Angular para validación segura
 * - SweetAlert2 para confirmaciones y notificaciones
 */

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors, FormGroup } from '@angular/forms';
import { EmpleadosService } from '../../core/services/empleados.service';
import { EnterNextDirective } from '../../shared/directives/enter-next.directive';
import { Usuario } from '../../core/models/usuario.model';
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
  private fb = inject(FormBuilder);

  empleados: Usuario[] = [];
  empleadosFiltrados: Usuario[] = [];
  cargando = true;
  error: string | null = null;

  filtroNombre = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' = 'todos';

  modalAbierto = false;
  empleadoSeleccionado: Usuario | null = null;
  formEditar!: FormGroup;

  machineIdActual: string | null = null;
  sucursalActual: string = 'PASAJE';

  /**
   * Hook de inicialización del componente.
   * Carga los empleados, Machine ID y sucursal actual.
   */
  ngOnInit(): void {
    this.cargarEmpleados();
    this.machineIdActual = this.empleadosService.getMachineIdActual();
    this.sucursalActual = this.empleadosService.getSucursalActual();
  }

  /**
   * Carga la lista completa de empleados desde Firestore.
   * Actualiza estado de carga y aplica filtros automáticamente.
   * 
   * Nota: Los errores de carga se capturan y se muestran en la interfaz.
   */
  cargarEmpleados(): void {
    this.cargando = true;
    this.error = null;

    this.empleadosService.getEmpleados().subscribe({
      next: (empleados) => {
        this.empleados = empleados;
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (err) => {
        this.error = `Error al cargar empleados: ${err.message}`;
        this.cargando = false;
      }
    });
  }

  /**
   * Aplica filtros de búsqueda y estado a la lista de empleados.
   * 
   * Soporta:
   * - Filtro por nombre o email (búsqueda case-insensitive)
   * - Filtro por estado: todos, activos, inactivos
   */
  aplicarFiltros(): void {
    let filtrados = [...this.empleados];

    if (this.filtroNombre.trim()) {
      const termino = this.filtroNombre.toLowerCase();
      filtrados = filtrados.filter(emp =>
        emp.nombre.toLowerCase().includes(termino) ||
        emp.email.toLowerCase().includes(termino)
      );
    }

    filtrados = this.filtroEstado === 'activos'
      ? filtrados.filter(emp => emp.activo)
      : this.filtroEstado === 'inactivos'
      ? filtrados.filter(emp => !emp.activo)
      : filtrados;

    this.empleadosFiltrados = filtrados;
  }

  /**
   * Alterna el estado de actividad de un empleado.
   * 
   * @param empleado Empleado cuyo estado se alterna
   */
  toggleEstado(empleado: Usuario): void {
    const nuevoEstado = !empleado.activo;

    if (nuevoEstado && !this.machineIdActual) {
      Swal.fire({
        icon: 'error',
        title: 'Machine ID no disponible',
        text: 'Asegúrate de estar ejecutando la aplicación empaquetada.'
      });
      return;
    }

    const titulo = empleado.activo ? 'Bloquear empleado' : 'Desbloquear empleado';
    const texto = nuevoEstado
      ? `Desbloquear a ${empleado.nombre}.\nSe asignará:\nMachine ID: ${this.machineIdActual}\nSucursal: ${this.sucursalActual}`
      : `¿Estás seguro de bloquear a ${empleado.nombre}?\nSe quitarán Machine ID y Sucursal.`;

    Swal.fire({
      icon: 'question',
      title: titulo,
      text: texto,
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No'
    }).then(res => {
      if (res.isConfirmed) {
        this.aplicarCambioEstado(empleado, nuevoEstado);
      }
    });
  }

  /**
   * Aplica el cambio de estado en base de datos.
   */
  private aplicarCambioEstado(empleado: Usuario, nuevoEstado: boolean): void {
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
        const accion = nuevoEstado ? 'desbloqueado' : 'bloqueado';
        Swal.fire({
          icon: 'success',
          title: 'Listo',
          text: `Empleado ${accion} exitosamente`
        });
      })
      .catch(err => Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message
      }));
  }

  /**
   * Abre el modal de edición para un empleado.
   * 
   * @param empleado Empleado a editar
   */
  abrirModalEditar(empleado: Usuario): void {
    this.empleadoSeleccionado = { ...empleado };
    this.modalAbierto = true;

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

  /**
   * Valida y guarda los cambios del formulario de edición.
   */
  guardarEdicion(): void {
    if (!this.empleadoSeleccionado?.id) return;

    if (this.formEditar?.invalid) {
      this.formEditar.markAllAsTouched();
      return;
    }

    const datos = {
      nombre: this.formEditar.value.nombre,
      email: this.formEditar.value.email,
      cedula: this.formEditar.value.cedula || null,
      apellido: this.formEditar.value.apellido || null,
      fechaNacimiento: this.formEditar.value.fechaNacimiento || null
    };

    this.empleadosService.actualizarEmpleado(this.empleadoSeleccionado.id, datos)
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Empleado actualizado exitosamente.'
        });
        this.cerrarModal();
        this.cargarEmpleados();
      })
      .catch(err => Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message
      }));
  }

  /**
   * Determina si un campo del formulario es inválido.
   */
  esInvalido(campo: string): boolean {
    const control = this.formEditar?.get(campo);
    return !!(control?.invalid && (control?.touched || control?.dirty));
  }

  /**
   * Retorna el mensaje de error para un campo.
   */
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

  /**
   * Validador personalizado para edad mínima.
   */
  edadMinimaValidator(edadMinima: number): (control: AbstractControl) => ValidationErrors | null {
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

  /**
   * Validador asincrónico para verificar unicidad de email.
   */
  uniqueEmailValidator(excluirId: string): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').toLowerCase().trim();
      if (!value) return null;

      const existe = await this.empleadosService.existeEmail(value, excluirId);
      return existe ? { emailTomado: true } : null;
    };
  }

  /**
   * Validador asincrónico para verificar unicidad de cédula.
   */
  uniqueCedulaValidator(excluirId: string): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').trim();
      if (!value) return null;

      const existe = await this.empleadosService.existeCedula(value, excluirId);
      return existe ? { cedulaTomada: true } : null;
    };
  }

  /**
   * Cierra el modal de edición.
   */
  cerrarModal(): void {
    this.modalAbierto = false;
    this.empleadoSeleccionado = null;
  }

  /**
   * Retorna el texto de estado del empleado.
   */
  getEstadoTexto(empleado: Usuario): string {
    if (!empleado.activo) return 'Bloqueado';
    if (!empleado.machineId) return 'Sin Acceso';
    return 'Activo';
  }
}
