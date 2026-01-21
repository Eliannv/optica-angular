import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CajaChica, MovimientoCajaChica, ResumenCajaChica } from '../../../../core/models/caja-chica.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ver-caja',
  standalone: false,
  templateUrl: './ver-caja.html',
  styleUrls: ['./ver-caja.css']
})
export class VerCajaComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  cajaId: string = '';
  caja: CajaChica | null = null;
  movimientos: MovimientoCajaChica[] = [];
  resumen: ResumenCajaChica | null = null;
  cargando = false;
  error = '';
  esAdmin = false;

  ngOnInit(): void {
    this.cajaId = this.route.snapshot.paramMap.get('id') || '';
    this.esAdmin = this.authService.isAdmin();
    this.cargarDetalles();
  }

  cargarDetalles(): void {
    if (!this.cajaId) return;

    this.cargando = true;
    this.error = '';

    // Cargar caja
    this.cajaChicaService.getCajaChicaById(this.cajaId).subscribe({
      next: (caja) => {
        this.caja = caja;
      },
      error: (error) => {
        console.error('Error al cargar caja:', error);
        this.error = 'Error al cargar la caja chica';
      }
    });

    // Cargar movimientos
    this.cajaChicaService.getMovimientosCajaChica(this.cajaId).subscribe({
      next: (movimientos) => {
        this.movimientos = movimientos;
      },
      error: (error) => {
        console.error('Error al cargar movimientos:', error);
      }
    });

    // Cargar resumen
    this.cajaChicaService.getResumenCajaChica(this.cajaId).then(
      (resumen) => {
        this.resumen = resumen;
        this.cargando = false;
      },
      (error) => {
        console.error('Error al cargar resumen:', error);
        this.cargando = false;
      }
    );
  }

  registrarMovimiento(): void {
    this.router.navigate(['/caja-chica/registrar', this.cajaId]);
  }

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
      const usuario = this.authService.getCurrentUser();

      // Crear fecha normalizada a medianoche en zona horaria local
      const hoy = new Date();
      const fechaNormalizada = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);

      // Buscar si existe Caja Banco para el mismo día
      const cajasBanco = await firstValueFrom(this.cajaBancoService.getCajasBanco());
      const cajaBancoHoy = cajasBanco.find(c => {
        const fechaCaja = c.fecha instanceof Date 
          ? new Date(c.fecha) 
          : (c.fecha && typeof c.fecha === 'object' && 'toDate' in c.fecha)
            ? (c.fecha as any).toDate()
            : new Date(c.fecha || new Date());
        fechaCaja.setHours(0, 0, 0, 0);
        const hoyNormalizado = new Date(fechaNormalizada);
        return fechaCaja.getTime() === hoyNormalizado.getTime();
      });

      // Si existe Caja Banco, sumar el monto al saldo actual
      if (cajaBancoHoy?.id) {
        const nuevoSaldo = (cajaBancoHoy.saldo_actual || 0) + montoActual;
        await this.cajaBancoService.actualizarSaldoCajaBanco(cajaBancoHoy.id, nuevoSaldo);
      } else {
        // Si no existe, crearla
        await this.cajaBancoService.abrirCajaBanco({
          fecha: fechaNormalizada,
          saldo_inicial: 0,
          saldo_actual: montoActual,
          estado: 'ABIERTA',
          usuario_id: usuario?.id,
          usuario_nombre: usuario?.nombre,
          observacion: 'Caja Banco creada automáticamente'
        });
      }

      // Cerrar la Caja Chica
      await this.cajaChicaService.cerrarCajaChica(this.cajaId, montoActual);

      // 🗑️ Limpiar localStorage
      localStorage.removeItem('cajaChicaAbierta');

      // Preguntar si desea imprimir el reporte
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

  async eliminarMovimiento(movimientoId: string): Promise<void> {
    const confirmar = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar movimiento',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmar.isConfirmed) return;

    try {
      await this.cajaChicaService.eliminarMovimiento(this.cajaId, movimientoId);
      await Swal.fire({
        icon: 'success',
        title: 'Movimiento eliminado',
        timer: 1500,
        showConfirmButton: false
      });
      this.cargarDetalles();
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al eliminar el movimiento'
      });
    }
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  formatoHora(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatoMoneda(monto: number | undefined): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  getTipoBadgeClass(tipo: string): string {
    return tipo === 'INGRESO' ? 'badge-success' : 'badge-warning';
  }

  volver(): void {
    this.router.navigate(['/caja-chica']);
  }

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

      // Abrir ventana de impresión directa
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
   * Genera el HTML del reporte de cierre de caja chica
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
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #333;
            background: #fff;
            padding: 20px;
          }
          
          .reporte-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
          }
          
          .reporte-header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          
          .reporte-header h1 {
            font-size: 20px;
            margin-bottom: 5px;
            font-weight: bold;
          }
          
          .reporte-header h2 {
            font-size: 14px;
            margin-bottom: 8px;
            font-weight: normal;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .fecha-reporte {
            font-size: 10px;
            color: #666;
          }
          
          .reporte-info {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
            background: #f8f8f8;
            padding: 12px;
            border-radius: 4px;
          }
          
          .reporte-info-item {
            display: flex;
            flex-direction: column;
          }
          
          .reporte-info-item .label {
            font-weight: bold;
            font-size: 10px;
            color: #666;
            margin-bottom: 3px;
          }
          
          .reporte-info-item .value {
            font-size: 11px;
            color: #333;
          }
          
          .reporte-resumen {
            background: #f0f0f0;
            padding: 12px;
            margin-bottom: 20px;
            border-left: 4px solid #007bff;
            border-radius: 3px;
          }
          
          .reporte-resumen h3 {
            font-size: 12px;
            margin-bottom: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #ddd;
            padding-bottom: 8px;
          }
          
          .reporte-resumen-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 11px;
          }
          
          .reporte-resumen-item span:first-child {
            font-weight: 500;
          }
          
          .reporte-resumen-item.total-final {
            background: white;
            padding: 8px;
            margin-top: 8px;
            border-top: 2px solid #333;
            font-weight: bold;
            font-size: 12px;
          }
          
          .tipo-ingreso {
            color: #28a745;
            font-weight: bold;
          }
          
          .tipo-egreso {
            color: #dc3545;
            font-weight: bold;
          }
          
          .reporte-section {
            margin-bottom: 20px;
          }
          
          .reporte-section h3 {
            font-size: 12px;
            margin-bottom: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #333;
            padding-bottom: 8px;
          }
          
          .reporte-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          
          .reporte-table thead {
            background: #e0e0e0;
            font-weight: bold;
          }
          
          .reporte-table th {
            padding: 8px 5px;
            text-align: left;
            border: 1px solid #999;
            font-size: 9px;
          }
          
          .reporte-table td {
            padding: 7px 5px;
            border: 1px solid #ddd;
          }
          
          .reporte-table tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          
          .reporte-table tbody tr:hover {
            background: #f0f0f0;
          }
          
          .text-center {
            text-align: center;
          }
          
          .text-right {
            text-align: right;
          }
          
          .reporte-empty {
            text-align: center;
            padding: 20px;
            background: #f8f8f8;
            color: #999;
            border-radius: 4px;
          }
          
          .reporte-firma {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            margin-bottom: 20px;
          }
          
          .reporte-firma-item {
            flex: 1;
            text-align: center;
            font-size: 10px;
          }
          
          .reporte-firma-item .linea {
            width: 80%;
            height: 1px;
            background: #000;
            margin: 30px auto 5px;
          }
          
          .reporte-firma-item small {
            display: block;
            font-size: 9px;
            color: #666;
            margin-top: 3px;
          }
          
          .reporte-footer {
            text-align: center;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 20px;
            font-size: 9px;
            color: #999;
          }
          
          .reporte-footer p {
            margin: 3px 0;
          }
          
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            
            .reporte-container {
              box-shadow: none;
            }
            
            .reporte-table tbody tr {
              page-break-inside: avoid;
            }
            
            .reporte-section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="reporte-container">
          <!-- HEADER -->
          <div class="reporte-header">
            <h1>ÓPTICA MACÍAS</h1>
            <h2>REPORTE DE CIERRE DE CAJA CHICA</h2>
            <div class="fecha-reporte">Fecha de impresión: ${formatoFecha(data.fechaReporte)}</div>
          </div>
          
          <!-- INFORMACIÓN GENERAL -->
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
          
          <!-- RESUMEN FINANCIERO -->
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
          
          <!-- DETALLE DE MOVIMIENTOS -->
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
                <tbody>
                  ${filasMovimientos}
                </tbody>
              </table>
            ` : `
              <div class="reporte-empty">No se registraron movimientos en esta caja</div>
            `}
          </div>
          
          ${data.caja.observacion ? `
            <!-- OBSERVACIONES -->
            <div class="reporte-section">
              <h3>OBSERVACIONES</h3>
              <p>${data.caja.observacion}</p>
            </div>
          ` : ''}
          
          <!-- FIRMAS -->
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
          
          <!-- FOOTER -->
          <div class="reporte-footer">
            <p>Este documento es un reporte interno de cierre de caja chica</p>
            <p>Generado por el Sistema de Gestión - Óptica Macías</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
