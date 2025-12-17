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
  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];
  productosPaginados: Producto[] = [];
  paginaActual: number = 1;
  productosPorPagina: number = 10;
  totalProductos: number = 0;
  Math = Math; // Para usar Math.min en el template
  productoSeleccionado: Producto | null = null;
  mostrarModal: boolean = false;
  terminoBusqueda: string = '';

  constructor(
    private productosService: ProductosService,
    private router: Router
  ) {}

  ngOnInit() {
    this.productosService.getProductos().subscribe(productos => {
      this.productos = productos;
      this.productosFiltrados = productos;
      this.totalProductos = productos.length;
      this.actualizarPaginacion();
    });
  }

  actualizarPaginacion() {
    const inicio = (this.paginaActual - 1) * this.productosPorPagina;
    const fin = inicio + this.productosPorPagina;
    this.productosPaginados = [...this.productosFiltrados.slice(inicio, fin)];
  }

  paginaSiguiente() {
    if (this.paginaActual * this.productosPorPagina < this.totalProductos) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  paginaAnterior() {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.actualizarPaginacion();
    }
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

  verDetalle(producto: Producto) {
    this.productoSeleccionado = producto;
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.productoSeleccionado = null;
  }

  trackByProductoId(index: number, producto: Producto): string {
    return producto.id || index.toString();
  }

  buscarProductos() {
    const termino = this.terminoBusqueda.toLowerCase().trim();
    
    if (!termino) {
      this.productosFiltrados = this.productos;
    } else {
      this.productosFiltrados = this.productos.filter(producto => {
        const nombre = producto.nombre?.toLowerCase() || '';
        const modelo = producto.datos?.dato2?.toLowerCase() || '';
        const grupo = producto.grupo?.toLowerCase() || '';
        const proveedor = producto.proveedores?.principal?.toLowerCase() || '';
        
        return nombre.includes(termino) ||
               modelo.includes(termino) ||
               grupo.includes(termino) ||
               proveedor.includes(termino);
      });
    }
    
    this.totalProductos = this.productosFiltrados.length;
    this.paginaActual = 1; // Resetear a la primera página
    this.actualizarPaginacion();
  }

  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.buscarProductos();
  }
}
