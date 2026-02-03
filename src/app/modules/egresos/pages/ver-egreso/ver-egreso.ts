import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EgresoMercaderiaService } from '../../../../core/services/egreso.service';
import { ProductosService } from '../../../../core/services/productos';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { MOTIVOS_EGRESO, MotivoEgreso } from '../../../../core/models/egreso.model';

@Component({
  selector: 'app-ver-egreso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ver-egreso.html',
  styleUrl: './ver-egreso.css'
})
export class VerEgresoComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private egresoService = inject(EgresoMercaderiaService);
  private productosService = inject(ProductosService);
  private authService = inject(AuthService);

  egreso: any = null;
  productos: any[] = [];
  loading = true;
  usuarioActual: any = null;

  private sub?: Subscription;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    
    // Obtener usuario autenticado
    this.usuarioActual = this.authService.getCurrentUser();
    
    // Cargar datos del egreso
    this.sub = this.egresoService.getEgresoById(id).subscribe({
      next: (egreso) => {
        this.egreso = egreso;
        this.productos = egreso?.productosEgresados || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar egreso:', error);
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  volver(): void {
    this.router.navigate(['/egresos-mercaderia/listado']);
  }

  calcularUnidadesTotales(): number {
    return this.productos.reduce((sum, p) => sum + (p.cantidad || 0), 0);
  }

  calcularCostoTotal(): string {
    const total = this.productos.reduce(
      (sum, p) => sum + ((p.cantidad || 0) * (p.costoUnitario || 0)),
      0
    );
    return total.toFixed(2);
  }

  formatMotivo(motivo: string): string {
    return MOTIVOS_EGRESO[motivo as MotivoEgreso] || motivo;
  }

  getMotivoBadgeClass(motivo: string): string {
    const classes: Record<string, string> = {
      'DEVOLUCION_PROVEEDOR': 'badge-devolucion',
      'PRODUCTO_DANADO': 'badge-perdida',
      'PRODUCTO_DEFECTUOSO': 'badge-perdida',
      'DONACION': 'badge-donacion',
      'VENCIMIENTO': 'badge-vencido',
      'PERDIDA': 'badge-perdida',
      'ROBO': 'badge-perdida',
      'OTRO': 'badge-otro'
    };
    return classes[motivo] || 'badge-default';
  }

  imprimirEgreso(): void {
    if (!this.egreso) return;

    const ventanaImpresion = window.open('', '', 'width=800,height=900');
    if (!ventanaImpresion) return;

    const contenidoHTML = this.generarContenidoImpresion();
    ventanaImpresion.document.write(contenidoHTML);
    ventanaImpresion.document.close();

    setTimeout(() => {
      ventanaImpresion.print();
      ventanaImpresion.close();
    }, 250);
  }

  private generarContenidoImpresion(): string {
    const fechaFormateada = this.egreso.fecha?.toDate 
      ? this.egreso.fecha.toDate().toLocaleDateString('es-ES')
      : new Date(this.egreso.fecha).toLocaleDateString('es-ES');

    let productosHTML = '';
    this.productos.forEach(prod => {
      const codigo = prod.productoCodigo || (prod.productoIdInterno ? `#${prod.productoIdInterno}` : 'N/A');
      const marca = prod.productoMarca || '-';
      const modelo = prod.productoModelo || '-';
      const costoUnit = (prod.costoUnitario || 0).toFixed(2);
      const total = ((prod.cantidad || 0) * (prod.costoUnitario || 0)).toFixed(2);

      productosHTML += `
        <tr>
          <td>${codigo}</td>
          <td>${prod.productoNombre}</td>
          <td>${marca}</td>
          <td>${modelo}</td>
          <td class="text-center">${prod.cantidad}</td>
          <td class="text-right">$${costoUnit}</td>
          <td class="text-right">$${total}</td>
        </tr>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Egreso de Mercadería</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { font-size: 18px; margin-bottom: 5px; }
          .info-section { margin-bottom: 20px; }
          .info-section h2 { font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .info-item { display: flex; justify-content: space-between; padding: 5px 0; }
          .info-label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .totales { margin-top: 15px; text-align: right; }
          .totales div { padding: 5px 0; }
          .total-final { font-size: 14px; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; }
          .observaciones { margin: 10px 0; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>EGRESO DE MERCADERÍA</h1>
          <p>Fecha de Egreso: ${fechaFormateada}</p>
        </div>

        <div class="info-section">
          <h2>Información General</h2>
          <div class="info-grid">
            ${this.egreso.proveedorNombre ? `<div class="info-item"><span class="info-label">Proveedor:</span><span>${this.egreso.proveedorNombre}</span></div>` : ''}
            ${this.egreso.documentoReferencia ? `<div class="info-item"><span class="info-label">Referencia:</span><span>${this.egreso.documentoReferencia}</span></div>` : ''}
            <div class="info-item"><span class="info-label">Motivo:</span><span>${this.formatMotivo(this.egreso.motivo)}</span></div>
            <div class="info-item"><span class="info-label">Usuario:</span><span>${this.egreso.usuarioNombre || 'Sistema'}</span></div>
          </div>
        </div>

        ${this.egreso.observaciones ? `
        <div class="info-section">
          <h2>Observaciones</h2>
          <div class="observaciones">${this.egreso.observaciones}</div>
        </div>
        ` : ''}

        <div class="info-section">
          <h2>Productos</h2>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th class="text-center">Cantidad</th>
                <th class="text-right">Costo Unit.</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productosHTML}
            </tbody>
          </table>

          <div class="totales">
            <div>Total de Productos: <strong>${this.productos.length}</strong></div>
            <div>Unidades Totales: <strong>${this.calcularUnidadesTotales()}</strong></div>
            <div class="total-final">COSTO TOTAL: <strong>$${this.calcularCostoTotal()}</strong></div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
