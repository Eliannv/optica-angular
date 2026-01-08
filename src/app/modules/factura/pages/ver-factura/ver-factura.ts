import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FacturasService } from '../../../../core/services/facturas';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { firstValueFrom } from 'rxjs';
import { ProductosService } from '../../../../core/services/productos';

@Component({
  selector: 'app-ver-factura',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ver-factura.html',
  styleUrl: './ver-factura.css'
})
export class VerFacturaComponent implements OnDestroy {
  factura: any = null;
  loading = true;

  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private facturasSrv: FacturasService,
    private productosSrv: ProductosService
  ) {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.sub = this.facturasSrv.getFacturaById(id).subscribe(f => {
      this.factura = f;
      this.loading = false;
    });
  }

  volver() {
    this.router.navigate(['/facturas']);
  }

  async reimprimir() {
    if (!this.factura) return;

    // Enriquecer con códigos reales si no vinieron
    if (Array.isArray(this.factura.items)) {
      for (const it of this.factura.items) {
        if (!it.codigo && it.productoId) {
          try {
            const prod: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));
            it.codigo = prod?.codigo || it.codigo || it.productoId;
          } catch (err) {
            it.codigo = it.codigo || it.productoId;
          }
        }
      }
    }

    const ticket = document.querySelector('.ticket');
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
      .t-kv { display: flex; justify-content: space-between; gap: 4px; }
      .t-kv span:first-child { width: 32mm; }
      .t-kv span:last-child { flex: 1; text-align: right; }
      .t-table-head, .t-table-row { display: grid; grid-template-columns: 8mm 30mm 8mm 12mm 12mm; column-gap: 2mm; row-gap: 0; align-items: center; }
      .t-table-head { font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 4px; }
      .t-table-row { margin: 0 0 2px 0; }
      .t-cell { display: block; }
      .t-cut { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .t-small { font-size: 11px; }
      @media print {
        @page { size: 80mm auto; margin: 0; }
        html, body { width: 80mm; margin: 0; padding: 0; }
        .ticket { width: 80mm; }
      }
    `;

    w.document.write(`
      <html>
        <head>
          <title>Ticket</title>
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
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    document.body.classList.remove('print-ticket');
  }
}

