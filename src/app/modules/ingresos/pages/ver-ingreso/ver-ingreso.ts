import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProductosService } from '../../../../core/services/productos';
import { forkJoin, of, Subscription } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

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
  private subFallback?: Subscription;

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

      // 🔄 Fallback: si no hay subcolección de detalles (p.ej. registros importados)
      if (!detalles || detalles.length === 0) {
        this.cargarDesdeMovimientos(id);
      }
    });
  }

  private cargarDesdeMovimientos(ingresoId: string) {
    this.subFallback?.unsubscribe();

    this.subFallback = this.ingresosSrv
      .getMovimientosIngreso(ingresoId)
      .pipe(
        switchMap(movs => {
          if (!movs || movs.length === 0) return of([]);

          const ids = Array.from(new Set(movs.map(m => m.productoId).filter(Boolean)));
          if (ids.length === 0) return of([]);

          const productos$ = ids.map(id => this.productosSrv.getProductoById(id).pipe(take(1)));

          return forkJoin(productos$).pipe(
            map(productos => {
              const mapa = new Map(ids.map((id, idx) => [id, productos[idx]]));

              return movs.map(m => {
                const prod = mapa.get(m.productoId || '');

                return {
                  tipo: 'EXISTENTE',
                  nombre: prod?.nombre || 'Producto',
                  modelo: prod?.modelo,
                  codigo: prod?.codigo,
                  cantidad: m.cantidad,
                  costoUnitario: m.costoUnitario,
                  productoId: m.productoId,
                } as any;
              });
            })
          );
        })
      )
      .subscribe(detalles => {
        this.productos = detalles;
      });
  }

  volver() {
    this.router.navigate(['/ingresos']);
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
    this.subFallback?.unsubscribe();
  }
}
