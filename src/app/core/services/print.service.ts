import { Injectable } from '@angular/core';
import { Cliente } from '../models/cliente.model';
import { HistoriaClinica } from '../models/historia-clinica.model';

/**
 * Servicio de impresión para documentos de la aplicación.
 *
 * Maneja la generación y apertura de vistas de impresión en ventanas emergentes
 * para tickets de historial clínico, facturas y otros documentos.
 */
@Injectable({
  providedIn: 'root'
})
export class PrintService {
  /**
   * Imprime un historial clínico en formato ticket de 80mm.
   *
   * @param cliente Cliente propietario del historial.
   * @param historial Historial clínico a imprimir.
   * @param facturas Array de facturas relacionadas.
   */
  imprimirHistorialClinico(
    cliente: Cliente,
    historial: HistoriaClinica,
    facturas: any[] = []
  ): void {
    const html = this.generarHTMLHistorial(cliente, historial, facturas);
    this.abrirVentanaDeImpresion('Historial Clínico', html);
  }

  /**
   * Genera el HTML para un ticket de historial clínico.
   */
  private generarHTMLHistorial(
    cliente: Cliente,
    historial: HistoriaClinica,
    facturas: any[]
  ): string {
    const ultimaFactura = this.obtenerUltimaFactura(facturas);
    const tieneArmazon = ultimaFactura ? this.tieneArmazon(ultimaFactura) : false;

    return `
      <div class="ticket">
        <div class="t-center t-bold">ÓPTICA MACÍAS PASAJE</div>
        <div class="t-center t-small">Historial Clínico</div>
        <div class="t-center t-small">Pasaje - Ecuador</div>

        <div class="t-hr"></div>

        <!-- Datos del cliente -->
        <div class="t-small">
          <div><b>Cliente:</b> ${cliente.nombres} ${cliente.apellidos}</div>
          <div><b>Cédula:</b> ${cliente.cedula || '-'}</div>
          <div><b>Tel:</b> ${cliente.telefono || '-'}</div>
          <div>
            <b>Fecha:</b> ${this.formatearFecha(cliente.createdAt)}
          </div>
        </div>

        <div class="t-hr"></div>

        <!-- Medidas -->
        <div class="t-bold t-small">MEDIDAS</div>

        <div class="t-small">
          <b>OD</b><br>
          Esf ${this.formatValue(historial.odEsfera)} Cil ${this.formatValue(historial.odCilindro)} Eje ${this.formatValue(historial.odEje)}<br>
          ACSV ${this.formatValue(historial.odAVSC)} AVCC ${this.formatValue(historial.odAVCC)}
        </div>

        <div class="t-small" style="margin-top:4px">
          <b>OI</b><br>
          Esf ${this.formatValue(historial.oiEsfera)} Cil ${this.formatValue(historial.oiCilindro)} Eje ${this.formatValue(historial.oiEje)}<br>
          ACSV ${this.formatValue(historial.oiAVSC)} AVCC ${this.formatValue(historial.oiAVCC)}
        </div>

        <div class="t-hr"></div>

        <!-- Medidas adicionales -->
        ${historial.add !== null && historial.add !== undefined ? `<div class="t-small"><b>ADD:</b> ${this.formatearNumero(historial.add)}</div>` : ''}
        ${historial.dp !== null && historial.dp !== undefined ? `<div class="t-small"><b>DP:</b> ${this.formatearNumero(historial.dp)}</div>` : ''}
        ${historial.altura !== null && historial.altura !== undefined ? `<div class="t-small"><b>Altura:</b> ${this.formatearNumero(historial.altura)} cm</div>` : ''}
        ${historial.de ? `<div class="t-small"><b>DE:</b> ${historial.de}</div>` : ''}
        ${historial.color ? `<div class="t-small"><b>Color:</b> ${historial.color}</div>` : ''}

        ${historial.add !== null && historial.add !== undefined && historial.add > 0 ? `
          <div class="t-hr"></div>
          <div class="t-bold t-small">MEDIDAS DEL ARMAZÓN</div>
          <div class="t-small" style="margin-top:4px">
            ${historial.armazonH !== null && historial.armazonH !== undefined ? `<div><b>H (Ancho):</b> ${this.formatearNumero(historial.armazonH)} mm</div>` : ''}
            ${historial.armazonV !== null && historial.armazonV !== undefined ? `<div><b>V (Alto):</b> ${this.formatearNumero(historial.armazonV)} mm</div>` : ''}
            ${historial.armazonDM !== null && historial.armazonDM !== undefined ? `<div><b>DM (Diag. Mayor):</b> ${this.formatearNumero(historial.armazonDM)} mm</div>` : ''}
            ${historial.armazonP !== null && historial.armazonP !== undefined ? `<div><b>P (Puente):</b> ${this.formatearNumero(historial.armazonP)} mm</div>` : ''}
            ${historial.armazonTipo ? `<div><b>Tipo:</b> ${historial.armazonTipo}</div>` : ''}
          </div>
        ` : ''}

        <div class="t-hr"></div>

        <!-- Observaciones -->
        ${historial.observacion ? `<div class="t-small"><b>Obs:</b><br> ${historial.observacion}</div><div class="t-hr"></div>` : ''}

        <!-- Información de registro -->
        <div class="t-small">
          ${historial.doctor ? `<div><b>Doctor:</b> ${historial.doctor}</div>` : ''}
          <div>
            <b>Registro:</b> ${this.formatearFecha(historial.fechaHoraChequeo || historial.createdAt)}
          </div>
        </div>

        ${ultimaFactura ? `
          <div class="t-hr"></div>
          <div class="t-bold t-small">FACTURA MÁS RECIENTE</div>
          <div class="t-small" style="margin-bottom: 12px;">
            <div><b>Fac:</b> ${ultimaFactura.id || '-'}</div>
            <div><b>Total:</b> $${this.formatearNumero(ultimaFactura.total)}</div>
            <div><b>Abono:</b> $${this.formatearNumero(ultimaFactura.abonado)}</div>
            <div><b>Restante:</b> $${this.formatearNumero(this.calcularTotalRestante(ultimaFactura))}</div>
            <div style="color: #333; margin-top: 4px;">
              ${tieneArmazon ? '✓ Armazón Incluido' : '- Armazón Propio'}
            </div>
          </div>
        ` : ''}

        <div class="t-hr"></div>

        <div class="t-center t-small">Documento informativo</div>
        <div class="t-center t-small">No válido como factura</div>
      </div>
    `;
  }

