import { Component } from '@angular/core';
import { Producto } from '../../../../core/models/producto.model';
import { ProductosService } from '../../../../core/services/productos';
import { Router } from '@angular/router';

@Component({
  selector: 'app-crear-producto',
  standalone: false,
  templateUrl: './crear-producto.html',
  styleUrl: './crear-producto.css',
})
export class CrearProducto {

  producto: Producto = {
    codArti: '',
    nomArti: '',
    nueCod: '',
    stoUnid: 0,
    pvpUnid: 0,
    cosUnid: 0,
    pvpCaja: 0,
    cosCaja: 0,
    pvpProd1: 0,
    pvpProd2: 0,
    ivaProd: 'S'
  };

  constructor(
    private productosService: ProductosService,
    private router: Router
  ) {}

  guardar() {
    if (this.producto.codArti && this.producto.nomArti) {
      this.productosService.createProducto(this.producto).then(() => {
        alert('Producto creado exitosamente');
        this.router.navigate(['/productos']);
      }).catch(error => {
        console.error('Error al crear producto:', error);
        alert('Error al crear el producto');
      });
    } else {
      alert('Por favor complete los campos obligatorios');
    }
  }

  cancelar() {
    this.router.navigate(['/productos']);
  }
}
