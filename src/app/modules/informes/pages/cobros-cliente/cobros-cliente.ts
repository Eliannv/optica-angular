import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { CobrosService } from '../../../../core/services/cobros.service';
import { ClientesService } from '../../../../core/services/clientes';
import { Cobro, FiltrosCobros } from '../../../../core/models/cobro.model';

/**
 * Componente para listar y filtrar cobros de clientes.
 * 
 * **Funcionalidades:**
 * - Listado de todos los cobros con paginación
 * - Filtros por fecha, cliente, método de pago
 * - Búsqueda por nombre de cliente o número de factura
 * - Cálculo de totales y estadísticas
 * - Impresión de reporte de cobros
 * 
 * **Flujo:**
 * 1. Carga todos los cobros desde Firestore
 * 2. Aplica filtros seleccionados por el usuario
 * 3. Muestra resultados paginados
 * 4. Permite imprimir reporte con filtros aplicados
 */
@Component({
  selector: 'app-cobros-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobros-cliente.html',
  styleUrls: ['./cobros-cliente.css']
})
export class CobrosClienteComponent implements OnInit, OnDestroy {
  loading = true;
  cobros: Cobro[] = [];
  cobrosFiltrados: Cobro[] = [];
  
  // Paginación
  paginaActual = 1;
  itemsPorPagina = 20;
  totalPaginas = 1;

  // Filtros
  fechaInicio = '';
  fechaFin = '';
  clienteBusqueda = '';
  metodoPago = 'TODOS';
  soloCreditoPersonal = false;
  estadoPago: 'PENDIENTE' | 'PAGADA' | 'TODAS' = 'TODAS';

  // Totales
  totalCobrado = 0;
  totalCobrosPendientes = 0;
  totalCobrosPagadas = 0;
  totalesPorMetodo: { [key: string]: number } = {};

  // Clientes (para autocomplete)
  clientes: any[] = [];

  private subscription?: Subscription;

