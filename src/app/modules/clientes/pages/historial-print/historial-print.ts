/**
 * Componente para la impresión del historial clínico en formato ticket.
 *
 * Este componente genera una vista optimizada para impresión en papel térmico de 80mm,
 * incluyendo los datos del cliente, su historial clínico oftalmológico completo,
 * y la información de la factura más reciente si existe.
 *
 * El proceso de impresión se activa automáticamente tras la carga de datos,
 * abriendo una ventana emergente con el contenido formateado y lanzando el
 * diálogo de impresión del navegador.
 */

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { FacturasService } from '../../../../core/services/facturas';
import { Cliente } from '../../../../core/models/cliente.model';
import { HistoriaClinica } from '../../../../core/models/historia-clinica.model';

@Component({
  standalone: true,
  selector: 'app-historial-print',
  imports: [CommonModule],
  templateUrl: './historial-print.html',
  styleUrl: './historial-print.css'
})
export class HistorialPrintComponent implements OnInit {

  clienteId!: string;
  cliente!: Cliente;
  historial!: HistoriaClinica;
  facturas: any[] = [];
  loading = true;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly clientesSrv: ClientesService,
    private readonly historialSrv: HistorialClinicoService,
    private readonly facturasSrv: FacturasService
  ) {}

  /**
   * Inicializa el componente y activa el proceso de impresión automática.
   *
   * Carga en secuencia los datos del cliente, su historial clínico y sus facturas
   * pendientes desde Firestore. Una vez completada la carga, genera automáticamente
   * una ventana emergente con el contenido del ticket formateado y lanza el diálogo
   * de impresión del navegador.
   */
  async ngOnInit() {
    try {
      this.clienteId = this.route.snapshot.paramMap.get('id')!;

      // Cliente
      this.cliente = await firstValueFrom(
        this.clientesSrv.getClienteById(this.clienteId)
      );

      // Historial
      const snap = await this.historialSrv.obtenerHistorial(this.clienteId);

      if (!snap.exists()) {
        throw new Error('No existe historial clínico');
      }

      this.historial = snap.data() as HistoriaClinica;

      this.facturas = await firstValueFrom(
        this.facturasSrv.getPendientesPorCliente(this.clienteId)
      );
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }

    // Auto imprimir con ventana dedicada (mismo patrón que factura)
    setTimeout(() => {
      const ticket = document.querySelector('.ticket') as HTMLElement | null;
      if (!ticket) return;

      const w = window.open('', 'PRINT', 'height=600,width=380');
      if (!w) return;

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
            <title>Historial Clínico</title>
            <style>${styles}</style>
          </head>
          <body>
            ${ticket.outerHTML}
          </body>
        </html>
      `);
      w.document.close();

      const triggerPrint = () => {
        let closed = false;
        const safeClose = () => { if (closed) return; closed = true; w.close(); };
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
    }, 300);
  }

  /**
   * Verifica si una factura contiene un armazón entre sus ítems.
   *
   * @param factura Factura a verificar.
   * @returns true si la factura incluye un ítem de tipo 'armazon', false en caso contrario.
   */
  tieneArmazon(factura: any): boolean {
    return factura?.items?.some((item: any) => item?.tipo === 'armazon' || item?.armazon);
  }

  /**
   * Calcula el monto restante por pagar de una factura.
   *
   * @param factura Factura a calcular.
   * @returns Monto pendiente (total - abonado).
   */
  calcularTotalRestante(factura: any): number {
    const total = factura?.total || 0;
    const abonado = factura?.abonado || 0;
    return total - abonado;
  }

  /**
   * Obtiene la factura más reciente del cliente.
   *
   * Ordena las facturas por fecha de creación descendente y retorna la primera
   * (la más reciente). Útil para mostrar solo la última factura en el ticket.
   *
   * @returns La factura más reciente o null si no hay facturas.
   */
  obtenerUltimaFactura(): any {
    if (!this.facturas || this.facturas.length === 0) return null;

    const sorted = [...this.facturas].sort((a, b) => {
      const fechaA = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
      const fechaB = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
      return fechaB - fechaA;
    });

    return sorted[0] || null;
  }
}