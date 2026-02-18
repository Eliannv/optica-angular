import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from '@angular/fire/firestore';

import { ReportesService } from '../../../../core/services/reportes.service';
import { Factura } from '../../../../core/models/factura.model';
import { FacturaDeuda } from '../../../../core/models/factura-deuda.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBanco } from '../../../../core/models/caja-banco.model';

/**
 * Componente de Reporte de Ventas Generales - OPTIMIZADO
 */
@Component({
  selector: 'app-ventas-generales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas-generales.html',
  styleUrl: './ventas-generales.css'
})
export class VentasGeneralesComponent implements OnInit, OnDestroy {
  loading = false;
  facturas: Factura[] = [];
  facturasFiltradas: Factura[] = [];
  pagosDeuda: FacturaDeuda[] = [];
  egresos: any[] = [];
  
  readonly LIMITE_PAGINA = 100;
  lastVisibleFactura: any = null;
  lastVisibleDeuda: any = null;
  hasMoreFacturas = false;
  hasMoreDeudas = false;
  paginaActual = 1;
  
  fechaDesde = '';
  fechaHasta = '';
  tiposSeleccionados: string[] = [];
  
  datosYaCargados = false;
  
  tiposDisponibles = [
    { valor: 'VENTAS', label: 'Ventas (Facturas)' },
    { valor: 'PAGOS_EFECTIVO', label: 'Efectivo (Ventas)' },
    { valor: 'VENTAS_TARJETA', label: 'Tarjeta (Ventas)' },
    { valor: 'TRANSFERENCIA_VENTAS', label: 'Transferencia (Ventas)' },
    { valor: 'PAGO_DEUDA_EFECTIVO', label: 'Pago Deuda (Efectivo)' },
    { valor: 'PAGO_DEUDA_TARJETA', label: 'Pago Deuda (Tarjeta)' },
    { valor: 'TRANSFERENCIA_DEUDAS', label: 'Transferencia (Cobro de Deudas)' },
    { valor: 'FACTURAS_DEUDA', label: 'Pagos de Deuda (Todos)' },
    { valor: 'EGRESOS', label: 'Egresos' }
  ];

  // Totales (basados en facturas)
  totalVendido = 0;
  cantidadRegistros = 0;
  totalPagosDeuda = 0;
  totalEgresos = 0;
  totalesPorMetodo: { [key: string]: number } = {};

  // 🆕 Desglose de abonos por tipo de pago
  abonosFacturasNormales: { efectivo: number; transferencia: number; tarjeta: number; total: number } =
    { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };
  abonosCobrosDeuda: { efectivo: number; transferencia: number; tarjeta: number; total: number } =
    { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };
  totalAbonosCombinados: { efectivo: number; transferencia: number; tarjeta: number; total: number } =
    { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };

  // Totales de cajas
  totalCajaChica = 0;
  totalCajaBanco = 0;
  totalCajas = 0;

  private subscriptions: Subscription[] = [];

  constructor(
    private reportesService: ReportesService,
    private router: Router,
    private firestore: Firestore,
    private cajaChicaService: CajaChicaService
  ) {}

  ngOnInit(): void {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaDesde = this.formatearFechaInput(primerDiaMes);
    this.fechaHasta = this.formatearFechaInput(hoy);
    console.log('Componente inicializado. Presione "Mostrar" para cargar datos.');
  }

