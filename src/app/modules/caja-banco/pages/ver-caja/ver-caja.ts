import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cajaBancoService = inject(CajaBancoService);
  private cajaChicaService = inject(CajaChicaService);

  caja: CajaBanco | null = null;
  cajasChicas: CajaChica[] = [];
  movimientos: MovimientoCajaBanco[] = [];
  cargando = false;
  cajaId: string = '';
  resumen = {
    total_ingresos: 0,
    total_egresos: 0,
    ingresos_cajas_chicas: 0,
    ingresos_otros: 0
  };

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.cajaId = params['id'];
      if (this.cajaId) {
        this.cargarDatos();
      }
    });
  }

  cargarDatos(): void {
    this.cargando = true;
    this.cajaBancoService.getCajaBancoById(this.cajaId).subscribe(c => {
      this.caja = c;
      // Asociar movimientos antiguos que no tengan caja_banco_id
      this.cajaBancoService.asociarMovimientosAntiguos(this.cajaId).then(() => {
        this.cargarCajasChicas();
      });
    });
    this.cajaBancoService.getMovimientosCajaBanco(this.cajaId).subscribe({
      next: (movimientos) => {
        console.log('Movimientos cargados para caja:', this.cajaId, movimientos);
        this.movimientos = movimientos || [];
        this.calcularResumen();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar caja:', error);
        this.cargando = false;
      }
    });
  }

  cargarCajasChicas(): void {
    if (!this.caja?.fecha) return;
    const fecha = this.caja.fecha instanceof Date ? this.caja.fecha : (this.caja.fecha as any).toDate?.() || new Date(this.caja.fecha);
    
    // Obtener todas las cajas chicas cerradas del mes de la caja banco
    const year = fecha.getFullYear();
    const mes = fecha.getMonth();
    
    this.cajaChicaService.getCajasChicasPorMes(year, mes).subscribe(todas => {
      // Filtrar solo las cajas chicas CERRADAS del mes
      this.cajasChicas = (todas || []).filter(cc => cc.estado === 'CERRADA');
      // Recalcular resumen cuando se cargan las cajas chicas
      this.calcularResumen();
    });
  }

  calcularResumen(): void {
    let ingresosCajasChicas = 0;
    let ingresosOtros = 0;
    let egresos = 0;
    
    // 1. Sumar ingresos de cajas chicas CERRADAS del mismo día
    (this.cajasChicas || []).forEach(cc => {
      if (cc.estado === 'CERRADA') {
        ingresosCajasChicas += cc.monto_actual || 0;
      }
    });
    
    // 2. Sumar movimientos de ingresos/egresos
    (this.movimientos || []).forEach(m => {
      if (m.tipo === 'INGRESO') {
        // Todos los ingresos registrados como movimientos van a "Otros Ingresos"
        // (incluyendo CIERRE_CAJA_CHICA, TRANSFERENCIA_CLIENTE, etc)
        ingresosOtros += m.monto || 0;
      } else if (m.tipo === 'EGRESO') {
        egresos += m.monto || 0;
      }
    });
    
    this.resumen.ingresos_cajas_chicas = ingresosCajasChicas;
    this.resumen.ingresos_otros = ingresosOtros;
    this.resumen.total_ingresos = ingresosCajasChicas + ingresosOtros;
    this.resumen.total_egresos = egresos;
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  volver(): void {
    this.router.navigate(['/caja-banco']);
  }

  registrarMovimiento(): void {
    this.router.navigate(['/caja-banco/registrar-movimiento'], {
      state: { cajaId: this.cajaId }
    });
  }

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

  private generarReporteCajaActual(caja: CajaBanco, movimientos: MovimientoCajaBanco[], cajasChicas: CajaChica[]): string {
    const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const fechaCaja = caja.fecha instanceof Date ? caja.fecha : (caja.fecha as any).toDate?.() || new Date(caja.fecha);
    const mesIndex = fechaCaja.getMonth();
    const year = fechaCaja.getFullYear();

    const totalIngresos = movimientos.filter(m => m.tipo === 'INGRESO').reduce((sum, m) => sum + (m.monto || 0), 0);
    const totalEgresos = movimientos.filter(m => m.tipo === 'EGRESO').reduce((sum, m) => sum + (m.monto || 0), 0);
    const saldoFinal = caja.saldo_inicial! + totalIngresos - totalEgresos;

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
            <h1>ÓPTICA MACÍAS</h1>
            <h2>REPORTE CAJA BANCO</h2>
            <div class="fecha-reporte">Fecha: ${this.formatoFecha(caja.fecha)}</div>
          </div>
          
          <div class="reporte-resumen">
            <h3>RESUMEN FINANCIERO</h3>
            <div class="reporte-resumen-item">
              <span>Saldo Inicial:</span>
              <span>${this.formatoMoneda(caja.saldo_inicial || 0)}</span>
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
