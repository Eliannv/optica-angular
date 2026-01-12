import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Ingreso } from '../../../../core/models/ingreso.model';
import { IngresosService } from '../../../../core/services/ingresos.service';
import Swal from 'sweetalert2';

type FiltroEstado = 'TODOS' | 'BORRADOR' | 'FINALIZADO';
type FiltroFecha = 'TODAS' | 'HOY' | 'SEMANA' | 'MES' | 'ANO' | 'ESPECIFICA';

@Component({
  selector: 'app-listar-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listar-ingresos.html',
  styleUrls: ['./listar-ingresos.css'],
})
export class ListarIngresosComponent implements OnInit {
  private router = inject(Router);
  private ingresosService = inject(IngresosService);

  Number = Number;
  Math = Math;

  // Datos
  ingresos: Ingreso[] = [];
  filtrados: Ingreso[] = [];
  ingresosPaginados: Ingreso[] = [];

  // Filtros
  filtroFecha: FiltroFecha = 'TODAS';
  fechaEspecifica: string = '';
  term: string = '';

  // Paginación
  paginaActual: number = 1;
  ingresosPorPagina: number = 10;
  totalIngresos: number = 0;

  ngOnInit() {
    this.cargarIngresos();
  }

  cargarIngresos() {
    this.ingresosService.getIngresos().subscribe({
      next: (ingresos) => {
        this.ingresos = ingresos.map(i => ({
          ...i,
          total: Number(i?.total || 0)
        }));
        
        // Ordenar por más recientes
        this.ingresos.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));
        
        this.filtrar();
      },
      error: (err) => console.error('Error al cargar ingresos:', err),
    });
  }

  private getFechaMs(ingreso: Ingreso): number {
    const v = ingreso?.fecha;
    if (!v) return 0;

    // Firestore Timestamp
    if (typeof (v as any)?.toDate === 'function') return (v as any).toDate().getTime();

    // Date
    if (v instanceof Date) return v.getTime();

    // string/number
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  filtrar() {
    const t = (this.term || '').trim().toLowerCase();
    let base = [...this.ingresos];

    // 1) Filtro por fecha
    if (this.filtroFecha !== 'TODAS') {
      base = base.filter(i => this.cumpleFiltroFecha(i));
    }

    // 2) Filtro por texto (número de factura o proveedor)
    if (t) {
      base = base.filter(i =>
        (i.numeroFactura || '').toLowerCase().includes(t) ||
        (i.proveedor || '').toLowerCase().includes(t) ||
        (i.id || '').toLowerCase().includes(t)
      );
    }

    // Mantener orden por fecha
    base.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

    this.filtrados = base;
    this.totalIngresos = base.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  private cumpleFiltroFecha(ingreso: Ingreso): boolean {
    const fechaIngreso = this.getFechaDate(ingreso.fecha);
    if (!fechaIngreso) return false;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    switch (this.filtroFecha) {
      case 'HOY':
        const ingresoDay = new Date(fechaIngreso);
        ingresoDay.setHours(0, 0, 0, 0);
        return ingresoDay.getTime() === hoy.getTime();

      case 'SEMANA':
        const semanaAtras = new Date(hoy);
        semanaAtras.setDate(semanaAtras.getDate() - 7);
        return fechaIngreso >= semanaAtras;

      case 'MES':
        const mesAtras = new Date(hoy);
        mesAtras.setMonth(mesAtras.getMonth() - 1);
        return fechaIngreso >= mesAtras;

      case 'ANO':
        const anoAtras = new Date(hoy);
        anoAtras.setFullYear(anoAtras.getFullYear() - 1);
        return fechaIngreso >= anoAtras;

      case 'ESPECIFICA':
        if (!this.fechaEspecifica) return true;
        const especifica = new Date(this.fechaEspecifica);
        especifica.setHours(0, 0, 0, 0);
        const ingresoDate = new Date(fechaIngreso);
        ingresoDate.setHours(0, 0, 0, 0);
        return ingresoDate.getTime() === especifica.getTime();

      default:
        return true;
    }
  }

  /**
   * 💰 Calcular el total de dinero de todos los ingresos filtrados
   */
  obtenerTotalDeuda(): number {
    return this.filtrados.reduce((sum, ingreso) => {
      return sum + (Number(ingreso.total) || 0);
    }, 0);
  }

  private getFechaDate(fecha: any): Date | null {
    if (!fecha) return null;

    // Firestore Timestamp
    if (typeof fecha?.toDate === 'function') return fecha.toDate();

    // Date
    if (fecha instanceof Date) return fecha;

    // string/number
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? null : d;
  }

  actualizarPaginacion(): void {
    const inicio = (this.paginaActual - 1) * this.ingresosPorPagina;
    const fin = inicio + this.ingresosPorPagina;
    this.ingresosPaginados = [...this.filtrados.slice(inicio, fin)];
  }

  paginaSiguiente(): void {
    if (this.paginaActual * this.ingresosPorPagina < this.totalIngresos) {
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

  nuevoIngreso() {
    this.router.navigate(['/ingresos/nuevo']);
  }

  verIngreso(ingreso: Ingreso) {
    if (ingreso.id) {
      this.router.navigate(['/ingresos/ver', ingreso.id]);
    }
  }

  formatearFecha(fecha: any): string {
    const d = this.getFechaDate(fecha);
    if (!d) return '-';
    
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    
    return `${dia}/${mes}/${ano}`;
  }
}
