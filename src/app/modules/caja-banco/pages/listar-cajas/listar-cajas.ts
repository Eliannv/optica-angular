/**
 * Componente para listar y gestionar todas las cajas banco del sistema.
 *
 * Este componente proporciona:
 * - Listado completo de cajas banco (abiertas y cerradas)
 * - Resumen financiero general (totales de ingresos/egresos)
 * - Acciones de creación, visualización y eliminación de cajas
 * - Cierre de mes y reporte mensual
 * - Gestión de cajas chicas asociadas
 *
 * Integra datos de tres fuentes principales:
 * 1. CajaBancoService: datos de cajas banco
 * 2. CajaChicaService: datos de cajas chicas cerradas
 * 3. MovimientoCajaBanco: movimientos financieros globales
 */

import { Component, inject, OnInit } from '@angular/core';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CajaBancoConfigService } from '../../../../core/services/caja-banco-config.service';
import { Router } from '@angular/router';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { combineLatest } from 'rxjs';
import Swal from 'sweetalert2';
import { normalizarFecha } from '../../../../core/utils/fecha-helpers';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit {
  /** Servicio de cajas banco */
  private cajaBancoService = inject(CajaBancoService);

  /** Servicio de cajas chicas */
  private cajaChicaService = inject(CajaChicaService);

  /** Servicio de autenticación */
  private authService = inject(AuthService);

  /** Servicio de configuración de cajas banco */
  private cajaBancoConfigService = inject(CajaBancoConfigService);

  /** Router para navegación */
  private router = inject(Router);

  /** Lista de todas las cajas banco del sistema */
  cajas: CajaBanco[] = [];

  /** Lista de cajas chicas cerradas (para integración de ingresos) */
  cajasChicas: CajaChica[] = [];

  /** Movimientos globales de caja banco registrados */
  movimientosGlobales: MovimientoCajaBanco[] = [];

  /** Estado de carga de datos */
  cargando = false;

  /** Flag para prevenir múltiples creaciones simultáneas */
  private procesandoCreacion = false;

  /** Flag para prevenir múltiples verificaciones automáticas simultáneas */
  private procesandoVerificacionAutomatica = false;

  /** Indica si está en modo automático */
  modoAutomatico = false;

  /**
   * Verifica si existe alguna caja banco ABIERTA.
   * Usado para ocultar el botón de crear nueva caja.
   */
  get tieneCajaAbierta(): boolean {
    return this.cajas.some(caja => caja.estado === 'ABIERTA' && caja.activo !== false);
  }

  /**
   * Objeto con totales calculados del sistema.
   * Incluye: cantidad de cajas, dinero ganado, transferencias, ingresos y egresos.
   */
  totales = {
    total_cajas: 0,
    total_ganado_cajas_chicas: 0,
    total_transferencias: 0,
    total_ingresos: 0,
    total_egresos: 0
  };

  /**
   * Hook de inicialización de Angular.
   * Dispara la carga de datos de cajas, cajas chicas y movimientos globales.
   */
  ngOnInit(): void {
    // Cargar modo actual de configuración
    this.modoAutomatico = this.cajaBancoConfigService.esAutomatico();
    
    this.cargarCajas();
    this.cargarCajasChicas();
    this.cargarMovimientosGlobales();
  }

  /**
   * Alterna entre modo automático y manual de gestión de cajas
   */
  async toggleModoAutomatico(): Promise<void> {
    const nuevoModo = this.cajaBancoConfigService.toggleModo();
    this.modoAutomatico = nuevoModo === 'automatico';
    
    const modoTexto = this.modoAutomatico ? 'AUTOMÁTICO' : 'MANUAL';
    const icono = this.modoAutomatico 
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.67 8H18a2 2 0 0 1 2 2v4.33"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M22 22 2 2"/><path d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 1.414-.586"/><path d="M9 13v2"/><path d="M9.67 4H12v2.33"/></svg>';
    
    await Swal.fire({
      title: `Modo ${modoTexto} Activado`,
      iconHtml: icono,
      html: this.modoAutomatico 
        ? `<p>Las cajas se cerrarán y abrirán automáticamente al cambiar de mes.</p>
           <p><small>El saldo final de una caja se transferirá como saldo inicial de la siguiente.</small></p>`
        : `<p>Deberás crear y cerrar las cajas manualmente.</p>`,
      confirmButtonText: 'Entendido',
      confirmButtonColor: 'var(--btn-primary-bg)'
    });
    
    // Si se activó automático, verificar inmediatamente
    if (this.modoAutomatico) {
      this.verificarCierreAperturaAutomatica();
    }
  }

  /**
   * Verifica si debe cerrar la caja del mes anterior y abrir una nueva
   * Solo se ejecuta en modo automático
   */
  private verificarCierreAperturaAutomatica(): void {
    // Evitar verificaciones simultáneas
    if (this.procesandoVerificacionAutomatica) {
      console.log('⏸️ Verificación automática ya en proceso, saltando...');
      return;
    }

    this.procesandoVerificacionAutomatica = true;

    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();
    
    console.log('🔍 Verificando cajas para modo automático...', {
      cajasTotal: this.cajas.length,
      mesActual: mesActual + 1,
      anioActual
    });
    
    // Buscar caja abierta
    const cajaAbierta = this.cajas.find(c => c.estado === 'ABIERTA' && c.activo !== false);
    
    if (cajaAbierta && cajaAbierta.fecha) {
      // Convertir fecha de Firestore a Date
      const fechaCaja = cajaAbierta.fecha instanceof Date 
        ? cajaAbierta.fecha 
        : (cajaAbierta.fecha as any).toDate?.() || new Date(cajaAbierta.fecha);
      
      const mesCaja = fechaCaja.getMonth();
      const anioCaja = fechaCaja.getFullYear();
      
      console.log('📅 Caja abierta encontrada:', {
        fecha: fechaCaja.toISOString(),
        mesCaja: mesCaja + 1,
        anioCaja,
        esMesAnterior: anioCaja < anioActual || (anioCaja === anioActual && mesCaja < mesActual)
      });
      
      // Si la caja abierta es de un mes anterior, cerrarla y crear nueva
      if (anioCaja < anioActual || (anioCaja === anioActual && mesCaja < mesActual)) {
        console.log('🤖 Modo automático: detectado cambio de mes, cerrando caja anterior...');
        this.cerrarYAbrirNuevaCajaAutomatica(cajaAbierta);
        return; // Salir y esperar a que termine el proceso
      } else {
        console.log('✅ La caja abierta corresponde al mes actual, no se requiere acción');
        this.procesandoVerificacionAutomatica = false;
      }
    } else if (!cajaAbierta) {
      // No hay caja abierta, verificar si ya existe una caja para el mes actual
      const tieneCajaMesActual = this.cajas.some(c => {
        const fechaCaja = c.fecha instanceof Date 
          ? c.fecha 
          : (c.fecha as any).toDate?.() || new Date(c.fecha);
        
        return fechaCaja.getMonth() === mesActual && 
               fechaCaja.getFullYear() === anioActual &&
               c.activo !== false;
      });
      
      if (tieneCajaMesActual) {
        console.log('ℹ️ Ya existe una caja para el mes actual (cerrada), no se crea nueva');
        this.procesandoVerificacionAutomatica = false;
      } else {
        // No hay caja abierta ni caja del mes actual, crear una nueva automáticamente
        console.log('🤖 Modo automático: no hay caja para el mes actual, creando nueva...');
        
        // Buscar la última caja cerrada para heredar su saldo
        const cajasOrdenadas = [...this.cajas]
          .filter(c => c.activo !== false)
          .sort((a, b) => {
            const fechaA = a.fecha instanceof Date ? a.fecha : (a.fecha as any).toDate?.() || new Date(a.fecha);
            const fechaB = b.fecha instanceof Date ? b.fecha : (b.fecha as any).toDate?.() || new Date(b.fecha);
            return fechaB.getTime() - fechaA.getTime();
          });
        
        const ultimaCaja = cajasOrdenadas[0];
        const saldoHeredado = ultimaCaja?.saldo_actual || 0;
        
        console.log('💰 Heredando saldo de última caja:', {
          cajaFecha: ultimaCaja?.fecha,
          saldoActual: ultimaCaja?.saldo_actual,
          saldoAUsar: saldoHeredado
        });
        
        this.crearCajaAutomatica(saldoHeredado);
        return; // Salir y esperar a que termine el proceso
      }
    } else {
      // No aplica ninguna condición
      this.procesandoVerificacionAutomatica = false;
    }
  }

  /**
   * Cierra la caja anterior y abre una nueva automáticamente
   */
  private async cerrarYAbrirNuevaCajaAutomatica(cajaAnterior: CajaBanco): Promise<void> {
    if (!cajaAnterior.id) return;
    
    try {
      // Guardar el saldo actual ANTES de cerrar
      const saldoFinal = cajaAnterior.saldo_actual || 0;
      console.log('💰 Saldo final de caja anterior:', saldoFinal);
      
      // Cerrar la caja anterior
      await this.cajaBancoService.cerrarCajaBanco(cajaAnterior.id);
      console.log('✅ Caja anterior cerrada automáticamente');
      
      // Crear nueva caja con el saldo final de la anterior
      await this.crearCajaAutomatica(saldoFinal);
      console.log('✅ Nueva caja creada con saldo inicial:', saldoFinal);
      
      this.procesandoVerificacionAutomatica = false;
      
      // Recargar cajas
      this.cargarCajas();
    } catch (error) {
      console.error('❌ Error en cierre/apertura automática:', error);
      this.procesandoVerificacionAutomatica = false;
    }
  }

  /**
   * Crea una nueva caja automáticamente (sin diálogo)
   */
  private async crearCajaAutomatica(saldoInicial?: number): Promise<void> {
    const hoy = new Date();
    const usuario = this.authService.getCurrentUser();
    
    if (!usuario) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    // Usar saldo proporcionado o 0 si es undefined (pero permitir 0 explícito)
    const saldo = saldoInicial !== undefined ? saldoInicial : 0;
    
    console.log('📝 Creando caja automática con saldo:', saldo);

    const nuevaCaja: Partial<CajaBanco> = {
      fecha: hoy,
      saldo_inicial: saldo,
      saldo_actual: saldo,
      estado: 'ABIERTA',
      usuario_id: usuario.id,
      usuario_nombre: usuario.nombre,
      observacion: 'Caja creada automáticamente',
      activo: true,
      createdAt: new Date()
    };

    try {
      await this.cajaBancoService.abrirCajaBanco(nuevaCaja as CajaBanco);
      console.log('✅ Caja banco creada automáticamente con saldo inicial:', saldo);
      this.procesandoVerificacionAutomatica = false;
    } catch (error) {
      console.error('❌ Error al crear caja automática:', error);
      this.procesandoVerificacionAutomatica = false;
    }
  }

  /**
   * Carga todas las cajas banco del sistema desde Firestore.
   * Actualiza el estado de carga y recalcula totales al completar.
   */
  cargarCajas(): void {
    this.cargando = true;
    this.cajaBancoService.getCajasBanco().subscribe({
      next: (cajas) => {
        this.cajas = (cajas || []);
        this.calcularTotales();
        this.cargando = false;
        
        // Verificar cierre/apertura automática DESPUÉS de cargar las cajas
        if (this.modoAutomatico) {
          this.verificarCierreAperturaAutomatica();
        }
      },
      error: (error) => {
        console.error('Error al cargar cajas:', error);
        this.cargando = false;
      }
    });
  }

  /**
   * Carga todas las cajas chicas cerradas del sistema.
   * Las cajas chicas cerradas representan ingresos para la caja banco.
   */
  cargarCajasChicas(): void {
    this.cajaChicaService.getCajasChicas().subscribe({
      next: (cajas) => {
        this.cajasChicas = cajas || [];
        this.calcularTotales();
      },
      error: (error) => {
        console.error('Error al cargar cajas chicas:', error);
      }
    });
  }

  /**
   * Carga todos los movimientos globales de caja banco.
   * Incluye ingresos por transferencias y egresos registrados.
   */
  cargarMovimientosGlobales(): void {
    this.cajaBancoService.getMovimientosCajaBanco().subscribe({
      next: (movimientos) => {
        this.movimientosGlobales = movimientos || [];
        this.calcularTotales();
      },
      error: (error) => {
        console.error('Error al cargar movimientos globales:', error);
      }
    });
  }

  /**
   * Calcula los totales financieros del sistema basándose en datos cargados.
   *
   * Cálculos realizados:
   * 1. Total de cajas banco creadas
   * 2. Total ganado en cajas chicas (sumatoria de montos de cajas cerradas)
   * 3. Total de transferencias e ingresos registrados
   * 4. Total de ingresos (cajas chicas + movimientos)
   * 5. Total de egresos
   */
  calcularTotales(): void {
    // 1. Total de cajas banco creadas
    this.totales.total_cajas = this.cajas.length;

    // 2. Total ganado de cajas chicas (sumar monto_actual de cajas chicas cerradas)
    this.totales.total_ganado_cajas_chicas = (this.cajasChicas || [])
      .filter(cc => cc.estado === 'CERRADA')
      .reduce((sum, cc) => sum + (cc.monto_actual || 0), 0);

    // 3. Total transferencias y otros ingresos (TODOS los movimientos de ingreso registrados)
    this.totales.total_transferencias = (this.movimientosGlobales || [])
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    // 4. Total ingresos (cajas chicas + movimientos de ingreso)
    this.totales.total_ingresos = this.totales.total_ganado_cajas_chicas + this.totales.total_transferencias;

    // 5. Total egresos
    this.totales.total_egresos = (this.movimientosGlobales || [])
      .filter(m => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  }

  /**
   * Navega a la vista de detalles de una caja banco específica.
   *
   * @param cajaId - Identificador único de la caja banco
   */
  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-banco', cajaId, 'ver']);
  }

  /**
   * Abre un diálogo modal para crear una nueva caja banco.
   *
   * NUEVO COMPORTAMIENTO:
   * - Permite seleccionar fecha manual (histórica o actual)
   * - La caja banco representa TODO el mes de la fecha seleccionada
   * - Hereda automáticamente el saldo del periodo anterior si no se especifica
   *
   * Solicita al usuario:
   * - Fecha (manual, default: hoy)
   * - Saldo inicial (en USD, opcional - hereda automáticamente)
   * - Observación opcional (detalles sobre la apertura)
   *
   * La nueva caja se crea con estado 'ABIERTA' para el periodo de la fecha seleccionada.
   *
   * @returns {Promise<void>} Se resuelve cuando se completa la creación
   */
  async crearCajaBanco(): Promise<void> {
    // Prevenir múltiples clics
    if (this.procesandoCreacion) {
      console.warn('⚠️ Ya hay una creación en proceso');
      return;
    }

    const hoy = new Date();
    const maxFecha = hoy.toISOString().split('T')[0];
    
    const { value: formValues } = await Swal.fire({
      title: 'Crear Nueva Caja Banco',
      iconHtml: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-landmark"><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></svg>',
      html: `
        <div style="text-align: left;">
          <!-- Fecha -->
          <div style="margin-bottom: 1rem;">
            <label for="fecha" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
              Fecha del Periodo *
            </label>
            <input 
              id="fecha" 
              type="date" 
              class="swal2-input" 
              value="${maxFecha}"
              max="${maxFecha}"
              style="width: 100%; padding: 0.6rem; border: 2px solid var(--border-color); border-radius: 6px; font-size: 0.95rem; box-sizing: border-box; margin: 0;"
            />
            <small style="display: block; margin-top: 0.2rem; color: var(--text-tertiary); font-size: 0.8rem;">La caja representará TODO el mes de esta fecha</small>
          </div>
          
          <!-- Saldo Inicial -->
          <div style="margin-bottom: 1rem;">
            <label for="saldo_inicial" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
              Saldo Inicial (USD)
            </label>
            <input 
              id="saldo_inicial" 
              type="number" 
              class="swal2-input" 
              placeholder="Auto (hereda del periodo anterior)"
              value=""
              step="0.01"
              min="0"
              style="width: 100%; padding: 0.6rem; border: 2px solid var(--border-color); border-radius: 6px; font-size: 0.95rem; box-sizing: border-box; margin: 0;"
            />
            <small style="display: block; margin-top: 0.2rem; color: var(--text-tertiary); font-size: 0.8rem;">Dejar vacío para heredar automáticamente del periodo anterior</small>
          </div>

          <!-- Observación -->
          <div style="margin-bottom: 1rem;">
            <label for="observacion" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
              Observación (opcional)
            </label>
            <textarea 
              id="observacion" 
              class="swal2-textarea" 
              placeholder="Detalles sobre la apertura..."
              rows="2"
              style="width: 100%; padding: 0.6rem; border: 2px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; resize: vertical; font-family: inherit; margin: 0;"
            ></textarea>
            <small style="display: block; margin-top: 0.2rem; color: var(--text-tertiary); font-size: 0.8rem;">Información adicional</small>
          </div>

          <!-- Info adicional -->
          <div style="padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px; border-left: 4px solid var(--info-color);">
            <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
              ℹ️ <strong>Caja histórica.</strong> Puedes crear cajas para periodos pasados o presentes.
            </p>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '✓ Crear Caja',
      cancelButtonText: '✕ Cancelar',
      confirmButtonColor: 'var(--btn-primary-bg)',
      cancelButtonColor: 'var(--btn-secondary-bg)',
      preConfirm: () => {
        const fechaInput = (document.getElementById('fecha') as HTMLInputElement)?.value;
        const saldoInput = (document.getElementById('saldo_inicial') as HTMLInputElement)?.value;
        const observacion = (document.getElementById('observacion') as HTMLTextAreaElement)?.value;

        if (!fechaInput) {
          Swal.showValidationMessage('La fecha es requerida');
          return false;
        }

        // Validar que la fecha no sea futura
        const fechaSeleccionada = new Date(fechaInput + 'T00:00:00');
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (fechaSeleccionada.getTime() > hoy.getTime()) {
          Swal.showValidationMessage('No se pueden crear cajas banco con fechas futuras');
          return false;
        }

        // Saldo es opcional - si está vacío, se heredará automáticamente
        let saldo: number | undefined = undefined;
        if (saldoInput && saldoInput.trim() !== '') {
          saldo = parseFloat(saldoInput);
          if (isNaN(saldo) || saldo < 0) {
            Swal.showValidationMessage('El saldo inicial debe ser un número válido y mayor o igual a 0');
            return false;
          }
        }

        // Usar normalizarFecha para evitar problemas de timezone
        return { fecha: normalizarFecha(fechaInput), saldo_inicial: saldo, observacion };
      }
    });

    if (!formValues) return;

    // Activar flag de procesamiento
    this.procesandoCreacion = true;

    try {
      // Obtener usuario actual
      const usuario = await this.authService.getCurrentUser();
      
      const nuevaCaja = {
        fecha: formValues.fecha,
        saldo_inicial: formValues.saldo_inicial, // undefined = herencia automática del periodo anterior
        saldo_actual: formValues.saldo_inicial, // undefined = se calculará en el servicio
        estado: 'ABIERTA' as const,
        usuario_id: usuario?.id || '',
        usuario_nombre: usuario?.nombre || 'Sistema',
        observacion: formValues.observacion || ''
      };

      console.log('📤 Enviando nueva caja al servicio:', {
        fecha: nuevaCaja.fecha.toISOString(),
        saldo_inicial: nuevaCaja.saldo_inicial,
        tipo_saldo_inicial: typeof nuevaCaja.saldo_inicial,
        es_undefined: nuevaCaja.saldo_inicial === undefined
      });

      await this.cajaBancoService.abrirCajaBanco(nuevaCaja);

      const periodo = formValues.fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      Swal.fire({
        icon: 'success',
        title: '¡Caja Banco Creada!',
        html: `
          <div style="text-align: center;">
            <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary); font-size: 0.95rem;">Periodo: <strong>${periodo}</strong></p>
            <div style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: 8px;">
              <p style="margin: 0; font-size: 1.4rem; font-weight: bold; color: var(--success-color);">✓</p>
              <p style="margin: 0.3rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">Caja creada con éxito</p>
            </div>
          </div>
        `,
        timer: 2000,
        showConfirmButton: false
      });

      this.cargarCajas();
    } catch (error: any) {
      console.error('Error al crear caja banco:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al crear caja',
        text: error?.message || 'No se pudo crear la caja banco. Intenta de nuevo.'
      });
    } finally {
      // Liberar flag de procesamiento
      this.procesandoCreacion = false;
    }
  }

  /**
   * Navega a la página de registro de movimiento.
   */
  registrarMovimiento(): void {
    this.router.navigate(['/caja-banco/registrar-movimiento']);
  }

  /**
   * Genera e imprime un reporte mensual de todas las cajas banco.
   *
   * El reporte incluye:
   * - Resumen financiero (ingresos, egresos, saldo final)
   * - Listado de cajas chicas del mes
   * - Detalle de todos los movimientos del mes
   *
   * Se abre en una nueva ventana del navegador para imprimir.
   */
  imprimirMensualActual(): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const m0 = month - 1;

    // Cargar datos y generar impresión directa
    combineLatest([
      this.cajaBancoService.getCajasBancoPorMes(year, m0),
      this.cajaBancoService.getMovimientosCajaBancoPorMes(year, m0),
      this.cajaChicaService.getCajasChicasPorMes(year, m0)
    ]).subscribe(([cajas, movs, cc]) => {
      const htmlReporte = this.generarReporteMensual(
        year,
        month,
        cajas || [],
        movs || [],
        cc || []
      );

      // Abrir ventana de impresión directa
      const w = window.open('', 'PRINT_CAJA_BANCO_MENSUAL', 'height=800,width=900');
      if (!w) {
        console.error('No se pudo abrir la ventana de impresión');
        return;
      }

      w.document.write(htmlReporte);
      w.document.close();

      // Disparar impresión automáticamente
      const triggerPrint = () => {
        let closed = false;
        const safeClose = () => {
          if (closed) return;
          closed = true;
          w.close();
        };

        try {
          w.focus();
          w.addEventListener('afterprint', safeClose, { once: true });
          w.print();
          setTimeout(safeClose, 3000);
        } catch (err) {
          safeClose();
        }
      };

      if (w.document.readyState === 'complete') {
        setTimeout(triggerPrint, 150);
      } else {
        w.onload = () => setTimeout(triggerPrint, 150);
      }
    });
  }

  /**
   * Genera el HTML para un reporte mensual completo.
   *
   * Incluye totales financieros, listado de cajas chicas y movimientos
   * detallados con formato profesional para impresión.
   *
   * @param year - Año del reporte
   * @param month - Mes (1-12)
   * @param cajas - Array de cajas banco del mes
   * @param movimientos - Array de movimientos del mes
   * @param cajasChicas - Array de cajas chicas del mes
   * @returns {string} HTML completo del reporte
   * @private
   */
  private generarReporteMensual(
    year: number,
    month: number,
    cajas: any[],
    movimientos: any[],
    cajasChicas: any[]
  ): string {
    const formatoMoneda = (valor: number) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor);
    };

    const getNombreMes = (index: number): string => {
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return meses[index] || '';
    };

    const convertirTimestamp = (fecha: any): Date => {
      if (!fecha) return new Date();
      if (fecha instanceof Date) return fecha;
      if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
      return new Date(fecha);
    };

    const formatoFechaSolo = (fecha: Date) => {
      return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(fecha));
    };

    const formatoHora = (fecha: Date) => {
      return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(fecha));
    };

    // Calcular resumen
    let totalIngresos = 0;
    let totalEgresos = 0;
    movimientos.forEach((m: any) => {
      if (m.tipo === 'INGRESO') totalIngresos += m.monto || 0;
      else totalEgresos += m.monto || 0;
    });
    const saldoFinal = totalIngresos - totalEgresos;

    const filasMovimientos = movimientos.map((mov: any) => `
      <tr>
        <td>${formatoFechaSolo(convertirTimestamp(mov.fecha))}<br><small>${formatoHora(convertirTimestamp(mov.createdAt))}</small></td>
        <td class="text-center ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo}</td>
        <td>${mov.categoria || '-'}</td>
        <td>${mov.descripcion}</td>
        <td class="text-right ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo === 'INGRESO' ? '+' : '-'}${formatoMoneda(mov.monto)}</td>
        <td class="text-center">${mov.referencia || '-'}</td>
      </tr>
    `).join('');

    const filasCajasChicas = cajasChicas.map((cc: any) => `
      <tr>
        <td>${formatoFechaSolo(convertirTimestamp(cc.fecha))}</td>
        <td>${cc.usuario_nombre || '-'}</td>
        <td class="text-right">${formatoMoneda(cc.monto_inicial || 0)}</td>
        <td class="text-right">${formatoMoneda(cc.monto_actual || 0)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte Mensual - Caja Banco</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #333; background: #fff; padding: 20px; }
          .reporte-container { max-width: 900px; margin: 0 auto; background: white; }
          .reporte-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .reporte-header h1 { font-size: 20px; margin-bottom: 5px; font-weight: bold; }
          .reporte-header h2 { font-size: 14px; margin-bottom: 8px; font-weight: normal; text-transform: uppercase; }
          .fecha-reporte { font-size: 10px; color: #666; }
          .reporte-resumen { background: #f0f0f0; padding: 12px; margin-bottom: 20px; border-left: 4px solid #007bff; border-radius: 3px; }
          .reporte-resumen h3 { font-size: 12px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
          .reporte-resumen-item { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
          .reporte-resumen-item span:first-child { font-weight: 500; }
          .reporte-resumen-item.total-final { background: white; padding: 8px; margin-top: 8px; border-top: 2px solid #333; font-weight: bold; font-size: 12px; }
          .tipo-ingreso { color: #28a745; font-weight: bold; }
          .tipo-egreso { color: #dc3545; font-weight: bold; }
          .reporte-section { margin-bottom: 20px; }
          .reporte-section h3 { font-size: 12px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #333; padding-bottom: 8px; }
          .reporte-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .reporte-table thead { background: #e0e0e0; font-weight: bold; }
          .reporte-table th { padding: 8px 5px; text-align: left; border: 1px solid #999; font-size: 9px; }
          .reporte-table td { padding: 7px 5px; border: 1px solid #ddd; }
          .reporte-table tbody tr:nth-child(even) { background: #f9f9f9; }
          .reporte-table tbody tr:hover { background: #f0f0f0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .reporte-firma { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 20px; }
          .reporte-firma-item { flex: 1; text-align: center; font-size: 10px; }
          .reporte-firma-item .linea { width: 80%; height: 1px; background: #000; margin: 30px auto 5px; }
          .reporte-footer { text-align: center; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; font-size: 9px; color: #999; }
          .reporte-footer p { margin: 3px 0; }
          @media print {
            body { padding: 0; margin: 0; }
            .reporte-container { box-shadow: none; }
            .reporte-table tbody tr { page-break-inside: avoid; }
            .reporte-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="reporte-container">
          <div class="reporte-header">
            <h1>ÓPTICA MACÍAS PASAJE</h1>
            <h2>REPORTE MENSUAL CAJA BANCO</h2>
            <div class="fecha-reporte">Periodo: ${getNombreMes(month - 1)} ${year}</div>
          </div>

          <div class="reporte-resumen">
            <h3>RESUMEN FINANCIERO</h3>
            <div class="reporte-resumen-item">
              <span>Total Ingresos:</span>
              <span class="tipo-ingreso">+${formatoMoneda(totalIngresos)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Total Egresos:</span>
              <span class="tipo-egreso">-${formatoMoneda(totalEgresos)}</span>
            </div>
            <div class="reporte-resumen-item total-final">
              <span>SALDO FINAL:</span>
              <span>${formatoMoneda(saldoFinal)}</span>
            </div>
          </div>

          <div class="reporte-section">
            <h3>CAJAS CHICAS DEL MES</h3>
            ${cajasChicas.length > 0 ? `
              <table class="reporte-table">
                <thead>
                  <tr>
                    <th style="width: 20%;">Fecha</th>
                    <th style="width: 40%;">Usuario</th>
                    <th style="width: 20%;" class="text-right">Monto Inicial</th>
                    <th style="width: 20%;" class="text-right">Saldo Final</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasCajasChicas}
                </tbody>
              </table>
            ` : `
              <div style="text-align: center; padding: 20px; background: #f8f8f8; color: #999; border-radius: 4px;">
                No se registraron cajas chicas
              </div>
            `}
          </div>

          <div class="reporte-section">
            <h3>DETALLE DE MOVIMIENTOS DEL MES</h3>
            ${movimientos.length > 0 ? `
              <table class="reporte-table">
                <thead>
                  <tr>
                    <th style="width: 15%;">Fecha/Hora</th>
                    <th style="width: 10%;" class="text-center">Tipo</th>
                    <th style="width: 15%;">Categoría</th>
                    <th style="width: 35%;">Descripción</th>
                    <th style="width: 15%;" class="text-right">Monto</th>
                    <th style="width: 10%;" class="text-center">Ref.</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasMovimientos}
                </tbody>
              </table>
            ` : `
              <div style="text-align: center; padding: 20px; background: #f8f8f8; color: #999; border-radius: 4px;">
                No se registraron movimientos
              </div>
            `}
          </div>

          <div class="reporte-firma">
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Responsable</div>
            </div>
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Supervisor/Gerente</div>
            </div>
          </div>

          <div class="reporte-footer">
            <p>Reporte mensual de Caja Banco - Óptica Macías Pasaje</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Abre un diálogo para cerrar el mes anterior y abrir uno nuevo.
   *
   * Acciones realizadas:
   * - Cierra todas las cajas banco del mes anterior
   * - Genera resumen mensual
   * - Abre nueva caja banco para el mes actual
   *
   * ⚠️ Esta acción NO es reversible.
   *
   * @returns {Promise<void>}
   */
  async cerrarMes(): Promise<void> {
    const ahora = new Date();
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const yearAnterior = mesAnterior.getFullYear();
    const monthAnterior = mesAnterior.getMonth() + 1;

    const resultado = await Swal.fire({
      title: '📅 Cerrar Mes',
      html: `
        <div style="text-align: left;">
          <p>Vas a cerrar el mes de <strong>${this.getNombreMes(monthAnterior - 1)} ${yearAnterior}</strong></p>
          <p style="margin-top: 1rem;">Esto hará:</p>
          <ul style="text-align: left; padding-left: 1.5rem;">
            <li>Cerrar todas las cajas banco del mes</li>
            <li>Generar resumen mensual</li>
            <li>Abrir nueva caja banco para el mes actual</li>
          </ul>
          <p style="color: #e67e22; margin-top: 1rem;"><strong>⚠️ Esta acción no se puede deshacer</strong></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cerrar mes',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        // Mostrar loading
        Swal.fire({
          title: 'Cerrando mes...',
          text: 'Por favor espera',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Cerrar todas las cajas del mes anterior
        await this.cajaBancoService.cerrarMesCompleto(yearAnterior, monthAnterior - 1);

        Swal.fire({
          title: '✅ Mes Cerrado',
          html: `
            <div style="text-align: left;">
              <p>Se ha cerrado el mes de <strong>${this.getNombreMes(monthAnterior - 1)} ${yearAnterior}</strong></p>
              <p style="margin-top: 1rem;">✅ Cajas banco cerradas</p>
              <p>✅ Nueva caja banco abierta para el mes actual</p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'OK'
        });

        // Recargar datos
        this.cargarCajas();
      } catch (error) {
        console.error('Error al cerrar mes:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo cerrar el mes. Intenta nuevamente.',
          icon: 'error'
        });
      }
    }
  }

  /**
   * Retorna el nombre del mes en español basado en su índice.
   *
   * @param index - Índice del mes (0-11, donde 0 es enero)
   * @returns {string} Nombre del mes capitalizado (ej: 'Enero', 'Diciembre')
   */
  getNombreMes(index: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[index] || '';
  }

  /**
   * Desactiva una caja chica y resta su monto de la caja banco actual.
   *
   * Esta es una operación que permite corregir errores:
   * - La caja chica se desactiva (soft delete)
   * - El dinero de la caja chica se resta de la caja banco
   * - Puede ser reactivada posteriormente
   *
   * @param cajaChica - Objeto de caja chica a desactivar
   * @returns {Promise<void>}
   */
  async eliminarCajaChica(cajaChica: CajaChica): Promise<void> {
    const resultado = await Swal.fire({
      title: '¿Desactivar Caja Chica?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaChica.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaChica.usuario_nombre || '-'}</p>
          <p><strong>Monto Inicial:</strong> ${this.formatoMoneda(cajaChica.monto_inicial || 0)}</p>
          <p><strong>Monto Actual:</strong> ${this.formatoMoneda(cajaChica.monto_actual || 0)}</p>
          <p style="color: orange; margin-top: 1rem;"><strong>ℹ️ La caja se desactivará pero podrá ser reactivada</strong></p>
          <p style="color: red;"><strong>Se restará ${this.formatoMoneda(cajaChica.monto_actual || 0)} de la caja banco</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        // Obtener la caja banco abierta del mismo día
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const cajaBancoHoy = this.cajas.find(c => {
          const fechaCaja = c.fecha instanceof Date
            ? new Date(c.fecha)
            : (c.fecha && typeof c.fecha === 'object' && 'toDate' in c.fecha)
              ? (c.fecha as any).toDate()
              : new Date(c.fecha || new Date());
          fechaCaja.setHours(0, 0, 0, 0);
          return fechaCaja.getTime() === hoy.getTime() && c.estado === 'ABIERTA';
        });

        if (cajaBancoHoy) {
          // Restar el monto de la caja chica del saldo de la caja banco
          const nuevoSaldo = (cajaBancoHoy.saldo_actual || 0) - (cajaChica.monto_actual || 0);

          await this.cajaBancoService.actualizarSaldoCajaBanco(cajaBancoHoy.id!, nuevoSaldo);
        }

        // Desactivar la caja chica (soft delete)
        await this.cajaChicaService.eliminarCajaChica(cajaChica.id!);

        // Recargar listas
        this.cargarCajas();
        this.cargarCajasChicas();

        Swal.fire({
          title: '✅ Desactivada',
          text: 'Caja chica desactivada y dinero restado de caja banco',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al desactivar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo desactivar la caja chica',
          icon: 'error'
        });
      }
    }
  }

  /**
   * Reactiva una caja chica previamente desactivada.
   *
   * El dinero de la caja chica se suma nuevamente a la caja banco actual.
   *
   * @param cajaChica - Objeto de caja chica a reactivar
   * @returns {Promise<void>}
   */
  async reactivarCajaChica(cajaChica: CajaChica): Promise<void> {
    if (cajaChica.activo !== false) {
      Swal.fire({
        title: '⚠️ Aviso',
        text: 'Esta caja chica ya está activa',
        icon: 'info'
      });
      return;
    }

    const resultado = await Swal.fire({
      title: '¿Reactivar Caja Chica?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaChica.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaChica.usuario_nombre || '-'}</p>
          <p><strong>Monto Inicial:</strong> ${this.formatoMoneda(cajaChica.monto_inicial || 0)}</p>
          <p><strong>Monto Actual:</strong> ${this.formatoMoneda(cajaChica.monto_actual || 0)}</p>
          <p style="color: green; margin-top: 1rem;"><strong>✓ Se sumará ${this.formatoMoneda(cajaChica.monto_actual || 0)} a la caja banco</strong></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        // Obtener la caja banco abierta del mismo día
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const cajaBancoHoy = this.cajas.find(c => {
          const fechaCaja = c.fecha instanceof Date
            ? new Date(c.fecha)
            : (c.fecha && typeof c.fecha === 'object' && 'toDate' in c.fecha)
              ? (c.fecha as any).toDate()
              : new Date(c.fecha || new Date());
          fechaCaja.setHours(0, 0, 0, 0);
          return fechaCaja.getTime() === hoy.getTime() && c.estado === 'ABIERTA';
        });

        if (cajaBancoHoy) {
          // Sumar el monto de la caja chica al saldo de la caja banco (se restó cuando se desactivó)
          const nuevoSaldo = (cajaBancoHoy.saldo_actual || 0) + (cajaChica.monto_actual || 0);

          await this.cajaBancoService.actualizarSaldoCajaBanco(cajaBancoHoy.id!, nuevoSaldo);
        }

        // Reactivar la caja chica
        await this.cajaChicaService.activarCajaChica(cajaChica.id!);

        // Recargar listas
        this.cargarCajas();
        this.cargarCajasChicas();

        Swal.fire({
          title: '✅ Reactivada',
          text: 'Caja chica reactivada y dinero sumado a caja banco',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al reactivar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo reactivar la caja chica',
          icon: 'error'
        });
      }
    }
  }

  /**
   * Desactiva una caja banco (solo si está cerrada).
   *
   * Las cajas cerradas pueden ser desactivadas (soft delete).
   * Una caja que está abierta no puede ser desactivada.
   *
   * @param cajaBanco - Objeto de caja banco a desactivar
   * @returns {Promise<void>}
   */
  async eliminarCajaBanco(cajaBanco: CajaBanco): Promise<void> {
    // Solo permitir eliminar si el saldo inicial es igual al saldo actual
    const saldoInicial = cajaBanco.saldo_inicial || 0;
    const saldoActual = cajaBanco.saldo_actual || 0;
    
    if (saldoInicial !== saldoActual) {
      Swal.fire({
        title: '❌ No permitido',
        html: `
          <div style="text-align: left;">
            <p>Solo puedes desactivar cajas donde el <strong>saldo inicial</strong> sea igual al <strong>saldo actual</strong>.</p>
            <hr>
            <p><strong>Saldo Inicial:</strong> ${this.formatoMoneda(saldoInicial)}</p>
            <p><strong>Saldo Actual:</strong> ${this.formatoMoneda(saldoActual)}</p>
            <p><strong>Diferencia:</strong> ${this.formatoMoneda(Math.abs(saldoActual - saldoInicial))}</p>
          </div>
        `,
        icon: 'error'
      });
      return;
    }

    const resultado = await Swal.fire({
      title: '¿Eliminar Caja Banco?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaBanco.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaBanco.usuario_nombre || '-'}</p>
          <p><strong>Saldo Inicial:</strong> ${this.formatoMoneda(cajaBanco.saldo_inicial || 0)}</p>
          <p><strong>Saldo Actual:</strong> ${this.formatoMoneda(cajaBanco.saldo_actual || 0)}</p>
          <p><strong>Estado:</strong> ${cajaBanco.estado}</p>
          <p style="color: #28a745; margin-top: 1rem;"><strong>✅ Saldos coinciden - puede eliminarse</strong></p>
          <p style="color: red;"><strong>⚠️ Esta acción es PERMANENTE y NO se puede deshacer</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar permanentemente',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        await this.cajaBancoService.eliminarCajaBanco(cajaBanco.id!);

        // Recargar listas
        this.cargarCajas();

        Swal.fire({
          title: '✅ Eliminada',
          text: 'Caja banco eliminada permanentemente',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al eliminar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo eliminar la caja banco',
          icon: 'error'
        });
      }
    }
  }

  /**
   * Getter para el total de cajas ganadas.
   * @returns {number} Suma total de montos de cajas chicas cerradas
   */
  getTotalGanado(): number {
    return this.totales.total_ganado_cajas_chicas;
  }

  /**
   * Getter para el total de transferencias.
   * @returns {number} Suma total de ingresos por transferencia
   */
  getTotalTransferencias(): number {
    return this.totales.total_transferencias;
  }

  /**
   * Getter para el total de ingresos.
   * @returns {number} Suma de cajas chicas + transferencias
   */
  getTotalIngresos(): number {
    return this.totales.total_ingresos;
  }

  /**
   * Getter para el total de egresos.
   * @returns {number} Suma total de movimientos de egreso
   */
  getTotalEgresos(): number {
    return this.totales.total_egresos;
  }

  /**
   * Retorna la clase CSS (badge) correspondiente al estado de una caja.
   *
   * @param estado - Estado de la caja ('ABIERTA', 'CERRADA', etc.)
   * @returns {string} Clase CSS para aplicar estilos (ej: 'badge-success')
   */
  getEstadoBadge(estado: string): string {
    if (estado === 'ABIERTA') return 'badge-success';
    if (estado === 'CERRADA') return 'badge-danger';
    return 'badge-secondary';
  }

  /**
   * Formatea una fecha para mostrar en la UI.
   *
   * @param fecha - Objeto Date, Firestore Timestamp o string
   * @returns {string} Fecha formateada (ej: '15/01/2026')
   */
  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  /**
   * Formatea un monto como moneda USD.
   *
   * @param monto - Valor numérico a formatear
   * @returns {string} Monto formateado (ej: '$1,234.56')
   */
  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  /**
   * Retorna la clase CSS para colorear un tipo de movimiento.
   *
   * @param tipo - Tipo de movimiento ('INGRESO' o 'EGRESO')
   * @returns {string} Nombre de clase CSS
   */
  getColorTipo(tipo: string): string {
    return tipo === 'INGRESO' ? 'ingreso' : 'egreso';
  }
}
