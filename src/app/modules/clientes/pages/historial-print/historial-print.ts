import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
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

  loading = true;

  constructor(
    private route: ActivatedRoute,
    private clientesSrv: ClientesService,
    private historialSrv: HistorialClinicoService
  ) {}

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

      console.log('HISTORIAL CARGADO:', this.historial); // 🔥 CLAVE
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
}
