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
  /** Ruta activa para obtener parámetros */
  private route = inject(ActivatedRoute);

  /** Router para navegación */
  private router = inject(Router);

  /** Servicio de cajas banco */
  private cajaBancoService = inject(CajaBancoService);

  /** Servicio de cajas chicas */
  private cajaChicaService = inject(CajaChicaService);

  /** Caja banco actual siendo visualizada */
  caja: CajaBanco | null = null;

  /** Cajas chicas cerradas del mismo período de la caja banco */
  cajasChicas: CajaChica[] = [];

  /** Movimientos asociados a esta caja banco */
  movimientos: MovimientoCajaBanco[] = [];

  /** Estado de carga de datos */
  cargando = false;

  /** ID de la caja banco (parámetro de ruta) */
  cajaId: string = '';

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
    let ingresosCajasChicas = 0;
    let ingresosOtros = 0;
    let egresos = 0;

    // 1. Sumar ingresos de cajas chicas (ya están filtradas por estado CERRADA y mismo día en cargarCajasChicas)
    (this.cajasChicas || []).forEach(cc => {
      ingresosCajasChicas += cc.monto_actual || 0;
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

    // El saldo_actual ahora viene directamente de Firestore en caja.saldo_actual
    // No es necesario calcularlo aquí
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
      state: { cajaId: this.cajaId }
    });
  }

  /**
   * Navega a la página de detalles de una caja chica.
   *
   * @param cajaChicaId - ID de la caja chica a visualizar
   */
  verCajaChica(cajaChicaId: string): void {
    // Redirigir a ver-caja de caja chica
    this.router.navigate(['/caja-chica/ver', cajaChicaId]);
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

    // Calcular ingresos de cajas chicas
    const ingresosCajasChicas = cajasChicas.reduce((sum, cc) => sum + (cc.monto_actual || 0), 0);
    // Calcular otros ingresos (movimientos de tipo INGRESO)
    const ingresosOtros = movimientos.filter(m => m.tipo === 'INGRESO').reduce((sum, m) => sum + (m.monto || 0), 0);
    // Total de ingresos
    const totalIngresos = ingresosCajasChicas + ingresosOtros;
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
