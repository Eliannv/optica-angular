/**
 * 🚀 OPTIMIZADO: Componente para listar y gestionar cajas chicas con paginación y filtro por periodo.
 *
 * Propósito:
 * Dashboard de cajas chicas con carga eficiente, navegación bidireccional y filtro automático por periodo.
 *
 * ✅ OPTIMIZACIONES APLICADAS:
 * - ✔ Paginación backend real (limit + startAfter)
 * - ✔ Navegación anterior/siguiente con historial
 * - ✔ Filtro por periodo (selección automática del periodo actual)
 * - ✔ Solo mantiene página actual en memoria
 * - ✔ Gestión de memoria automática
 * - ✔ Reduce lecturas Firestore
 *
 * Funcionalidades:
 * - Paginación: 10 cajas por página (navegación bidireccional)
 * - Filtro: Periodo automático (mes/año de caja banco)
 * - Acciones: abrir, ver, registrar movimiento, cerrar
 * - Formateo: fechas y montos localizados
 *
 * @component ListarCajasComponent
 * @standalone false
 * @module CajaChicaModule
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { CajaBanco } from '../../../../core/models/caja-banco.model';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';
import { normalizarFecha } from '../../../../core/utils/fecha-helpers';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit, OnDestroy {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private subscriptions = new Subscription();

  // 📋 Datos del periodo (fuente principal para KPIs, filtros y tabla)
  todasLasCajasDelPeriodo: CajaChica[] = [];

  // 📄 Paginación cliente
  paginaClienteActual = 1;
  pageSize = 10;
  cargando = false;

  // 🎯 Filtro de periodo (siempre activo)
  cajaBancoSeleccionada: string | null = null; // ID de caja banco para filtrar por periodo
  fechaSeleccionada: string = ''; // Fecha específica para filtrar (formato YYYY-MM-DD)
  minFechaPeriodo: string = ''; // Fecha mínima permitida según periodo
  maxFechaPeriodo: string = ''; // Fecha máxima permitida según periodo

  // 📆 Cajas banco disponibles (para selector de periodo)
  cajasBancoDisponibles: CajaBanco[] = [];
  cargandoPeriodos = false;

  // 🔍 Filtros
  filtroEstado: string = 'TODOS'; // TODOS, ABIERTA, CERRADA
  filtroSaldoInicialMin: number | null = null;
  filtroSaldoInicialMax: number | null = null;
  filtroSaldoActualMin: number | null = null;
  filtroSaldoActualMax: number | null = null;
  filtroUsuario: string = '';

  // ⏱ Filtro de duración
  filtroDuracionTipo: string = 'TODOS'; // 'TODOS' | 'MENOS_DE' | 'ENTRE' | 'MAS_DE'
  filtroDuracionHorasA: number | null = null; // valor principal (límite en todos los modos)
  filtroDuracionHorasB: number | null = null; // límite superior (solo para ENTRE)

  // 📊 Filtro de movimientos
  filtroMovimientos: string = 'TODOS'; // 'TODOS' | 'CON' | 'SIN'

  // 📊 KPIs calculados (SOBRE TODAS LAS CAJAS DEL PERIODO, NO SOBRE FILTROS NI PAGINACIÓN)
  get totalCajasChicas(): number {
    return this.todasLasCajasDelPeriodo.length;
  }

  get cajasConMovimientos(): number {
    return this.todasLasCajasDelPeriodo.filter(
      c => Math.abs((c.monto_actual || 0) - (c.monto_inicial || 0)) > 0.001
    ).length;
  }

  get cajasSinMovimientos(): number {
    return this.todasLasCajasDelPeriodo.filter(
      c => Math.abs((c.monto_actual || 0) - (c.monto_inicial || 0)) <= 0.001
    ).length;
  }

  get saldoTotalActual(): number {
    return Math.round(
      this.todasLasCajasDelPeriodo.reduce((sum, c) => sum + (c.monto_actual || 0), 0) * 100
    ) / 100;
  }

  get gastoPromedioPorCaja(): number {
    if (this.totalCajasChicas === 0) return 0;
    const totalGastos = this.todasLasCajasDelPeriodo.reduce((sum, c) => {
      const gasto = (c.monto_inicial || 0) - (c.monto_actual || 0);
      return sum + gasto;
    }, 0);
    return Math.round((totalGastos / this.totalCajasChicas) * 100) / 100;
  }

  get duracionPromedioCaja(): number {
    const cajasCerradas = this.todasLasCajasDelPeriodo.filter(c => c.estado === 'CERRADA' && c.cerrado_en && c.fecha);
    if (cajasCerradas.length === 0) return 0;
    
    const totalHoras = cajasCerradas.reduce((sum, c) => {
      const apertura = (c.fecha as any).toDate ? (c.fecha as any).toDate() : new Date(c.fecha);
      const cierre = (c.cerrado_en as any)?.toDate ? (c.cerrado_en as any).toDate() : new Date(c.cerrado_en!);
      const diffMs = cierre.getTime() - apertura.getTime();
      const diffHoras = diffMs / (1000 * 60 * 60);
      return sum + diffHoras;
    }, 0);
    
    return totalHoras / cajasCerradas.length;
  }

  // Verifica si hay filtros activos
  get hayFiltrosActivos(): boolean {
    return this.filtroEstado !== 'TODOS' ||
           this.filtroSaldoInicialMin !== null ||
           this.filtroSaldoInicialMax !== null ||
           this.filtroSaldoActualMin !== null ||
           this.filtroSaldoActualMax !== null ||
           this.filtroUsuario.trim() !== '' ||
           this.fechaSeleccionada !== '' ||
           this.filtroDuracionTipo !== 'TODOS' ||
           this.filtroMovimientos !== 'TODOS';
  }

  // Cajas filtradas (sobre TODO el periodo, no solo la página)
  get cajasFiltradas(): CajaChica[] {
    return this.todasLasCajasDelPeriodo.filter(caja => {
      // Filtro por fecha específica
      if (this.fechaSeleccionada) {
        const fechaCaja = (caja.fecha as any).toDate ? (caja.fecha as any).toDate() : new Date(caja.fecha);
        const fechaStr = this.formatoFechaInput(fechaCaja);
        if (fechaStr !== this.fechaSeleccionada) return false;
      }
      // Filtro por estado
      if (this.filtroEstado !== 'TODOS' && caja.estado !== this.filtroEstado) {
        return false;
      }

      // Filtro por saldo inicial
      if (this.filtroSaldoInicialMin !== null && (caja.monto_inicial || 0) < this.filtroSaldoInicialMin) {
        return false;
      }
      if (this.filtroSaldoInicialMax !== null && (caja.monto_inicial || 0) > this.filtroSaldoInicialMax) {
        return false;
      }

      // Filtro por saldo actual
      if (this.filtroSaldoActualMin !== null && (caja.monto_actual || 0) < this.filtroSaldoActualMin) {
        return false;
      }
      if (this.filtroSaldoActualMax !== null && (caja.monto_actual || 0) > this.filtroSaldoActualMax) {
        return false;
      }

      // Filtro por usuario
      if (this.filtroUsuario.trim()) {
        const term = this.filtroUsuario.trim().toLowerCase();
        const abrio = (caja.usuario_nombre || '').toLowerCase();
        const cerro = (caja.cerrado_por_nombre || '').toLowerCase();
        if (!abrio.includes(term) && !cerro.includes(term)) {
          return false;
        }
      }

      // Filtro por duración
      if (this.filtroDuracionTipo !== 'TODOS') {
        const horas = this.calcularDuracionHoras(caja);
        if (horas === null) return false; // sin duración calculable se excluye
        if (this.filtroDuracionTipo === 'MENOS_DE') {
          if (this.filtroDuracionHorasA === null || horas >= this.filtroDuracionHorasA) return false;
        } else if (this.filtroDuracionTipo === 'ENTRE') {
          if (this.filtroDuracionHorasA !== null && horas < this.filtroDuracionHorasA) return false;
          if (this.filtroDuracionHorasB !== null && horas > this.filtroDuracionHorasB) return false;
        } else if (this.filtroDuracionTipo === 'MAS_DE') {
          if (this.filtroDuracionHorasA === null || horas <= this.filtroDuracionHorasA) return false;
        }
      }

      // Filtro por movimientos (detectado si el saldo cambió respecto al inicial)
      if (this.filtroMovimientos !== 'TODOS') {
        const tieneMovimientos = Math.abs((caja.monto_actual || 0) - (caja.monto_inicial || 0)) > 0.001;
        if (this.filtroMovimientos === 'CON' && !tieneMovimientos) return false;
        if (this.filtroMovimientos === 'SIN' && tieneMovimientos) return false;
      }

      return true;
    });
  }

  /**
   * Calcula la duración en horas decimales entre apertura y cierre de una caja.
   * Devuelve null si la caja no tiene ambas fechas.
   */
  private calcularDuracionHoras(caja: CajaChica): number | null {
    if (!caja.fecha || !caja.cerrado_en) return null;
    const apertura = (caja.fecha as any).toDate ? (caja.fecha as any).toDate() : new Date(caja.fecha);
    const cierre = (caja.cerrado_en as any).toDate ? (caja.cerrado_en as any).toDate() : new Date(caja.cerrado_en);
    return (cierre.getTime() - apertura.getTime()) / (1000 * 60 * 60);
  }

  // Página actual de la tabla (slice de cajasFiltradas)
  get cajasEnPagina(): CajaChica[] {
    const inicio = (this.paginaClienteActual - 1) * this.pageSize;
    return this.cajasFiltradas.slice(inicio, inicio + this.pageSize);
  }

  get totalPaginasCliente(): number {
    return Math.max(1, Math.ceil(this.cajasFiltradas.length / this.pageSize));
  }

  irPaginaSiguiente(): void {
    if (this.paginaClienteActual < this.totalPaginasCliente) this.paginaClienteActual++;
  }

  irPaginaAnterior(): void {
    if (this.paginaClienteActual > 1) this.paginaClienteActual--;
  }

  irPrimeraPaginaCliente(): void {
    this.paginaClienteActual = 1;
  }

  irUltimaPaginaCliente(): void {
    this.paginaClienteActual = this.totalPaginasCliente;
  }

  ngOnInit(): void {
    this.cargarPeriodosDisponibles();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.todasLasCajasDelPeriodo = [];
    this.cajasBancoDisponibles = [];
  }

  /**   * 📆 Carga las cajas banco disponibles para el selector de periodo.
   * Selecciona automáticamente el periodo más reciente (actual).
   */
  cargarPeriodosDisponibles(): void {
    this.cargandoPeriodos = true;
    const sub = this.cajaBancoService.getCajasBanco().subscribe({
      next: (cajasBanco) => {
        // Ordenar por fecha descendente (más recientes primero)
        this.cajasBancoDisponibles = cajasBanco.sort((a, b) => {
          const fechaA = (a.fecha as any)?.toMillis?.() || new Date(a.fecha).getTime();
          const fechaB = (b.fecha as any)?.toMillis?.() || new Date(b.fecha).getTime();
          return fechaB - fechaA;
        });
        
        // Seleccionar automáticamente el periodo más reciente
        if (this.cajasBancoDisponibles.length > 0) {
          this.cajaBancoSeleccionada = this.cajasBancoDisponibles[0].id || null;
          this.calcularRangoFechasPeriodo();
          this.cargarTodasLasCajasDelPeriodo();
        }
        
        this.cargandoPeriodos = false;
      },
      error: (error) => {
        console.error('Error al cargar periodos:', error);
        this.cargandoPeriodos = false;
      }
    });
    this.subscriptions.add(sub);
  }

  /**
   * 🔥 Carga TODAS las cajas del periodo seleccionado (sin paginación) para calcular KPIs.
   * Los KPIs deben reflejar TODO el periodo, no solo la página actual.
   */
  async cargarTodasLasCajasDelPeriodo(): Promise<void> {
    if (!this.cajaBancoSeleccionada) {
      this.todasLasCajasDelPeriodo = [];
      return;
    }

    try {
      // Obtener todas las cajas del periodo a través de una suscripción temporal
      const sub = this.cajaChicaService.getCajasChicas().subscribe({
        next: (todasLasCajas) => {
          // Filtrar solo las cajas del periodo seleccionado
          this.todasLasCajasDelPeriodo = todasLasCajas.filter(caja => 
            caja.caja_banco_id === this.cajaBancoSeleccionada
          );
        },
        error: (error) => {
          console.error('❌ Error al cargar todas las cajas del periodo:', error);
          this.todasLasCajasDelPeriodo = [];
        }
      });
      this.subscriptions.add(sub);
    } catch (error) {
      console.error('❌ Error al cargar todas las cajas del periodo:', error);
      this.todasLasCajasDelPeriodo = [];
    }
  }

  /**
   * 📆 Calcula el rango de fechas permitidas según el periodo seleccionado.
   */
  calcularRangoFechasPeriodo(): void {
    if (!this.cajaBancoSeleccionada) {
      this.minFechaPeriodo = '';
      this.maxFechaPeriodo = '';
      return;
    }

    const cajaBanco = this.cajasBancoDisponibles.find(c => c.id === this.cajaBancoSeleccionada);
    if (!cajaBanco || !cajaBanco.fecha) {
      this.minFechaPeriodo = '';
      this.maxFechaPeriodo = '';
      return;
    }

    const fecha = (cajaBanco.fecha as any).toDate ? (cajaBanco.fecha as any).toDate() : new Date(cajaBanco.fecha);
    const año = fecha.getFullYear();
    const mes = fecha.getMonth(); // 0-11

    // Primer día del mes
    const primerDia = new Date(año, mes, 1);
    // Último día del mes
    const ultimoDia = new Date(año, mes + 1, 0);

    // Formatear a YYYY-MM-DD
    this.minFechaPeriodo = this.formatoFechaInput(primerDia);
    this.maxFechaPeriodo = this.formatoFechaInput(ultimoDia);
  }

  /**
   * Formatea una fecha a formato YYYY-MM-DD para input type="date".
   */
  formatoFechaInput(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  /**
   * 📆 Cambia el filtro de periodo y recarga desde el inicio.
   */
  cambiarFiltroPeriodo(cajaBancoId: string | null): void {
    this.cajaBancoSeleccionada = cajaBancoId;
    this.fechaSeleccionada = '';
    this.paginaClienteActual = 1;
    this.calcularRangoFechasPeriodo();
    this.cargarTodasLasCajasDelPeriodo();
  }

  /**
   * 📅 Cambia el filtro de fecha específica y recarga.
   */
  cambiarFiltroFecha(fecha: string): void {
    this.fechaSeleccionada = fecha;
    this.paginaClienteActual = 1;
  }

  /**
   * 🔄 Limpia el filtro de fecha.
   */
  limpiarFiltroFecha(): void {
    this.fechaSeleccionada = '';
    this.paginaClienteActual = 1;
  }

  /**
   * Abre un modal para crear una nueva caja chica.
   * Similar al flujo de caja banco, pero validando primero que exista una caja banco.
   */
  async abrirCaja(): Promise<void> {
    try {
      // Verificar primero que exista al menos una caja banco
      const existeCajaBanco = await firstValueFrom(this.cajaBancoService.existeAlMenosUnaCajaBanco());
      
      if (!existeCajaBanco) {
        const esAdmin = this.authService.isAdmin();
        
        if (esAdmin) {
          const result = await Swal.fire({
            icon: 'warning',
            title: 'Caja Banco requerida',
            text: 'Debe crear primero una Caja Banco antes de registrar una Caja Chica.',
            confirmButtonText: 'Ir a Caja Banco',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: 'var(--btn-primary-bg)',
            cancelButtonColor: 'var(--btn-secondary-bg)'
          });
          
          if (result.isConfirmed) {
            this.router.navigate(['/caja-banco']);
          }
        } else {
          await Swal.fire({
            icon: 'error',
            title: 'Caja Banco no disponible',
            text: 'No existe una Caja Banco creada. Contacte con el administrador para que la cree.',
            confirmButtonText: 'Aceptar'
          });
        }
        return;
      }

      // Obtener restricciones de fecha de la caja banco abierta
      const cajaBanco = await this.cajaBancoService.getCajaBancoAbierta();
      let fechaMinima = '';
      let fechaMaxima = '';
      let periodoNombre = '';

      if (cajaBanco?.fecha) {
        const fechaCaja = (cajaBanco.fecha as any)?.toDate ? (cajaBanco.fecha as any).toDate() : new Date(cajaBanco.fecha);
        const year = fechaCaja.getFullYear();
        const month = fechaCaja.getMonth();
        
        const primerDia = new Date(year, month, 1);
        const ultimoDia = new Date(year, month + 1, 0);
        const hoy = new Date();
        
        fechaMinima = this.formatearFechaInput(primerDia);
        fechaMaxima = this.formatearFechaInput(ultimoDia < hoy ? ultimoDia : hoy);
        
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        periodoNombre = `${meses[month]} ${year}`;
      }

      const hoy = new Date();
      const fechaHoy = this.formatearFechaInput(hoy);

      const { value: formValues } = await Swal.fire({
        title: 'Crear Nueva Caja Chica',
        iconHtml: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="16" r="1"/><rect width="18" height="12" x="3" y="10" rx="2"/><path d="M7 10V7a5 5 0 0 1 9.33-2.5"/></svg>',
        html: `
          <div style="text-align: left;">
            <!-- Fecha -->
            <div style="margin-bottom: 1rem;">
              <label for="fecha" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
                Fecha de Apertura *
              </label>
              <input 
                id="fecha" 
                type="date" 
                class="swal2-input" 
                value="${fechaHoy}"
                min="${fechaMinima}"
                max="${fechaMaxima}"
                style="width: 100%; padding: 0.6rem; border: 2px solid var(--border-color); border-radius: 6px; font-size: 0.95rem; box-sizing: border-box; margin: 0;"
              />
              <small style="display: block; margin-top: 0.2rem; color: var(--text-tertiary); font-size: 0.8rem;">
                ${periodoNombre ? `Periodo de caja banco: ${periodoNombre}` : 'Seleccione la fecha de apertura'}
              </small>
            </div>
            
            <!-- Monto Inicial -->
            <div style="margin-bottom: 1rem;">
              <label for="monto_inicial" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
                Monto Inicial (USD) *
              </label>
              <input 
                id="monto_inicial" 
                type="number" 
                class="swal2-input" 
                placeholder="0.00"
                step="0.01"
                min="0"
                style="width: 100%; padding: 0.6rem; border: 2px solid var(--border-color); border-radius: 6px; font-size: 0.95rem; box-sizing: border-box; margin: 0;"
              />
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
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '✓ Crear Caja Chica',
        cancelButtonText: '✕ Cancelar',
        confirmButtonColor: 'var(--btn-primary-bg)',
        cancelButtonColor: 'var(--btn-secondary-bg)',
        preConfirm: () => {
          const fechaInput = (document.getElementById('fecha') as HTMLInputElement)?.value;
          const montoInput = (document.getElementById('monto_inicial') as HTMLInputElement)?.value;
          const observacion = (document.getElementById('observacion') as HTMLTextAreaElement)?.value;

          if (!fechaInput) {
            Swal.showValidationMessage('La fecha es requerida');
            return false;
          }

          if (!montoInput || montoInput.trim() === '') {
            Swal.showValidationMessage('El monto inicial es requerido');
            return false;
          }

          const monto = parseFloat(montoInput);
          if (isNaN(monto) || monto < 0) {
            Swal.showValidationMessage('El monto debe ser un número válido mayor o igual a 0');
            return false;
          }

          // Validar que la fecha esté dentro del periodo
          if (fechaMinima && fechaMaxima) {
            if (fechaInput < fechaMinima || fechaInput > fechaMaxima) {
              Swal.showValidationMessage(`La fecha debe estar dentro del periodo ${periodoNombre}`);
              return false;
            }
          }

          // Validar que no sea fecha futura
          const fechaSeleccionada = new Date(fechaInput + 'T00:00:00');
          const hoyValidacion = new Date();
          hoyValidacion.setHours(0, 0, 0, 0);
          
          if (fechaSeleccionada.getTime() > hoyValidacion.getTime()) {
            Swal.showValidationMessage('No se pueden crear cajas con fechas futuras');
            return false;
          }

          return { fecha: fechaInput, monto_inicial: monto, observacion };
        }
      });

      if (!formValues) return;

      // Obtener usuario actual
      const usuario = this.authService.getCurrentUser();
      
      const nuevaCaja = {
        fecha: normalizarFecha(formValues.fecha),
        monto_inicial: formValues.monto_inicial,
        monto_actual: formValues.monto_inicial,
        estado: 'ABIERTA' as const,
        usuario_id: usuario?.id || '',
        usuario_nombre: usuario?.nombre || 'Sistema',
        observacion: formValues.observacion || ''
      };

      await this.cajaChicaService.abrirCajaChica(nuevaCaja);

      await Swal.fire({
        icon: 'success',
        title: '¡Caja Chica Creada!',
        text: 'Caja creada con éxito',
        timer: 3000,
        toast: true,
          position: 'top-end',
        showConfirmButton: false
      });

      // Recargar cajas
      this.cargarTodasLasCajasDelPeriodo();
    } catch (error: any) {
      console.error('Error al crear caja chica:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error al crear caja',
        text: error?.message || 'No se pudo crear la caja chica. Intenta de nuevo.',
        toast: true,
          position: 'top-end',
          timer: 3000,
          showConfirmButton: false
      });
    }
  }

  /**
   * Formatea una fecha a string YYYY-MM-DD para input[type="date"]
   */
  private formatearFechaInput(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Navega a la página de detalles de una caja chica específica.
   */
  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-chica/ver', cajaId], {
      queryParams: { returnTo: this.router.url }
    });
  }

  /**
   * Navega al formulario de registro de movimiento para una caja específica.
   */
  registrarMovimiento(cajaId: string): void {
    this.router.navigate(['/caja-chica/registrar', cajaId]);
  }

  /**
   * Cierra una caja chica después de obtener confirmación del usuario.
   */
  async cerrarCaja(cajaId: string): Promise<void> {
    const confirmar = await Swal.fire({
      icon: 'question',
      title: '¿Cerrar Caja Chica?',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    });

    if (!confirmar.isConfirmed) return;

    try {
      await this.cajaChicaService.cerrarCajaChica(cajaId);
      await Swal.fire({
        icon: 'success',
        title: '¡Caja cerrada!',
        text: 'La caja chica se cerró exitosamente',
        timer: 3000,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
      this.cargarTodasLasCajasDelPeriodo();
    } catch (error: any) {
      console.error('Error al cerrar caja:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cerrar la caja chica',
        toast: true,
        position: 'top-end',
      });
    }
  }

  /**
   * Retorna la clase CSS Bootstrap para el badge de estado de caja.
   */
  getEstadoBadgeClass(estado: string): string {
    return estado === 'ABIERTA' ? 'badge-success' : 'badge-danger';
  }

  /**
   * Formatea una fecha de Firestore al formato local (DD/MM/YYYY).
   */
  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  /**
   * Formatea un monto numérico como moneda USD en formato español.
   */
  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  /**
   * Retorna el periodo (mes/año) de una caja banco para mostrar en el selector.
   */
  getPeriodoDisplay(cajaBanco: CajaBanco): string {
    if (!cajaBanco.fecha) return 'Periodo desconocido';
    
    const fecha = (cajaBanco.fecha as any).toDate ? (cajaBanco.fecha as any).toDate() : new Date(cajaBanco.fecha);
    const mes = fecha.toLocaleDateString('es-ES', { month: 'long' });
    const año = fecha.getFullYear();
    
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${año}`;
  }

  /**
   * 🧹 Limpia todos los filtros y recarga.
   */
  limpiarFiltros(): void {
    this.filtroEstado = 'TODOS';
    this.filtroSaldoInicialMin = null;
    this.filtroSaldoInicialMax = null;
    this.filtroSaldoActualMin = null;
    this.filtroSaldoActualMax = null;
    this.filtroUsuario = '';
    this.fechaSeleccionada = '';
    this.filtroDuracionTipo = 'TODOS';
    this.filtroDuracionHorasA = null;
    this.filtroDuracionHorasB = null;
    this.filtroMovimientos = 'TODOS';
    this.paginaClienteActual = 1;
  }

  /**
   * Formatea una fecha con hora para mostrar en la tabla.
   */
  formatoFechaHora(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatea una fecha para mostrar solo la hora (HH:MM).
   */
  formatoSoloHora(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  }

  /**
   * Calcula la duración entre apertura y cierre de caja (en horas y minutos).
   */
  calcularDuracion(fechaApertura: any, fechaCierre: any): string {
    if (!fechaApertura || !fechaCierre) return '-';
    
    const apertura = (fechaApertura as any).toDate ? (fechaApertura as any).toDate() : new Date(fechaApertura);
    const cierre = (fechaCierre as any).toDate ? (fechaCierre as any).toDate() : new Date(fechaCierre);
    
    const diffMs = cierre.getTime() - apertura.getTime();
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHoras > 0) {
      return `${diffHoras}h ${diffMinutos}m`;
    } else {
      return `${diffMinutos}m`;
    }
  }
}