  constructor(
    private cobrosService: CobrosService,
    private clientesService: ClientesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarCobros();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Carga la lista de clientes para el buscador.
   */
  cargarClientes(): void {
    this.clientesService.getClientes().subscribe({
      next: (clientes) => {
        this.clientes = clientes;
      },
      error: (error) => {
        console.error('Error cargando clientes:', error);
      }
    });
  }

  /**
   * Carga todos los cobros desde Firestore.
   */
  cargarCobros(): void {
    this.loading = true;

    this.subscription = this.cobrosService.getCobros().subscribe({
      next: (cobros) => {
        this.cobros = cobros;
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando cobros:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los cobros. Intente nuevamente.'
        });
        this.loading = false;
      }
    });
  }

  /**
   * Aplica los filtros seleccionados a la lista de cobros.
   */
  aplicarFiltros(): void {
    let resultado = [...this.cobros];

    // Filtro por rango de fechas
    if (this.fechaInicio) {
      const inicio = new Date(this.fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      resultado = resultado.filter(c => c.fecha >= inicio);
    }

    if (this.fechaFin) {
      const fin = new Date(this.fechaFin);
      fin.setHours(23, 59, 59, 999);
      resultado = resultado.filter(c => c.fecha <= fin);
    }

    // Filtro por búsqueda de cliente o factura
    if (this.clienteBusqueda.trim()) {
      const busqueda = this.clienteBusqueda.toLowerCase().trim();
      resultado = resultado.filter(c => 
        c.clienteNombre.toLowerCase().includes(busqueda) ||
        c.facturaIdPersonalizado?.toLowerCase().includes(busqueda) ||
        c.facturaId.toLowerCase().includes(busqueda)
      );
    }

    // Filtro por método de pago
    if (this.metodoPago !== 'TODOS') {
      resultado = resultado.filter(c => c.metodoPago === this.metodoPago);
    }

    // Filtro por crédito personal
    if (this.soloCreditoPersonal) {
      resultado = resultado.filter(c => c.esCredito);
    }

    // Filtro por estado de pago
    if (this.estadoPago !== 'TODAS') {
      resultado = resultado.filter(c => c.estadoPago === this.estadoPago);
    }

    this.cobrosFiltrados = resultado;
    this.calcularTotales();
    this.calcularPaginacion();
    this.paginaActual = 1; // Resetear a primera página
  }

  /**
   * Calcula totales y estadísticas de los cobros filtrados.
   */
  calcularTotales(): void {
    this.totalCobrado = this.cobrosFiltrados.reduce((sum, c) => sum + c.monto, 0);
    
    this.totalCobrosPendientes = this.cobrosFiltrados
      .filter(c => c.estadoPago === 'PENDIENTE')
      .reduce((sum, c) => sum + c.monto, 0);
    
    this.totalCobrosPagadas = this.cobrosFiltrados
      .filter(c => c.estadoPago === 'PAGADA')
      .reduce((sum, c) => sum + c.monto, 0);

    // Agrupar por método de pago
    this.totalesPorMetodo = this.cobrosService.agruparPorMetodoPago(this.cobrosFiltrados);
  }

  /**
   * Calcula la paginación basada en los cobros filtrados.
   */
  calcularPaginacion(): void {
    this.totalPaginas = Math.ceil(this.cobrosFiltrados.length / this.itemsPorPagina);
    if (this.totalPaginas === 0) this.totalPaginas = 1;
  }

  /**
   * Obtiene los cobros de la página actual.
   */
  get cobrosPaginados(): Cobro[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.cobrosFiltrados.slice(inicio, fin);
  }

  /**
   * Navega a la página anterior.
   */
  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
    }
  }

  /**
   * Navega a la página siguiente.
   */
  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
    }
  }

  /**
   * Limpia todos los filtros aplicados.
   */
  limpiarFiltros(): void {
    this.fechaInicio = '';
    this.fechaFin = '';
    this.clienteBusqueda = '';
    this.metodoPago = 'TODOS';
    this.soloCreditoPersonal = false;
    this.estadoPago = 'TODAS';
    this.aplicarFiltros();
  }

  /**
   * Formatea una fecha a string legible.
   */
  formatoFecha(fecha: Date): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatea un monto como moneda.
   */
  formatoMoneda(monto: number): string {
    return `$${monto.toFixed(2)}`;
  }

  /**
   * Genera e imprime el reporte de cobros.
   */
  imprimirReporte(): void {
    if (this.cobrosFiltrados.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin Datos',
        text: 'No hay cobros para imprimir con los filtros aplicados.'
      });
      return;
    }

    const htmlReporte = this.generarHTMLReporte();
    const ventana = window.open('', 'PRINT', 'height=800,width=900');
    
    if (!ventana) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir la ventana de impresión. Verifique que no esté bloqueada por el navegador.'
      });
      return;
    }

    ventana.document.write(htmlReporte);
    ventana.document.close();
    
    ventana.addEventListener('load', () => {
      ventana.focus();
      ventana.print();
      
      ventana.addEventListener('afterprint', () => {
        ventana.close();
      });
    });
  }

  /**
   * Genera el HTML del reporte para impresión.
   */
  private generarHTMLReporte(): string {
    const fechaReporte = new Date().toLocaleString('es-ES');
    
    // Construir descripción de filtros aplicados
    const filtrosAplicados: string[] = [];
    if (this.fechaInicio) filtrosAplicados.push(`Desde: ${new Date(this.fechaInicio).toLocaleDateString('es-ES')}`);
    if (this.fechaFin) filtrosAplicados.push(`Hasta: ${new Date(this.fechaFin).toLocaleDateString('es-ES')}`);
    if (this.clienteBusqueda) filtrosAplicados.push(`Cliente: ${this.clienteBusqueda}`);
    if (this.metodoPago !== 'TODOS') filtrosAplicados.push(`Método: ${this.metodoPago}`);
    if (this.soloCreditoPersonal) filtrosAplicados.push('Solo Crédito Personal');
    if (this.estadoPago !== 'TODAS') filtrosAplicados.push(`Estado: ${this.estadoPago}`);

    const filtrosTexto = filtrosAplicados.length > 0 
      ? `<div class="filtros">Filtros aplicados: ${filtrosAplicados.join(' | ')}</div>`
      : '';

    // Generar filas de la tabla
    const filas = this.cobrosFiltrados.map(cobro => `
      <tr>
        <td>${cobro.facturaIdPersonalizado || cobro.facturaId}</td>
        <td>${this.formatoFecha(cobro.fecha)}</td>
        <td>${cobro.clienteNombre}</td>
        <td class="text-right">${this.formatoMoneda(cobro.totalFactura)}</td>
        <td class="text-right">${this.formatoMoneda(cobro.monto)}</td>
        <td class="text-right">${this.formatoMoneda(cobro.saldoPendiente)}</td>
        <td class="text-center">${cobro.metodoPago}</td>
        <td class="text-center">
          <span class="badge badge-${cobro.estadoPago === 'PAGADA' ? 'success' : 'warning'}">
            ${cobro.estadoPago}
          </span>
        </td>
      </tr>
    `).join('');

    // Generar filas de totales por método
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
        <title>Reporte de Cobros Cliente</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { font-size: 20px; margin-bottom: 5px; }
          .header .empresa { font-size: 14px; font-weight: bold; }
          .header .subtitulo { font-size: 12px; color: #666; }
          .fecha-reporte { text-align: right; font-size: 10px; color: #666; margin-bottom: 10px; }
          .filtros { background: #f5f5f5; padding: 8px; margin-bottom: 15px; font-size: 10px; border-left: 3px solid #007bff; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #333; color: white; padding: 8px; text-align: left; font-size: 10px; }
          td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
          tr:hover { background: #f9f9f9; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .badge { padding: 3px 8px; border-radius: 3px; font-size: 9px; font-weight: bold; }
          .badge-success { background: #28a745; color: white; }
          .badge-warning { background: #ffc107; color: #333; }
          .resumen { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
          .resumen h3 { font-size: 14px; margin-bottom: 10px; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
          .resumen-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .resumen-item { display: flex; justify-content: space-between; padding: 5px 0; }
          .resumen-item.total { font-weight: bold; font-size: 13px; border-top: 2px solid #333; padding-top: 8px; margin-top: 5px; }
          .total-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
          .total-value { font-weight: bold; color: #28a745; }
          @media print {
            @page { margin: 1cm; }
            body { padding: 0; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="empresa">ÓPTICA MACÍAS PASAJE</div>
          <h1>REPORTE DE COBROS CLIENTE</h1>
          <div class="subtitulo">Informe detallado de cobros realizados</div>
        </div>

        <div class="fecha-reporte">
          Generado el: ${fechaReporte}
        </div>

        ${filtrosTexto}

        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th class="text-right">Total Factura</th>
              <th class="text-right">Cobrado</th>
              <th class="text-right">Saldo</th>
              <th class="text-center">Método</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>

        <div class="resumen">
          <h3>RESUMEN FINANCIERO</h3>
          <div class="resumen-grid">
            <div>
              <div class="resumen-item">
                <span>Total de Cobros:</span>
                <span>${this.cobrosFiltrados.length}</span>
              </div>
              <div class="resumen-item">
                <span>Facturas Pagadas:</span>
                <span>${this.cobrosFiltrados.filter(c => c.estadoPago === 'PAGADA').length}</span>
              </div>
              <div class="resumen-item">
                <span>Facturas Pendientes:</span>
                <span>${this.cobrosFiltrados.filter(c => c.estadoPago === 'PENDIENTE').length}</span>
              </div>
            </div>
            <div>
              <h4 style="font-size: 12px; margin-bottom: 8px;">Totales por Método de Pago:</h4>
              ${totalesMetodo}
            </div>
          </div>
          <div class="resumen-item total">
            <span>TOTAL COBRADO:</span>
            <span style="color: #28a745; font-size: 16px;">${this.formatoMoneda(this.totalCobrado)}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Navega de regreso al inicio.
   */
  volver(): void {
    this.router.navigate(['/']);
  }
}
