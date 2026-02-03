import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EgresoMercaderiaService } from '../../../../core/services/egreso.service';
import { EgresoMercaderia, MOTIVOS_EGRESO } from '../../../../core/models/egreso.model';

@Component({
  selector: 'app-listado-egresos',
  imports: [CommonModule, FormsModule],
  templateUrl: './listado-egresos.html',
  styleUrl: './listado-egresos.css',
})
export class ListadoEgresos implements OnInit {
  private router = inject(Router);
  private egresoService = inject(EgresoMercaderiaService);

  egresos = signal<EgresoMercaderia[]>([]);
  egresosFiltrados = signal<EgresoMercaderia[]>([]);
  loading = signal(true);
  term = '';
  
  // Paginación
  paginaActual = signal(1);
  egresosPorPagina = 10;
  Math = Math;

  totalEgresos = computed(() => this.egresosFiltrados().length);
  egresosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.egresosPorPagina;
    const fin = inicio + this.egresosPorPagina;
    return this.egresosFiltrados().slice(inicio, fin);
  });

  ngOnInit(): void {
    this.cargarEgresos();
  }

  cargarEgresos(): void {
    this.loading.set(true);
    this.egresoService.getEgresos().subscribe({
      next: (egresos) => {
        // Ordenar por fecha descendente (más reciente primero)
        const egresosOrdenados = egresos.sort((a, b) => {
          const fechaA = new Date(a.fecha).getTime();
          const fechaB = new Date(b.fecha).getTime();
          return fechaB - fechaA;
        });
        this.egresos.set(egresosOrdenados);
        this.egresosFiltrados.set(egresosOrdenados);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error al cargar egresos:', error);
        this.loading.set(false);
      }
    });
  }

  filtrar(): void {
    const busqueda = this.term.toLowerCase().trim();
    
    if (!busqueda) {
      this.egresosFiltrados.set(this.egresos());
    } else {
      const filtrados = this.egresos().filter(egreso => 
        egreso.productoNombre?.toLowerCase().includes(busqueda) ||
        egreso.motivo?.toLowerCase().includes(busqueda) ||
        egreso.proveedorNombre?.toLowerCase().includes(busqueda) ||
        egreso.descripcion?.toLowerCase().includes(busqueda) ||
        egreso.productoModelo?.toLowerCase().includes(busqueda)
      );
      this.egresosFiltrados.set(filtrados);
    }
    
    // Resetear a la primera página al filtrar
    this.paginaActual.set(1);
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) {
      this.paginaActual.update(p => p - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() * this.egresosPorPagina < this.totalEgresos()) {
      this.paginaActual.update(p => p + 1);
    }
  }

  registrarNuevo(): void {
    this.router.navigate(['/egresos-mercaderia/registrar']);
  }
  verEgreso(egreso: EgresoMercaderia): void {
    this.router.navigate(['/egresos-mercaderia/ver', egreso.id]);
  }
  formatoFecha(fecha: Date): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatoMoneda(valor: number): string {
    return `$${valor.toFixed(2)}`;
  }

  formatMotivo(motivo: string): string {
    return MOTIVOS_EGRESO[motivo as keyof typeof MOTIVOS_EGRESO] || motivo;
  }

  getMotivoBadgeClass(motivo: string): string {
    const clases: Record<string, string> = {
      'DEVOLUCION_PROVEEDOR': 'badge-warning',
      'PRODUCTO_DEFECTUOSO': 'badge-danger',
      'VENCIMIENTO': 'badge-danger',
      'AJUSTE_INVENTARIO': 'badge-info',
      'MUESTRA_CLIENTE': 'badge-success',
      'USO_INTERNO': 'badge-primary',
      'OTRO': 'badge-secondary'
    };
    return clases[motivo] || 'badge-secondary';
  }

  getTotalUnidades(): number {
    return this.egresosFiltrados().reduce((sum, e) => {
      // Sistema nuevo: múltiples productos
      if (e.productosEgresados && e.productosEgresados.length > 0) {
        return sum + e.productosEgresados.reduce((s, p) => s + p.cantidad, 0);
      }
      // Sistema antiguo: un solo producto
      return sum + (e.cantidad || 0);
    }, 0);
  }

  getTotalCosto(): number {
    return this.egresosFiltrados().reduce((sum, e) => sum + e.costoTotal, 0);
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}

