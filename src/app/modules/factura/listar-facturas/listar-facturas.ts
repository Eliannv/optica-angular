import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FacturasService } from '../../../core/services/facturas';


@Component({
  selector: 'app-listar-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listar-facturas.html',
  styleUrl: './listar-facturas.css'
})
export class ListarFacturasComponent {
  term = '';
  facturas: any[] = [];
  filtradas: any[] = [];
  facturasPaginadas: any[] = [];
  paginaActual: number = 1;
  facturasPorPagina: number = 10;
  totalFacturas: number = 0;
  Math = Math; // Para usar Math.min en el template

  constructor(private facturasSrv: FacturasService, private router: Router) {
    this.facturasSrv.getFacturas().subscribe((data: any[]) => {
      this.facturas = data || [];
      this.filtrar();
    });
  }

  filtrar() {
    const t = (this.term || '').trim().toLowerCase();
    if (!t) { 
      this.filtradas = [...this.facturas]; 
    } else {
      this.filtradas = this.facturas.filter(f =>
        (f.clienteNombre || '').toLowerCase().includes(t) ||
        (f.metodoPago || '').toLowerCase().includes(t) ||
        (f.id || '').toLowerCase().includes(t)
      );
    }
    this.totalFacturas = this.filtradas.length;
    this.paginaActual = 1; // Resetear a la primera página al filtrar
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

  nuevaVenta() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}
