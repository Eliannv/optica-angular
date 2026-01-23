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

  ngOnInit(): void {
    this.inicializarFormulario();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el formulario reactivo con estructura y validaciones.
   *
   * Campos:
   * - fecha: Date (default: hoy a medianoche, solo lectura)
   * - monto_inicial: number (requerido, mínimo 0)
   * - observacion: string (opcional)
   *
   * Efectos secundarios:
   * - Limpia localStorage de referencia anterior (cajaChicaAbierta)
   * - Establece maxFecha en formato ISO para restricción HTML input[type=date]
   * - Normaliza fecha a medianoche (setHours 0,0,0,0)
   *
   * Nota: La fecha es fija (no es editable por usuario) y se calcula al init.
   *
   * @returns void
   */
  inicializarFormulario(): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    this.maxFecha = hoy.toISOString().split('T')[0];
    localStorage.removeItem('cajaChicaAbierta');

    this.form = this.formBuilder.group({
      fecha: [hoy, Validators.required],
      monto_inicial: ['', [Validators.required, Validators.min(0)]],
      observacion: ['']
    });
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
      return;
    }

    if (this.existeCajaAbiertaHoy()) {
      this.procesando = false;
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
    const fechaSel = new Date(this.form.get('fecha')?.value);
    const hoyCmp = new Date();
    fechaSel.setHours(0, 0, 0, 0);
    hoyCmp.setHours(0, 0, 0, 0);

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
    const fecha = this.normalizarFecha();

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
   *
   * Maneja múltiples tipos de entrada:
   * 1. Fecha instanceof Date → clona y normaliza
   * 2. String (YYYY-MM-DD o DD/MM/YYYY) → parsea con parsearFechaString()
   * 3. Otros tipos (null, undefined) → usa new Date() actual
   *
   * Siempre retorna Date normalizada a medianoche para consistencia en Firestore.
   * Esto evita problemas con comparaciones de fechas que incluyan hora.
   *
   * @returns Date normalizada a 00:00:00 en zona local
   */
  private normalizarFecha(): Date {
    const fechaValue = this.form.get('fecha')?.value;
    let fecha: Date;

    if (fechaValue instanceof Date) {
      fecha = new Date(fechaValue);
      fecha.setHours(0, 0, 0, 0);
    } else if (typeof fechaValue === 'string') {
      fecha = this.parsearFechaString(fechaValue);
    } else {
      fecha = new Date();
      fecha.setHours(0, 0, 0, 0);
    }

    return fecha;
  }

  /**
   * Parsea una cadena de fecha en dos formatos soportados.
   *
   * Formatos reconocidos:
   * 1. YYYY-MM-DD (ISO): Más común en input[type=date] HTML
   * 2. DD/MM/YYYY: Formato común en inputsHTML tradicionales
   *
   * Lógica:
   * - Detecta formato por presencia de '-' o '/'
   * - Separa componentes y valida rangos manualmente
   * - Fallback: new Date() si formato no es reconocido
   *
   * Retorno:
   * - Siempre retorna Date normalizada a medianoche
   *
   * Nota: No valida corrección de fecha (ej: 32/13 sería creado como Date inválida).
   * El validador del navegador (input type=date) previene esto en la mayoría de casos.
   *
   * @param fechaString String con fecha en formato "YYYY-MM-DD" o "DD/MM/YYYY"
   * @returns Date parseada y normalizada a medianoche (00:00:00)
   */
  private parsearFechaString(fechaString: string): Date {
    let fecha: Date;

    if (fechaString.includes('-')) {
      const [year, month, day] = fechaString.split('-');
      fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
    } else if (fechaString.includes('/')) {
      const [day, month, year] = fechaString.split('/');
      fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
    } else {
      fecha = new Date();
      fecha.setHours(0, 0, 0, 0);
    }

    return fecha;
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
      this.router.navigate(['/caja-chica/ver', cajaId]);
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
   * Retorna el control del monto inicial del formulario.
   */
  get montoControl() {
    return this.form.get('monto_inicial');
  }

  /**
   * Navega de regreso a la lista de cajas chicas.
   */
  volver(): void {
    this.router.navigate(['/caja-chica']);
  }
}
