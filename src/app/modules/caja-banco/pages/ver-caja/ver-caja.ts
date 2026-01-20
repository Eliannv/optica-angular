import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';

@Component({
  selector: 'app-ver-caja',
  standalone: false,
  templateUrl: './ver-caja.html',
  styleUrls: ['./ver-caja.css']
})
export class VerCajaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cajaBancoService = inject(CajaBancoService);

  caja: CajaBanco | null = null;
  movimientos: MovimientoCajaBanco[] = [];
  cargando = false;
  cajaId: string = '';

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.cajaId = params['id'];
      if (this.cajaId) {
        this.cargarCaja();
      }
    });
  }

  cargarCaja(): void {
    this.cargando = true;
    this.cajaBancoService.getMovimientosCajaBanco(this.cajaId).subscribe({
      next: (movimientos) => {
        this.movimientos = movimientos;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar caja:', error);
        this.cargando = false;
      }
    });
  }

  volver(): void {
    this.router.navigate(['/caja-banco']);
  }

  imprimir(): void {
    if (!this.cajaId) return;
    this.router.navigate(['/caja-banco/imprimir', this.cajaId]);
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  getColorTipo(tipo: string): string {
    return tipo === 'INGRESO' ? 'ingreso' : 'egreso';
  }
}
