import { Component, OnInit } from '@angular/core';
import { Producto } from '../../../../core/models/producto.model';
import { Observable } from 'rxjs';
import { ProductosService } from '../../../../core/services/productos';
import { Router } from '@angular/router';

@Component({
  selector: 'app-listar-productos',
  standalone: false,
  templateUrl: './listar-productos.html',
  styleUrl: './listar-productos.css',
})
export class ListarProductos implements OnInit {
  productos$!: Observable<Producto[]>;

  constructor(
    private productosService: ProductosService,
    private router: Router
  ) {}

  ngOnInit() {
    this.productos$ = this.productosService.getProductos();
  }

  crearProducto() {
    this.router.navigate(['/productos/crear']);
  }

  eliminarProducto(id: string) {
    if (confirm('¿Está seguro de eliminar este producto?')) {
      this.productosService.deleteProducto(id).then(() => {
        alert('Producto eliminado exitosamente');
      }).catch(error => {
        console.error('Error al eliminar producto:', error);
        alert('Error al eliminar el producto');
      });
    }
  }
}