  /**
   * Abre una ventana emergente con contenido HTML para impresión.
   *
   * @param titulo Título del documento para la ventana de impresión.
   * @param html Contenido HTML a imprimir.
   */
  private abrirVentanaDeImpresion(titulo: string, html: string): void {
    setTimeout(() => {
      const w = window.open('', 'PRINT', 'height=600,width=380');
      if (!w) {
        console.error('No se pudo abrir ventana de impresión');
        return;
      }

      const styles = `
        html, body { margin: 0; padding: 0; width: 80mm; background: #fff; font-family: monospace; }
        .ticket { padding: 6px 4px; font-size: 12px; line-height: 1.2; width: 80mm; box-sizing: border-box; }
        .t-center { text-align: center; }
        .t-right { text-align: right; }
        .t-bold { font-weight: 700; }
        .t-hr { border-top: 1px dashed #000; margin: 6px 0; }
        .t-small { font-size: 11px; }
        .t-kv { display: flex; justify-content: space-between; gap: 4px; }
        .t-kv span:first-child { width: 32mm; }
        .t-kv span:last-child { flex: 1; text-align: right; }
        @media print { @page { size: 80mm auto; margin: 0; } html, body { width: 80mm; margin: 0; padding: 0; } .ticket { width: 80mm; } }
      `;

      w.document.write(`
        <html>
          <head>
            <title>${titulo}</title>
            <style>${styles}</style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `);
      w.document.close();

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
          setTimeout(safeClose, 2000);
        } catch {
          safeClose();
        }
      };

      if (w.document.readyState === 'complete') {
        setTimeout(triggerPrint, 150);
      } else {
        w.onload = () => setTimeout(triggerPrint, 150);
      }
    }, 50);
  }

  /**
   * Obtiene la factura más reciente de un array de facturas.
   */
  private obtenerUltimaFactura(facturas: any[]): any {
    if (!facturas || facturas.length === 0) return null;

    const sorted = [...facturas].sort((a, b) => {
      const fechaA = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
      const fechaB = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
      return fechaB - fechaA;
    });

    return sorted[0] || null;
  }

  /**
   * Verifica si una factura contiene un armazón entre sus ítems.
   */
  private tieneArmazon(factura: any): boolean {
    return factura?.items?.some((item: any) => item?.tipo === 'armazon' || item?.armazon);
  }

  /**
   * Calcula el monto restante por pagar de una factura.
   */
  private calcularTotalRestante(factura: any): number {
    const total = factura?.total || 0;
    const abonado = factura?.abonado || 0;
    return total - abonado;
  }

  /**
   * Formatea un valor numérico para la impresión.
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined || value === '' || value === 'N/A') {
      return '-';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return '-';
    }

    return numValue.toFixed(2);
  }

  /**
   * Formatea un número con 2 decimales.
   */
  private formatearNumero(value: any): string {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '-' : num.toFixed(2);
  }

  /**
   * Formatea una fecha para visualización.
   */
  private formatearFecha(fecha: any): string {
    if (!fecha) return 'Sin fecha';

    try {
      let dateObj: Date;
      if (typeof fecha.toDate === 'function') {
        dateObj = fecha.toDate();
      } else if (fecha instanceof Date) {
        dateObj = fecha;
      } else {
        return 'Sin fecha';
      }

      return dateObj.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Sin fecha';
    }
  }
}