  private formatearFechaInput(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  toggleTipo(tipo: string): void {
    const index = this.tiposSeleccionados.indexOf(tipo);
    if (index > -1) {
      this.tiposSeleccionados.splice(index, 1);
    } else {
      this.tiposSeleccionados.push(tipo);
    }
  }

  isTipoSeleccionado(tipo: string): boolean {
    return this.tiposSeleccionados.includes(tipo);
  }

  private cargarFacturas(): void {
    this.loading = true;
    if (!this.fechaDesde || !this.fechaHasta) {
      this.loading = false;
      return;
    }

    const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
    const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);
    const fechaDesde = new Date(añoDesde, mesDesde - 1, diaDesde, 0, 0, 0, 0);
    const fechaHasta = new Date(añoHasta, mesHasta - 1, diaHasta, 23, 59, 59, 999);

    const facturasSub = this.reportesService.getFacturasPaginadas(
      fechaDesde, fechaHasta, undefined, this.LIMITE_PAGINA
    ).subscribe({
      next: (result) => {
        this.facturas = result.docs as Factura[];
        this.hasMoreFacturas = result.hasMore;
        this.lastVisibleFactura = result.lastVisible;
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('Error cargando facturas:', error);
        this.facturas = [];
        this.verificarCargaCompleta();
      }
    });

    const deudasSub = this.reportesService.getPagosDeudaPaginados(
      fechaDesde, fechaHasta, undefined, this.LIMITE_PAGINA
    ).subscribe({
      next: (result) => {
        this.pagosDeuda = result.docs as FacturaDeuda[];
        this.hasMoreDeudas = result.hasMore;
        this.lastVisibleDeuda = result.lastVisible;
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('Error cargando pagos deuda:', error);
        this.pagosDeuda = [];
        this.verificarCargaCompleta();
      }
    });

    const egresosSub = this.reportesService.getMovimientosCajaChicaPaginados(
      fechaDesde, fechaHasta, 'EGRESO', this.LIMITE_PAGINA
    ).subscribe({
      next: (result) => {
        this.egresos = result.docs;
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('Error cargando egresos:', error);
        this.egresos = [];
        this.verificarCargaCompleta();
      }
    });

    this.cargarTotalCajaChica(fechaDesde, fechaHasta);
    this.cargarTotalCajaBanco(fechaDesde, fechaHasta);

    this.subscriptions.push(facturasSub, deudasSub, egresosSub);
  }

  private contadorCargas = 0;
  private verificarCargaCompleta(): void {
    this.contadorCargas++;
    if (this.contadorCargas >= 5) {
      this.loading = false;
      this.contadorCargas = 0;
      this.datosYaCargados = true;
      this.filtrarDatosEnMemoria();
    }
  }

