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

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { EmpleadosService } from '../../core/services/empleados.service';
import { MaquinasAutorizadasService } from '../../core/services/maquinas-autorizadas.service';
import { MaquinaAutorizada } from '../../core/models/maquina-autorizada.model';
import { CajaBancoService } from '../../core/services/caja-banco.service';
import { EnterNextDirective } from '../../shared/directives/enter-next.directive';
import { Usuario, RolUsuario } from '../../core/models/usuario.model';
import { EmpleadoMetricasService } from '../../core/services/empleado-metricas.service';
import {
  EmpleadoConMetricas,
  MetricaGlobal,
  RankingItem,
  ResumenMensual,
  FiltrosMetricas
} from '../../core/models/empleado-metricas.model';
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
  private maquinasService = inject(MaquinasAutorizadasService);
  private cajaBancoSrv = inject(CajaBancoService);
  public metricasService = inject(EmpleadoMetricasService); // Público para acceso en template
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(Auth);

  empleados: Usuario[] = [];
  empleadosFiltrados: Usuario[] = [];
  cargando = true;
  error: string | null = null;

  filtroNombre = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' = 'todos';

  modalAbierto = false;
  empleadoSeleccionado: Usuario | null = null;
  formEditar!: FormGroup;

  // Variables para validación reactiva
  validandoCedula = false;
  validandoEmail = false;
  cedulaDuplicadaMsg = '';
  emailDuplicadoMsg = '';
  cedulaOriginal = '';
  emailOriginal = '';

  machineIdActual: string | null = null;
  sucursalActual: string = 'PASAJE';

  // ✅ NUEVAS PROPIEDADES PARA MÉTRICAS
  metricasGlobales: MetricaGlobal[] = [];
  rankingVentas: RankingItem[] = [];
  rankingMontos: RankingItem[] = [];
  empleadosConMetricas: EmpleadoConMetricas[] = [];
  cargandoMetricas = false; // ✅ Loading para cálculo de métricas
  
  // Filtros para métricas - basados en periodos reales
  periodoSeleccionado: string | null = null; // Formato: 'MM/YYYY'
  periodosDisponibles: Array<{mes: number, anio: number, label: string}> = [];
  cargandoPeriodos = false;
  sucursalFiltro: string = 'todas';
  sucursalesDisponibles: string[] = [];
  
  // Modal de detalle
  modalDetalleAbierto = false;
  empleadoDetalle: any = null;
  resumenMensualDetalle: ResumenMensual | null = null;
  historialMensual: ResumenMensual[] = [];
  cargandoDetalle = false;

  /**
   * Hook de inicialización del componente.
   * ✅ ACTUALIZADO: Carga empleados, periodos y métricas automáticamente
   */
  ngOnInit(): void {
    this.cargarEmpleados();
    this.machineIdActual = this.empleadosService.getMachineIdActual();
    this.sucursalActual = this.empleadosService.getSucursalActual();
    this.cargarPeriodosDisponibles();
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
   * Al desbloquear, permite seleccionar la máquina autorizada.
   * 
   * @param empleado Empleado cuyo estado se alterna
   */
  async toggleEstado(empleado: Usuario): Promise<void> {
    const nuevoEstado = !empleado.activo;

    if (nuevoEstado) {
      // Desbloquear: mostrar selector de máquinas
      await this.desbloquearConMaquina(empleado);
    } else {
      // Bloquear: confirmar y quitar máquina
      await this.bloquearEmpleado(empleado);
    }
  }

  /**
   * Desbloquea un empleado permitiéndole seleccionar una máquina autorizada
   */
  private async desbloquearConMaquina(empleado: Usuario): Promise<void> {
    try {
      // Obtener máquinas activas
      const maquinas = await new Promise<MaquinaAutorizada[]>((resolve, reject) => {
        this.maquinasService.getMaquinasAutorizadas().subscribe({
          next: (data) => resolve(data.filter(m => m.activo)),
          error: (err) => reject(err)
        });
      });

      if (maquinas.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'No hay máquinas disponibles',
          text: 'No se encontraron máquinas autorizadas activas. Primero registre máquinas en Gestión de Máquinas.',
          confirmButtonText: 'Entendido'
        });
        return;
      }

      // Crear opciones para el selector
      const opciones: { [key: string]: string } = {};
      maquinas.forEach(m => {
        opciones[m.machineId] = `${m.nombreMaquina} - ${m.sucursal}`;
      });

      const result = await Swal.fire({
        icon: 'question',
        title: `Desbloquear a ${empleado.nombre}`,
        html: `
          <div style="text-align: left; padding: 1rem;">
            <p style="margin-bottom: 1rem;">Seleccione la máquina que usará este empleado:</p>
          </div>
        `,
        input: 'select',
        inputOptions: opciones,
        inputPlaceholder: 'Seleccione una máquina',
        showCancelButton: true,
        confirmButtonText: 'Desbloquear',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        inputValidator: (value) => {
          if (!value) {
            return 'Debe seleccionar una máquina';
          }
          return null;
        }
      });

      if (!result.isConfirmed || !result.value) return;

      const maquinaSeleccionada = maquinas.find(m => m.machineId === result.value);
      if (!maquinaSeleccionada) return;

      // Aplicar cambios
      const datosActualizacion = {
        activo: true,
        machineId: maquinaSeleccionada.machineId,
        sucursal: maquinaSeleccionada.sucursal
      };

      await this.empleadosService.toggleEstadoEmpleado(empleado.id!, datosActualizacion);
      
      empleado.activo = true;
      empleado.machineId = maquinaSeleccionada.machineId;
      empleado.sucursal = maquinaSeleccionada.sucursal;

      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        html: `
          <div style="text-align: left; padding: 1rem;">
            <p><strong>Empleado desbloqueado</strong></p>
            <p><strong>Máquina asignada:</strong> ${maquinaSeleccionada.nombreMaquina}</p>
            <p><strong>Sucursal:</strong> ${maquinaSeleccionada.sucursal}</p>
          </div>
        `,
        timer: 3000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al desbloquear empleado:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo desbloquear el empleado',
        confirmButtonText: 'Cerrar'
      });
    }
  }

  /**
   * Bloquea un empleado y quita su asignación de máquina
   */
  private async bloquearEmpleado(empleado: Usuario): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Bloquear empleado',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p>¿Está seguro de bloquear a <strong>${empleado.nombre}</strong>?</p>
          <p style="color: #6c757d; margin-top: 1rem;">Se quitarán el Machine ID y la Sucursal asignados.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, Bloquear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    });

    if (!result.isConfirmed) return;

    try {
      const datosActualizacion = {
        activo: false,
        machineId: undefined,
        sucursal: undefined
      };

      await this.empleadosService.toggleEstadoEmpleado(empleado.id!, datosActualizacion);
      
      empleado.activo = false;
      empleado.machineId = undefined;
      empleado.sucursal = undefined;

      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Empleado bloqueado exitosamente',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al bloquear empleado:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo bloquear el empleado',
        confirmButtonText: 'Cerrar'
      });
    }
  }

  /**
   * Abre el modal de edición para un empleado.
   * 
   * @param empleado Empleado a editar
   */
  abrirModalEditar(empleado: Usuario): void {
    this.empleadoSeleccionado = { ...empleado };
    this.modalAbierto = true;

    // Guardar valores originales para comparar cambios
    this.cedulaOriginal = empleado.cedula || '';
    this.emailOriginal = empleado.email || '';
    
    // Limpiar mensajes de validación
    this.cedulaDuplicadaMsg = '';
    this.emailDuplicadoMsg = '';
    this.validandoCedula = false;
    this.validandoEmail = false;

    // Formulario sin validadores obligatorios
    this.formEditar = this.fb.group({
      cedula: [empleado.cedula || ''],
      nombre: [empleado.nombre || ''],
      apellido: [empleado.apellido || ''],
      fechaNacimiento: [empleado.fechaNacimiento || ''],
      email: [empleado.email || '']
    });

    // Configurar validaciones reactivas solo para cédula y email
    this.setupValidacionesReactivas();
  }

  /**
   * Configura validaciones reactivas para cédula y email.
   * Solo valida si los valores cambian respecto a los originales.
   */
  setupValidacionesReactivas(): void {
    // Validación reactiva para cédula
    this.formEditar.get('cedula')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(async (cedula: string) => {
        this.cedulaDuplicadaMsg = '';
        this.validandoCedula = false;
        
        if (!cedula || cedula.trim() === '') return;
        
        // Solo validar si cambió respecto al original
        if (cedula.trim() === this.cedulaOriginal.trim()) return;
        
        this.validandoCedula = true;
        this.cdr.markForCheck();
        
        try {
          const existe = await this.empleadosService.existeCedula(cedula, this.empleadoSeleccionado?.id);
          if (existe) {
            this.cedulaDuplicadaMsg = 'Esta cédula ya existe en el sistema';
          }
        } catch (error) {
          console.error('Error validando cédula:', error);
        } finally {
          this.validandoCedula = false;
          this.cdr.markForCheck();
        }
      });

    // Validación reactiva para email
    this.formEditar.get('email')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(async (email: string) => {
        this.emailDuplicadoMsg = '';
        this.validandoEmail = false;
        
        if (!email || email.trim() === '') return;
        
        // Solo validar si cambió respecto al original
        if (email.trim().toLowerCase() === this.emailOriginal.trim().toLowerCase()) return;
        
        this.validandoEmail = true;
        this.cdr.markForCheck();
        
        try {
          const existe = await this.empleadosService.existeEmail(email, this.empleadoSeleccionado?.id);
          if (existe) {
            this.emailDuplicadoMsg = 'Este email ya existe en el sistema';
          }
        } catch (error) {
          console.error('Error validando email:', error);
        } finally {
          this.validandoEmail = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Verifica si el formulario puede ser guardado.
   */
  get puedeGuardar(): boolean {
    // Bloquear si hay duplicados
    if (this.cedulaDuplicadaMsg || this.emailDuplicadoMsg) return false;
    
    // Bloquear si se está validando
    if (this.validandoCedula || this.validandoEmail) return false;
    
    return true;
  }

  /**
   * Valida y guarda los cambios del formulario de edición.
   */
  async guardarEdicion(): Promise<void> {
    if (!this.empleadoSeleccionado?.id) return;

    const cedula = this.formEditar.get('cedula')?.value || '';
    const email = this.formEditar.get('email')?.value || '';

    // Validar cédula si cambió
    if (cedula && cedula.trim() !== this.cedulaOriginal.trim()) {
      const cedulaExiste = await this.empleadosService.existeCedula(cedula, this.empleadoSeleccionado.id);
      if (cedulaExiste) {
        Swal.fire({
          icon: 'error',
          title: 'Cédula duplicada',
          text: 'Esta cédula ya existe en el sistema'
        });
        return;
      }
    }

    // Validar email si cambió
    if (email && email.trim() !== this.emailOriginal.trim()) {
      const emailExiste = await this.empleadosService.existeEmail(email, this.empleadoSeleccionado.id);
      if (emailExiste) {
        Swal.fire({
          icon: 'error',
          title: 'Email duplicado',
          text: 'Este email ya existe en el sistema'
        });
        return;
      }
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

  // =====================================================
  // ✅ NUEVOS MÉTODOS PARA MÉTRICAS Y REPORTES
  // =====================================================

  /**
   * 📆 Carga los periodos disponibles basados en cajas banco.
   * Selecciona automáticamente el periodo más reciente.
   */
  cargarPeriodosDisponibles(): void {
    this.cargandoPeriodos = true;
    this.cajaBancoSrv.getCajasBanco().subscribe({
      next: (cajasBanco) => {
        // Obtener periodos únicos ordenados por fecha descendente
        const periodosMap = new Map<string, {mes: number, anio: number, label: string}>();
        
        cajasBanco.forEach(caja => {
          let fecha: Date;
          if (caja.fecha instanceof Date) {
            fecha = caja.fecha;
          } else if (caja.fecha && typeof caja.fecha === 'object' && 'toDate' in caja.fecha) {
            fecha = (caja.fecha as any).toDate();
          } else {
            fecha = new Date(caja.fecha);
          }
          
          const mes = fecha.getMonth() + 1; // 1-12
          const anio = fecha.getFullYear();
          const key = `${mes.toString().padStart(2, '0')}/${anio}`;
          
          if (!periodosMap.has(key)) {
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            periodosMap.set(key, {
              mes,
              anio,
              label: `${meses[mes - 1]} ${anio}`
            });
          }
        });

        // Convertir a array y ordenar por fecha descendente
        this.periodosDisponibles = Array.from(periodosMap.values())
          .sort((a, b) => {
            if (a.anio !== b.anio) return b.anio - a.anio;
            return b.mes - a.mes;
          });

        // Seleccionar automáticamente el periodo más reciente
        if (this.periodosDisponibles.length > 0) {
          const periodo = this.periodosDisponibles[0];
          this.periodoSeleccionado = `${periodo.mes.toString().padStart(2, '0')}/${periodo.anio}`;
          this.cargarMetricas();
        }

        this.cargandoPeriodos = false;
      },
      error: (error) => {
        this.cargandoPeriodos = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los periodos disponibles'
        });
      }
    });
  }

  /**
   * Carga todas las métricas del sistema.
   */
  /**
   * Carga todas las métricas del sistema.
   */
  async cargarMetricas(): Promise<void> {
    if (!this.periodoSeleccionado) {
      return;
    }

    this.cargandoMetricas = true;
    
    // Mostrar loading de SweetAlert2
    Swal.fire({
      title: 'Calculando métricas...',
      html: 'Por favor espera mientras procesamos los datos',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    try {
      const currentUser = this.auth.currentUser;
      
      if (!currentUser) {
        Swal.close();
        this.cargandoMetricas = false;
        return;
      }

      // Obtener year y month desde periodoSeleccionado
      const [mesStr, anioStr] = this.periodoSeleccionado.split('/');
      const year = parseInt(anioStr, 10);
      const month = parseInt(mesStr, 10);

      // Cargar métricas globales
      this.metricasGlobales = await this.metricasService.calcularMetricasGlobales(
        year,
        month,
        this.empleados
      );

      // Cargar rankings
      const fechaInicio = new Date(year, month - 1, 1);
      const fechaFin = new Date(year, month, 0, 23, 59, 59);

      [this.rankingVentas, this.rankingMontos] = await Promise.all([
        this.metricasService.generarRankingVentas(this.empleados, fechaInicio, fechaFin, 5),
        this.metricasService.generarRankingMontoVendido(this.empleados, fechaInicio, fechaFin, 5)
      ]);

      // Cargar métricas individuales para cada empleado
      await this.cargarMetricasEmpleados();

      // Extraer sucursales disponibles
      this.extractSucursales();
      
      // Cerrar loading
      Swal.close();
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las métricas. Por favor intenta nuevamente.'
      });
    } finally {
      this.cargandoMetricas = false;
    }
  }

  /**
   * Carga métricas individuales para cada empleado.
   */
  async cargarMetricasEmpleados(): Promise<void> {
    if (!this.periodoSeleccionado) return;

    const [mesStr, anioStr] = this.periodoSeleccionado.split('/');
    const year = parseInt(anioStr, 10);
    const month = parseInt(mesStr, 10);

    const promesas = this.empleados.map(async (emp) => {
      if (!emp.id) return null;

      const resumen = await this.metricasService.calcularResumenMensual(emp.id, year, month);
      const antiguedad = this.metricasService.calcularAntiguedad(emp.createdAt);

      const empleadoConMetricas: EmpleadoConMetricas = {
        id: emp.id,
        nombre: emp.nombre,
        email: emp.email,
        rol: emp.rol,
        sucursal: emp.sucursal,
        activo: emp.activo,
        createdAt: emp.createdAt?.toDate ? emp.createdAt.toDate() : new Date(emp.createdAt),
        antiguedadMeses: antiguedad.meses,
        antiguedadTexto: antiguedad.texto,
        metricasActuales: resumen
      };

      return empleadoConMetricas;
    });

    const resultados = await Promise.all(promesas);
    this.empleadosConMetricas = resultados.filter(e => e !== null) as EmpleadoConMetricas[];
  }

  /**
   * Extrae las sucursales disponibles de los empleados.
   */
  extractSucursales(): void {
    const sucursales = new Set<string>();
    this.empleados.forEach(emp => {
      if (emp.sucursal) {
        sucursales.add(emp.sucursal);
      }
    });
    this.sucursalesDisponibles = Array.from(sucursales).sort();
  }

  /**
   * Abre modal de detalle de un empleado.
   */
  async abrirModalDetalle(empleado: Usuario): Promise<void> {
    if (!empleado.id) return;

    const currentUser = this.auth.currentUser;
    
    if (!currentUser) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Debes estar autenticado para ver los detalles'
      });
      return;
    }

    this.modalDetalleAbierto = true;
    this.empleadoDetalle = empleado;
    this.cargandoDetalle = true;

    try {
      if (!this.periodoSeleccionado) {
        this.cargandoDetalle = false;
        return;
      }

      const [mesStr, anioStr] = this.periodoSeleccionado.split('/');
      const year = parseInt(anioStr, 10);
      const month = parseInt(mesStr, 10);

      // Cargar resumen del mes actual
      this.resumenMensualDetalle = await this.metricasService.calcularResumenMensual(
        empleado.id,
        year,
        month
      );

      // Cargar historial de últimos 6 meses
      this.historialMensual = await this.metricasService.calcularHistorialMensual(empleado.id, 6);

      this.cargandoDetalle = false;
    } catch (error: any) {
      console.error('❌ Error cargando detalle:', error);
      this.cargandoDetalle = false;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el detalle del empleado'
      });
    }
  }

  /**
   * Cierra el modal de detalle.
   */
  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.empleadoDetalle = null;
    this.resumenMensualDetalle = null;
    this.historialMensual = [];
  }

  /**
   * Cambia el periodo de análisis y recarga métricas.
   */
  async cambiarMes(direccion: 'anterior' | 'siguiente'): Promise<void> {
    if (!this.periodoSeleccionado || this.periodosDisponibles.length === 0) return;

    // Encontrar el índice del periodo actual
    const indiceActual = this.periodosDisponibles.findIndex(
      p => `${p.mes.toString().padStart(2, '0')}/${p.anio}` === this.periodoSeleccionado
    );

    if (indiceActual === -1) return;

    // Calcular nuevo índice
    let nuevoIndice: number;
    if (direccion === 'siguiente') {
      // Siguiente = más reciente (indice menor)
      nuevoIndice = indiceActual - 1;
    } else {
      // Anterior = más antiguo (indice mayor)
      nuevoIndice = indiceActual + 1;
    }

    // Validar que el nuevo índice esté dentro del rango
    if (nuevoIndice < 0 || nuevoIndice >= this.periodosDisponibles.length) return;

    // Actualizar periodo seleccionado
    const nuevoPeriodo = this.periodosDisponibles[nuevoIndice];
    this.periodoSeleccionado = `${nuevoPeriodo.mes.toString().padStart(2, '0')}/${nuevoPeriodo.anio}`;
    
    await this.cargarMetricas();
  }

  /**
   * Obtiene el nombre del periodo actual seleccionado.
   */
  get mesActualNombre(): string {
    if (!this.periodoSeleccionado) return '-';

    const periodo = this.periodosDisponibles.find(
      p => `${p.mes.toString().padStart(2, '0')}/${p.anio}` === this.periodoSeleccionado
    );

    return periodo ? periodo.label : this.periodoSeleccionado;
  }

  /**
   * Mapea rol numérico a texto.
   */
  getRolTexto(rol: number): string {
    return this.metricasService.mapearRolTexto(rol);
  }

  /**
   * Formatea un monto como moneda.
   */
  formatearMoneda(monto: number): string {
    return `$${monto.toFixed(2)}`;
  }

  /**
   * Obtiene el emoji de medalla según la posición.
   */
  getMedalla(posicion: number): string {
    switch (posicion) {
      case 1: return '1';
      case 2: return '2';
      case 3: return '3';
      default: return `${posicion}°`;
    }
  }

  /**
   * Filtra empleados según criterios de métricas.
   */
  get empleadosFiltradosMetricas(): EmpleadoConMetricas[] {
    let filtrados = [...this.empleadosConMetricas];

    // Filtro por sucursal
    if (this.sucursalFiltro !== 'todas') {
      filtrados = filtrados.filter(e => e.sucursal === this.sucursalFiltro);
    }

    return filtrados;
  }
}
