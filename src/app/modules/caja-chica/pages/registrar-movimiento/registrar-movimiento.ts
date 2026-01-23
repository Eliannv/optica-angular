/**
 * Componente para registrar movimientos (ingresos/egresos) en cajas chicas.
 *
 * Propósito:
 * Facilita el registro de transacciones dentro de una caja chica abierta.
 * Un movimiento representa un ingreso o egreso de dinero que afecta el saldo
 * disponible de la caja para el resto del día.
 *
 * Validaciones implementadas:
 * - Que el formulario sea completo (descripción, monto requeridos)
 * - Que el monto sea válido (mayor a 0.01 para evitar errores de redondeo)
 * - Que hay saldo suficiente en la caja (para egresos)
 * - Que la caja existe y está accesible en Firestore
 *
 * Flujo del registro:
 * 1. Componente carga cajaId desde URL (ruta: /caja-chica/registrar/:id)
 * 2. Inicializa formulario con campos de tipo, descripción, monto, comprobante, observación
 * 3. Carga saldo actual de la caja vía servicio
 * 4. Usuario completa formulario
 * 5. Sistema valida formulario y saldo
 * 6. Se crea objeto MovimientoCajaChica con:
 *    - Datos del usuario (automático, desde authService)
 *    - Fecha/hora actual
   * - Datos ingresados (tipo, descripción, monto, etc)
 * 7. Se registra en Firestore → recalcula saldo de caja
 * 8. Redirige a vista detallada de caja
 *
 * Tipos de movimientos:
 * Actualmente solo soporta EGRESO (gasto). INGRESO está comentado pero disponible.
 * Esto puede cambiar si la lógica de negocio lo requiere.
 *
 * @component RegistrarMovimientoComponent
 * @standalone false
 * @module CajaChicaModule
 */

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { MovimientoCajaChica } from '../../../../core/models/caja-chica.model';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-registrar-movimiento',
  standalone: false,
  templateUrl: './registrar-movimiento.html',
  styleUrls: ['./registrar-movimiento.css']
})
export class RegistrarMovimientoComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private formBuilder = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  form!: FormGroup;
  cajaId: string = '';
  cargando = false;
  error = '';
  exito = false;
  saldoActual = 0;

  /**
   * Tipos de movimientos disponibles
   */
  tipos = [
    { value: 'EGRESO', label: 'Egreso (Gasto pequeño)' }
  ];

  ngOnInit(): void {
    this.cajaId = this.route.snapshot.paramMap.get('id') || '';
    this.inicializarFormulario();
    this.cargarSaldoActual();
  }

  /**
   * Inicializa el formulario reactivo con campos y validadores.
   *
   * Estructura del formulario:
   * - tipo: 'EGRESO' (default, required) → selector de tipo de movimiento
   * - descripcion: '' (required, minLength: 3) → texto que describe el movimiento
   * - monto: '' (required, min: 0.01) → cantidad monetaria
   * - comprobante: '' (optional) → ref. de comprobante (ticket, factura, etc)
   * - observacion: '' (optional) → notas adicionales
   *
   * Validadores:
   * - Requeridos: tipo, descripcion, monto
   * - Condicionales: min(0.01) para monto, minLength(3) para descripción
   *
   * @returns void
   */
  inicializarFormulario(): void {
    this.form = this.formBuilder.group({
      tipo: ['EGRESO', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      monto: ['', [Validators.required, Validators.min(0.01)]],
      comprobante: [''],
      observacion: ['']
    });
  }

  /**
   * Carga el saldo actual de la caja chica desde Firestore.
   *
   * Operación:
   * 1. Suscribe a cajaChicaService.getCajaChicaById(cajaId)
   * 2. En éxito: Extrae monto_actual y lo asigna a this.saldoActual
   * 3. En error:
   *    - Registra en consola
   *    - Asigna mensaje de error a this.error (para mostrar en UI)
   *
   * Uso:
   * - Se llamaautomáticamente en ngOnInit()
   * - Se llamatambién después de registrar un movimiento exitosamente
   * - El saldo se muestra en template para validación visual del usuario
   *
   * @returns void
   */
  cargarSaldoActual(): void {
    this.cajaChicaService.getCajaChicaById(this.cajaId).subscribe({
      next: (caja) => {
        this.saldoActual = caja.monto_actual || 0;
      },
      error: (error) => {
        console.error('Error al cargar saldo:', error);
        this.error = 'Error al cargar el saldo actual';
      }
    });
  }

  /**
   * Inicia el flujo de registro de movimiento.
   *
   * Pasos:
   * 1. Valida formulario (validarFormulario)
   * 2. Extrae monto y tipo
   * 3. Valida que hay saldo suficiente (validarSaldo)
   * 4. Si todo OK: procesa el movimiento (procesarMovimiento)
   *
   * Guard:
   * - Early returns si validaciones fallan
   * - Cada validación falla muestra su propia alerta (no acumula errores)
   *
   * @returns void
   */
  registrarMovimiento(): void {
    if (!this.validarFormulario()) return;

    const monto = parseFloat(this.form.get('monto')?.value);
    const tipo = this.form.get('tipo')?.value;

    if (!this.validarSaldo(monto, tipo)) return;

    this.procesarMovimiento(monto, tipo);
  }

  /**
   * Valida que el formulario sea válido (todos los campos requeridos).
   *
   * Lógica:
   * - Revisa form.invalid (Angular formula basada en validadores)
   * - Si inválido: muestra alerta y retorna false
   * - Si válido: retorna true (silenciosamente)
   *
   * Validadores verificados:
   * - tipo: required
   * - descripcion: required, minLength(3)
   * - monto: required, min(0.01)
   *
   * @returns boolean true si formulario es válido, false en otro caso
   */
  private validarFormulario(): boolean {
    if (this.form.invalid) {
      Swal.fire({
        icon: 'error',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos obligatorios.'
      });
      return false;
    }
    return true;
  }

  /**
   * Valida que exista saldo suficiente para el movimiento.
   *
   * Lógica:
   * - Si tipo === 'EGRESO' y monto > saldoActual:
   *   • Muestra alerta de saldo insuficiente
   *   • Retorna false
   * - Si tipo === 'INGRESO' o saldo es suficiente:
   *   • Retorna true (sin alerta)
   *
   * Nota:
   * - INGRESOS no tienen restricción de saldo (pueden ocurrir siempre)
   * - EGRESOS solo se permiten si hay dinero disponible
   *
   * @param monto Cantidad del movimiento (float)
   * @param tipo Tipo de movimiento ('INGRESO' o 'EGRESO')
   * @returns boolean true si hay saldo suficiente o no es necesario validar
   */
  private validarSaldo(monto: number, tipo: string): boolean {
    if (tipo === 'EGRESO' && monto > this.saldoActual) {
      Swal.fire({
        icon: 'warning',
        title: 'Saldo insuficiente',
        text: 'La caja chica no tiene suficiente saldo para este egreso.'
      });
      return false;
    }
    return true;
  }

  /**
   * Procesa el registro del movimiento en Firestore.
   *
   * Responsabilidades:
   * 1. Establece cargando = true (desactiva UI)
   * 2. Obtiene usuario actual del authService
   * 3. Construye objeto MovimientoCajaChica con:
   *    - Datos recopilados automáticamente (usuario, fecha, caja_chica_id)
   *    - Datos ingresados por usuario (tipo, descripción, monto, etc)
   * 4. Llama cajaChicaService.registrarMovimiento(cajaId, movimiento)
   * 5. Maneja éxito o error con callbacks (.then)
   *
   * Nota importante:
   * - El campo fecha se establece a new Date() (hora actual del cliente)
   * - El servicio puede reemplazar con serverTimestamp si es necesario
   * - Usuario se obtiene via authService.getCurrentUser()
   * - Si no hay usuario, omite campos usuario_id y usuario_nombre (spread condicional)
   *
   * @param monto Cantidad del movimiento (float)
   * @param tipo Tipo del movimiento ('INGRESO' | 'EGRESO')
   * @returns void (operación asincrónica)
   */
  private procesarMovimiento(monto: number, tipo: 'INGRESO' | 'EGRESO'): void {
    this.cargando = true;
    this.error = '';

    const usuario = this.authService.getCurrentUser();
    const movimiento: MovimientoCajaChica = {
      caja_chica_id: this.cajaId,
      fecha: new Date(),
      tipo,
      descripcion: this.form.get('descripcion')?.value,
      monto,
      comprobante: this.form.get('comprobante')?.value,
      observacion: this.form.get('observacion')?.value,
      ...(usuario?.id ? { usuario_id: usuario.id } : {}),
      ...(usuario?.nombre ? { usuario_nombre: usuario.nombre } : {}),
    };

    this.cajaChicaService.registrarMovimiento(this.cajaId, movimiento).then(
      () => this.manejarExito(),
      (error) => this.manejarError(error)
    );
  }

  /**
   * Maneja el resultado exitoso del registro de movimiento.
   *
   * Acciones:
   * 1. Resetea cargando = false (libera UI)
   * 2. Establece exito = true (flag de resultado)
   * 3. Resetea formulario (borra datos, mantiene tipo = 'INGRESO')
   * 4. Recarga saldo actual (refleja el cambio)
   * 5. Muestra alerta de éxito (timer: 1500ms)
   * 6. Redirige a vista detallada de caja (/caja-chica/ver/:id)
   *
   * El timer de 1500ms da tiempo al usuario de ver el mensaje antes de navegar.
   *
   * @returns void (operación asincrónica)
   */
  private manejarExito(): void {
    this.cargando = false;
    this.exito = true;
    this.form.reset({ tipo: 'INGRESO' });
    this.cargarSaldoActual();
    Swal.fire({
      icon: 'success',
      title: 'Movimiento registrado',
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      this.router.navigate(['/caja-chica/ver', this.cajaId]);
    });
  }

  /**
   * Maneja errores ocurridos durante el registro de movimiento en Firestore.
   *
   * Responsabilidades:
   * 1. Resetea cargando = false (libera UI)
   * 2. Registra error en consola (nivel ERROR)
   * 3. Extrae mensaje del error (si existe)
   * 4. Muestra alerta amigable al usuario
   *
   * Causas posibles:
   * - Validación de servicio falló (caja no existe, está cerrada)
   * - Permiso insuficiente en Firestore
   * - Usuario no autenticado
   * - Conexión fallida
   *
   * @param error Objeto Error retornado por Promise
   * @returns void
   */
  private manejarError(error: any): void {
    this.cargando = false;
    console.error('Error al registrar movimiento:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error?.message || 'Error al registrar el movimiento'
    });
  }

  /**
   * Navega de regreso a la vista detallada de la caja actual.
   *
   * Ruta destino: '/caja-chica/ver/:id'
   * Útil como botón "Volver" o "Cancelar" en el formulario.
   *
   * @returns void
   */
  volver(): void {
    this.router.navigate(['/caja-chica/ver', this.cajaId]);
  }

  /**
   * Retorna el FormControl del campo monto para acceso en template.
   *
   * Uso:
   * - Mostrar mensajes de error de validación
   * - Cambiar estilos condicionales según validez
   * - Acceder a propiedades como .errors, .valid, .touched
   *
   * Patrón: get montoControl() → uso en template [formControl]="montoControl"
   *
   * @returns FormControl del campo 'monto' o null
   */
  get montoControl() {
    return this.form.get('monto');
  }

  /**
   * Retorna el FormControl del campo descripción para acceso en template.
   *
   * Uso:
   * - Mostrar validadores fallidos (minLength, required)
   * - Cambiar estilos visuales según estado
   * - Debugging de validaciones
   *
   * @returns FormControl del campo 'descripcion' o null
   */
  get descriptionControl() {
    return this.form.get('descripcion');
  }

  /**
   * Formatea un monto numérico como moneda USD en localización española.
   *
   * Utiliza Intl.NumberFormat con:
   * - style: 'currency' (incluye símbolo $)
   * - currency: 'USD'
   * - Localización: 'es-ES'
   *
   * Fallback: Si monto es undefined/null, usa 0
   * Ejemplo: 1234.56 → "$1.234,56" (separador local español)
   *
   * Usado en template para mostrar saldo actual y validaciones visuales.
   *
   * @param monto Cantidad numérica a formatear
   * @returns String formateado con símbolo y separadores locales
   */
  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }
}
