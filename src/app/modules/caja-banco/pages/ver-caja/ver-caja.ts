/**
 * Componente para visualizar detalles de una caja banco específica.
 *
 * Proporciona:
 * - Información completa de la caja banco (saldo inicial/actual, estado)
 * - Listado de cajas chicas cerradas del mismo período
 * - Detalle de movimientos asociados a la caja
 * - Resumen financiero (ingresos de cajas chicas y otros, egresos)
 * - Funcionalidad para registrar nuevos movimientos
 * - Generación de reportes individuales de caja
 *
 * @component VerCajaComponent
 */

import { Component, inject, OnInit } from '@angular/core';
import { puedeModificarCaja } from '../../../../core/utils/permisos-caja';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoConfigService } from '../../../../core/services/caja-banco-config.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ver-caja',
  standalone: false,
  templateUrl: './ver-caja.html',
  styleUrls: ['./ver-caja.css']
})
export class VerCajaComponent implements OnInit {
  /** Ruta activa para obtener parámetros */
  private route = inject(ActivatedRoute);

  /** Router para navegación */
  private router = inject(Router);

  /** Servicio de cajas banco */
  private cajaBancoService = inject(CajaBancoService);

  /** Servicio de cajas chicas */
  private cajaChicaService = inject(CajaChicaService);

  /** Servicio de configuración de cajas banco */
  protected cajaBancoConfigService = inject(CajaBancoConfigService);

  /** Servicio de autenticación */
  private authService = inject(AuthService);

  /** Caja banco actual siendo visualizada */
  caja: CajaBanco | null = null;

  /** Cajas chicas cerradas del mismo período de la caja banco */
  cajasChicas: CajaChica[] = [];

  /** Movimientos asociados a esta caja banco */
  movimientos: MovimientoCajaBanco[] = [];

  // ─── Filtros de movimientos ───────────────────────────────────────────
  filtroBusqueda: string = '';
  filtroTipoMov: string = 'TODOS';
  filtroCategoriaMov: string = 'TODOS';
  filtroUsuarioMov: string = '';
  filtroFechaMovDesde: string = '';
  filtroFechaMovHasta: string = '';
  filtroMontoMin: number | null = null;
  filtroMontoMax: number | null = null;
  mostrarFiltrosMov: boolean = false;
  // ─── Filtros de cajas chicas ──────────────────────────────────────────────
  mostrarFiltrosCC: boolean = false;
  filtroCCFechaDesde: string = '';
  filtroCCFechaHasta: string = '';
  filtroCCSaldoIniMin: number | null = null;
  filtroCCSaldoIniMax: number | null = null;
  filtroCCSaldoActMin: number | null = null;
  filtroCCSaldoActMax: number | null = null;
  filtroCCUsuario: string = '';

  get cajasChicasFiltradas(): CajaChica[] {
    return this.cajasChicas.filter(cc => {
      if (this.filtroCCFechaDesde || this.filtroCCFechaHasta) {
        const f: Date = (cc.fecha as any)?.toDate ? (cc.fecha as any).toDate() : new Date(cc.fecha);
        if (this.filtroCCFechaDesde && f < new Date(this.filtroCCFechaDesde + 'T00:00:00')) return false;
        if (this.filtroCCFechaHasta && f > new Date(this.filtroCCFechaHasta + 'T23:59:59')) return false;
      }
      if (this.filtroCCSaldoIniMin !== null && (cc.monto_inicial || 0) < this.filtroCCSaldoIniMin) return false;
      if (this.filtroCCSaldoIniMax !== null && (cc.monto_inicial || 0) > this.filtroCCSaldoIniMax) return false;
      if (this.filtroCCSaldoActMin !== null && (cc.monto_actual || 0) < this.filtroCCSaldoActMin) return false;
      if (this.filtroCCSaldoActMax !== null && (cc.monto_actual || 0) > this.filtroCCSaldoActMax) return false;
      if (this.filtroCCUsuario.trim()) {
        const term = this.filtroCCUsuario.trim().toLowerCase();
        const abrio = (cc.usuario_nombre || '').toLowerCase();
        const cerro = (cc.cerrado_por_nombre || '').toLowerCase();
        if (!abrio.includes(term) && !cerro.includes(term)) return false;
      }
      return true;
    });
  }

  get hayFiltrosCC(): boolean {
    return !!this.filtroCCFechaDesde || !!this.filtroCCFechaHasta
      || this.filtroCCSaldoIniMin !== null || this.filtroCCSaldoIniMax !== null
      || this.filtroCCSaldoActMin !== null || this.filtroCCSaldoActMax !== null
      || !!this.filtroCCUsuario.trim();
  }

