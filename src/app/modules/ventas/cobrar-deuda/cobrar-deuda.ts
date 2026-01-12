import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../core/services/clientes';
import { FacturasService } from '../../../core/services/facturas';
import { ProductosService } from '../../../core/services/productos';
import { CajaChicaService } from '../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../core/services/caja-banco.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-cobrar-deuda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobrar-deuda.html',
  styleUrls: ['./cobrar-deuda.css'], // aquí copiamos el CSS de crear-venta
})
export class CobrarDeudaComponent implements OnInit, OnDestroy {
  loading = true;

  clienteId = '';
  clienteNombre = '';

  pendientes: any[] = [];
  deudaTotal = 0;

  facturaSeleccionada: any = null;

  metodoPago = 'Efectivo';
  abono = 0;
  saldoNuevo = 0;

  pagando = false;
  sub?: Subscription;

  // ✅ ticket
  ticketPago: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientesSrv: ClientesService,
    private facturasSrv: FacturasService,
    private productosSrv: ProductosService,
    private cajaChicaService: CajaChicaService,
    private cajaBancoService: CajaBancoService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';
    if (!this.clienteId) {
      this.router.navigate(['/clientes/historial-clinico']);
      return;
    }

    try {
      const cli = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));
      this.clienteNombre = `${cli?.nombres || ''} ${cli?.apellidos || ''}`.trim();

      this.sub = this.facturasSrv.getPendientesPorCliente(this.clienteId).subscribe(list => {
        this.pendientes = list || [];
        this.deudaTotal = +this.pendientes.reduce((acc, f) => acc + Number(f?.saldoPendiente || 0), 0).toFixed(2);

        // si la seleccionada ya no existe (pagada), limpiar
        if (this.facturaSeleccionada) {
          const still = this.pendientes.find(x => x.id === this.facturaSeleccionada.id);
          if (!still) {
            this.facturaSeleccionada = null;
            this.abono = 0;
            this.saldoNuevo = 0;
          } else {
            // refrescar datos en pantalla
            this.facturaSeleccionada = still;
            this.recalcularSaldoNuevo();
          }
        }
      });
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  seleccionarFactura(f: any) {
    this.facturaSeleccionada = f;
    this.abono = 0;
    this.metodoPago = 'Efectivo';
    this.recalcularSaldoNuevo();
  }

  onChangeAbono(value: any) {
    const saldo = Number(this.facturaSeleccionada?.saldoPendiente || 0);
    const n = Math.max(0, Number(value || 0));
    this.abono = Math.min(n, saldo);
    this.recalcularSaldoNuevo();
  }

  private recalcularSaldoNuevo() {
    const saldo = Number(this.facturaSeleccionada?.saldoPendiente || 0);
    this.saldoNuevo = +(saldo - this.abono).toFixed(2);
    if (this.saldoNuevo < 0) this.saldoNuevo = 0;
  }

  async registrarAbono() {
    if (!this.facturaSeleccionada || this.abono <= 0 || this.pagando) return;

    this.pagando = true;

    try {
      const f = this.facturaSeleccionada;

      const total = Number(f?.total || 0);
      const abonadoAnterior = Number(f?.abonado || 0);
      const saldoAnterior = Number(f?.saldoPendiente || 0);

      const abonoReal = Math.min(this.abono, saldoAnterior);

      const abonadoNuevo = +(abonadoAnterior + abonoReal).toFixed(2);
      const saldoNuevo = +(total - abonadoNuevo).toFixed(2);
      const estadoPago = saldoNuevo <= 0 ? 'PAGADA' : 'PENDIENTE';

      await this.facturasSrv.actualizarPagoFactura(f.id, {
        abonado: abonadoNuevo,
        saldoPendiente: Math.max(0, saldoNuevo),
        estadoPago,
        metodoPago: this.metodoPago,
      });

      // ✅ enriquecer ítems con código real si falta
      const items = Array.isArray(f.items) ? [...f.items] : [];
      for (const it of items) {
        if (!it.codigo && it.productoId) {
          try {
            const prod: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));
            it.codigo = prod?.codigo || it.productoId;
          } catch (err) {
            it.codigo = it.productoId;
          }
        }
      }

      // ✅ ticket con tu estilo + ítems
      this.ticketPago = {
        facturaId: f.id,
        fecha: new Date(),
        clienteNombre: this.clienteNombre,
        metodoPago: this.metodoPago,
        totalFactura: total,
        abonadoAnterior,
        abonoRealizado: abonoReal,
        abonadoNuevo,
        saldoNuevo: Math.max(0, saldoNuevo),
        items,
      };

      // ✅ Imprimir con ventana dedicada (mismo patrón que factura/pos)
      setTimeout(() => {
        const ticketEl = document.querySelector('.ticket') as HTMLElement | null;
        if (!ticketEl) return;

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
          @media print { @page { size: 80mm auto; margin: 0; } html, body { width: 80mm; margin: 0; padding: 0; } .ticket { width: 80mm; } }
        `;

        w.document.write(`
          <html>
            <head>
              <title>Comprobante de Abono</title>
              <style>${styles}</style>
            </head>
            <body>
              ${ticketEl.outerHTML}
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
      }, 0);

      // limpiar campos
      this.abono = 0;
      this.saldoNuevo = 0;

      // 💰 Registrar automáticamente en Caja Chica si el pago es en efectivo
      if (this.metodoPago === 'Efectivo') {
        try {
          const cajaAbierta = await this.cajaChicaService.getCajaAbiertaHoy();
          if (cajaAbierta && cajaAbierta.id) {
            const usuario = this.authService.getCurrentUser();
            const movimiento = {
              caja_chica_id: cajaAbierta.id,
              fecha: new Date(),
              tipo: 'INGRESO' as const,
              descripcion: `Pago de deuda - ${this.clienteNombre} - Factura #${f.id}`,
              monto: abonoReal,
              comprobante: f.id,
            };
            if (usuario?.id) {
              (movimiento as any).usuario_id = usuario.id;
              (movimiento as any).usuario_nombre = usuario.nombre || 'Usuario';
            }
            await this.cajaChicaService.registrarMovimiento(cajaAbierta.id, movimiento);
          }
        } catch (err) {
          console.warn('No se pudo registrar el pago en Caja Chica:', err);
          // No fallar la operación si hay error en Caja Chica
        }
      } else if (this.metodoPago === 'Transferencia') {
        // 🏦 Pago por TRANSFERENCIA → Registrar en Caja Banco
        try {
          const usuario = this.authService.getCurrentUser();
          await this.cajaBancoService.registrarTransferenciaCliente(
            abonoReal,
            f.id, // usar el ID de la factura como referencia
            f.id,
            usuario?.id || '',
            usuario?.nombre || 'Usuario'
          );
          console.log('✅ Pago de deuda registrado en Caja Banco');
        } catch (err) {
          console.warn('No se pudo registrar el pago en Caja Banco:', err);
          // No fallar la operación si hay error en Caja Banco
        }
      }

    } catch (e) {
      console.error(e);
      alert('No se pudo registrar el abono');
    } finally {
      this.pagando = false;
    }
  }

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}
