import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProductosService } from '../../../../core/services/productos';
import { Producto } from '../../../../core/models/producto.model';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

@Component({
  selector: 'app-imprimir-codigos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './imprimir-codigos.html',
  styleUrls: ['./imprimir-codigos.css']
})
export class ImprimirCodigosComponent implements OnInit {
  productos: Producto[] = [];
  cargando = false;
  formatoCodigo: 'code128' | 'ean13' = 'code128';
  mostrarSoloConCodigo = true;

  constructor(
    private productosService: ProductosService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      this.cargando = true;
      this.productos = await firstValueFrom(this.productosService.getProductos());
    } catch (error) {
      console.error('Error cargando productos:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los productos para la generación de códigos.'
      });
    } finally {
      this.cargando = false;
    }
  }

  async generarPdf() {
    if (!this.productos || !this.productos.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin productos',
        text: 'No hay productos disponibles para generar el PDF.'
      });
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margenX = 10;
    const margenY = 10;
    const anchoCard = 65;
    const altoCard = 35;
    let x = margenX;
    let y = margenY;

    for (const producto of this.productos) {
      // RECOMENDADO: usar idInterno cuando existe, porque es único y numérico para scanner.
      // Usar 4 ceros iniciales fijos: idInterno 162 => 0000162
      const valorIdInterno = producto.idInterno != null ? producto.idInterno.toString().padStart(7, '0') : '';
      const fallback = (producto.codigo || producto.modelo || '').trim();
      const valorGenerado = valorIdInterno || fallback;
      if (!valorGenerado) continue;
      if (this.mostrarSoloConCodigo && !valorGenerado) continue;

      // Generar la etiqueta mostrando código de barras en un canvas y luego como PNG
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 80;

      try {
        JsBarcode(canvas, valorGenerado, {
          format: this.formatoCodigo,
          width: 2,
          height: 30,
          displayValue: true,
          fontSize: 10,
          margin: 3,
          textMargin: 2
        });
      } catch (err) {
        console.warn('Valor no soportado para JsBarcode:', valorGenerado, err);
        continue;
      }

      const pngDataUrl = canvas.toDataURL('image/png');

      doc.setFontSize(9);
      doc.text((producto.nombre || 'SIN NOMBRE').slice(0, 28), x + 1, y + 5);
      doc.addImage(pngDataUrl, 'PNG', x + 1, y + 7, anchoCard - 2, 20);
      doc.setFontSize(8);
      const etiquetaCampo = producto.idInterno ? 'idInterno' : (producto.codigo ? 'Código' : 'Modelo');
      doc.text(`${etiquetaCampo}: ${valorGenerado}`, x + 1, y + 30);

      x += anchoCard + 5;
      if (x + anchoCard > doc.internal.pageSize.getWidth() - margenX) {
        x = margenX;
        y += altoCard + 5;
      }
      if (y + altoCard > doc.internal.pageSize.getHeight() - margenY) {
        doc.addPage();
        x = margenX;
        y = margenY;
      }
    }

    doc.save('etiquetas-codigos-barras.pdf');
  }

  volverListado() {
    this.router.navigate(['/productos']);
  }
}