  limpiarFiltrosCC(): void {
    this.filtroCCFechaDesde = '';
    this.filtroCCFechaHasta = '';
    this.filtroCCSaldoIniMin = null;
    this.filtroCCSaldoIniMax = null;
    this.filtroCCSaldoActMin = null;
    this.filtroCCSaldoActMax = null;
    this.filtroCCUsuario = '';
  }
  /** Controla la visibilidad del accordion de detalles de la caja */
  mostrarDetallesCaja: boolean = false;

  /** Estado de carga de datos */
  cargando = false;

  /** ID de la caja banco (parámetro de ruta) */
  cajaId: string = '';

  /** ID de la ultima caja banco abierta */
  ultimaCajaAbiertaId: string | null = null;

  /**
   * Resumen financiero de la caja.
   * Incluye totales de ingresos y egresos desglosados.
   */
  resumen = {
    total_ingresos: 0,
    total_egresos: 0,
    ingresos_cajas_chicas: 0,
    ingresos_otros: 0
  };

  /**
   * Calcula el saldo actual de la caja banco.
   * Fórmula: saldo_inicial + total_ingresos - total_egresos
   */
  get saldoActualCalculado(): number {
    if (!this.caja) return 0;
    return Math.round(((this.caja.saldo_inicial || 0) + this.resumen.total_ingresos - this.resumen.total_egresos) * 100) / 100;
  }

  /**
   * Verifica si el usuario actual es administrador.
   * Los operadores no tienen permisos para cerrar cajas.
   */
  get esAdministrador(): boolean {
    return this.authService.isAdmin();
  }

  /**
   * Solo el admin puede editar/eliminar y solo si es la ultima caja abierta.
   */
  get puedeEditarMovimientos(): boolean {
    const usuario = this.authService.getCurrentUser();
    if (!this.caja || !usuario) return false;
    if (this.caja.estado === 'CERRADA') {
      // Solo admin puede editar cualquier caja cerrada
      return usuario.rol === 1; // RolUsuario.ADMINISTRADOR
    }
    // Si está ABIERTA, solo la última caja abierta puede ser editada
    return this.caja.id === this.ultimaCajaAbiertaId && puedeModificarCaja(this.caja, usuario);
  }

  /** Movimientos filtrados según los criterios activos */
  get movimientosFiltrados(): MovimientoCajaBanco[] {
    let result = [...this.movimientos];

    // Búsqueda rápida (descripción, referencia, monto, usuario, tipo)
    if (this.filtroBusqueda.trim()) {
      const q = this.filtroBusqueda.toLowerCase().trim();
      result = result.filter(m =>
        (m.descripcion || '').toLowerCase().includes(q) ||
        (m.referencia || '').toLowerCase().includes(q) ||
        String(m.monto ?? '').includes(q) ||
        (m.usuario_nombre || '').toLowerCase().includes(q) ||
        (m.tipo || '').toLowerCase().includes(q)
      );
    }

    if (this.filtroTipoMov !== 'TODOS') {
      result = result.filter(m => m.tipo === this.filtroTipoMov);
    }

    if (this.filtroCategoriaMov !== 'TODOS') {
      result = result.filter(m => m.categoria === this.filtroCategoriaMov);
    }

    if (this.filtroUsuarioMov.trim()) {
      const u = this.filtroUsuarioMov.toLowerCase().trim();
      result = result.filter(m => (m.usuario_nombre || '').toLowerCase().includes(u));
    }

    if (this.filtroFechaMovDesde) {
      const desde = new Date(this.filtroFechaMovDesde);
      result = result.filter(m => {
        const f: Date = (m.fecha as any)?.toDate?.() ?? (m.fecha instanceof Date ? m.fecha : new Date(m.fecha));
        return f >= desde;
      });
    }

    if (this.filtroFechaMovHasta) {
      const hasta = new Date(this.filtroFechaMovHasta + 'T23:59:59');
      result = result.filter(m => {
        const f: Date = (m.fecha as any)?.toDate?.() ?? (m.fecha instanceof Date ? m.fecha : new Date(m.fecha));
        return f <= hasta;
      });
    }

    if (this.filtroMontoMin !== null) {
      result = result.filter(m => (m.monto || 0) >= this.filtroMontoMin!);
    }

    if (this.filtroMontoMax !== null) {
      result = result.filter(m => (m.monto || 0) <= this.filtroMontoMax!);
    }

    return result;
  }

  /** True si hay algún filtro activo en movimientos */
  get hayFiltrosMov(): boolean {
    return !!(
      this.filtroBusqueda.trim() ||
      this.filtroTipoMov !== 'TODOS' ||
      this.filtroCategoriaMov !== 'TODOS' ||
      this.filtroUsuarioMov.trim() ||
      this.filtroFechaMovDesde ||
      this.filtroFechaMovHasta ||
      this.filtroMontoMin !== null ||
      this.filtroMontoMax !== null
    );
  }

