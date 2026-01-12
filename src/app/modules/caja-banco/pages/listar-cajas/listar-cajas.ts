import { Component, inject, OnInit } from '@angular/core';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { Router } from '@angular/router';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit {
  private cajaBancoService = inject(CajaBancoService);
  private router = inject(Router);

  cajas: CajaBanco[] = [];
  movimientosGlobales: MovimientoCajaBanco[] = [];
  cargando = false;

  ngOnInit(): void {
    this.cargarCajas();
    this.cargarMovimientosGlobales();
  }

  cargarCajas(): void {
    this.cargando = true;
    this.cajaBancoService.getCajasBanco().subscribe({
      next: (cajas) => {
        // Filtrar solo cajas CERRADAS
        this.cajas = (cajas || []).filter(c => c.estado === 'CERRADA');
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar cajas:', error);
        this.cargando = false;
      }
    });
  }

  cargarMovimientosGlobales(): void {
    this.cajaBancoService.getMovimientosCajaBanco().subscribe({
      next: (movimientos) => {
        this.movimientosGlobales = (movimientos || []).filter(m => !m.caja_banco_id);
      },
      error: (error) => {
        console.error('Error al cargar movimientos globales:', error);
      }
    });
  }

  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-banco/ver', cajaId]);
  }

  registrarMovimiento(): void {
    this.router.navigate(['/caja-banco/registrar-movimiento']);
  }

  getTotalGanado(): number {
    // Total de cajas cerradas
    return this.cajas.reduce((acc, c) => acc + (c.saldo_actual || 0), 0);
  }

  getTotalTransferencias(): number {
    // Solo transferencias de clientes
    return this.movimientosGlobales
      .filter(m => m.categoria === 'TRANSFERENCIA_CLIENTE' && m.tipo === 'INGRESO')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
  }

  getTotalIngresos(): number {
    // Total Ingresos = Total Ganado Cajas + TODOS los ingresos globales
    const ingresosGlobales = this.movimientosGlobales
      .filter(m => m.tipo === 'INGRESO')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
    return this.getTotalGanado() + ingresosGlobales;
  }

  getTotalEgresos(): number {
    return this.movimientosGlobales
      .filter(m => m.tipo === 'EGRESO')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
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
