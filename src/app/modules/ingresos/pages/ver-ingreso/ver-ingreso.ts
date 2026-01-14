import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProductosService } from '../../../../core/services/productos';
import { AuthService } from '../../../../core/services/auth.service';
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
  usuarioActual: any = null;

  private sub?: Subscription;
  private subDetalles?: Subscription;
  private subFallback?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ingresosSrv: IngresosService,
    private productosSrv: ProductosService,
    private authService: AuthService
  ) {
    const id = this.route.snapshot.paramMap.get('id')!;
    
    // Obtener usuario autenticado
    this.usuarioActual = this.authService.getCurrentUser();
    
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
                  idInterno: prod?.idInterno,
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

  imprimirIngreso() {
    if (!this.ingreso || !this.productos) return;

    // Obtener fecha formateada
    const fecha = this.ingreso.fecha?.toDate ? this.ingreso.fecha.toDate() : new Date(this.ingreso.fecha);
    const fechaFormato = fecha.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // Obtener datos del proveedor
    const proveedor = this.ingreso.proveedor || 'N/A';
    const numeroFactura = this.ingreso.numeroFactura || 'N/A';
    const idIngreso = this.ingreso.idPersonalizado || this.ingreso.id || 'N/A';
    const usuario = this.usuarioActual?.nombre || 'Usuario';

    // Calcular total de unidades
    const totalUnidades = this.calcularUnidadesTotales();

    // Crear ventana de impresión
    const w = window.open('', 'PRINT', 'height=800,width=600');
    if (!w) return;

    // HTML para impresión
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 10mm;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: white;
          }

          body {
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          .container {
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          /* ENCABEZADO */
          .header {
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }

          .header-title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: 2px;
          }

          .header-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: 11px;
            line-height: 1.6;
          }

          .header-item {
            display: flex;
            flex-direction: column;
          }

          .header-label {
            font-weight: bold;
            color: #333;
            margin-bottom: 3px;
          }

          .header-value {
            color: #555;
            word-break: break-word;
          }

          /* CUERPO - TABLA */
          .body {
            flex: 1;
            margin-bottom: 20px;
          }

          .body-title {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 10px;
            text-transform: uppercase;
            border-bottom: 1px solid #999;
            padding-bottom: 5px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 10px;
          }

          thead {
            background-color: #f0f0f0;
            font-weight: bold;
            border-bottom: 1px solid #333;
          }

          th {
            padding: 8px 5px;
            text-align: left;
            border-right: 1px solid #ddd;
          }

          th:last-child {
            border-right: none;
          }

          td {
            padding: 8px 5px;
            border-bottom: 1px solid #e0e0e0;
            border-right: 1px solid #e0e0e0;
          }

          td:last-child {
            border-right: none;
          }

          tbody tr:last-child td {
            border-bottom: 1px solid #333;
          }

          .text-right {
            text-align: right;
          }

          .text-center {
            text-align: center;
          }

          /* TOTALES */
          .footer {
            border-top: 2px solid #333;
            padding-top: 15px;
            display: flex;
            justify-content: flex-end;
            font-size: 12px;
          }

          .total-row {
            display: flex;
            gap: 30px;
            align-items: center;
          }

          .total-label {
            font-weight: bold;
          }

          .total-value {
            font-weight: bold;
            font-size: 14px;
            min-width: 80px;
            text-align: right;
          }

          @media print {
            body {
              margin: 0;
              padding: 10mm;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- ENCABEZADO -->
          <div class="header">
            <div class="header-title">FACTURA DE INGRESO ${idIngreso}</div>
            
            <div class="header-grid">
              <div class="header-item">
                <span class="header-label">Proveedor:</span>
                <span class="header-value">${proveedor}</span>
              </div>
              <div class="header-item">
                <span class="header-label">Fecha:</span>
                <span class="header-value">${fechaFormato}</span>
              </div>

              <div class="header-item">
                <span class="header-label">Guía:</span>
                <span class="header-value">${numeroFactura}</span>
              </div>
              <div class="header-item">
                <span class="header-label">Imprimido por:</span>
                <span class="header-value">${usuario}</span>
              </div>
            </div>
          </div>

          <!-- CUERPO - TABLA DE PRODUCTOS -->
          <div class="body">
            <div class="body-title">Productos Ingresados</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 10%;">ID</th>
                  <th style="width: 30%;">Nombre</th>
                  <th style="width: 15%;">Modelo</th>
                  <th style="width: 15%;">Color</th>
                  <th style="width: 15%; text-align: right;">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                ${this.productos.map(p => `
                  <tr>
                    <td>${p.idInterno || '-'}</td>
                    <td>${p.nombre || '-'}</td>
                    <td>${p.modelo || '-'}</td>
                    <td>${p.color || '-'}</td>
                    <td class="text-right">${p.cantidad || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- TOTALES -->
          <div class="footer">
            <div class="total-row">
              <span class="total-label">TOTAL UNIDADES:</span>
              <span class="total-value">${totalUnidades}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    w.document.write(html);
    w.document.close();

    // Esperar un poco y luego imprimir
    setTimeout(() => {
      w.print();
      w.close();
    }, 250);
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
