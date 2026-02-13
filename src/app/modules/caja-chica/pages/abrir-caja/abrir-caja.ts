/**
 * Componente para abrir una nueva caja chica diaria.
 *
 * Propósito:
 * Facilita la creación de cajas chicas diarias con un monto inicial definido.
 * Una caja chica es un mecanismo para registrar gastos menores sin pasar
 * por la caja banco principal. Cada caja tiene una sola vida útil (1 día)
 * y se cierra al final del turno.
 *
 * Validaciones implementadas:
 * - Existencia de caja banco principal (prerequisito obligatorio)
 * - Que no exista ya una caja abierta para hoy (localStorage check + alerta)
 * - Que la fecha no sea futura
 * - Que el formulario esté completo (monto_inicial requerido)
 *
 * Flujo de apertura:
 * 1. Usuario completa formulario (fecha [fija a hoy], monto_inicial, observación opcional)
 * 2. Sistema valida existencia de caja banco
 * 3. Si no existe: Muestra alerta diferenciada (admin/operador)
 * 4. Si existe: Validaciones internas (fecha, duplicidad, formulario)
 * 5. Crea registro en Firestore con datos del operador y timestamp
 * 6. Guarda ID en localStorage para referencia rápida en el sesión
 * 7. Redirige a vista detallada de caja (ver-caja)
 * 8. Muestra mensajes de alerta con SWAL
 *
 * Gestión del ciclo de vida:
 * - OnInit: Inicializa formulario y limpia localStorage anterior
 * - OnDestroy: Completa el Subject destroy$ para evitar memory leaks en suscripciones
 *
 * @component AbrirCajaComponent
 * @standalone false
 * @module CajaChicaModule
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { normalizarFecha, obtenerPeriodo } from '../../../../core/utils/fecha-helpers';

@Component({
  selector: 'app-abrir-caja',
  standalone: false,
  templateUrl: './abrir-caja.html',
  styleUrls: ['./abrir-caja.css']
})
export class AbrirCajaComponent implements OnInit, OnDestroy {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  cargando = false;
  error = '';
  maxFecha = '';
  private procesando = false;
  
  // 🔒 Restricción de fecha según el periodo de la caja banco
  fechaMinima = ''; // Fecha mínima permitida (inicio del mes de la caja banco)
  fechaMaximaPermitida = ''; // Fecha máxima permitida (fin del mes de la caja banco o hoy)
  periodoNombre = ''; // Nombre del periodo para mostrar (ej: "Enero 2026")

  /** Referencia al control de monto para usar en template */
  get montoControl() {
    return this.form.get('monto_inicial');
  }

  /** Fecha máxima permitida (hoy) en formato YYYY-MM-DD */
  get fechaMaxima(): string {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
  }

  /** Verifica si el usuario actual es operador (no puede seleccionar fechas) */
  get esOperador(): boolean {
    return !this.authService.isAdmin();
  }

  ngOnInit(): void {
    this.inicializarFormulario();
    // Cargar restricciones de fecha según caja banco abierta
    this.cargarRestriccionesFechaCajaBanco();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el formulario reactivo con estructura y validaciones.
   *
   * Campos:
   * - fecha: string en formato YYYY-MM-DD (default: hoy, editable por usuario para historial)
   * - monto_inicial: number (requerido, mínimo 0)
   * - observacion: string (opcional)
   *
   * NUEVO COMPORTAMIENTO:
   * - Fecha es EDITABLE (permite crear cajas históricas)
   * - Por defecto usa la fecha actual en formato ISO para compatibilidad con input[type=date]
   * - Usuario puede seleccionar cualquier fecha pasada o presente
   *
   * Efectos secundarios:
   * - Limpia localStorage de referencia anterior (cajaChicaAbierta)
   *
   * @returns void
   */
  inicializarFormulario(): void {
    // Usar string ISO para evitar problemas de timezone con input[type=date]
    const hoy = new Date();
    const fechaISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    
    localStorage.removeItem('cajaChicaAbierta');

    this.form = this.formBuilder.group({
      fecha: [fechaISO, Validators.required],
      monto_inicial: ['', [Validators.required, Validators.min(0)]],
      observacion: ['']
    });

    // SEGURIDAD: Si es operador, deshabilitar el campo de fecha
    if (this.esOperador) {
      this.form.get('fecha')?.disable();
    }
  }

  /**
   * Carga las restricciones de fecha min/max basadas en el periodo de la caja banco abierta.
   * Limita la selección de fecha al mes de la caja banco activa.
   */
  async cargarRestriccionesFechaCajaBanco(): Promise<void> {
    try {
      const caja = await this.cajaBancoService.getCajaBancoAbierta();
      
      if (!caja?.fecha) {
        console.warn('⚠️ No hay caja banco abierta');
        return;
      }

      // Convertir fecha de Firestore a Date
      let fechaCaja: Date;
      if ((caja.fecha as any)?.toDate) {
        fechaCaja = (caja.fecha as any).toDate();
      } else if (caja.fecha instanceof Date) {
        fechaCaja = caja.fecha;
      } else {
        fechaCaja = new Date(caja.fecha);
      }

      // Obtener periodo de la caja
      const periodo = obtenerPeriodo(fechaCaja);
      const year = periodo.year;
      const month = periodo.monthIndex0; // Base 0

      // Calcular primer y último día del mes
      const primerDia = new Date(year, month, 1);
      const ultimoDia = new Date(year, month + 1, 0); // Día 0 del mes siguiente = último día del mes actual
      const hoy = new Date();

      // Formatear para input[type="date"] (YYYY-MM-DD)
      this.fechaMinima = this.formatearFecha(primerDia);
      // La fecha máxima es el menor entre el último día del mes y hoy
      const fechaMax = ultimoDia < hoy ? ultimoDia : hoy;
      this.fechaMaximaPermitida = this.formatearFecha(fechaMax);
      
      // Nombre del periodo para mostrar
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      this.periodoNombre = `${meses[month]} ${year}`;

      console.log(`📅 Restricciones de fecha establecidas: ${this.fechaMinima} a ${this.fechaMaximaPermitida} (${this.periodoNombre})`);
    } catch (error) {
      console.error('❌ Error cargando restricciones de fecha:', error);
    }
  }

  /**
   * Formatea una fecha a string YYYY-MM-DD para input[type="date"]
   */
  private formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Inicia el flujo de apertura de caja chica.
   *
   * Proceso:
   * 1. Guarda flag cargando = true para evitar múltiples clics
   * 2. Consulta cajaBancoService.existeAlMenosUnaCajaBanco()
   * 3. Suscribción usa takeUntil para limpiar al destruir componente
   * 4. Si éxito: valida existencia con validarYProceder()
   * 5. Si error: maneja via manejarErrorValidacion()
   *
   * Guard:
   * - Retorna early si cargando = true (evita condición de carrera)
   *
   * @returns void
   */
  abrirCaja(): void {
    if (this.cargando) return;
    
    // Si es operador, forzar fecha actual (seguridad adicional)
    if (this.esOperador) {
      const hoy = new Date();
      const fechaISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      // Habilitar temporalmente, actualizar y deshabilitar de nuevo
      this.form.get('fecha')?.enable();
      this.form.patchValue({ fecha: fechaISO });
      this.form.get('fecha')?.disable();
    }
    
    // Validar que la fecha no sea futura (usar getRawValue para obtener valor incluso si está deshabilitado)
    const fechaSeleccionada = this.form.getRawValue().fecha;
    if (fechaSeleccionada) {
      // Validar que esté dentro del periodo de la caja banco
      if (this.fechaMinima && this.fechaMaximaPermitida) {
        if (fechaSeleccionada < this.fechaMinima || fechaSeleccionada > this.fechaMaximaPermitida) {
          Swal.fire({
            icon: 'error',
            title: 'Fecha Inválida',
            text: `La fecha debe estar dentro del periodo de la caja banco: ${this.periodoNombre}. Seleccione una fecha entre ${this.fechaMinima} y ${this.fechaMaximaPermitida}.`,
            confirmButtonText: 'Entendido'
          });
          return;
        }
      }
      
      const fechaNorm = new Date(fechaSeleccionada + 'T00:00:00');
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaNorm.getTime() > hoy.getTime()) {
        Swal.fire({
          icon: 'error',
          title: 'Fecha inválida',
          text: 'No se pueden crear cajas chicas con fechas futuras.',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
    }
    
    this.cargando = true;

    this.cajaBancoService.existeAlMenosUnaCajaBanco()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existe) => this.validarYProceder(existe),
        error: (err) => this.manejarErrorValidacion(err)
      });
  }

  /**
   * Valida la existencia de caja banco y procede con apertura o muestra error.
   *
   * Lógica:
   * - Si existeCajaBanco = false: Resetea cargando y muestra alerta específica
   * - Si existeCajaBanco = true: Llama a procederAbrirCaja()
   *
   * La alerta mostrada cambia según el rol del usuario (admin vs operador).
   *
   * @param existeCajaBanco boolean indicando si hay al menos una caja banco en el sistema
   * @returns void
   */
  private validarYProceder(existeCajaBanco: boolean): void {
    if (!existeCajaBanco) {
      this.cargando = false;
      this.mostrarAlertaCajaBancoRequerida();
      return;
    }

    this.procederAbrirCaja();
  }

  /**
   * Muestra alerta contextualizada según el rol del usuario.
   *
   * Para administradores:
   * - Icon: warning (amarillo)
   * - Botón principal: "Ir a Caja Banco" (navega a /caja-banco)
   * - Botón secundario: "Volver" (solo cierra alerta)
   *
   * Para operadores:
   * - Icon: error (rojo)
   * - Mensaje: instrucción de contactar administrador
   * - Solo botón "Aceptar" (no permite navegación)
   *
   * Justificación:
   * - Los admins tienen permisos para crear cajas banco
   * - Los operadores deben esperar a que admin las cree
   *
   * @returns void
   */
  private mostrarAlertaCajaBancoRequerida(): void {
    const esAdmin = this.authService.isAdmin();

    if (esAdmin) {
      Swal.fire({
        icon: 'warning',
        title: 'Caja Banco requerida',
        text: 'Debe crear primero una Caja Banco antes de registrar una Caja Chica.',
        confirmButtonText: 'Ir a Caja Banco',
        showCancelButton: true,
        cancelButtonText: 'Volver',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/caja-banco']);
        }
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Caja Banco no disponible',
        text: 'No existe una Caja Banco creada. Contacte con el administrador para que la cree.',
        confirmButtonText: 'Aceptar',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
    }
  }

  /**
   * Ejecuta la secuencia completa de validaciones y creación de caja.
   *
   * Validaciones secuenciales (early return pattern):
   * 1. Flag procesando = true evita ejecuciones concurrentes
   * 2. Validación de formulario (campos obligatorios)
   * 3. Validación de fecha (no futura)
   * 4. Verificación de duplicidad (localStorage)
   * 5. Si todo OK: cargando = true y llama crearCaja()
   *
   * Si cualquier validación falla:
   * - Resetea procesando = false
   * - Muestra alerta con motivo del rechazo
   * - Retorna temprano
   *
   * @returns void
   */
  private procederAbrirCaja(): void {
    if (this.procesando) return;
    
    this.procesando = true;

    if (this.form.invalid) {
      this.procesando = false;
      Swal.fire({
        icon: 'error',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos requeridos'
      });
      return;
    }

    if (!this.validarFecha()) {
      this.procesando = false;
      this.cargando = false; // Resetear estado de cargando
      return;
    }

    if (this.existeCajaAbiertaHoy()) {
      this.procesando = false;
      this.cargando = false; // Resetear estado de cargando
      return;
    }

    this.cargando = true;
    this.crearCaja();
  }

  /**
   * Valida que la fecha de apertura no sea posterior a hoy.
   *
   * Lógica:
   * 1. Obtiene fecha del formulario
   * 2. Normaliza ambas fechas a medianoche (setHours 0,0,0,0)
   * 3. Compara timestamps
   * 4. Si fecha > hoy: muestra alerta y retorna false
   * 5. Si fecha <= hoy: retorna true
   *
   * Caso de uso:
   * - Permite abrir cajas para hoy o días pasados (ej: para cierres atrasados)
   * - Previene abrir cajas para fechas futuras (error de usuario)
   *
   * @returns boolean true si la fecha es válida (pasada o presente), false si es futura
   */
  private validarFecha(): boolean {
    const fechaISO = this.form.get('fecha')?.value;
    const fechaSel = new Date(fechaISO);
    const hoyCmp = new Date();
    fechaSel.setHours(0, 0, 0, 0);
    hoyCmp.setHours(0, 0, 0, 0);

    // La validación del periodo de caja banco ya se hace en abrirCaja()
    // Solo validar fechas futuras aquí (por si acaso)
    if (fechaSel.getTime() > hoyCmp.getTime()) {
      Swal.fire({
        icon: 'warning',
        title: 'Fecha inválida',
        text: 'La fecha de apertura no puede ser posterior a hoy.'
      });
      return false;
    }
    return true;
  }

  /**
   * Verifica si existe una caja chica abierta para hoy según localStorage.
   *
   * Esta es una verificación de UX rápida (no consulta Firestore).
   * Se combina con validaciones del servicio para garantizar integridad.
   *
   * Storage key: 'cajaChicaAbierta'
   * - Contiene ID de la caja abierta en sesión actual
   * - Se establece cuando caja se abre exitosamente
   * - Se limpia cuando caja se cierra o componente se destruye
   *
   * @returns boolean true si cajaChicaAbierta existe en localStorage, false en otro caso
   */
  private existeCajaAbiertaHoy(): boolean {
    const cajaAbiertaId = localStorage.getItem('cajaChicaAbierta');
    if (cajaAbiertaId) {
      Swal.fire({
        icon: 'error',
        title: 'Caja ya abierta',
        text: 'Ya existe una caja abierta para hoy'
      });
      return true;
    }
    return false;
  }

  /**
   * Crea un nuevo registro de caja chica en Firestore.
   *
   * Datos enviados:
   * - fecha: normalizada a medianoche
   * - monto_inicial: parseado a float desde campo del formulario
   * - monto_actual: igual a monto_inicial al crear
   * - estado: 'ABIERTA' (literal type const)
   * - usuario_id: ID del usuario autenticado actual
   * - usuario_nombre: Nombre del operador (fallback "Usuario Desconocido")
   * - observacion: Notas opcionales del usuario
   *
   * Flujo:
   * 1. Obtiene usuario actual via authService.getCurrentUser()
   * 2. Normaliza fecha via normalizarFecha()
   * 3. Parsea monto a float
   * 4. Construye objeto nuevaCaja con todos los campos
   * 5. Llama cajaChicaService.abrirCajaChica(nuevaCaja)
   * 6. Maneja éxito o error con callbacks (.then)
   *
   * Throws:
   * - No valida duplicidad (servicio lo hace)
   * - No valida existencia de caja banco (ya validado antes)
   *
   * @returns void (operación asincrónica)
   */
  private crearCaja(): void {
    const usuario = this.authService.getCurrentUser();
    const montoParse = parseFloat(this.form.get('monto_inicial')?.value);
    const fecha = this.normalizarFechaFormulario();

    const nuevaCaja = {
      fecha,
      monto_inicial: montoParse,
      monto_actual: montoParse,
      estado: 'ABIERTA' as const,
      usuario_id: usuario?.id,
      usuario_nombre: usuario?.nombre || 'Usuario Desconocido',
      observacion: this.form.get('observacion')?.value || ''
    };

    this.cajaChicaService.abrirCajaChica(nuevaCaja).then(
      (cajaId) => this.manejarExitoCaja(cajaId, montoParse),
      (error) => this.manejarErrorCaja(error)
    );
  }

  /**
   * Normaliza la fecha del formulario a medianoche (00:00:00) en zona horaria local.
   * Usa el helper global normalizarFecha que maneja correctamente strings ISO.
   * Usa getRawValue() para obtener el valor incluso si el campo está deshabilitado.
   *
   * @returns Date normalizada a 00:00:00 en zona local
   */
  private normalizarFechaFormulario(): Date {
    // Usar getRawValue() para obtener el valor incluso si está deshabilitado
    const fechaControl = this.form.get('fecha');
    const fechaValue = fechaControl?.value || this.form.getRawValue().fecha;
    
    if (!fechaValue) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      return hoy;
    }
    
    // Usar helper global que maneja correctamente timezone
    return normalizarFecha(fechaValue);
  }

  /**
   * Maneja el resultado exitoso de la creación de caja chica.
   *
   * Acciones:
   * 1. Resetea flags cargando = false y procesando = false
   * 2. Guarda ID de caja en localStorage ('cajaChicaAbierta')
   * 3. Muestra alerta de éxito con monto inicial (timer: 1500ms)
   * 4. Redirige a vista detallada (/caja-chica/ver/:id)
   *
   * Efectos:
   * - localStorage['cajaChicaAbierta'] = cajaId → usado para validaciones futuras
   * - Navegación automática a página de detalles de caja
   *
   * El timer de 1500ms da tiempo al usuario de ver el mensaje antes de navegar.
   *
   * @param cajaId ID único de la caja creada en Firestore
   * @param montoParse Monto inicial parseado (float), usado para mostrar en mensaje
   * @returns void
   */
  private manejarExitoCaja(cajaId: string, montoParse: number): void {
    this.cargando = false;
    this.procesando = false;
    localStorage.setItem('cajaChicaAbierta', cajaId);

    Swal.fire({
      icon: 'success',
      title: 'Caja abierta',
      text: `Caja chica abierta con $${montoParse.toFixed(2)}`,
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      this.router.navigate(['/caja-chica/ver', cajaId], {
        queryParams: { returnTo: this.router.url }
      });
    });
  }

  /**
   * Maneja errores ocurridos durante la creación de caja en Firestore.
   *
   * Responsabilidades:
   * 1. Resetea flags de carga (cargando, procesando)
   * 2. Registra error en consola (nivel ERROR)
   * 3. Muestra alerta amigable al usuario con mensaje del error (si existe)
   *
   * Localización:
   * - Intenta extraer error.message
   * - Fallback: "No se pudo abrir la caja chica"
   *
   * Causas posibles:
   * - Permiso insuficiente en Firestore
   * - Usuario no autenticado
   * - Conexión de red fallida
   * - Validación de servicio fallida
   *
   * @param error Objeto error retornado por Promise (generalmente Error o estructura personalizada)
   * @returns void
   */
  private manejarErrorCaja(error: any): void {
    this.cargando = false;
    this.procesando = false;
    console.error('Error al abrir caja:', error);

    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: (error?.message) || 'No se pudo abrir la caja chica'
    });
  }

  /**
   * Maneja errores durante la validación de existencia de caja banco.
   *
   * Responsabilidades:
   * 1. Resetea cargando = false (libera UI)
   * 2. Registra error en consola para debugging
   * 3. Muestra alerta genérica de error al usuario
   * 4. No intenta recuperación automática
   *
   * Contexto:
   * Este método se ejecuta si existeAlMenosUnaCajaBanco() falla (Observable.error).
   * Diferente de manejarErrorCaja(), que maneja errores de creación.
   *
   * Causas:
   * - Error de conexión a Firestore
   * - Permisos insuficientes para leer cajas banco
   * - Timeout de consulta
   *
   * UX:
   * - Se sugiere reintentar manualmente (usuario cierra alerta y reintenta)
   *
   * @param err Error retornado por RxJS Observable (generalmente tipo Error)
   * @returns void
   */
  private manejarErrorValidacion(err: any): void {
    this.cargando = false;
    console.error('Error al verificar existencia de Caja Banco:', err);

    Swal.fire({
      icon: 'error',
      title: 'Error de validación',
      text: 'No se pudo verificar la existencia de una Caja Banco. Inténtelo nuevamente.',
      confirmButtonText: 'Aceptar'
    });
  }

  /**
   * Navega de regreso a la lista de cajas chicas.
   */
  volver(): void {
    this.router.navigate(['/caja-chica']);
  }
}
