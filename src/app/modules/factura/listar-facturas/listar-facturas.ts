import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FacturasService } from '../../../core/services/facturas';

type FiltroEstado = 'TODAS' | 'PENDIENTES' | 'PAGADAS';

@Component({
  selector: 'app-listar-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listar-facturas.html',
  styleUrl: './listar-facturas.css'
})
export class ListarFacturasComponent {
  Number = Number;

  // ✅ NUEVO
  filtroEstado: FiltroEstado = 'TODAS';
  term: string = '';

  facturas: any[] = [];
  filtradas: any[] = [];
  facturasPaginadas: any[] = [];

  paginaActual: number = 1;
  facturasPorPagina: number = 10;
  totalFacturas: number = 0;
  Math = Math;

  constructor(private facturasSrv: FacturasService, private router: Router) {
    this.facturasSrv.getFacturas().subscribe((data: any[]) => {
      this.facturas = (data || []).map(f => ({
        ...f,
        total: Number(f?.total || 0),
        saldoPendiente: Number(f?.saldoPendiente || 0),
      }));

      // ✅ SIEMPRE ordenar por más recientes al inicio
      this.facturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

      this.filtrar();
    });
  }

  // obtiene ms de fecha (Timestamp o Date o string)
  private getFechaMs(f: any): number {
    const v = f?.fecha;
    if (!v) return 0;

    // Firestore Timestamp
    if (typeof v?.toDate === 'function') return v.toDate().getTime();

    // Date
    if (v instanceof Date) return v.getTime();

    // string/number
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  filtrar() {
    const t = (this.term || '').trim().toLowerCase();

    // 1) filtro por estado
    let base = [...this.facturas];

    if (this.filtroEstado === 'PENDIENTES') {
      base = base.filter(f => (Number(f.saldoPendiente) || 0) > 0);
    } else if (this.filtroEstado === 'PAGADAS') {
      base = base.filter(f => (Number(f.saldoPendiente) || 0) <= 0);
    }

    // 2) filtro texto
    if (!t) {
      this.filtradas = base;
    } else {
      this.filtradas = base.filter(f =>
        (f.clienteNombre || '').toLowerCase().includes(t) ||
        (f.metodoPago || '').toLowerCase().includes(t) ||
        (f.id || '').toLowerCase().includes(t)
      );
    }

    // 3) mantener orden "últimas primero" siempre
    this.filtradas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

    this.totalFacturas = this.filtradas.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  actualizarPaginacion(): void {
    const inicio = (this.paginaActual - 1) * this.facturasPorPagina;
    const fin = inicio + this.facturasPorPagina;
    this.facturasPaginadas = [...this.filtradas.slice(inicio, fin)];
  }

  paginaSiguiente(): void {
    if (this.paginaActual * this.facturasPorPagina < this.totalFacturas) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.actualizarPaginacion();
    }
  }

  ver(id: string) {
    this.router.navigate(['/facturas', id]);
  }

  // ✅ NUEVO
  cobrarDeuda(clienteId: string, ev?: Event) {
    ev?.stopPropagation();
    if (!clienteId) return;
    this.router.navigate(['/ventas/deuda'], {
      queryParams: { clienteId }
    });
  }

  nuevaVenta() {
    this.router.navigate(['/clientes/historial-clinica']);
  }
}
