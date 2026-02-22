/**
 * 🚀 OPTIMIZADO: Componente para ver detalles de caja chica con lazy loading.
 *
 * Propósito:
 * Visualizar y gestionar detalles de una caja chica específica con carga eficiente
 * de movimientos bajo demanda.
 *
 * ✅ OPTIMIZACIONES APLICADAS:
 * - ✔ NO precarga movimientos automáticamente
 * - ✔ Carga movimientos SOLO al expandir sección
 * - ✔ Paginación real para movimientos
 * - ✔ Botón "Cargar más" para movimientos
 * - ✔ Gestión de memoria eficiente
 * - ✔ Reduce lecturas Firestore masivas
 *
 * Funcionalidades:
 * - Mostrar información general de la caja
 * - Cargar movimientos bajo demanda (lazy loading)
 * - Paginación de movimientos (20 por página)
 * - Registrar nuevos movimientos
 * - Cerrar caja e integrar con caja banco
 * - Eliminar movimientos (solo si caja abierta)
 * - Generar reportes de cierre
 *
 * @component VerCajaComponent
 * @standalone false
 * @module CajaChicaModule
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FacturasService } from '../../../../core/services/facturas';
import { ProductosService } from '../../../../core/services/productos';
import { CajaChica, MovimientoCajaChica, ResumenCajaChica } from '../../../../core/models/caja-chica.model';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ver-caja',
  standalone: false,
  templateUrl: './ver-caja.html',
  styleUrls: ['./ver-caja.css']
})
export class VerCajaComponent implements OnInit, OnDestroy {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);
  private facturasSrv = inject(FacturasService);
  private productosSrv = inject(ProductosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions = new Subscription();

  cajaId: string = '';
  caja: CajaChica | null = null;
  returnTo = '';
  
  // 📄 Movimientos con paginación (navegación anterior/siguiente)
  movimientos: MovimientoCajaChica[] = [];
  movimientosCargados = false; // Flag para lazy loading
  mostrarMovimientos = true; // Flag para expandir/contraer sección (por defecto visible)
  mostrarDetallesCaja = false; // Flag para expandir/contraer detalles de la caja
  
  // Control de paginación
  paginaActualMovimientos = 1;
  pageSize = 20;
  lastVisibleMovimiento: QueryDocumentSnapshot<DocumentData> | null = null;
  firstVisibleMovimiento: QueryDocumentSnapshot<DocumentData> | null = null;
  hasMoreMovimientos = false;
  cargandoMovimientos = false;

  // Historial de páginas
  paginasHistorialMovimientos: Array<{
    firstDoc: QueryDocumentSnapshot<DocumentData> | null;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    pageNumber: number;
  }> = [];
  
  // ─── Filtros de movimientos ───────────────────────────────────────────
  filtroBusqueda: string = '';
  filtroTipoMov: string = 'TODOS';
  filtroUsuarioMov: string = '';
  filtroFechaMovDesde: string = '';
  filtroFechaMovHasta: string = '';
  filtroMontoMin: number | null = null;
  filtroMontoMax: number | null = null;
  mostrarFiltrosMov: boolean = false;
  
  resumen: ResumenCajaChica | null = null;
  cargando = false;
  error = '';
  esAdmin = false;

  // ══════════════════════════════════════════════════════════════════════════
  // 🎯 MÉTRICAS CALCULADAS
  // ══════════════════════════════════════════════════════════════════════════

  /** Métricas globales para mostrar en la parte superior */
  get metricasGlobales(): Array<{titulo: string; valor: string; subtitulo?: string; icono?: string}> {
    if (!this.movimientos || this.movimientos.length === 0) {
      return [
        { titulo: 'Total Ingresos', valor: this.formatoMoneda(0), subtitulo: '0 movimientos', icono: 'money' },
        { titulo: 'Total Egresos', valor: this.formatoMoneda(0), subtitulo: '0 movimientos', icono: 'money' },
        { titulo: 'Balance Neto', valor: this.formatoMoneda(0), icono: 'chart' },
        { titulo: 'Movimientos', valor: '0', subtitulo: 'Sin movimientos', icono: 'alert' }
      ];
    }

    const ingresos = this.movimientos.filter(m => m.tipo === 'INGRESO');
    const egresos = this.movimientos.filter(m => m.tipo === 'EGRESO');
    const totalIngresos = ingresos.reduce((sum, m) => sum + (m.monto || 0), 0);
    const totalEgresos = egresos.reduce((sum, m) => sum + (m.monto || 0), 0);
    const balance = totalIngresos - totalEgresos;
    const promedio = this.movimientos.length > 0 ? (totalIngresos + totalEgresos) / this.movimientos.length : 0;

    return [
      { 
        titulo: 'Total Ingresos', 
        valor: this.formatoMoneda(totalIngresos), 
        subtitulo: `${ingresos.length} ingreso${ingresos.length !== 1 ? 's' : ''}`,
        icono: 'money'
      },
      { 
        titulo: 'Total Egresos', 
        valor: this.formatoMoneda(totalEgresos), 
        subtitulo: `${egresos.length} egreso${egresos.length !== 1 ? 's' : ''}`,
        icono: 'money'
      },
      { 
        titulo: 'Balance Neto', 
        valor: this.formatoMoneda(balance),
        subtitulo: balance >= 0 ? 'Positivo' : 'Negativo',
        icono: 'chart'
      },
      { 
        titulo: 'Promedio por Movimiento', 
        valor: this.formatoMoneda(promedio),
        subtitulo: `de ${this.movimientos.length} movimiento${this.movimientos.length !== 1 ? 's' : ''}`,
        icono: 'trophy'
      }
    ];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🔍 FILTROS Y ANÁLISIS
  // ══════════════════════════════════════════════════════════════════════════

  /** Movimientos filtrados según los criterios activos */
  get movimientosFiltrados(): MovimientoCajaChica[] {
    let result = [...this.movimientos];

    // Búsqueda rápida (descripción, comprobante, monto, usuario)
    if (this.filtroBusqueda.trim()) {
      const q = this.filtroBusqueda.toLowerCase().trim();
      result = result.filter(m =>
        (m.descripcion || '').toLowerCase().includes(q) ||
        (m.comprobante || '').toLowerCase().includes(q) ||
        String(m.monto ?? '').includes(q) ||
        (m.usuario_nombre || '').toLowerCase().includes(q)
      );
    }

    if (this.filtroTipoMov !== 'TODOS') {
      result = result.filter(m => m.tipo === this.filtroTipoMov);
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
    if (this.filtroUsuarioMov.trim()) chips.push({ label: 'Usuario: ' + this.filtroUsuarioMov, key: 'usuario' });
    if (this.filtroMontoMin !== null) chips.push({ label: 'Monto mín: $' + this.filtroMontoMin, key: 'minMonto' });
    if (this.filtroMontoMax !== null) chips.push({ label: 'Monto máx: $' + this.filtroMontoMax, key: 'maxMonto' });
    return chips;
  }

  /** Resumen filtrado (ingresos, egresos, balance) */
  get resumenFiltrado(): { ingresos: number; egresos: number; balance: number } {
    const movs = this.movimientos; // Usar todos para resumen fijo
    const ingresos = movs.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + (m.monto || 0), 0);
    const egresos = movs.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + (m.monto || 0), 0);
    return { ingresos, egresos, balance: ingresos - egresos };
  }

  /** Quita un chip de filtro puntual */
  quitarChip(key: string): void {
    switch (key) {
      case 'desde':    this.filtroFechaMovDesde = ''; break;
      case 'hasta':    this.filtroFechaMovHasta = ''; break;
      case 'tipo':     this.filtroTipoMov = 'TODOS'; break;
      case 'usuario':  this.filtroUsuarioMov = ''; break;
      case 'minMonto': this.filtroMontoMin = null; break;
      case 'maxMonto': this.filtroMontoMax = null; break;
    }
  }

  /** Limpia todos los filtros de movimientos */
  limpiarFiltrosMov(): void {
    this.filtroBusqueda = '';
    this.filtroTipoMov = 'TODOS';
    this.filtroUsuarioMov = '';
    this.filtroFechaMovDesde = '';
    this.filtroFechaMovHasta = '';
    this.filtroMontoMin = null;
    this.filtroMontoMax = null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 📊 ANÁLISIS POR CATEGORÍAS INFERIDAS (SIN MODIFICAR BD)
  // ══════════════════════════════════════════════════════════════════════════

  /** Clasifica un movimiento según palabras clave en su descripción */
  clasificarMovimiento(movimiento: MovimientoCajaChica): 'VENTA' | 'PAGO_DEUDA' | 'GASTO' | 'OTRO' {
    const desc = (movimiento.descripcion || '').toLowerCase();
    
    if (desc.includes('venta') || desc.includes('factura')) {
      return 'VENTA';
    }
    
    if (desc.includes('deuda') || desc.includes('cobro') || desc.includes('abono')) {
      return 'PAGO_DEUDA';
    }
    
    if (movimiento.tipo === 'EGRESO') {
      return 'GASTO';
    }
    
    return 'OTRO';
  }

  /** Distribución de movimientos por categoría inferida */
  get distribucionCategorias(): Array<{categoria: string; cantidad: number; monto: number; porcentaje: number}> {
    const total = this.movimientos.length;
    if (total === 0) return [];

    const categorias = new Map<string, {cantidad: number; monto: number}>();
    
    this.movimientos.forEach(m => {
      const cat = this.clasificarMovimiento(m);
      const actual = categorias.get(cat) || { cantidad: 0, monto: 0 };
      categorias.set(cat, {
        cantidad: actual.cantidad + 1,
        monto: actual.monto + (m.monto || 0)
      });
    });

    const result = Array.from(categorias.entries()).map(([cat, data]) => ({
      categoria: cat,
      cantidad: data.cantidad,
      monto: data.monto,
      porcentaje: Math.round((data.cantidad / total) * 100)
    }));

    // Ordenar por cantidad (mayor a menor)
    return result.sort((a, b) => b.cantidad - a.cantidad);
  }

  /** Etiqueta legible para categoría inferida */
  labelCategoriaInferida(cat: string): string {
    const labels: Record<string, string> = {
      'VENTA': '💰 Ventas',
      'PAGO_DEUDA': '💳 Cobros de Deuda',
      'GASTO': '💸 Gastos',
      'OTRO': '📋 Otros'
    };
    return labels[cat] || cat;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️ INDICADORES DE CONTROL (NO BLOQUEAN, SOLO INFORMAN)
  // ══════════════════════════════════════════════════════════════════════════

  /** Movimientos sin descripción/observación */
  get movimientosSinDescripcion(): MovimientoCajaChica[] {
    return this.movimientos.filter(m => !m.descripcion || m.descripcion.trim() === '');
  }

  /** Comprobantes duplicados (mismo comprobante en múltiples movimientos) */
  get comprobantesDuplicados(): Array<{comprobante: string; cantidad: number}> {
    const comprobantes = new Map<string, number>();
    
    this.movimientos.forEach(m => {
      if (m.comprobante && m.comprobante.trim()) {
        const count = comprobantes.get(m.comprobante) || 0;
        comprobantes.set(m.comprobante, count + 1);
      }
    });

    return Array.from(comprobantes.entries())
      .filter(([_, count]) => count > 1)
      .map(([comprobante, cantidad]) => ({ comprobante, cantidad }));
  }

  /** Saltos inconsistentes de saldo (diferencia > monto movimiento - tolerancia de error) */
  get saltosInconsistentes(): MovimientoCajaChica[] {
    const inconsistentes: MovimientoCajaChica[] = [];
    
    for (let i = 1; i < this.movimientos.length; i++) {
      const anterior = this.movimientos[i - 1];
      const actual = this.movimientos[i];
      
      const saldoEsperado = anterior.saldo_nuevo;
      const saldoReal = actual.saldo_anterior;
      
      // Tolerancia de 0.01 para errores de redondeo
      if (saldoEsperado !== undefined && saldoReal !== undefined && Math.abs(saldoEsperado - saldoReal) > 0.01) {
        inconsistentes.push(actual);
      }
    }
    
    return inconsistentes;
  }

  /** True si hay al menos un indicador de control activo */
  get hayAlertasControl(): boolean {
    return this.movimientosSinDescripcion.length > 0 ||
           this.comprobantesDuplicados.length > 0 ||
           this.saltosInconsistentes.length > 0;
  }

  ngOnInit(): void {
    this.cajaId = this.route.snapshot.paramMap.get('id') || '';
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '';
    this.esAdmin = this.authService.isAdmin();
    this.cargarDetallesCaja();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // Liberar memoria
    this.movimientos = [];
    this.paginasHistorialMovimientos = [];
    this.caja = null;
    this.resumen = null;
    this.lastVisibleMovimiento = null;
    this.firstVisibleMovimiento = null;
  }

  /**
   * 🚀 OPTIMIZADO: Carga SOLO la información básica de la caja.
   * 📌 ACTUALIZADO: Ahora carga movimientos automáticamente para mostrar métricas.
   */
  cargarDetallesCaja(): void {
    if (!this.cajaId) return;

    this.cargando = true;
    this.error = '';

    // Solo cargar información de la caja
    const sub = this.cajaChicaService.getCajaChicaById(this.cajaId).subscribe({
      next: async (caja) => {
        this.caja = caja;
        this.cargando = false;
        
        // Cargar movimientos automáticamente
        if (!this.movimientosCargados) {
          await this.cargarMovimientosPaginados();
          this.movimientosCargados = true;
        }
      },
      error: (error) => {
        console.error('Error al cargar caja:', error);
        this.error = 'Error al cargar la caja chica';
        this.cargando = false;
      }
    });

    this.subscriptions.add(sub);

    // Cargar resumen (es ligero, solo totales)
    this.cargarResumen();
  }

  /**
   * Carga el resumen financiero (totales).
   */
  async cargarResumen(): Promise<void> {
    try {
      this.resumen = await this.cajaChicaService.getResumenCajaChica(this.cajaId);
    } catch (error) {
      console.error('Error al cargar resumen:', error);
    }
  }

  /**
   * 📄 Toggle para expandir/contraer la sección de movimientos.
   */
  async toggleMovimientos(): Promise<void> {
    this.mostrarMovimientos = !this.mostrarMovimientos;
  }

  /**
   * 🚀 Carga inicial de movimientos con paginación.
   */
  async cargarMovimientosPaginados(): Promise<void> {
    // Resetear estado
    this.movimientos = [];
    this.paginaActualMovimientos = 1;
    this.paginasHistorialMovimientos = [];
    this.lastVisibleMovimiento = null;
    this.firstVisibleMovimiento = null;
    this.hasMoreMovimientos = false;

    this.cargandoMovimientos = true;

    try {
      const resultado = await this.cajaChicaService.getMovimientosPaginados(
        this.cajaId,
        { pageSize: this.pageSize }
      );

      this.movimientos = resultado.movimientos;
      this.lastVisibleMovimiento = resultado.lastVisible;
      this.firstVisibleMovimiento = resultado.movimientos.length > 0 ? resultado.lastVisible : null;
      this.hasMoreMovimientos = resultado.hasMore;

      // Guardar primera página en historial
      if (this.movimientos.length > 0) {
        this.paginasHistorialMovimientos.push({
          firstDoc: null,
          lastDoc: this.lastVisibleMovimiento,
          pageNumber: 1
        });
      }

    } catch (error) {
      console.error('❌ Error al cargar movimientos:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los movimientos',
        timer: 3000
      });
    } finally {
      this.cargandoMovimientos = false;
    }
  }

  /**
   * 📄 Navega a la página siguiente de movimientos.
   */
  async paginaSiguienteMovimientos(): Promise<void> {
    if (!this.hasMoreMovimientos || this.cargandoMovimientos) return;

    this.cargandoMovimientos = true;

    try {
      const resultado = await this.cajaChicaService.getMovimientosPaginados(
        this.cajaId,
        {
          pageSize: this.pageSize,
          lastVisible: this.lastVisibleMovimiento || undefined
        }
      );

      this.movimientos = resultado.movimientos;
      this.lastVisibleMovimiento = resultado.lastVisible;
      this.firstVisibleMovimiento = resultado.movimientos.length > 0 ? resultado.lastVisible : null;
      this.hasMoreMovimientos = resultado.hasMore;
      this.paginaActualMovimientos++;

      // Guardar en historial
      if (this.movimientos.length > 0) {
        this.paginasHistorialMovimientos.push({
          firstDoc: this.firstVisibleMovimiento,
          lastDoc: this.lastVisibleMovimiento,
          pageNumber: this.paginaActualMovimientos
        });
      }

    } catch (error) {
      console.error('❌ Error al cargar siguiente página:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la página siguiente',
        timer: 3000
      });
    } finally {
      this.cargandoMovimientos = false;
    }
  }

  /**
   * 📄 Navega a la página anterior de movimientos.
   */
  async paginaAnteriorMovimientos(): Promise<void> {
    if (this.paginaActualMovimientos <= 1 || this.cargandoMovimientos) return;

    this.cargandoMovimientos = true;

    try {
      // Eliminar la página actual del historial
      this.paginasHistorialMovimientos.pop();
      this.paginaActualMovimientos--;

      // Obtener la página anterior
      const paginaAnterior = this.paginasHistorialMovimientos[this.paginasHistorialMovimientos.length - 1];

      if (!paginaAnterior || paginaAnterior.pageNumber === 1) {
        // Si es la primera página, recargarla
        await this.cargarMovimientosPaginados();
        return;
      }

      // Cargar desde el snapshot del historial
      const resultado = await this.cajaChicaService.getMovimientosPaginados(
        this.cajaId,
        {
          pageSize: this.pageSize,
          lastVisible: this.paginasHistorialMovimientos[this.paginasHistorialMovimientos.length - 2]?.lastDoc || undefined
        }
      );

      this.movimientos = resultado.movimientos;
      this.lastVisibleMovimiento = paginaAnterior.lastDoc;
      this.firstVisibleMovimiento = paginaAnterior.firstDoc;
      this.hasMoreMovimientos = true;

    } catch (error) {
      console.error('❌ Error al cargar página anterior:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la página anterior',
        timer: 3000
      });
    } finally {
      this.cargandoMovimientos = false;
    }
  }

  /**
   * 📄 Navega a la primera página de movimientos.
   */
  async irPrimeraPaginaMovimientos(): Promise<void> {
    if (this.paginaActualMovimientos === 1 || this.cargandoMovimientos) return;
    await this.cargarMovimientosPaginados();
  }

  /**
   * Navega al formulario de registro de movimiento.
   */
  registrarMovimiento(): void {
    this.router.navigate(['/caja-chica/registrar', this.cajaId]);
  }

  /**
   * Cierra la caja chica e integra el saldo con caja banco.
   */
  async cerrarCaja(): Promise<void> {
    const confirmar = await Swal.fire({
      icon: 'question',
      title: 'Cerrar Caja Chica',
      text: 'El saldo será sumado a Caja Banco. ¿Deseas continuar?',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmar.isConfirmed) return;

    try {
      const montoActual = this.caja?.monto_actual || 0;

      await this.cajaChicaService.cerrarCajaChica(this.cajaId, montoActual);
      localStorage.removeItem('cajaChicaAbierta');

      const imprimirResult = await Swal.fire({
        icon: 'success',
        title: 'Caja cerrada correctamente',
        text: 'Saldo sumado a Caja Banco exitosamente. ¿Deseas imprimir el reporte de cierre?',
        showCancelButton: true,
        confirmButtonText: 'Sí, imprimir',
        cancelButtonText: 'No, solo cerrar'
      });

      if (imprimirResult.isConfirmed) {
        await this.imprimirReporteCierre();
      }

      this.router.navigate(['/caja-chica']);
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al cerrar',
        text: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * Elimina un movimiento de la caja chica.
   */
  async eliminarMovimiento(movimientoId: string): Promise<void> {
    // ✅ Validar que la caja esté abierta
    if (this.caja?.estado === 'CERRADA') {
      Swal.fire({
        icon: 'error',
        title: 'Caja Cerrada',
        text: 'No se pueden eliminar movimientos de una caja cerrada.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Buscar el movimiento para obtener el comprobante (facturaId)
    const movimiento = this.movimientos.find(m => m.id === movimientoId);
    
    const confirmar = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar movimiento',
      html: `
        <div style="text-align: left;">
          <p>Esta acción eliminará:</p>
          <ul>
            <li>El movimiento de caja</li>
            ${movimiento?.comprobante ? '<li>La factura asociada #' + movimiento.comprobante + '</li><li>Revertirá el stock de productos</li>' : ''}
          </ul>
          <p style="color: red; margin-top: 10px;"><strong>⚠️ Esta acción no se puede deshacer.</strong></p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#d33',
      cancelButtonText: 'Cancelar'
    });
    
    if (!confirmar.isConfirmed) return;

    try {
      // Verificar si es un movimiento de venta (no de cobro de deuda)
      const esMovimientoDeVenta = movimiento?.descripcion?.startsWith('Venta #');
      let facturaEliminada = false;
      
      // 1️⃣ Si hay factura asociada Y es movimiento de venta, eliminarla y revertir stock
      if (movimiento?.comprobante && esMovimientoDeVenta) {
        const facturaId = movimiento.comprobante;
        console.log('🔄 Buscando factura asociada (movimiento de venta):', facturaId);
        
        try {
          // Buscar la factura
          const factura = await firstValueFrom(this.facturasSrv.getFacturaById(facturaId));
          
          if (factura) {
            console.log('🔄 Revirtiendo stock de productos...');
            
            // Revertir stock de cada producto
            for (const item of factura.items || []) {
              if (item.esServicio) {
                console.log(`⏭️ Saltando servicio: "${item.nombre}"`);
                continue;
              }
              
              if (item.productoId && item.cantidad > 0) {
                try {
                  await this.productosSrv.incrementarStock(item.productoId, item.cantidad);
                  console.log(`✅ Stock restaurado: ${item.nombre} (+${item.cantidad})`);
                } catch (error) {
                  console.error(`Error restaurando stock de "${item.nombre}":`, error);
                }
              }
            }
            
            // Eliminar factura
            console.log('🔄 Eliminando factura...');
            if (factura.id) {
              await this.facturasSrv.eliminarFactura(factura.id);
              console.log('✅ Factura eliminada');
              facturaEliminada = true;
            }
          }
        } catch (error) {
          console.error('Error procesando factura:', error);
          // Continuar con la eliminación del movimiento aunque falle la factura
        }
      } else if (movimiento?.comprobante && !esMovimientoDeVenta) {
        console.log('⚠️ Movimiento de cobro de deuda - Restando del abonado de la factura');
        
        // Para cobros de deuda, restar el monto del campo abonado de la factura
        try {
          const facturaId = movimiento.comprobante;
          const factura = await firstValueFrom(this.facturasSrv.getFacturaById(facturaId));
          
          if (factura && factura.id) {
            const nuevoAbonado = (factura.abonado || 0) - movimiento.monto;
            const nuevoSaldoPendiente = (factura.total || 0) - nuevoAbonado;
            
            // Preparar datos de actualización
            const datosActualizacion: any = {
              abonado: nuevoAbonado >= 0 ? nuevoAbonado : 0,
              saldoPendiente: nuevoSaldoPendiente >= 0 ? nuevoSaldoPendiente : 0
            };
            
            // Si hay saldo pendiente, cambiar estado de pago a PENDIENTE
            if (nuevoSaldoPendiente > 0) {
              datosActualizacion.estadoPago = 'PENDIENTE';
              
              // Si es crédito, cambiar a ACTIVO
              if (factura.esCredito || factura.tipoVenta === 'CREDITO') {
                datosActualizacion.estadoCredito = 'ACTIVO';
              }
            }
            
            await this.facturasSrv.actualizarFactura(factura.id, datosActualizacion);
            console.log(`✅ Abonado actualizado: ${factura.abonado} → ${nuevoAbonado}`);
            console.log(`✅ Saldo pendiente actualizado: ${factura.saldoPendiente} → ${nuevoSaldoPendiente}`);
            if (nuevoSaldoPendiente > 0) {
              console.log(`✅ Estado pago: PAGADA → PENDIENTE`);
              if (factura.esCredito || factura.tipoVenta === 'CREDITO') {
                console.log(`✅ Estado crédito: CANCELADO → ACTIVO`);
              }
            }
          }
        } catch (error) {
          console.error('Error actualizando abonado de factura:', error);
          // Continuar con la eliminación del movimiento
        }
      }
      
      // 2️⃣ Eliminar el movimiento de caja chica
      console.log('🔄 Eliminando movimiento de caja...');
      await this.cajaChicaService.eliminarMovimiento(this.cajaId, movimientoId);
      
      await Swal.fire({
        icon: 'success',
        title: '✅ Eliminado',
        html: `
          <div style="text-align: left;">
            <p>✅ Movimiento eliminado</p>
            ${facturaEliminada ? '<p>✅ Factura eliminada</p><p>✅ Stock restaurado</p>' : ''}
          </div>
        `,
        timer: 2000,
        showConfirmButton: false
      });
      
      // Recargar datos después de eliminar
      await this.cargarResumen();
      
      // Si los movimientos están expandidos, recargarlos
      if (this.mostrarMovimientos) {
        await this.cargarMovimientosPaginados();
      }
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Error al eliminar el movimiento'
      });
    }
  }

  /**
   * Convierte y formatea una fecha de Firestore al formato local (DD/MM/YYYY).
   *
   * Maneja múltiples tipos de entrada:
   * - Timestamp de Firestore (tiene método toDate())
   * - Date nativa de JavaScript
   * - Cadena ISO o cualquier valor reconocible por new Date()
   *
   * Localización: Usa formato 'es-ES' para mostrar en español.
   * Si la fecha es null/undefined, retorna '-' para mejor UX.
   *
   * @param fecha Timestamp de Firestore, Date o valor que pueda parsearse a Date
   * @returns Fecha formateada "DD/MM/YYYY" o '-' si es inválida
   */
  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  /**
   * Extrae y formatea la hora de una fecha al formato local (HH:MM).
   *
   * Maneja los mismos tipos que formatoFecha(). Retorna '-' para valores inválidos.
   * Localización: Usa formato 'es-ES' con 24 horas.
   *
   * Uso común: Mostrar hora de creación de movimientos junto a la fecha.
   *
   * @param fecha Timestamp de Firestore, Date o valor parseble a Date
   * @returns Hora formateada "HH:MM" o '-' si es inválida
   */
  formatoHora(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Formatea un monto numérico como moneda USD en formato español.
   *
   * Utiliza Intl.NumberFormat con:
   * - style: 'currency' (incluye símbolo $)
   * - currency: 'USD'
   * - Localización: 'es-ES'
   *
   * Si el monto es undefined o null, usa 0 como fallback.
   * Ejemplo: 1234.56 → "$1.234,56" (en formato español)
   *
   * @param monto Cantidad numérica a formatear
   * @returns Monto formateado con símbolo USD y separadores locales
   */
  formatoMoneda(monto: number | undefined): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  /**
   * Formatea una fecha con hora en formato DD/MM/YYYY, HH:MM.
   *
   * @param fecha Timestamp de Firestore, Date o valor parseble a Date
   * @returns Fecha formateada "DD/MM/YYYY, HH:MM" o '-' si es inválida
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
   * Retorna la clase CSS Bootstrap para el badge de tipo de movimiento.
   *
   * Mapeo:
   * - 'INGRESO' → 'badge-success' (verde, para ingresos)
   * - Cualquier otro tipo → 'badge-warning' (naranja, para egresos)
   *
   * Uso: Se asigna directamente en template [ngClass]="getTipoBadgeClass(mov.tipo)"
   *
   * @param tipo Tipo de movimiento ('INGRESO', 'EGRESO', etc)
   * @returns Nombre de clase CSS Bootstrap para el badge
   */
  getTipoBadgeClass(tipo: string): string {
    return tipo === 'INGRESO' ? 'badge-success' : 'badge-warning';
  }

  /**
   * Navega de regreso a la lista de todas las cajas chicas.
   *
   * Ruta destino: '/caja-chica' (lista general)
   * Se ejecuta via Router.navigate()
   *
   * @returns void
   */
  volver(): void {
    if (this.returnTo) {
      this.router.navigateByUrl(this.returnTo);
      return;
    }

    this.router.navigate(['/caja-chica']);
  }

  /**
   * Genera e imprime un reporte detallado del cierre de la caja chica.
   *
   * Responsabilidades:
   * 1. Convierte Timestamps de Firestore a Date para evitar errores NG02100 en Angular
   * 2. Prepara datos de la caja, movimientos y resumen
   * 3. Genera HTML completo del reporte (via generarHTMLReporte)
   * 4. Abre ventana de impresión (via abrirVentanaImpresion)
   * 5. Captura errores y muestra alerta de error si falla
   *
   * Conversión de Timestamps:
   * - Si la fecha es null/undefined → retorna new Date()
   * - Si ya es Date → retorna sin cambios
   * - Si tiene método toDate() (Firestore Timestamp) → lo llama
   * - Fallback: new Date(fecha) para otros tipos
   *
   * Contenido del reporte:
   * - Encabezado con nombre de empresa y tipo de documento
   * - Información general (fechas, usuario, estado)
   * - Resumen financiero (montos iniciales, ingresos, egresos, saldo final)
   * - Tabla detallada de todos los movimientos
   * - Sección de observaciones (si existen)
   * - Área de firmas (responsable y supervisor)
   * - Footer con información del sistema
   *
   * @returns Promise<void>
   */
  async imprimirReporteCierre(): Promise<void> {
    try {
      // Convertir Timestamps a Date para evitar errores NG02100
      const convertirTimestamp = (fecha: any): Date => {
        if (!fecha) return new Date();
        if (fecha instanceof Date) return fecha;
        if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
        return new Date(fecha);
      };

      // Preparar datos para el reporte con conversión de Timestamps
      const caja = {
        ...this.caja,
        fecha: convertirTimestamp(this.caja?.fecha),
        cerrado_en: this.caja?.cerrado_en ? convertirTimestamp(this.caja.cerrado_en) : null,
        createdAt: this.caja?.createdAt ? convertirTimestamp(this.caja.createdAt) : new Date()
      };

      const movimientos = this.movimientos.map(m => ({
        ...m,
        fecha: convertirTimestamp(m.fecha),
        createdAt: m.createdAt ? convertirTimestamp(m.createdAt) : new Date()
      }));

      const resumen = { ...this.resumen };
      const fechaReporte = new Date();
      const usuarioCierre = this.authService.getCurrentUser()?.nombre || 'N/A';

      // Generar HTML del reporte
      const htmlReporte = this.generarHTMLReporte({
        caja,
        movimientos,
        resumen,
        fechaReporte,
        usuarioCierre
      });

      // Abrir ventana de impresión
      this.abrirVentanaImpresion(htmlReporte);
    } catch (error) {
      console.error('❌ Error al preparar reporte:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el reporte para impresión'
      });
    }
  }

  /**
   * Abre una ventana del navegador con el HTML del reporte e inicia impresión automática.
   *
   * Flujo:
   * 1. Abre nueva ventana con configuración específica (height=800,width=900)
   * 2. Si el bloqueador de ventanas emergentes impide la apertura, muestra alerta
   * 3. Escribe el contenido HTML en la ventana
   * 4. Cuando el documento está listo, dispara window.print()
   * 5. Cierra automáticamente la ventana después de imprimir (o timeout de 3 segundos)
   *
   * Seguridad de cierre:
   * - Variable `closed` evita cerrar múltiples veces
   * - Event listener 'afterprint' cierra cuando termina la impresión
   * - Timeout fallback de 3 segundos previene ventanas huérfanas
   *
   * Debugging:
   * - Log en consola: "✅ Reporte enviado a impresión"
   * - Helpers: w.focus() y setTimeout para timing de documentos lentos
   *
   * @param htmlReporte String HTML completo del reporte con estilos inline
   * @returns void (operación asincrónica con efectos secundarios visuales)
   */
  private abrirVentanaImpresion(htmlReporte: string): void {
    const w = window.open('', 'PRINT_CAJA_CHICA', 'height=800,width=900');
    if (!w) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir la ventana de impresión. Verifique los bloqueadores de ventanas emergentes.'
      });
      return;
    }

    w.document.write(htmlReporte);
    w.document.close();

    // Disparar impresión automáticamente cuando el contenido esté listo
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
        // Fallback: cerrar si afterprint no se dispara
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

    console.log('✅ Reporte enviado a impresión');
  }

  /**
   * Genera el HTML completo del reporte de cierre de caja chica listo para impresión.
   *
   * Estructura del documento HTML:
   * 1. Declaración DOCTYPE y meta tags (encoding, viewport)
   * 2. Estilos CSS internos (@media print para optimización de impresión)
   * 3. Body con estructura semántica:
   *    - Encabezado: Nombre de empresa y tipo de reporte
   *    - Información general: Fechas de apertura/cierre, usuario, estado
   *    - Resumen financiero: Cálculos y balances
   *    - Detalle de movimientos: Tabla con fila por movimiento
   *    - Observaciones (condicional)
   *    - Firmas: Espacios para responsable y supervisor
   *    - Footer: Información del sistema
   *
   * Funciones locales:
   * - formatoMoneda(): Convierte números a USD con localización es-CO
   * - formatoFecha(): Retorna "DD/MM/YYYY HH:MM" en localización es-CO
   * - formatoFechaSolo(): Retorna solo "DD/MM/YYYY"
   * - formatoHora(): Retorna solo "HH:MM"
   * - filasMovimientos: Mapea array de movimientos a <tr> HTML
   *
   * Estilos de impresión:
   * - Optimiza para papel A4 (max-width: 900px)
   * - Media query @media print elimina márgenes y fondo
   * - Evita saltos de página en tablas (page-break-inside: avoid)
   * - Colores diferenciados para ingresos (verde #28a745) y egresos (rojo #dc3545)
   *
   * Variables esperadas en `data`:
   * - data.caja: Objeto CajaChica con campos fecha, cerrado_en, usuario_nombre, estado, observacion, monto_inicial, monto_actual
   * - data.movimientos: Array de MovimientoCajaChica[] con campo tipo ('INGRESO'|'EGRESO')
   * - data.resumen: ResumenCajaChica con totales
   * - data.fechaReporte: Date para timestamp de impresión
   * - data.usuarioCierre: String con nombre del operador
   *
   * @param data Objeto con propiedades: caja, movimientos, resumen, fechaReporte, usuarioCierre
   * @returns String HTML listo para renderizar en ventana de impresión
   */
  private generarHTMLReporte(data: any): string {
    const formatoMoneda = (valor: number) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor);
    };

    const formatoFecha = (fecha: Date) => {
      return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(fecha));
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

    const filasMovimientos = data.movimientos.map((mov: any) => `
      <tr>
        <td>${formatoFechaSolo(mov.fecha)}<br><small>${formatoHora(mov.createdAt)}</small></td>
        <td class="text-center ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo}</td>
        <td>${mov.descripcion}</td>
        <td class="text-right ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo === 'INGRESO' ? '+' : '-'}${formatoMoneda(mov.monto)}</td>
        <td class="text-right">${formatoMoneda(mov.saldo_nuevo)}</td>
        <td class="text-center">${mov.comprobante || '-'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte de Cierre - Caja Chica</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #333; background: #fff; padding: 20px; }
          .reporte-container { max-width: 900px; margin: 0 auto; background: white; }
          .reporte-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .reporte-header h1 { font-size: 20px; margin-bottom: 5px; font-weight: bold; }
          .reporte-header h2 { font-size: 14px; margin-bottom: 8px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px; }
          .fecha-reporte { font-size: 10px; color: #666; }
          .reporte-info { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; background: #f8f8f8; padding: 12px; border-radius: 4px; }
          .reporte-info-item { display: flex; flex-direction: column; }
          .reporte-info-item .label { font-weight: bold; font-size: 10px; color: #666; margin-bottom: 3px; }
          .reporte-info-item .value { font-size: 11px; color: #333; }
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
          .reporte-empty { text-align: center; padding: 20px; background: #f8f8f8; color: #999; border-radius: 4px; }
          .reporte-firma { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 20px; }
          .reporte-firma-item { flex: 1; text-align: center; font-size: 10px; }
          .reporte-firma-item .linea { width: 80%; height: 1px; background: #000; margin: 30px auto 5px; }
          .reporte-firma-item small { display: block; font-size: 9px; color: #666; margin-top: 3px; }
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
            <h2>REPORTE DE CIERRE DE CAJA CHICA</h2>
            <div class="fecha-reporte">Fecha de impresión: ${formatoFecha(data.fechaReporte)}</div>
          </div>
          <div class="reporte-info">
            <div class="reporte-info-item">
              <span class="label">Fecha de Apertura:</span>
              <span class="value">${formatoFechaSolo(data.caja.fecha)}</span>
            </div>
            <div class="reporte-info-item">
              <span class="label">Fecha de Cierre:</span>
              <span class="value">${formatoFechaSolo(data.caja.cerrado_en)}</span>
            </div>
            <div class="reporte-info-item">
              <span class="label">Usuario:</span>
              <span class="value">${data.caja.usuario_nombre || '-'}</span>
            </div>
            <div class="reporte-info-item">
              <span class="label">Estado:</span>
              <span class="value">${data.caja.estado}</span>
            </div>
          </div>
          <div class="reporte-resumen">
            <h3>RESUMEN FINANCIERO</h3>
            <div class="reporte-resumen-item">
              <span>Monto Inicial:</span>
              <span>${formatoMoneda(data.caja.monto_inicial)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Total Ingresos (${data.movimientos.filter((m: any) => m.tipo === 'INGRESO').length} movimientos):</span>
              <span class="tipo-ingreso">+${formatoMoneda(data.resumen.total_ingresos || 0)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Total Egresos:</span>
              <span class="tipo-egreso">-${formatoMoneda(data.resumen.total_egresos || 0)}</span>
            </div>
            <div class="reporte-resumen-item total-final">
              <span>SALDO FINAL:</span>
              <span>${formatoMoneda(data.caja.monto_actual)}</span>
            </div>
          </div>
          <div class="reporte-section">
            <h3>DETALLE DE MOVIMIENTOS</h3>
            ${data.movimientos.length > 0 ? `
              <table class="reporte-table">
                <thead>
                  <tr>
                    <th style="width: 15%;">Fecha/Hora</th>
                    <th style="width: 10%;" class="text-center">Tipo</th>
                    <th style="width: 35%;">Descripción</th>
                    <th style="width: 15%;" class="text-right">Monto</th>
                    <th style="width: 15%;" class="text-right">Saldo</th>
                    <th style="width: 10%;" class="text-center">Comprobante</th>
                  </tr>
                </thead>
                <tbody>${filasMovimientos}</tbody>
              </table>
            ` : `
              <div class="reporte-empty">No se registraron movimientos en esta caja</div>
            `}
          </div>
          ${data.caja.observacion ? `
            <div class="reporte-section">
              <h3>OBSERVACIONES</h3>
              <p>${data.caja.observacion}</p>
            </div>
          ` : ''}
          <div class="reporte-firma">
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Responsable de Caja</div>
              <small>${data.caja.usuario_nombre}</small>
            </div>
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Supervisor/Gerente</div>
            </div>
          </div>
          <div class="reporte-footer">
            <p>Este documento es un reporte interno de cierre de caja chica</p>
            <p>Generado por el Sistema de Gestión - Óptica Macías Pasaje</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