  aplicarFiltros(): void {
    if (!this.fechaDesde || !this.fechaHasta) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas Requeridas',
        text: 'Por favor seleccione las fechas DESDE y HASTA para generar el reporte.'
      });
      return;
    }
    this.reportesService.clearCache();
    this.lastVisibleFactura = null;
    this.lastVisibleDeuda = null;
    this.paginaActual = 1;
    this.cargarFacturas();
  }

  private filtrarDatosEnMemoria(): void {
    let facturasFiltradas = [...this.facturas];

    if (this.tiposSeleccionados.length > 0) {
      const mostrarVentas = this.tiposSeleccionados.includes('VENTAS');
      const mostrarEfectivo = this.tiposSeleccionados.includes('PAGOS_EFECTIVO');
      const mostrarTarjeta = this.tiposSeleccionados.includes('VENTAS_TARJETA');
      const mostrarTransferenciaVentas = this.tiposSeleccionados.includes('TRANSFERENCIA_VENTAS');
      const hayFiltroMetodo = mostrarEfectivo || mostrarTransferenciaVentas || mostrarTarjeta;

      if (mostrarVentas && !hayFiltroMetodo) {
        facturasFiltradas = [...this.facturas];
      } else {
        facturasFiltradas = this.facturas.filter(f => {
          if (mostrarEfectivo && f.metodoPago === 'Efectivo') return true;
          if (mostrarTransferenciaVentas && f.metodoPago === 'Transferencia') return true;
          if (mostrarTarjeta && f.metodoPago === 'Tarjeta') return true;
          return false;
        });
      }
    }

    this.facturasFiltradas = facturasFiltradas;
    this.facturasFiltradas.sort((a, b) => {
      const fechaA = this.obtenerFechaDate(a.fecha);
      const fechaB = this.obtenerFechaDate(b.fecha);
      return fechaB.getTime() - fechaA.getTime();
    });
    this.calcularTotales();
  }

  private obtenerFechaDate(fecha: any): Date {
    if (fecha && (fecha as any).toDate) return (fecha as any).toDate();
    if (fecha instanceof Date) return fecha;
    return new Date(fecha);
  }

  calcularTotales(): void {
    const filtrarPorFecha = (fecha: Date | { toDate?: () => Date } | string, desde: string, hasta: string) => {
      let d: Date;
      if (fecha instanceof Date) {
        d = fecha;
      } else if (fecha && typeof fecha === 'object' && typeof (fecha as any).toDate === 'function') {
        d = (fecha as any).toDate();
      } else {
        d = new Date(fecha as string);
      }
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}` >= desde && `${yyyy}-${mm}-${dd}` <= hasta;
    };

    const desde = this.fechaDesde;
    const hasta = this.fechaHasta;

    const facturasEnRango = this.facturas.filter(f => filtrarPorFecha(f.fecha, desde, hasta));
    const pagosDeudaEnRango = this.pagosDeuda.filter(p => filtrarPorFecha(p.fechaPago, desde, hasta));
    const egresosEnRango = this.egresos.filter(e => filtrarPorFecha(e.fecha, desde, hasta));

    this.totalVendido = facturasEnRango.reduce((sum, f) => sum + (f.total || 0), 0);
    this.cantidadRegistros = facturasEnRango.length;
    this.totalPagosDeuda = pagosDeudaEnRango.reduce((sum, p) => sum + (p.montoPagado || 0), 0);
    this.totalEgresos = egresosEnRango.reduce((sum, e) => sum + (e.monto || 0), 0);

    // ─── 🆕 Abonos de facturas normales por método de pago ────────────────────
    let abonosNormalesEfectivo = 0;
    let abonosNormalesTarjeta = 0;
    let abonosNormalesTransferencia = 0;

    facturasEnRango.forEach(f => {
      const abono = typeof f.abonado === 'number' ? f.abonado : 0;
      if (abono > 0) {
        if (f.metodoPago === 'Efectivo')       abonosNormalesEfectivo      += abono;
        else if (f.metodoPago === 'Tarjeta')   abonosNormalesTarjeta       += abono;
        else if (f.metodoPago === 'Transferencia') abonosNormalesTransferencia += abono;
      }
    });

    this.abonosFacturasNormales = {
      efectivo:      abonosNormalesEfectivo,
      tarjeta:       abonosNormalesTarjeta,
      transferencia: abonosNormalesTransferencia,
      total:         abonosNormalesEfectivo + abonosNormalesTarjeta + abonosNormalesTransferencia
    };

    // ─── 🆕 Abonos de cobros/pagos de deuda por método de pago ───────────────
    let abonosDeudaEfectivo = 0;
    let abonosDeudaTarjeta = 0;
    let abonosDeudaTransferencia = 0;

    pagosDeudaEnRango.forEach(p => {
      if (p.metodoPago === 'Efectivo')           abonosDeudaEfectivo      += p.montoPagado;
      else if (p.metodoPago === 'Tarjeta')       abonosDeudaTarjeta       += p.montoPagado;
      else if (p.metodoPago === 'Transferencia') abonosDeudaTransferencia += p.montoPagado;
    });

    this.abonosCobrosDeuda = {
      efectivo:      abonosDeudaEfectivo,
      tarjeta:       abonosDeudaTarjeta,
      transferencia: abonosDeudaTransferencia,
      total:         abonosDeudaEfectivo + abonosDeudaTarjeta + abonosDeudaTransferencia
    };

    // ─── 🆕 Totales combinados ────────────────────────────────────────────────
    this.totalAbonosCombinados = {
      efectivo:      abonosNormalesEfectivo      + abonosDeudaEfectivo,
      tarjeta:       abonosNormalesTarjeta       + abonosDeudaTarjeta,
      transferencia: abonosNormalesTransferencia + abonosDeudaTransferencia,
      total:         this.abonosFacturasNormales.total + this.abonosCobrosDeuda.total
    };

    // Totales por método de pago
    this.totalesPorMetodo = {
      'Efectivo': facturasEnRango.filter(f => f.metodoPago === 'Efectivo').reduce((sum, f) => sum + (f.total || 0), 0),
      'Abonos (Efectivo)': abonosNormalesEfectivo + abonosDeudaEfectivo,
      'Tarjeta': facturasEnRango.filter(f => f.metodoPago === 'Tarjeta').reduce((sum, f) => sum + (f.total || 0), 0),
      'Transferencia (Ventas)': facturasEnRango.filter(f => f.metodoPago === 'Transferencia').reduce((sum, f) => sum + (f.total || 0), 0),
      'Efectivo pago de deudas': abonosDeudaEfectivo,
      'Tarjeta pago de deudas': abonosDeudaTarjeta,
      'Transferencia (Cobro de Deudas)': abonosDeudaTransferencia
    };

    this.totalCajaChica = this.totalesPorMetodo['Efectivo'] + this.totalesPorMetodo['Abonos (Efectivo)'] - this.totalEgresos;
    this.totalCajaBanco = this.totalesPorMetodo['Tarjeta'] + this.totalesPorMetodo['Transferencia (Ventas)'] + this.totalesPorMetodo['Tarjeta pago de deudas'] + this.totalesPorMetodo['Transferencia (Cobro de Deudas)'];
    this.totalCajas = this.totalCajaChica + this.totalCajaBanco;
  }

  private calcularTotalesCajas(): void {
    this.totalCajaChica = 0;
    const facturasEfectivo = this.facturas.filter(f => f.metodoPago === 'Efectivo');
    this.totalCajaChica += facturasEfectivo.reduce((sum, f) => sum + Number(f?.abonado ?? f?.total ?? 0), 0);
    const deudasEfectivo = this.pagosDeuda.filter(d => d.metodoPago === 'Efectivo');
    this.totalCajaChica += deudasEfectivo.reduce((sum, d) => sum + d.montoPagado, 0);
    this.totalCajaChica -= this.totalEgresos;
    this.totalCajaBanco = 0;
    const facturasBanco = this.facturas.filter(f => f.metodoPago === 'Transferencia' || f.metodoPago === 'Tarjeta');
    this.totalCajaBanco += facturasBanco.reduce((sum, f) => sum + f.total, 0);
    const deudasBanco = this.pagosDeuda.filter(d => d.metodoPago === 'Transferencia' || d.metodoPago === 'Tarjeta');
    this.totalCajaBanco += deudasBanco.reduce((sum, d) => sum + d.montoPagado, 0);
    this.calcularTotalCajas();
  }

  private async cargarTotalCajaChica(fechaDesde: Date, fechaHasta: Date): Promise<void> {
    try {
      this.totalCajaChica = 0;
      const desde = new Date(fechaDesde);
      const hasta = new Date(fechaHasta);
      desde.setHours(0, 0, 0, 0);
      hasta.setHours(0, 0, 0, 0);
      const dias: string[] = [];
      for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
        dias.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
      }
      for (const dia of dias) {
        const resultado = await this.cajaChicaService.getCajasChicasPaginadas({ fecha: dia, pageSize: 10 });
        if (resultado && resultado.cajas && resultado.cajas.length > 0) {
          this.totalCajaChica += resultado.cajas.reduce((sum, c) => sum + (c.monto_actual || 0), 0);
        }
      }
      this.verificarCargaCompleta();
    } catch (error) {
      console.error('Error en carga de caja chica:', error);
      this.verificarCargaCompleta();
    }
  }

  private async cargarTotalCajaBanco(fechaDesde: Date, fechaHasta: Date): Promise<void> {
    try {
      this.verificarCargaCompleta();
    } catch (error) {
      console.error('Error en carga de caja banco:', error);
      this.verificarCargaCompleta();
    }
  }

  private calcularTotalCajas(): void {
    this.totalCajas = this.totalCajaChica + this.totalCajaBanco;
  }

  limpiarFiltros(): void {
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.tiposSeleccionados = [];
    this.facturas = [];
    this.facturasFiltradas = [];
    this.pagosDeuda = [];
    this.egresos = [];
    this.totalVendido = 0;
    this.totalPagosDeuda = 0;
    this.totalEgresos = 0;
    this.cantidadRegistros = 0;
    this.totalesPorMetodo = {};
    this.totalCajaChica = 0;
    this.totalCajaBanco = 0;
    this.totalCajas = 0;
    // 🆕 Limpiar abonos
    this.abonosFacturasNormales = { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };
    this.abonosCobrosDeuda = { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };
    this.totalAbonosCombinados = { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };
    this.lastVisibleFactura = null;
    this.lastVisibleDeuda = null;
    this.hasMoreFacturas = false;
    this.hasMoreDeudas = false;
    this.paginaActual = 1;
    this.datosYaCargados = false;
    this.reportesService.clearCache();
  }

  formatoFecha(fecha: Date | any): string {
    if (!fecha) return '-';
    let f: Date;
    if (fecha.toDate) f = fecha.toDate();
    else if (fecha instanceof Date) f = fecha;
    else f = new Date(fecha);
    return f.toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatoMoneda(monto: number): string {
    return `$${monto.toFixed(2)}`;
  }

  getTransferenciasCajaBancoDeuda(): any[] {
    return [];
  }

  getPagosDeudaFiltrados(): FacturaDeuda[] {
    const mostrarTodos = this.tiposSeleccionados.includes('FACTURAS_DEUDA') || this.tiposSeleccionados.length === 0;
    const mostrarSoloTransferencias = this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS');
    const mostrarSoloEfectivo = this.tiposSeleccionados.includes('PAGO_DEUDA_EFECTIVO');
    const mostrarSoloTarjeta = this.tiposSeleccionados.includes('PAGO_DEUDA_TARJETA');

    if (!mostrarTodos && !mostrarSoloTransferencias && !mostrarSoloEfectivo && !mostrarSoloTarjeta) return [];
    if (mostrarSoloTransferencias && !mostrarTodos && !mostrarSoloEfectivo && !mostrarSoloTarjeta)
      return this.pagosDeuda.filter(p => p.metodoPago === 'Transferencia');
    if (mostrarSoloEfectivo && !mostrarTodos && !mostrarSoloTransferencias && !mostrarSoloTarjeta)
      return this.pagosDeuda.filter(p => p.metodoPago === 'Efectivo');
    if (mostrarSoloTarjeta && !mostrarTodos && !mostrarSoloTransferencias && !mostrarSoloEfectivo)
      return this.pagosDeuda.filter(p => p.metodoPago === 'Tarjeta');
    if (!mostrarTodos) {
      const filtros: ((p: FacturaDeuda) => boolean)[] = [];
      if (mostrarSoloTransferencias) filtros.push(p => p.metodoPago === 'Transferencia');
      if (mostrarSoloEfectivo) filtros.push(p => p.metodoPago === 'Efectivo');
      if (mostrarSoloTarjeta) filtros.push(p => p.metodoPago === 'Tarjeta');
      return this.pagosDeuda.filter(p => filtros.some(f => f(p)));
    }
    return this.pagosDeuda;
  }

  get hayDatosParaImprimir(): boolean {
    const hayFacturas = this.facturasFiltradas.length > 0;
    const hayPagosDeuda = this.getPagosDeudaFiltrados().length > 0;
    const hayEgresos = (this.tiposSeleccionados.includes('EGRESOS') || this.tiposSeleccionados.length === 0) && this.egresos.length > 0;
    return hayFacturas || hayPagosDeuda || hayEgresos;
  }

  async imprimirReporte(): Promise<void> {
    const hayFacturas = this.facturasFiltradas.length > 0;
    const hayPagosDeuda = this.getPagosDeudaFiltrados().length > 0;
    const hayEgresos = (this.tiposSeleccionados.includes('EGRESOS') || this.tiposSeleccionados.length === 0) && this.egresos.length > 0;
    
    if (!hayFacturas && !hayPagosDeuda && !hayEgresos) {
      Swal.fire({ icon: 'warning', title: 'Sin Datos', text: 'No hay registros para imprimir.' });
      return;
    }

    const htmlReporte = await this.generarHTMLReporte();
    const ventana = window.open('', 'PRINT', 'height=800,width=900');
    if (!ventana) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo abrir la ventana de impresión.' });
      return;
    }

    ventana.document.write(htmlReporte);
    ventana.document.close();

    ventana.addEventListener('load', async () => {
      let totalCajaChicaImpresion = 0;
      try {
        const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
        const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);
        let fechaActual = new Date(añoDesde, mesDesde - 1, diaDesde, 0, 0, 0, 0);
        const fechaFin = new Date(añoHasta, mesHasta - 1, diaHasta, 0, 0, 0, 0);
        while (fechaActual <= fechaFin) {
          const yyyy = fechaActual.getFullYear();
          const mm = (fechaActual.getMonth() + 1).toString().padStart(2, '0');
          const dd = fechaActual.getDate().toString().padStart(2, '0');
          const resultado = await this.cajaChicaService.getCajasChicasPaginadas({ fecha: `${yyyy}-${mm}-${dd}`, pageSize: 10 });
          if (resultado && resultado.cajas && resultado.cajas.length > 0) {
            totalCajaChicaImpresion += resultado.cajas.reduce((sum, c) => sum + (c.monto_actual || 0), 0);
          }
          fechaActual.setDate(fechaActual.getDate() + 1);
        }
      } catch (e) {
        totalCajaChicaImpresion = 0;
      }
      const spanCajaChica = ventana.document.getElementById('impresion-caja-chica');
      if (spanCajaChica) spanCajaChica.textContent = this.formatoMoneda(totalCajaChicaImpresion);
      ventana.focus();
      ventana.print();
      ventana.addEventListener('afterprint', () => ventana.close());
    });
  }

  private async generarHTMLReporte(): Promise<string> {
    const fechaReporte = new Date().toLocaleString('es-ES');
    
    const filtrosAplicados: string[] = [];
    if (this.fechaDesde) {
      const [año, mes, dia] = this.fechaDesde.split('-');
      filtrosAplicados.push(`Desde: ${dia}/${mes}/${año}`);
    }
    if (this.fechaHasta) {
      const [año, mes, dia] = this.fechaHasta.split('-');
      filtrosAplicados.push(`Hasta: ${dia}/${mes}/${año}`);
    }
    if (this.tiposSeleccionados.length > 0) {
      const tipoLabels: { [key: string]: string } = {
        'VENTAS': 'Ventas (Facturas)', 'PAGOS_EFECTIVO': 'Efectivo (Ventas)',
        'TRANSFERENCIA_VENTAS': 'Transferencia (Ventas)', 'TRANSFERENCIA_DEUDAS': 'Transferencia (Cobro de Deudas)',
        'VENTAS_TARJETA': 'Tarjeta (Ventas)', 'PAGO_DEUDA_EFECTIVO': 'Pago Deuda (Efectivo)',
        'PAGO_DEUDA_TARJETA': 'Pago Deuda (Tarjeta)', 'FACTURAS_DEUDA': 'Pagos de Deuda (Todos)', 'EGRESOS': 'Egresos'
      };
      filtrosAplicados.push(`Tipos: ${this.tiposSeleccionados.map(t => tipoLabels[t] || t).join(', ')}`);
    }

    const filtrosTexto = filtrosAplicados.length > 0 ? `<div class="filtros">${filtrosAplicados.join(' | ')}</div>` : '';

    const filasVentas = this.facturasFiltradas.map(factura => {
      let mp = factura.metodoPago === 'Transferencia' ? 'Transferencia (Ventas)' : factura.metodoPago;
      return `<tr>
          <td>${this.formatoFecha(factura.fecha)}</td><td>Venta</td>
          <td>${factura.idPersonalizado || factura.id || '-'}</td>
          <td>${factura.clienteNombre || 'Sin nombre'}</td><td>${mp}</td>
          <td class="text-right">${this.formatoMoneda(factura.total)}</td>
          <td class="text-right">${this.formatoMoneda(factura.abonado || 0)}</td>
          <td class="text-right">${this.formatoMoneda(factura.saldoPendiente || 0)}</td>
        </tr>`;
    }).join('');

    const mostrarFacturasDeuda = this.tiposSeleccionados.includes('FACTURAS_DEUDA') ||
                                  this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS') ||
                                  this.tiposSeleccionados.length === 0;
    const filasDeuda = mostrarFacturasDeuda ? this.getPagosDeudaFiltrados().map(deuda => {
      let mp = deuda.metodoPago === 'Transferencia' ? 'Transferencia (Cobro de Deudas)' : deuda.metodoPago;
      return `<tr style="background-color:#fff3e0;">
          <td>${this.formatoFecha(deuda.fechaPago)}</td><td>Pago Deuda</td>
          <td>${deuda.facturaIdPersonalizado || deuda.facturaId || '-'}</td>
          <td>${deuda.clienteNombre || 'Sin nombre'}</td><td>${mp}</td>
          <td class="text-right">${this.formatoMoneda(deuda.montoPagado)}</td>
          <td class="text-right">${this.formatoMoneda(deuda.montoPagado)}</td>
          <td class="text-right">${this.formatoMoneda(deuda.saldoRestante || 0)}</td>
        </tr>`;
    }).join('') : '';

    const mostrarEgresos = this.tiposSeleccionados.includes('EGRESOS') || this.tiposSeleccionados.length === 0;
    const filasEgresos = mostrarEgresos ? this.egresos.map(egreso => `
        <tr style="background-color:#ffebee;">
          <td>${this.formatoFecha(egreso.fecha)}</td><td>Egreso</td>
          <td>${egreso.comprobante || '-'}</td>
          <td>${egreso.descripcion || 'Sin descripción'}</td><td>Efectivo</td>
          <td class="text-right">${this.formatoMoneda(egreso.monto)}</td>
          <td class="text-right">-</td><td class="text-right">-</td>
        </tr>`).join('') : '';

    const metodosMostrar = [
      'Efectivo', 'Abonos (Efectivo)', 'Tarjeta', 'Transferencia (Ventas)',
      'Efectivo pago de deudas', 'Tarjeta pago de deudas', 'Transferencia (Cobro de Deudas)'
    ];
    const totalesMetodo = metodosMostrar.map(m => `
      <div class="total-item">
        <span>${m}:</span>
        <span class="total-value">${this.formatoMoneda(this.totalesPorMetodo[m] || 0)}</span>
      </div>`).join('');

    // ─── 🆕 Sección DESGLOSE DE ABONOS ───────────────────────────────────────
    const seccionAbonos = `
      <h4 class="seccion-titulo">DESGLOSE DE ABONOS POR TIPO DE PAGO</h4>
      <table class="abonos-inner">
        <thead>
          <tr>
            <th style="text-align:left;width:38%;">Origen</th>
            <th style="text-align:right;">Efectivo</th>
            <th style="text-align:right;">Transferencia</th>
            <th style="text-align:right;">Tarjeta</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Abonos Facturas Normales</td>
            <td class="text-right">${this.formatoMoneda(this.abonosFacturasNormales.efectivo)}</td>
            <td class="text-right">${this.formatoMoneda(this.abonosFacturasNormales.transferencia)}</td>
            <td class="text-right">${this.formatoMoneda(this.abonosFacturasNormales.tarjeta)}</td>
            <td class="text-right bold">${this.formatoMoneda(this.abonosFacturasNormales.total)}</td>
          </tr>
          <tr style="background-color:#fff3e0;">
            <td>Abonos Cobros / Pagos Deuda</td>
            <td class="text-right">${this.formatoMoneda(this.abonosCobrosDeuda.efectivo)}</td>
            <td class="text-right">${this.formatoMoneda(this.abonosCobrosDeuda.transferencia)}</td>
            <td class="text-right">${this.formatoMoneda(this.abonosCobrosDeuda.tarjeta)}</td>
            <td class="text-right bold">${this.formatoMoneda(this.abonosCobrosDeuda.total)}</td>
          </tr>
          <tr class="fila-total-abonos">
            <td><strong>TOTAL ABONOS</strong></td>
            <td class="text-right"><strong>${this.formatoMoneda(this.totalAbonosCombinados.efectivo)}</strong></td>
            <td class="text-right"><strong>${this.formatoMoneda(this.totalAbonosCombinados.transferencia)}</strong></td>
            <td class="text-right"><strong>${this.formatoMoneda(this.totalAbonosCombinados.tarjeta)}</strong></td>
            <td class="text-right"><strong>${this.formatoMoneda(this.totalAbonosCombinados.total)}</strong></td>
          </tr>
        </tbody>
      </table>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte de Ventas Generales</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; padding: 10px; font-size: 10px; color: #000; background: #fff; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .header h1 { font-size: 16px; margin-bottom: 3px; font-weight: bold; text-transform: uppercase; }
    .header .empresa { font-size: 12px; font-weight: bold; margin-bottom: 2px; }
    .header .subtitulo { font-size: 10px; }
    .fecha-reporte { text-align: right; font-size: 8px; margin-bottom: 10px; }
    .filtros { background: #f5f5f5; padding: 6px; margin-bottom: 12px; font-size: 9px; border: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { background: #000; color: #fff; padding: 6px 4px; text-align: left; font-size: 9px; border: 1px solid #000; }
    td { padding: 5px 4px; border: 1px solid #000; font-size: 9px; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .resumen { border: 2px solid #000; padding: 10px; margin-top: 15px; }
    .resumen h3 { font-size: 11px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 4px; text-transform: uppercase; }
    .resumen-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 9px; }
    .resumen-item.total { font-weight: bold; font-size: 11px; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; }
    .total-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 9px; }
    .total-value { font-weight: bold; }
    /* Sección de abonos */
    .seccion-titulo {
      font-size: 10px; margin: 12px 0 6px 0; font-weight: bold;
      border-top: 1px solid #000; padding-top: 8px; text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .abonos-inner { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .abonos-inner th { background: #444; color: #fff; padding: 5px 4px; font-size: 8px; border: 1px solid #000; }
    .abonos-inner td { padding: 4px; border: 1px solid #000; font-size: 9px; }
    .fila-total-abonos { background-color: #e0e0e0; }
    @media print {
      @page { margin: 0.5cm; size: auto; }
      body { padding: 0; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="empresa">ÓPTICA MACÍAS PASAJE</div>
    <h1>REPORTE DE VENTAS GENERALES</h1>
    <div class="subtitulo">Basado en Facturas del Sistema</div>
  </div>
  <div class="fecha-reporte">Generado: ${fechaReporte}</div>
  ${filtrosTexto}

  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Tipo</th><th>Nº Doc</th><th>Cliente/Descripción</th>
        <th>Método Pago</th><th class="text-right">Monto</th>
        <th class="text-right">Abono</th><th class="text-right">Saldo</th>
      </tr>
    </thead>
    <tbody>
      ${filasVentas}
      ${filasDeuda}
      ${filasEgresos}
    </tbody>
  </table>

  <div class="resumen">
    <h3>RESUMEN</h3>
    <div class="resumen-item"><span>Total Ventas (Facturas):</span><span>${this.cantidadRegistros}</span></div>
    ${mostrarFacturasDeuda ? `<div class="resumen-item"><span>Total Pagos de Deuda:</span><span>${this.getPagosDeudaFiltrados().length}</span></div>` : ''}
    ${mostrarEgresos ? `<div class="resumen-item"><span>Total Egresos:</span><span>${this.egresos.length}</span></div>` : ''}

    <h4 style="font-size:10px;margin:6px 0 4px 0;font-weight:bold;">Desglose por Forma de Pago:</h4>
    ${totalesMetodo}

    <div class="resumen-item total"><span>TOTAL VENDIDO:</span><span>${this.formatoMoneda(this.totalVendido)}</span></div>
    ${mostrarFacturasDeuda ? `<div class="resumen-item"><span>Total Pagos Deuda:</span><span>${this.formatoMoneda(this.totalPagosDeuda)}</span></div>` : ''}
    ${mostrarEgresos ? `<div class="resumen-item"><span>Total Egresos:</span><span>${this.formatoMoneda(this.totalEgresos)}</span></div>` : ''}

    ${seccionAbonos}

    <h4 style="font-size:10px;margin:10px 0 4px 0;font-weight:bold;border-top:1px solid #000;padding-top:6px;">
      Totales por Tipo de Caja:
    </h4>
    <div class="resumen-item">
      <span>Total Caja Chica:</span>
      <span class="total-value" id="impresion-caja-chica">Cargando...</span>
    </div>
    <div class="resumen-item">
      <span>Total Caja Banco:</span>
      <span class="total-value">${this.formatoMoneda(this.totalCajaBanco)}</span>
    </div>
    <div class="resumen-item total">
      <span>TOTAL CAJAS:</span><span>${this.formatoMoneda(this.totalCajas)}</span>
    </div>
  </div>
</body>
</html>`;
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}