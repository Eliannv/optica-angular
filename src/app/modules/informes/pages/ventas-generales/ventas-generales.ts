import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { ReportesService } from '../../../../core/services/reportes.service';
import { Factura } from '../../../../core/models/factura.model';
import { FacturaDeuda } from '../../../../core/models/factura-deuda.model';

/**
 * 🚀 Componente OPTIMIZADO de Reporte de Ventas Generales
 * 
 * **Optimizaciones implementadas:**
 * ✅ 1. Carga bajo demanda (NO carga nada al iniciar, solo al presionar "Mostrar")
 * ✅ 2. Filtros obligatorios por fecha (no trae colecciones completas)
 * ✅ 3. Paginación real con limit() y startAfter() de Firestore
 * ✅ 4. Solo usa getDocs() (sin listeners en tiempo real)
 * ✅ 5. Cache en memoria para evitar consultas repetidas
 * ✅ 6. Consultas optimizadas con índices
 * 
 * **Funcionalidades:**
 * - Reporte basado exclusivamente en facturas del sistema
 * - Filtros por rango de fechas (OBLIGATORIOS)
 * - Filtros por tipo de venta y forma de pago
 * - Paginación de resultados (100 docs por página)
 * - Impresión compatible con impresoras POS y normales
 */
@Component({
  selector: 'app-ventas-generales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas-generales.html',
  styleUrl: './ventas-generales.css'
})
export class VentasGeneralesComponent implements OnInit, OnDestroy {
  loading = false; // ✅ No carga al iniciar
  datosReporte = false; // ✅ Indica si ya se cargaron datos
  
  // Datos paginados
  facturas: Factura[] = [];
  pagosDeuda: FacturaDeuda[] = [];
  egresos: any[] = [];
  registrosCombinados: any[] = []; // 🆕 Array combinado y ordenado por fecha
  
  // Paginación
  paginaActual = 1;
  limitePorPagina = 100; // ✅ Traer solo 100 documentos a la vez
  hayMasPaginas = false;
  ultimoDocumentoFacturas: any = null;
  ultimoDocumentoDeuda: any = null;
  ultimoDocumentoEgresos: any = null;
  
  // Filtros (fechas son OBLIGATORIAS)
  fechaDesde = '';
  fechaHasta = '';
  metodoPagoFiltro = 'TODOS'; // Filtro por método de pago
  tipoReporte: 'VENTAS' | 'DEUDAS' | 'EGRESOS' | 'COMPLETO' = 'VENTAS';
  
  // Opciones de tipos disponibles
  tiposDisponibles = [
    { valor: 'VENTAS', label: 'Solo Ventas (Facturas)' },
    { valor: 'DEUDAS', label: 'Solo Pagos de Deuda' },
    { valor: 'EGRESOS', label: 'Solo Egresos' },
    { valor: 'COMPLETO', label: 'Reporte Completo (Todo)' }
  ];
  
  metodosPago = ['TODOS', 'Efectivo', 'Transferencia', 'Tarjeta'];

  // Totales (basados en facturas)
  totalVendido = 0; // Total de ventas (suma de facturas)
  cantidadRegistros = 0; // Cantidad de facturas
  totalPagosDeuda = 0; // 🆕 Total de pagos de deuda
  totalEgresos = 0; // 🆕 Total de egresos
  totalesPorMetodo: { [key: string]: number } = {}; // Desglose por forma de pago

  private subscription?: Subscription;

  constructor(
    private reportesService: ReportesService, // ✅ Servicio optimizado
    private router: Router
  ) {}

  ngOnInit(): void {
    // ✅ Establecer fechas por defecto PERO NO CARGAR DATOS
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    this.fechaDesde = this.formatearFechaInput(primerDiaMes);
    this.fechaHasta = this.formatearFechaInput(hoy);
    
    // ✅ NO llamar cargarFacturas() aquí - solo cuando usuario presione "Mostrar"
    console.log('📊 Reporte inicializado. Presione "Mostrar" para cargar datos.');
  }

