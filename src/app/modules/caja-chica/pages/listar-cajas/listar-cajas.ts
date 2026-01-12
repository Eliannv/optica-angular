import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaChica } from '../../../../core/models/caja-chica.model';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private router = inject(Router);

  cajas: CajaChica[] = [];
  cajasAbiertas: CajaChica[] = [];
  cargando = false;
  filtro = 'todas'; // 'todas', 'abiertas', 'cerradas'

  ngOnInit(): void {
    this.cargarCajas();
  }

  cargarCajas(): void {
    this.cargando = true;
    this.cajaChicaService.getCajasChicas().subscribe({
      next: (cajas) => {
        this.cajas = cajas;
        this.actualizarFiltro();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar cajas:', error);
        this.cargando = false;
      }
    });
  }

  actualizarFiltro(): void {
    if (this.filtro === 'abiertas') {
      this.cajasAbiertas = this.cajas.filter(c => c.estado === 'ABIERTA');
    } else if (this.filtro === 'cerradas') {
      this.cajasAbiertas = this.cajas.filter(c => c.estado === 'CERRADA');
    } else {
      this.cajasAbiertas = this.cajas;
    }
  }

  cambiarFiltro(nuevoFiltro: string): void {
    this.filtro = nuevoFiltro;
    this.actualizarFiltro();
  }

  abrirCaja(): void {
    this.router.navigate(['/caja-chica/nueva']);
  }

  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-chica/ver', cajaId]);
  }

  registrarMovimiento(cajaId: string): void {
    this.router.navigate(['/caja-chica/registrar', cajaId]);
  }

  getEstadoBadgeClass(estado: string): string {
    return estado === 'ABIERTA' ? 'badge-success' : 'badge-danger';
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }
}
