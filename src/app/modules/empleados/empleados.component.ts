import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors, FormGroup } from '@angular/forms';
import { EmpleadosService } from '../../core/services/empleados.service';
import { Usuario } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
      case 'sinAcceso':
        filtrados = filtrados.filter(emp => !emp.machineId);
        break;
    }

    this.empleadosFiltrados = filtrados;
  }

  toggleEstado(empleado: Usuario) {
    Swal.fire({
      icon: 'question',
      title: empleado.activo ? 'Bloquear empleado' : 'Desbloquear empleado',
      text: `¿Estás seguro de ${empleado.activo ? 'bloquear' : 'desbloquear'} a ${empleado.nombre}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No'
    }).then(res => {
      if (res.isConfirmed) {
        this.empleadosService.toggleEstadoEmpleado(empleado.id!, !empleado.activo)
          .then(() => {
            empleado.activo = !empleado.activo;
            Swal.fire({ icon: 'success', title: 'Listo', text: `Empleado ${empleado.activo ? 'desbloqueado' : 'bloqueado'} exitosamente` });
          })
          .catch(err => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
      }
    });
  }

  autorizarAcceso(empleado: Usuario) {
    if (!this.machineIdActual) {
      Swal.fire({ icon: 'error', title: 'Machine ID no disponible', text: 'Asegúrate de estar ejecutando la aplicación empaquetada.' });
      return;
    }

    const texto = empleado.machineId
      ? `Actualizar acceso de ${empleado.nombre}.\nMachine ID: ${this.machineIdActual}\nSucursal: ${this.sucursalActual}`
      : `Autorizar acceso a ${empleado.nombre}.\nMachine ID: ${this.machineIdActual}\nSucursal: ${this.sucursalActual}`;

    Swal.fire({ icon: 'question', title: empleado.machineId ? 'Actualizar acceso' : 'Autorizar acceso', text: texto, showCancelButton: true })
      .then(res => {
        if (res.isConfirmed) {
          this.empleadosService.autorizarAcceso(empleado.id!, this.machineIdActual!, this.sucursalActual)
            .then(() => {
              empleado.machineId = this.machineIdActual!;
              empleado.sucursal = this.sucursalActual;
              Swal.fire({ icon: 'success', title: 'Listo', text: 'Acceso autorizado exitosamente' });
            })
            .catch(err => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
        }
      });
  }

  revocarAcceso(empleado: Usuario) {
    Swal.fire({
      icon: 'warning',
      title: 'Revocar acceso',
      text: `¿Revocar el acceso de ${empleado.nombre}? El empleado no podrá iniciar sesión hasta ser autorizado nuevamente.`,
      showCancelButton: true
    }).then(res => {
      if (res.isConfirmed) {
        this.empleadosService.revocarAcceso(empleado.id!)
          .then(() => {
            empleado.machineId = undefined;
            empleado.sucursal = undefined;
            Swal.fire({ icon: 'success', title: 'Listo', text: 'Acceso revocado exitosamente' });
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
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(20)],
        asyncValidators: [this.uniqueCedulaValidator(empleado.id!)],
        updateOn: 'blur'
      }],
      nombre: [empleado.nombre || '', [Validators.required, Validators.minLength(2)]],
      apellido: [empleado.apellido || '', [Validators.required, Validators.minLength(2)]],
      fechaNacimiento: [empleado.fechaNacimiento || ''],
      email: [empleado.email || '', {
        validators: [Validators.required, Validators.email],
        asyncValidators: [this.uniqueEmailValidator(empleado.id!)],
        updateOn: 'blur'
      }]
    });

    // Modales de unicidad en blur
    const cedCtrl = this.formEditar.get('cedula');
    const mailCtrl = this.formEditar.get('email');
    cedCtrl?.statusChanges.subscribe(status => {
      if (status === 'INVALID' && cedCtrl.hasError('cedulaTomada')) {
        Swal.fire({ icon: 'error', title: 'Cédula ya registrada', text: 'La cédula ingresada ya pertenece a otro usuario.' });
      }
    });
    mailCtrl?.statusChanges.subscribe(status => {
      if (status === 'INVALID' && mailCtrl.hasError('emailTomado')) {
        Swal.fire({ icon: 'error', title: 'Correo ya registrado', text: 'El correo ingresado ya pertenece a otro usuario.' });
      }
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
      Swal.fire({ icon: 'warning', title: 'Datos incompletos', text: 'Revisa los campos del formulario.' });
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
      Swal.fire({ icon: 'success', title: 'Actualizado', text: 'Empleado actualizado exitosamente.' });
      this.cerrarModal();
      this.cargarEmpleados();
    })
    .catch(err => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
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