  /** Chips de filtros activos para mostrar en la UI */
  get chipsFiltrosMov(): { label: string; key: string }[] {
    const chips: { label: string; key: string }[] = [];
    if (this.filtroFechaMovDesde) chips.push({ label: 'Desde: ' + this.filtroFechaMovDesde, key: 'desde' });
    if (this.filtroFechaMovHasta) chips.push({ label: 'Hasta: ' + this.filtroFechaMovHasta, key: 'hasta' });
    if (this.filtroTipoMov !== 'TODOS') chips.push({ label: 'Tipo: ' + this.filtroTipoMov, key: 'tipo' });
    if (this.filtroCategoriaMov !== 'TODOS') chips.push({ label: 'Categoría: ' + this.filtroCategoriaMov.replace(/_/g, ' '), key: 'categoria' });
    if (this.filtroUsuarioMov.trim()) chips.push({ label: 'Usuario: ' + this.filtroUsuarioMov, key: 'usuario' });
    if (this.filtroMontoMin !== null) chips.push({ label: 'Monto mín: $' + this.filtroMontoMin, key: 'minMonto' });
    if (this.filtroMontoMax !== null) chips.push({ label: 'Monto máx: $' + this.filtroMontoMax, key: 'maxMonto' });
    return chips;
  }

  /** Resumen de ingresos/egresos FIJOS (sin aplicar filtros - calculado sobre todos los movimientos) */
  get resumenFiltrado(): { ingresos: number; egresos: number; balance: number } {
    const movs = this.movimientos; // Cambiado de movimientosFiltrados a movimientos para que sea fijo
    const ingresos = movs.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + (m.monto || 0), 0);
    const egresos  = movs.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + (m.monto || 0), 0);
    return { ingresos, egresos, balance: ingresos - egresos };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 📊 ESTADÍSTICAS POR CATEGORÍA (FIJAS - SIN FILTROS)
  // ══════════════════════════════════════════════════════════════════════════

  /** Total de ingresos por categoría: Cierre Caja Chica */
  get totalCierreCajaChica(): number {
    return this.movimientos
      .filter(m => m.tipo === 'INGRESO' && m.categoria === 'CIERRE_CAJA_CHICA')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  }

  /** Total de ingresos por categoría: Transferencia Cliente */
  get totalTransferenciaCliente(): number {
    return this.movimientos
      .filter(m => m.tipo === 'INGRESO' && m.categoria === 'TRANSFERENCIA_CLIENTE')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  }

  /** Total de ingresos por categoría: Otro Ingreso */
  get totalOtroIngreso(): number {
    return this.movimientos
      .filter(m => m.tipo === 'INGRESO' && m.categoria === 'OTRO_INGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  }

  /** Total de egresos por categoría: Pago Trabajador */
  get totalPagoTrabajador(): number {
    return this.movimientos
      .filter(m => m.tipo === 'EGRESO' && m.categoria === 'PAGO_TRABAJADOR')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  }

  /** Total de egresos por categoría: Pago Proveedores */
  get totalPagoProveedores(): number {
    return this.movimientos
      .filter(m => m.tipo === 'EGRESO' && m.categoria === 'PAGO_PROVEEDORES')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  }

  /** Total de egresos por categoría: Otro Egreso */
  get totalOtroEgreso(): number {
    return this.movimientos
      .filter(m => m.tipo === 'EGRESO' && m.categoria === 'OTRO_EGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  }

  /** Quita un chip de filtro puntual */
  quitarChip(key: string): void {
    switch (key) {
      case 'desde':    this.filtroFechaMovDesde = ''; break;
      case 'hasta':    this.filtroFechaMovHasta = ''; break;
      case 'tipo':     this.filtroTipoMov = 'TODOS'; break;
      case 'categoria': this.filtroCategoriaMov = 'TODOS'; break;
      case 'usuario':  this.filtroUsuarioMov = ''; break;
      case 'minMonto': this.filtroMontoMin = null; break;
      case 'maxMonto': this.filtroMontoMax = null; break;
    }
  }

  /** Limpia todos los filtros de movimientos */
  limpiarFiltrosMov(): void {
    this.filtroBusqueda = '';
    this.filtroTipoMov = 'TODOS';
    this.filtroCategoriaMov = 'TODOS';
    this.filtroUsuarioMov = '';
    this.filtroFechaMovDesde = '';
    this.filtroFechaMovHasta = '';
    this.filtroMontoMin = null;
    this.filtroMontoMax = null;
  }

  /** Etiqueta legible para una categoría de movimiento */
  labelCategoria(cat: string): string {
    const labels: Record<string, string> = {
      'CIERRE_CAJA_CHICA': 'Cierre Caja Chica',
      'TRANSFERENCIA_CLIENTE': 'Trans. Cliente',
      'PAGO_TRABAJADOR': 'Pago Trabajador',
      'PAGO_PROVEEDORES': 'Pago Proveedor',
      'OTRO_INGRESO': 'Otro Ingreso',
      'OTRO_EGRESO': 'Otro Egreso'
    };
    return labels[cat] || cat || '-';
  }

  /**
   * Hook de inicialización de Angular.
   * Obtiene el ID de la caja del parámetro de ruta y carga sus datos.
   */
  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.cajaId = params['id'];
      if (this.cajaId) {
        this.cargarDatos();
      }
    });
  }

  /**
   * Carga todos los datos relacionados con la caja banco.
   *
   * Realiza en paralelo:
   * 1. Obtiene datos de la caja banco
   * 2. Asocia movimientos antiguos sin referencia
   * 3. Carga cajas chicas del mismo período
   * 4. Carga movimientos de esta caja
   */
  cargarDatos(): void {
    this.cargando = true;
    this.cargarUltimaCajaAbierta();
    this.cajaBancoService.getCajaBancoById(this.cajaId).subscribe(c => {
      this.caja = c;
      // Asociar movimientos antiguos que no tengan caja_banco_id
      this.cajaBancoService.asociarMovimientosAntiguos(this.cajaId).then(() => {
        this.cargarCajasChicas();
      });
    });
    this.cajaBancoService.getMovimientosCajaBanco(this.cajaId).subscribe({
      next: (movimientos) => {
        console.log('📊 Movimientos cargados para caja:', this.cajaId);
        console.log('   Total:', movimientos?.length || 0);
        (movimientos || []).forEach((m, i) => {
          console.log(`   [${i}]`, {
            id: m.id,
            caja_banco_id: m.caja_banco_id,
            categoria: m.categoria,
            descripcion: m.descripcion,
            monto: m.monto,
            tipo: m.tipo
          });
        });
        this.movimientos = movimientos || [];
        this.calcularResumen();
        this.cargando = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar movimientos de caja:', this.cajaId, error);
        this.cargando = false;
      }
    });
  }

  private async cargarUltimaCajaAbierta(): Promise<void> {
    try {
      const ultima = await this.cajaBancoService.getCajaBancoAbierta();
      this.ultimaCajaAbiertaId = ultima?.id || null;
    } catch (error) {
      console.error('Error obteniendo ultima caja abierta:', error);
      this.ultimaCajaAbiertaId = null;
    }
  }

  async editarMovimiento(mov: MovimientoCajaBanco): Promise<void> {
    if (!this.puedeEditarMovimientos || !this.cajaId || !mov.id) {
      await Swal.fire({
        icon: 'warning',
        title: 'Accion no permitida',
        text: 'Solo el administrador puede editar movimientos en la ultima caja abierta.'
      });
      return;
    }

    const fechaActual = mov.fecha ? new Date(mov.fecha) : new Date();
    const fechaIso = `${fechaActual.getFullYear()}-${(fechaActual.getMonth() + 1).toString().padStart(2, '0')}-${fechaActual.getDate().toString().padStart(2, '0')}`;
    const horaActual = fechaActual.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    const result = await Swal.fire({
      title: 'Editar movimiento',
      html: `
        <div class="modern-modal-content">
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Tipo:</span>
              <span class="info-value">${mov.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Monto original:</span>
              <span class="info-value highlight">$${(mov.monto || 0).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="form-group-modern">
            <label for="mov-fecha" class="form-label-modern">Fecha</label>
            <input id="mov-fecha" class="form-input-modern" type="date" value="${fechaIso}">
          </div>
          
          <div class="form-group-modern">
            <label for="mov-hora" class="form-label-modern">Hora</label>
            <input id="mov-hora" class="form-input-modern" type="time" step="1" value="${horaActual}">
          </div>
          
          <div class="form-group-modern">
            <label for="mov-descripcion" class="form-label-modern">Descripción</label>
            <input id="mov-descripcion" class="form-input-modern" type="text" placeholder="Descripción del movimiento" value="${mov.descripcion || ''}">
          </div>
          
          <div class="form-group-modern">
            <label for="mov-referencia" class="form-label-modern">Referencia (opcional)</label>
            <input id="mov-referencia" class="form-input-modern" type="text" placeholder="Número de referencia o documento" value="${mov.referencia || ''}">
          </div>
          
          <div class="form-group-modern">
            <label for="mov-monto" class="form-label-modern">Monto</label>
            <input id="mov-monto" class="form-input-modern" type="number" placeholder="0.00" step="0.01" min="0.01" value="${mov.monto || 0}">
          </div>
          
          <div class="alert-modern">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            <span>Al editar este movimiento se actualizará el registro en la caja banco</span>
          </div>
        </div>
        
        <style>
          .modern-modal-content { text-align: left; padding: 0.5rem; }
          .info-section { background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; border: 1px solid #e9ecef; }
          .info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
          .info-row:last-child { margin-bottom: 0; }
          .info-label { font-weight: 500; color: #6c757d; font-size: 0.95rem; }
          .info-value { font-weight: 600; color: #2c3e50; font-size: 1rem; }
          .info-value.highlight { color: #3498db; font-size: 1.25rem; }
          .form-group-modern { margin-bottom: 1.25rem; }
          .form-label-modern { display: block; font-weight: 600; font-size: 0.95rem; color: #2c3e50; margin-bottom: 0.5rem; }
          .form-input-modern { width: 100%; padding: 0.75rem 1rem; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; transition: all 0.2s; }
          .form-input-modern:focus { outline: none; border-color: #3498db; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1); }
          .alert-modern { background: rgba(52, 152, 219, 0.1); color: #3498db; padding: 0.875rem 1rem; border-radius: 8px; font-size: 0.9rem; display: flex; align-items: center; gap: 0.75rem; border: 1px solid rgba(52, 152, 219, 0.2); }
          .alert-modern svg { flex-shrink: 0; }
        </style>
      `,
      width: '550px',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-check-lg"></i> Guardar cambios',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3498db',
      cancelButtonColor: '#6c757d',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-confirm-btn',
        cancelButton: 'modern-cancel-btn'
      },
      preConfirm: () => {
        const fechaInput = document.getElementById('mov-fecha') as HTMLInputElement;
        const horaInput = document.getElementById('mov-hora') as HTMLInputElement;
        const descripcionInput = document.getElementById('mov-descripcion') as HTMLInputElement;
        const referenciaInput = document.getElementById('mov-referencia') as HTMLInputElement;
        const montoInput = document.getElementById('mov-monto') as HTMLInputElement;
        
        const fecha = fechaInput?.value;
        const hora = horaInput?.value;
        const descripcion = descripcionInput?.value || '';
        const referencia = referenciaInput?.value || '';
        const monto = Number(montoInput?.value || 0);

        if (!fecha) {
          Swal.showValidationMessage('La fecha es obligatoria');
          return null;
        }
        
        if (!hora) {
          Swal.showValidationMessage('La hora es obligatoria');
          return null;
        }
        
        if (!descripcion.trim()) {
          Swal.showValidationMessage('La descripción es obligatoria');
          return null;
        }
        
        if (monto <= 0) {
          Swal.showValidationMessage('El monto debe ser mayor a 0');
          return null;
        }

        // Combinar fecha y hora
        const [hours, minutes, seconds] = hora.split(':').map(Number);
        const fechaCompleta = new Date(fecha + 'T00:00:00');
        fechaCompleta.setHours(hours, minutes, seconds || 0);

        return {
          fecha: fechaCompleta,
          descripcion: descripcion.trim(),
          referencia: referencia.trim(),
          monto
        };
      }
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    try {
      await this.cajaBancoService.actualizarMovimientoEnUltimaCaja(this.cajaId, mov.id, result.value);
      await Swal.fire({
        icon: 'success',
        title: 'Movimiento actualizado',
        timer: 1500,
        showConfirmButton: false
      });
      this.cargarDatos();
    } catch (error: any) {
      console.error('Error al editar movimiento:', error);
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo editar',
        text: error?.message || 'Error desconocido'
      });
    }
  }

  async eliminarMovimiento(mov: MovimientoCajaBanco): Promise<void> {
    if (!this.puedeEditarMovimientos || !this.cajaId || !mov.id) {
      await Swal.fire({
        icon: 'warning',
        title: 'Accion no permitida',
        text: 'Solo el administrador puede eliminar movimientos en la ultima caja abierta.'
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar movimiento',
      text: 'Esta accion no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await this.cajaBancoService.eliminarMovimientoEnUltimaCaja(this.cajaId, mov.id);
      await Swal.fire({
        icon: 'success',
        title: 'Movimiento eliminado',
        timer: 1500,
        showConfirmButton: false
      });
      this.cargarDatos();
    } catch (error: any) {
      console.error('Error al eliminar movimiento:', error);
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: error?.message || 'Error desconocido'
      });
    }
  }

  /**
   * Carga las cajas chicas cerradas del mismo mes/año que la caja banco.
   *
   * Filtra cajas chicas que estén CERRADAS y en el mismo período
   * (no solo el mismo día, sino de todo el mes).
   */
  cargarCajasChicas(): void {
    if (!this.caja?.fecha) return;
    const fecha = this.caja.fecha instanceof Date ? this.caja.fecha : (this.caja.fecha as any).toDate?.() || new Date(this.caja.fecha);

    // Obtener todas las cajas chicas cerradas del mes de la caja banco
    const year = fecha.getFullYear();
    const mes = fecha.getMonth();

    this.cajaChicaService.getCajasChicasPorMes(year, mes).subscribe(todas => {
      // Filtrar solo las cajas chicas CERRADAS del MISMO MES Y AÑO de la caja banco
      // (NO solo del mismo día, sino de todo el período de mes)
      this.cajasChicas = (todas || []).filter(cc => {
        if (cc.estado !== 'CERRADA') return false;
        const cajaDia = new Date(cc.fecha instanceof Date ? cc.fecha : (cc.fecha as any).toDate?.() || new Date(cc.fecha));
        // Comparar año y mes, pero NO el día
        return cajaDia.getFullYear() === year && cajaDia.getMonth() === mes;
      });
      // Recalcular resumen cuando se cargan las cajas chicas
      this.calcularResumen();
    });
  }

  /**
   * Calcula el resumen financiero de la caja.
   *
   * Desglose:
   * - Ingresos cajas chicas: suma de montos_actual de cajas chicas cerradas
   * - Ingresos otros: suma de movimientos de tipo INGRESO
   * - Total ingresos: suma de ambos
   * - Total egresos: suma de movimientos de tipo EGRESO
   */
  calcularResumen(): void {
    // Acumular en centavos enteros para eliminar error de punto flotante
    const sumCents = (items: any[], valueFn: (i: any) => number) =>
      items.reduce((sum, i) => sum + Math.round(valueFn(i) * 100), 0) / 100;

    // 1. Ingresos de cajas chicas: desde monto_actual de la sub-colección
    this.resumen.ingresos_cajas_chicas = sumCents(
      this.cajasChicas || [],
      cc => cc.monto_actual || 0
    );

    // 2. Otros ingresos: TODOS los movimientos INGRESO
    this.resumen.ingresos_otros = sumCents(
      (this.movimientos || []).filter(m => m.tipo === 'INGRESO'),
      m => m.monto || 0
    );

    // 3. Total ingresos y egresos
    this.resumen.total_ingresos =
      Math.round((this.resumen.ingresos_cajas_chicas + this.resumen.ingresos_otros) * 100) / 100;

    this.resumen.total_egresos = sumCents(
      (this.movimientos || []).filter(m => m.tipo === 'EGRESO'),
      m => m.monto || 0
    );
  }

  /**
   * Formatea una fecha con hora en formato DD/MM/YYYY, HH:MM.
   *
   * @param fecha - Timestamp de Firestore o Date
   * @returns {string} Fecha y hora formateadas
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
   * Formatea una fecha con hora para mostrar en la UI.
   *
   * @param fecha - Objeto Date, Firestore Timestamp o string
   * @returns {string} Fecha y hora formateadas
   */
  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Formatea un monto como moneda USD.
   *
   * @param monto - Valor numérico a formatear
   * @returns {string} Monto formateado
   */
  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  /**
   * Obtiene el nombre del mes de la caja actual.
   *
   * @returns {string} Nombre del mes en español
   */
  obtenerNombreMes(): string {
    if (!this.caja) return '';
    const fecha = (this.caja.fecha as any)?.toDate ? (this.caja.fecha as any).toDate() : new Date(this.caja.fecha);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[fecha.getMonth()];
  }

  /**
   * Obtiene el año de la caja actual.
   *
   * @returns {number} Año de la caja
   */
  obtenerAnio(): number {
    if (!this.caja) return new Date().getFullYear();
    const fecha = (this.caja.fecha as any)?.toDate ? (this.caja.fecha as any).toDate() : new Date(this.caja.fecha);
    return fecha.getFullYear();
  }

  /**
   * Navega de vuelta a la lista de cajas banco.
   */
  volver(): void {
    this.router.navigate(['/caja-banco']);
  }

  /**
   * Navega a la página de registro de movimiento para esta caja específica.
   * Pasa el ID de la caja tanto en estado como en sessionStorage.
   */
  registrarMovimiento(): void {
    // Guardar el ID en sessionStorage para que registrar-movimiento lo pueda recuperar
    sessionStorage.setItem('cajaBancoIdActual', this.cajaId);
    this.router.navigate(['/caja-banco/registrar-movimiento'], {
      state: { cajaId: this.cajaId },
      queryParams: { returnTo: this.router.url }
    });
  }

  /**
   * Cierra la caja banco actual.
   * Muestra confirmación antes de proceder.
   */
  async cerrarCaja(): Promise<void> {
    if (!this.caja || this.caja.estado !== 'ABIERTA') {
      return;
    }

    // ✅ VALIDAR QUE NO HAYA CAJAS CHICAS ABIERTAS
    try {
      const cajaChicaAbierta = await this.cajaChicaService.getCajaAbierta();
      
      if (cajaChicaAbierta) {
        // Formatear fecha de la caja chica abierta
        let fechaCajaChica: Date;
        if ((cajaChicaAbierta.fecha as any)?.toDate) {
          fechaCajaChica = (cajaChicaAbierta.fecha as any).toDate();
        } else if (cajaChicaAbierta.fecha instanceof Date) {
          fechaCajaChica = cajaChicaAbierta.fecha;
        } else {
          fechaCajaChica = new Date(cajaChicaAbierta.fecha);
        }
        
        const fechaFormateada = fechaCajaChica.toLocaleDateString('es-ES', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });
        
        await Swal.fire({
          icon: 'warning',
          title: 'Caja Chica Abierta',
          html: `
            <p>No se puede cerrar la caja banco porque hay una caja chica abierta.</p>
            <p style="margin-top: 1rem;">
              <strong>Caja Chica:</strong> ${fechaFormateada}<br>
              <strong>Saldo:</strong> ${this.formatoMoneda(cajaChicaAbierta.monto_actual)}
            </p>
            <p class="text-muted" style="font-size: 0.9rem; margin-top: 1rem;">
              Por favor, cierra primero la caja chica antes de cerrar la caja banco.
            </p>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#3085d6'
        });
        return;
      }
    } catch (error) {
      console.error('Error al verificar cajas chicas:', error);
    }

    const periodo = this.formatoFecha(this.caja.fecha);
    
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Cerrar Caja Banco?',
      html: `
        <p>Estás a punto de cerrar la caja banco de <strong>${periodo}</strong></p>
        <p>Saldo actual: <strong>${this.formatoMoneda(this.saldoActualCalculado)}</strong></p>
        <p class="text-muted" style="font-size: 0.9rem; margin-top: 1rem;">
          Una vez cerrada, no podrás registrar más movimientos en esta caja.
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, Cerrar Caja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (result.isConfirmed) {
      try {
        // Pasar el saldo calculado para que Firestore quede actualizado correctamente
        await this.cajaBancoService.cerrarCajaBanco(this.cajaId, this.saldoActualCalculado);
        
        await Swal.fire({
          icon: 'success',
          title: 'Caja Cerrada',
          text: 'La caja banco se cerró correctamente.',
          timer: 2000,
          showConfirmButton: false
        });

        // Recargar datos para actualizar el estado
        this.cargarDatos();
      } catch (error: any) {
        console.error('Error al cerrar caja:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Error al Cerrar',
          text: error?.message || 'No se pudo cerrar la caja banco. Intenta nuevamente.'
        });
      }
    }
  }

  /**
   * Navega a la página de detalles de una caja chica.
   *
   * @param cajaChicaId - ID de la caja chica a visualizar
   */
  verCajaChica(cajaChicaId: string): void {
    // Redirigir a ver-caja de caja chica
    this.router.navigate(['/caja-chica/ver', cajaChicaId], {
      queryParams: { returnTo: this.router.url }
    });
  }

  /**
   * Genera e imprime un reporte de la caja actual.
   *
   * Incluye:
   * - Resumen financiero (saldo inicial/final, ingresos/egresos)
   * - Cajas chicas del día
   * - Detalle de movimientos
   *
   * Se abre en una nueva ventana para imprimir.
   */
  imprimirMensualActual(): void {
    if (!this.caja) {
      alert('No hay caja cargada');
      return;
    }

    // Imprimir solo la caja actual con sus movimientos
    const htmlReporte = this.generarReporteCajaActual(this.caja, this.movimientos, this.cajasChicas);
    const w = window.open('', 'PRINT_CAJA_ACTUAL', 'height=800,width=900');
    if (!w) return;

    w.document.write(htmlReporte);
    w.document.close();

    const triggerPrint = () => {
      w.focus();
      w.addEventListener('afterprint', () => w.close(), { once: true });
      w.print();
      setTimeout(() => w.close(), 3000);
    };

    if (w.document.readyState === 'complete') {
      setTimeout(triggerPrint, 150);
    } else {
      w.onload = () => setTimeout(triggerPrint, 150);
    }
  }

  /**
   * Genera el HTML para un reporte individual de caja.
   *
   * @param caja - Datos de la caja banco
   * @param movimientos - Movimientos asociados
   * @param cajasChicas - Cajas chicas del mismo período
   * @returns {string} HTML del reporte
   * @private
   */
  private generarReporteCajaActual(caja: CajaBanco, movimientos: MovimientoCajaBanco[], cajasChicas: CajaChica[]): string {
    const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const fechaCaja = caja.fecha instanceof Date ? caja.fecha : (caja.fecha as any).toDate?.() || new Date(caja.fecha);
    const mesIndex = fechaCaja.getMonth();
    const year = fechaCaja.getFullYear();

    const sumCentsRpt = (items: any[], valueFn: (i: any) => number) =>
      items.reduce((sum, i) => sum + Math.round(valueFn(i) * 100), 0) / 100;

    // Ingresos de cajas chicas: suma de monto_actual de la sub-colección
    const ingresosCajasChicas = sumCentsRpt(cajasChicas, cc => cc.monto_actual || 0);
    // Otros ingresos: TODOS los movimientos INGRESO
    const ingresosOtros = sumCentsRpt(movimientos.filter(m => m.tipo === 'INGRESO'), m => m.monto || 0);
    // Total de ingresos
    const totalIngresos = Math.round((ingresosCajasChicas + ingresosOtros) * 100) / 100;
    const totalEgresos = sumCentsRpt(movimientos.filter(m => m.tipo === 'EGRESO'), m => m.monto || 0);
    // Saldo Final = Saldo Inicial + Total Ingresos - Total Egresos
    const saldoFinal = Math.round(((caja.saldo_inicial || 0) + totalIngresos - totalEgresos) * 100) / 100;

    const filasMovimientos = movimientos.map((mov: any) => `
      <tr>
        <td>${this.formatoFecha(mov.fecha)}</td>
        <td class="text-center ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo}</td>
        <td>${mov.categoria || '-'}</td>
        <td>${mov.descripcion}</td>
        <td class="text-right ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo === 'INGRESO' ? '+' : '-'}${this.formatoMoneda(mov.monto)}</td>
      </tr>
    `).join('');

    const filasCajasChicas = cajasChicas.map((cc: any) => `
      <tr>
        <td>${this.formatoFecha(cc.fecha)}</td>
        <td>${cc.usuario_nombre || '-'}</td>
        <td class="text-right">${this.formatoMoneda(cc.monto_inicial || 0)}</td>
        <td class="text-right">${this.formatoMoneda(cc.monto_actual || 0)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte Caja Banco - ${nombreMes[mesIndex]} ${year}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #333; background: #fff; padding: 20px; }
          .reporte-container { max-width: 900px; margin: 0 auto; background: white; }
          .reporte-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .reporte-header h1 { font-size: 18px; margin-bottom: 5px; font-weight: bold; }
          .reporte-header h2 { font-size: 14px; margin-bottom: 8px; font-weight: normal; }
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
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .reporte-firma { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 20px; }
          .reporte-firma-item { flex: 1; text-align: center; font-size: 10px; }
          .reporte-firma-item .linea { width: 80%; height: 1px; background: #000; margin: 30px auto 5px; }
          .reporte-footer { text-align: center; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; font-size: 9px; color: #999; }
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
            <h2>REPORTE CAJA BANCO</h2>
            <div class="fecha-reporte">PERIODO ${nombreMes[mesIndex].toUpperCase()} ${year}</div>
          </div>

          <div class="reporte-resumen">
            <h3>RESUMEN FINANCIERO</h3>
            <div class="reporte-resumen-item">
              <span>Saldo Inicial:</span>
              <span>${this.formatoMoneda(caja.saldo_inicial || 0)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Ingresos Cajas Chicas:</span>
              <span class="tipo-ingreso">+${this.formatoMoneda(ingresosCajasChicas)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Otros Ingresos:</span>
              <span class="tipo-ingreso">+${this.formatoMoneda(ingresosOtros)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Total Ingresos:</span>
              <span class="tipo-ingreso">+${this.formatoMoneda(totalIngresos)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Total Egresos:</span>
              <span class="tipo-egreso">-${this.formatoMoneda(totalEgresos)}</span>
            </div>
            <div class="reporte-resumen-item total-final">
              <span>SALDO FINAL:</span>
              <span>${this.formatoMoneda(saldoFinal)}</span>
            </div>
          </div>

          ${cajasChicas.length > 0 ? `
          <div class="reporte-section">
            <h3>CAJAS CHICAS DEL DÍA</h3>
            <table class="reporte-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th class="text-right">Saldo Inicial</th>
                  <th class="text-right">Saldo Actual</th>
                </tr>
              </thead>
              <tbody>
                ${filasCajasChicas}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${movimientos.length > 0 ? `
          <div class="reporte-section">
            <h3>MOVIMIENTOS</h3>
            <table class="reporte-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th class="text-center">Tipo</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th class="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                ${filasMovimientos}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="reporte-firma">
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Responsable de Caja</div>
            </div>
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Administrador</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
