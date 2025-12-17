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
    codigo: '',
    nombre: '',
    nuevoCodigo: '',
    grupo: '',
    stock: 0,
    unidad: '1',
    iva: true,
    observacion: null,
    costos: {
      caja: '0.00',
      unidad: '0.00'
    },
    datos: {
      dato1: '',
      dato2: ''
    },
    precios: {
      caja: '0.00',
      pvp1: '0.00',
      pvp2: '0.00',
      unidad: '0.00'
    },
    proveedores: {
      principal: '',
      secundario: '',
      terciario: ''
    }
  };

  constructor(
    private productosService: ProductosService,
    private router: Router
  ) {}

  guardar() {
    if (this.producto.codigo && this.producto.nombre) {
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