  /**
   * Formatea una fecha a formato YYYY-MM-DD para input type="date"
   */
  private formatearFechaInput(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * 🚀 OPTIMIZADO: Aplicar filtros y cargar datos SOLO cuando usuario presiona "Mostrar"
   * 
   * Mejoras:
   * - ✅ Validación obligatoria de fechas
   * - ✅ Carga paginada (100 docs por vez)
   * - ✅ Consultas optimizadas con índices
   * - ✅ Cache automático en ReportesService
   */
  aplicarFiltros(): void {
    // Validar fechas obligatorias
    if (!this.fechaDesde || !this.fechaHasta) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas Requeridas',
        text: 'Por favor seleccione las fechas DESDE y HASTA para generar el reporte.'
      });
      return;
    }

    this.loading = true;
    this.datosReporte = true;
    this.paginaActual = 1;
    
    // Limpiar datos anteriores
    this.facturas = [];
    this.pagosDeuda = [];
    this.egresos = [];
    this.ultimoDocumentoFacturas = null;
    this.ultimoDocumentoDeuda = null;
    this.ultimoDocumentoEgresos = null;

    // Convertir fechas de string a Date
    const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
    const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);
    
    const fechaDesde = new Date(añoDesde, mesDesde - 1, diaDesde, 0, 0, 0, 0);
    const fechaHasta = new Date(añoHasta, mesHasta - 1, diaHasta, 23, 59, 59, 999);

    console.log('🔍 Cargando datos optimizados:', {
      fechaDesde,
      fechaHasta,
      tipo: this.tipoReporte,
      metodoPago: this.metodoPagoFiltro,
      limite: this.limitePorPagina
    });

    // Cargar según tipo de reporte seleccionado
    if (this.tipoReporte === 'VENTAS' || this.tipoReporte === 'COMPLETO') {
      this.cargarFacturas(fechaDesde, fechaHasta);
    }
    
    if (this.tipoReporte === 'DEUDAS' || this.tipoReporte === 'COMPLETO') {
      this.cargarPagosDeuda(fechaDesde, fechaHasta);
    }
    
    if (this.tipoReporte === 'EGRESOS' || this.tipoReporte === 'COMPLETO') {
      this.cargarEgresos(fechaDesde, fechaHasta);
    }
  }

  /**
   * 🚀 Cargar facturas con paginación optimizada
   */
  private cargarFacturas(fechaDesde: Date, fechaHasta: Date): void {
    const metodoPago = this.metodoPagoFiltro !== 'TODOS' ? this.metodoPagoFiltro : undefined;
    
    this.subscription = this.reportesService.getFacturasPaginadas(
      fechaDesde,
      fechaHasta,
      metodoPago,
      this.limitePorPagina,
      this.ultimoDocumentoFacturas
    ).subscribe({
      next: (resultado) => {
        this.facturas = resultado.docs;
        this.hayMasPaginas = resultado.hasMore;
        this.ultimoDocumentoFacturas = resultado.lastVisible;
        this.loading = false;
        
        console.log('✅ Facturas cargadas:', {
          cantidad: this.facturas.length,
          hayMas: this.hayMasPaginas
        });
        
        this.calcularTotales();
      },
      error: (error) => {
        console.error('❌ Error cargando facturas:', error);
        this.loading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las facturas. Intente nuevamente.'
        });
      }
    });
  }

  /**
   * 🚀 Cargar pagos de deuda con paginación optimizada
   */
  private cargarPagosDeuda(fechaDesde: Date, fechaHasta: Date): void {
    const metodoPago = this.metodoPagoFiltro !== 'TODOS' ? this.metodoPagoFiltro : undefined;
    
    this.subscription = this.reportesService.getPagosDeudaPaginados(
      fechaDesde,
      fechaHasta,
      metodoPago,
      this.limitePorPagina,
      this.ultimoDocumentoDeuda
    ).subscribe({
      next: (resultado) => {
        this.pagosDeuda = resultado.docs;
        this.ultimoDocumentoDeuda = resultado.lastVisible;
        this.loading = false;
        
        console.log('✅ Pagos de deuda cargados:', this.pagosDeuda.length);
        this.calcularTotales();
      },
      error: (error) => {
        console.error('❌ Error cargando pagos de deuda:', error);
        this.loading = false;
      }
    });
  }

  /**
   * 🚀 Cargar egresos con paginación optimizada
   */
  private cargarEgresos(fechaDesde: Date, fechaHasta: Date): void {
    this.subscription = this.reportesService.getMovimientosCajaChicaPaginados(
      fechaDesde,
      fechaHasta,
      'EGRESO',
      this.limitePorPagina,
      this.ultimoDocumentoEgresos
    ).subscribe({
      next: (resultado) => {
        this.egresos = resultado.docs;
        this.ultimoDocumentoEgresos = resultado.lastVisible;
        this.loading = false;
        
        console.log('✅ Egresos cargados:', this.egresos.length);
        this.calcularTotales();
      },
      error: (error) => {
        console.error('❌ Error cargando egresos:', error);
        this.loading = false;
      }
    });
  }

  /**
   * Cargar siguiente página de resultados
   */
  cargarMasDatos(): void {
    if (!this.hayMasPaginas || this.loading) return;

    this.loading = true;
    this.paginaActual++;

    const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
    const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);
    
    const fechaDesde = new Date(añoDesde, mesDesde - 1, diaDesde, 0, 0, 0, 0);
    const fechaHasta = new Date(añoHasta, mesHasta - 1, diaHasta, 23, 59, 59, 999);

    // Cargar siguiente página
    if (this.tipoReporte === 'VENTAS' || this.tipoReporte === 'COMPLETO') {
      const metodoPago = this.metodoPagoFiltro !== 'TODOS' ? this.metodoPagoFiltro : undefined;
      
      this.reportesService.getFacturasPaginadas(
        fechaDesde,
        fechaHasta,
        metodoPago,
        this.limitePorPagina,
        this.ultimoDocumentoFacturas
      ).subscribe({
        next: (resultado) => {
          this.facturas = [...this.facturas, ...resultado.docs]; // Append nuevos datos
          this.hayMasPaginas = resultado.hasMore;
          this.ultimoDocumentoFacturas = resultado.lastVisible;
          this.loading = false;
          
          console.log('✅ Página', this.paginaActual, 'cargada. Total:', this.facturas.length);
          this.calcularTotales();
        },
        error: () => {
          this.loading = false;
        }
      });
    }
  }

  /**
   * Calcula totales basados en los datos cargados
   */
  calcularTotales(): void {
    // Total vendido
    this.totalVendido = this.facturas.reduce((sum, f) => sum + (f.total || 0), 0);
    this.cantidadRegistros = this.facturas.length;

    // Total pagos de deuda
    this.totalPagosDeuda = this.pagosDeuda.reduce((sum, p) => sum + (p.montoPagado || 0), 0);

    // Total egresos
    this.totalEgresos = this.egresos.reduce((sum, e) => sum + (e.monto || 0), 0);

    // Agrupar por método de pago
    this.totalesPorMetodo = {};
    this.facturas.forEach(f => {
      const metodo = f.metodoPago || 'Sin Método';
      this.totalesPorMetodo[metodo] = (this.totalesPorMetodo[metodo] || 0) + f.total;
    });

    // 🆕 COMBINAR todos los registros y ordenar por fecha descendente
    this.registrosCombinados = [
      ...this.facturas.map(f => ({ ...f, _tipo: 'VENTA', _fechaOrden: this.obtenerFecha(f.fecha) })),
      ...this.pagosDeuda.map(d => ({ ...d, _tipo: 'PAGO_DEUDA', _fechaOrden: this.obtenerFecha(d.fechaPago) })),
      ...this.egresos.map(e => ({ ...e, _tipo: 'EGRESO', _fechaOrden: this.obtenerFecha(e.fecha) }))
    ].sort((a, b) => b._fechaOrden.getTime() - a._fechaOrden.getTime()); // Descendente (más reciente primero)

    console.log('📊 Totales calculados:', {
      ventas: this.totalVendido,
      pagosDeuda: this.totalPagosDeuda,
      egresos: this.totalEgresos,
      porMetodo: this.totalesPorMetodo,
      registrosTotales: this.registrosCombinados.length
    });
  }

  /**
   * Obtiene objeto Date desde diferentes formatos de fecha de Firestore
   */
  private obtenerFecha(fecha: any): Date {
    if (!fecha) return new Date(0);
    if (fecha.toDate) return fecha.toDate();
    if (fecha instanceof Date) return fecha;
    return new Date(fecha);
  }

  /**
   * Limpia todos los filtros y datos
   */
  limpiarFiltros(): void {
    // Limpiar cache del servicio
    this.reportesService.clearCache();
    
    // Limpiar datos locales
    this.facturas = [];
    this.pagosDeuda = [];
    this.egresos = [];
    this.registrosCombinados = [];
    this.datosReporte = false;
    this.paginaActual = 1;
    this.hayMasPaginas = false;
    
    // Resetear totales
    this.totalVendido = 0;
    this.totalPagosDeuda = 0;
    this.totalEgresos = 0;
    this.cantidadRegistros = 0;
    this.totalesPorMetodo = {};
    
    // Resetear fechas por defecto
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaDesde = this.formatearFechaInput(primerDiaMes);
    this.fechaHasta = this.formatearFechaInput(hoy);
    
    console.log('🗑️ Filtros y cache limpiados');
  }

  /**
   * Genera e imprime el reporte optimizado
   */
  imprimirReporte(): void {
    if (!this.datosReporte || this.facturas.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin Datos',
        text: 'No hay registros para imprimir. Aplique filtros y presione "Mostrar" primero.'
      });
      return;
    }

    const htmlReporte = this.generarHTMLReporte();
    const ventana = window.open('', 'PRINT', 'height=800,width=900');
    
    if (!ventana) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir la ventana de impresión.'
      });
      return;
    }

    ventana.document.write(htmlReporte);
    ventana.document.close();
    
    ventana.addEventListener('load', () => {
      ventana.focus();
      ventana.print();
      ventana.addEventListener('afterprint', () => ventana.close());
    });
  }

  /**
   * Genera HTML optimizado del reporte
   */
  private generarHTMLReporte(): string {
    const fechaReporte = new Date().toLocaleString('es-ES');
    
    // Filtros aplicados
    const filtrosAplicados: string[] = [];
    if (this.fechaDesde) {
      const [año, mes, dia] = this.fechaDesde.split('-');
      filtrosAplicados.push(`Desde: ${dia}/${mes}/${año}`);
    }
    if (this.fechaHasta) {
      const [año, mes, dia] = this.fechaHasta.split('-');
      filtrosAplicados.push(`Hasta: ${dia}/${mes}/${año}`);
    }
    filtrosAplicados.push(`Tipo: ${this.tipoReporte}`);
    if (this.metodoPagoFiltro !== 'TODOS') {
      filtrosAplicados.push(`Método: ${this.metodoPagoFiltro}`);
    }

    const filtrosTexto = `<div class="filtros">${filtrosAplicados.join(' | ')}</div>`;

    // Generar filas según tipo de reporte
    let filas = '';
    
    if (this.tipoReporte === 'VENTAS' || this.tipoReporte === 'COMPLETO') {
      filas += this.facturas.map(f => `
        <tr>
          <td>${this.formatoFecha(f.fecha)}</td>
          <td>Venta</td>
          <td>${f.idPersonalizado || f.id || '-'}</td>
          <td>${f.clienteNombre || 'Sin nombre'}</td>
          <td>${f.metodoPago}</td>
          <td class="text-right">${this.formatoMoneda(f.total)}</td>
        </tr>
      `).join('');
    }
    
    if (this.tipoReporte === 'DEUDAS' || this.tipoReporte === 'COMPLETO') {
      filas += this.pagosDeuda.map(d => `
        <tr style="background-color: #fff3e0;">
          <td>${this.formatoFecha(d.fechaPago)}</td>
          <td>Pago Deuda</td>
          <td>${d.facturaIdPersonalizado || '-'}</td>
          <td>${d.clienteNombre || 'Sin nombre'}</td>
          <td>${d.metodoPago}</td>
          <td class="text-right">${this.formatoMoneda(d.montoPagado)}</td>
        </tr>
      `).join('');
    }
    
    if (this.tipoReporte === 'EGRESOS' || this.tipoReporte === 'COMPLETO') {
      filas += this.egresos.map(e => `
        <tr style="background-color: #ffebee;">
          <td>${this.formatoFecha(e.fecha)}</td>
          <td>Egreso</td>
          <td>${e.comprobante || '-'}</td>
          <td>${e.descripcion || 'Sin descripción'}</td>
          <td>Efectivo</td>
          <td class="text-right">${this.formatoMoneda(e.monto)}</td>
        </tr>
      `).join('');
    }

    // Totales por método
    const totalesMetodo = Object.entries(this.totalesPorMetodo)
      .map(([metodo, total]) => `
        <div class="total-item">
          <span>${metodo}:</span>
          <span class="total-value">${this.formatoMoneda(total)}</span>
        </div>
      `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Ventas Generales</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 10px; 
            font-size: 10px;
            color: #000;
            background: #fff;
          }
          .header { 
            text-align: center; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #000; 
            padding-bottom: 10px; 
          }
          .header h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .header .empresa { font-size: 12px; font-weight: bold; margin-bottom: 2px; }
          .fecha-reporte { text-align: right; font-size: 8px; margin-bottom: 10px; }
          .filtros { 
            background: #f5f5f5; 
            padding: 6px; 
            margin-bottom: 12px; 
            font-size: 9px; 
            border: 1px solid #000;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { 
            background: #000; 
            color: #fff; 
            padding: 6px 4px; 
            text-align: left; 
            font-size: 9px;
            border: 1px solid #000;
          }
          td { padding: 5px 4px; border: 1px solid #000; font-size: 9px; }
          .text-right { text-align: right; }
          .resumen { border: 2px solid #000; padding: 10px; margin-top: 15px; }
          .resumen h3 { 
            font-size: 11px; 
            margin-bottom: 8px; 
            border-bottom: 1px solid #000; 
            padding-bottom: 4px;
          }
          .resumen-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 3px 0;
            font-size: 9px;
          }
          .resumen-item.total { 
            font-weight: bold; 
            font-size: 11px; 
            border-top: 2px solid #000; 
            padding-top: 6px; 
            margin-top: 4px; 
          }
          .total-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 3px 0; 
            font-size: 9px; 
          }
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
        </div>

        <div class="fecha-reporte">Generado: ${fechaReporte}</div>
        ${filtrosTexto}

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Nº Doc</th>
              <th>Cliente/Descripción</th>
              <th>Método Pago</th>
              <th class="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>

        <div class="resumen">
          <h3>RESUMEN</h3>
          <div class="resumen-item"><span>Total Ventas:</span><span>${this.cantidadRegistros}</span></div>
          <div class="resumen-item"><span>Total Pagos Deuda:</span><span>${this.pagosDeuda.length}</span></div>
          <div class="resumen-item"><span>Total Egresos:</span><span>${this.egresos.length}</span></div>
          <h4 style="font-size: 10px; margin: 6px 0 4px 0; font-weight: bold;">Desglose por Forma de Pago:</h4>
          ${totalesMetodo}
          <div class="resumen-item total">
            <span>TOTAL VENDIDO:</span>
            <span>${this.formatoMoneda(this.totalVendido)}</span>
          </div>
          ${this.totalPagosDeuda > 0 ? `<div class="resumen-item"><span>Total Pagos Deuda:</span><span>${this.formatoMoneda(this.totalPagosDeuda)}</span></div>` : ''}
          ${this.totalEgresos > 0 ? `<div class="resumen-item"><span>Total Egresos:</span><span>${this.formatoMoneda(this.totalEgresos)}</span></div>` : ''}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Formatear fecha
   */
  formatoFecha(fecha: Date | any): string {
    if (!fecha) return '-';
    
    const f = fecha.toDate ? fecha.toDate() : (fecha instanceof Date ? fecha : new Date(fecha));
    
    return f.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatear moneda
   */
  formatoMoneda(monto: number): string {
    return `$${monto.toFixed(2)}`;
  }

  /**
   * Volver al inicio
   */
  volver(): void {
    this.router.navigate(['/']);
  }
}
