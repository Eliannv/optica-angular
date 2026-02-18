/**
 * Gestiona ventas con tarjeta y sus ingresos diferidos del banco.
 */
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription, filter, distinctUntilChanged, take } from 'rxjs';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { VentasTarjetaService } from '../../../../core/services/ventas-tarjeta.service';
import { SucursalContextService } from '../../../../core/services/sucursal-context.service';
import { VentaTarjeta } from '../../../../core/models/venta-tarjeta.model';

@Component({
  selector: 'app-ventas-tarjeta',
  standalone: false,
  templateUrl: './ventas-tarjeta.html',
  styleUrls: ['./ventas-tarjeta.css']
})
export class VentasTarjetaComponent implements OnInit, OnDestroy {
  ventas: VentaTarjeta[] = [];
  ventasFiltradas: VentaTarjeta[] = [];
  cargando = true;

  filtroEstado: 'TODAS' | 'PENDIENTE' | 'LIQUIDADA' = 'PENDIENTE';
  filtroFactura = '';

  ventaSeleccionada: VentaTarjeta | null = null;

  ingresoFecha = this.getFechaActual();
  ingresoMonto = 0;
  ingresoBanco = '';
  ingresoLote = '';
  ingresoObservacion = '';

  constructor(private ventasTarjetaService: VentasTarjetaService) {}

  private sucursalContext = inject(SucursalContextService);
  private router = inject(Router);
  private subscriptions = new Subscription();

  ngOnInit(): void {
    const sub = this.sucursalContext.getSucursalSeleccionada().pipe(
      filter(s => s !== null),
      distinctUntilChanged((a, b) => a?.id === b?.id)
    ).subscribe(() => {
      this.ventas = [];
      this.ventasFiltradas = [];
      this.cargarVentas();
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  cargarVentas(): void {
    this.cargando = true;
    this.ventasTarjetaService.getVentasTarjeta().pipe(take(1)).subscribe({
      next: (ventas) => {
        this.ventas = ventas || [];
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando ventas con tarjeta:', err);
        this.cargando = false;
      }
    });
  }

  aplicarFiltros(): void {
    const filtroFactura = this.filtroFactura.trim().toLowerCase();

    this.ventasFiltradas = (this.ventas || []).filter(v => {
      if (this.filtroEstado !== 'TODAS' && v.estado !== this.filtroEstado) {
        return false;
      }

      if (filtroFactura) {
        const numero = (v.facturaIdPersonalizado || v.facturaId || '').toLowerCase();
        if (!numero.includes(filtroFactura)) {
          return false;
        }
      }

      return true;
    });
  }

  seleccionarVenta(venta: VentaTarjeta): void {
    this.ventaSeleccionada = venta;
    this.ingresoMonto = 0;
    this.ingresoFecha = this.getFechaActual();
    this.ingresoBanco = '';
    this.ingresoLote = '';
    this.ingresoObservacion = '';
  }

  limpiarSeleccion(): void {
    this.ventaSeleccionada = null;
  }

  async registrarIngreso(): Promise<void> {
    if (!this.ventaSeleccionada) {
      return;
    }

    const monto = Number(this.ingresoMonto || 0);
    if (monto <= 0) {
      await Swal.fire('Monto invalido', 'Ingrese un monto mayor a 0.', 'warning');
      return;
    }

    const saldoPendiente = Number(this.ventaSeleccionada.saldoPendiente || 0);
    if (monto > saldoPendiente) {
      await Swal.fire('Monto excede saldo', 'El monto no puede superar el saldo pendiente.', 'warning');
      return;
    }

    const fecha = this.ingresoFecha ? new Date(this.ingresoFecha) : new Date();

    try {
      await this.ventasTarjetaService.registrarIngresoBanco(this.ventaSeleccionada.id || this.ventaSeleccionada.facturaId, {
        fecha,
        monto,
        banco: this.ingresoBanco || undefined,
        numeroLote: this.ingresoLote || undefined,
        observacion: this.ingresoObservacion || undefined
      });

      await Swal.fire('Ingreso registrado', 'El ingreso del banco se registro correctamente.', 'success');
      this.limpiarSeleccion();
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', err instanceof Error ? err.message : 'No se pudo registrar el ingreso.', 'error');
    }
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  formatoFecha(fecha: Date | undefined): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  getTotalPendiente(): number {
    return (this.ventas || []).reduce((acc, v) => acc + Number(v.saldoPendiente || 0), 0);
  }

  getTotalRecibido(): number {
    return (this.ventas || []).reduce((acc, v) => acc + Number(v.montoRecibido || 0), 0);
  }

  getCantidadPendientes(): number {
    return (this.ventas || []).filter(v => v.estado === 'PENDIENTE').length;
  }

  getCantidadLiquidadas(): number {
    return (this.ventas || []).filter(v => v.estado === 'LIQUIDADA').length;
  }

  private getFechaActual(): string {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const day = hoy.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
