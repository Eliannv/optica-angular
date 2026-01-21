import { Component, inject, OnInit } from '@angular/core';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { Router } from '@angular/router';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { combineLatest } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit {
  private cajaBancoService = inject(CajaBancoService);
  private cajaChicaService = inject(CajaChicaService);
  private router = inject(Router);

  cajas: CajaBanco[] = [];
  cajasChicas: CajaChica[] = [];
  movimientosGlobales: MovimientoCajaBanco[] = [];
  cargando = false;

  // Totales
  totales = {
    total_cajas: 0,
    total_ganado_cajas_chicas: 0,
    total_transferencias: 0,
    total_ingresos: 0,
    total_egresos: 0
  };

  ngOnInit(): void {
    this.cargarCajas();
    this.cargarCajasChicas();
    this.cargarMovimientosGlobales();
  }

  cargarCajas(): void {
    this.cargando = true;
    this.cajaBancoService.getCajasBanco().subscribe({
      next: (cajas) => {
        this.cajas = (cajas || []);
        this.calcularTotales();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar cajas:', error);
        this.cargando = false;
      }
    });
  }

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

  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-banco', cajaId, 'ver']);
  }

  async crearCajaBanco(): Promise<void> {
    const { value: formValues } = await Swal.fire({
      title: 'Crear Nueva Caja Banco',
      html: `
        <div style="text-align: left;">
          <div class="form-group" style="margin-bottom: 15px;">
            <label for="saldo_inicial" style="display: block; margin-bottom: 5px; font-weight: 600;">Saldo Inicial (USD):</label>
            <input 
              id="saldo_inicial" 
              type="number" 
              class="swal2-input" 
              placeholder="0.00" 
              value="0"
              step="0.01"
              min="0"
              style="width: 100%;"
            />
          </div>
          <div class="form-group">
            <label for="observacion" style="display: block; margin-bottom: 5px; font-weight: 600;">Observación (opcional):</label>
            <textarea 
              id="observacion" 
              class="swal2-input" 
              placeholder="Detalles sobre la apertura de caja..."
              rows="3"
              style="width: 100%; resize: vertical;"
            ></textarea>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Crear',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const saldoInput = (document.getElementById('saldo_inicial') as HTMLInputElement)?.value;
        const observacion = (document.getElementById('observacion') as HTMLTextAreaElement)?.value;
        
        const saldo = parseFloat(saldoInput || '0');
        if (isNaN(saldo) || saldo < 0) {
          Swal.showValidationMessage('El saldo inicial debe ser un número válido y mayor o igual a 0');
          return false;
        }
        
        return { saldo_inicial: saldo, observacion };
      }
    });

    if (!formValues) return;

    try {
      const nuevaCaja = {
        saldo_inicial: formValues.saldo_inicial,
        saldo_actual: formValues.saldo_inicial,
        estado: 'ABIERTA' as const,
        usuario_id: '',
        usuario_nombre: 'Sistema',
        observacion: formValues.observacion || '',
        fecha: new Date()
      };

      await this.cajaBancoService.abrirCajaBanco(nuevaCaja);
      
      Swal.fire({
        icon: 'success',
        title: '¡Caja creada!',
        text: `Caja banco creada con saldo inicial: $${formValues.saldo_inicial.toFixed(2)}`,
        timer: 2000,
        showConfirmButton: false
      });

      this.cargarCajas();
    } catch (error) {
      console.error('Error al crear caja banco:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear la caja banco. Intenta de nuevo.'
      });
    }
  }

  registrarMovimiento(): void {
    this.router.navigate(['/caja-banco/registrar-movimiento']);
  }

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
            <h1>ÓPTICA MACÍAS</h1>
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
            <p>Reporte mensual de Caja Banco - Óptica Macías</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // 🔹 Cerrar mes y abrir nuevo periodo
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

  getNombreMes(index: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[index] || '';
  }

  // 🔹 Eliminar una caja chica y restar el dinero de la caja banco
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

  // 🔹 Reactivar una caja chica desactivada
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
          // 🔹 Sumar el monto de la caja chica al saldo de la caja banco (se restó cuando se desactivó)
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

  // 🔹 Eliminar una caja banco
  async eliminarCajaBanco(cajaBanco: CajaBanco): Promise<void> {
    // Solo permitir eliminar si está CERRADA
    if (cajaBanco.estado !== 'CERRADA') {
      Swal.fire({
        title: '❌ No permitido',
        text: 'Solo puedes desactivar cajas que estén CERRADAS',
        icon: 'error'
      });
      return;
    }

    const resultado = await Swal.fire({
      title: '¿Desactivar Caja Banco?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaBanco.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaBanco.usuario_nombre || '-'}</p>
          <p><strong>Saldo Inicial:</strong> ${this.formatoMoneda(cajaBanco.saldo_inicial || 0)}</p>
          <p><strong>Saldo Actual:</strong> ${this.formatoMoneda(cajaBanco.saldo_actual || 0)}</p>
          <p><strong>Estado:</strong> ${cajaBanco.estado}</p>
          <p style="color: orange; margin-top: 1rem;"><strong>ℹ️ La caja se desactivará pero podrá ser reactivada</strong></p>
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
        await this.cajaBancoService.eliminarCajaBanco(cajaBanco.id!);
        
        // Recargar listas
        this.cargarCajas();

        Swal.fire({
          title: '✅ Desactivada',
          text: 'Caja banco desactivada correctamente',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al desactivar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo desactivar la caja banco',
          icon: 'error'
        });
      }
    }
  }

  getTotalGanado(): number {
    return this.totales.total_ganado_cajas_chicas;
  }

  getTotalTransferencias(): number {
    return this.totales.total_transferencias;
  }

  getTotalIngresos(): number {
    return this.totales.total_ingresos;
  }

  getTotalEgresos(): number {
    return this.totales.total_egresos;
  }

  getEstadoBadge(estado: string): string {
    if (estado === 'ABIERTA') return 'badge-success';
    if (estado === 'CERRADA') return 'badge-danger';
    return 'badge-secondary';
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  getColorTipo(tipo: string): string {
    return tipo === 'INGRESO' ? 'ingreso' : 'egreso';
  }
}
