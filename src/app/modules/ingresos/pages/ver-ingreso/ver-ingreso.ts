import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProductosService } from '../../../../core/services/productos';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ver-ingreso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ver-ingreso.html',
  styleUrl: './ver-ingreso.css'
})
export class VerIngresoComponent implements OnDestroy {
  ingreso: any = null;
  productos: any[] = [];
  loading = true;

  private sub?: Subscription;
  private subDetalles?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ingresosSrv: IngresosService,
    private productosSrv: ProductosService
  ) {
    const id = this.route.snapshot.paramMap.get('id')!;
    
    // Cargar datos del ingreso
    this.sub = this.ingresosSrv.getIngresoById(id).subscribe(ing => {
      this.ingreso = ing;
      this.loading = false;
    });

    // Cargar detalles del ingreso desde la subcolección
    this.subDetalles = this.ingresosSrv.getDetallesIngreso(id).subscribe(detalles => {
      this.productos = detalles;
    });
  }

  volver() {
    this.router.navigate(['/ingresos']);
  }

  imprimir() {
    if (!this.ingreso) return;
    window.print();
  }

  calcularUnidadesTotales(): number {
    if (!this.productos || this.productos.length === 0) return 0;
    return this.productos.reduce((sum: number, p: any) => sum + (p.cantidad || 0), 0);
  }

  calcularCostoTotal(): string {
    if (!this.productos || this.productos.length === 0) return '0.00';
    const total = this.productos.reduce((sum: number, p: any) => {
      return sum + ((p.cantidad || 0) * (p.costoUnitario || 0));
    }, 0);
    return total.toFixed(2);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.subDetalles?.unsubscribe();
  }
}
