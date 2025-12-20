import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../core/services/clientes';
import { FacturasService } from '../../../core/services/facturas';

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
    private facturasSrv: FacturasService
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

      // ✅ ticket con tu estilo
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
      };

      // ✅ imprime igual que tu POS (usa tus estilos @media print)
      setTimeout(() => {
        window.print();
      }, 0);

      // limpiar campos
      this.abono = 0;
      this.saldoNuevo = 0;

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
