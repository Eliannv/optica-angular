import { Component, OnInit, inject } from '@angular/core';
import { Producto } from '../../../../core/models/producto.model';
import { Observable } from 'rxjs';
import { ProductosService } from '../../../../core/services/productos';
import { ExcelService } from '../../../../core/services/excel.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { UpperCasePipe } from '@angular/common';

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
  grupoSeleccionado: string = ''; // Para almacenar el grupo activo desde la URL

  constructor(
    private productosService: ProductosService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  private excelService = inject(ExcelService);
  private authService = inject(AuthService);

  ngOnInit() {
    // Suscribirse a los parámetros de consulta para detectar cambios en el grupo
    this.route.queryParams.subscribe(params => {
      this.grupoSeleccionado = params['grupo'] || '';
      
      // Cargar productos después de obtener el parámetro de grupo
      this.productosService.getProductos().subscribe(productos => {
        this.productos = productos;
        this.aplicarFiltros();
      });
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
  irPrimeraPagina(): void {
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  irUltimaPagina(): void {
    this.paginaActual = Math.ceil(this.totalProductos / this.productosPorPagina);
    this.actualizarPaginacion();
  }
  crearProducto() {
    this.router.navigate(['/productos/crear']);
  }

  nuevoIngreso() {
    this.router.navigate(['/ingresos/nuevo']);
  }

  eliminarProducto(id: string) {
    Swal.fire({
      title: '¿Eliminar producto?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.productosService.deleteProducto(id)
          .then(() => {
            Swal.fire('Eliminado', 'Producto eliminado exitosamente', 'success');
          })
          .catch(error => {
            console.error('Error al eliminar producto:', error);
            Swal.fire('Error', 'No se pudo eliminar el producto', 'error');
          });
      }
    });
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

  /**
   * Aplica filtros combinados: grupo (desde URL) y búsqueda (desde input)
   */
  aplicarFiltros() {
    let productosFiltrados = [...this.productos];

    // Filtrar por grupo si está seleccionado
    if (this.grupoSeleccionado) {
      productosFiltrados = productosFiltrados.filter(producto => 
        producto.grupo?.toUpperCase() === this.grupoSeleccionado.toUpperCase()
      );
    }

    // Filtrar por término de búsqueda si existe
    if (this.terminoBusqueda.trim()) {
      const termino = this.terminoBusqueda.toLowerCase().trim();
      productosFiltrados = productosFiltrados.filter(producto => {
        const nombre = producto.nombre?.toLowerCase() || '';
        const modelo = producto.modelo?.toLowerCase() || '';
        const color = producto.color?.toLowerCase() || '';
        const grupo = producto.grupo?.toLowerCase() || '';
        const proveedor = producto.proveedor?.toLowerCase() || '';
        const idInterno = producto.idInterno?.toString() || '';

        return nombre.includes(termino) ||
               modelo.includes(termino) ||
               color.includes(termino) ||
               grupo.includes(termino) ||
               proveedor.includes(termino) ||
               idInterno.includes(termino);
      });
    }

    this.productosFiltrados = productosFiltrados;
    this.totalProductos = this.productosFiltrados.length;
    this.paginaActual = 1; // Resetear a la primera página
    this.actualizarPaginacion();
  }

  buscarProductos() {
    this.aplicarFiltros();
  }

  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.aplicarFiltros();
  }

  /**
   * 📤 Exportar productos a Excel
   * Nombre: "INGRESO MERCADERIA (MES) - (NOMBRE ADMINISTRADOR)"
   */
  exportarProductos(): void {
    const productosExportar = this.productosFiltrados.length > 0 
      ? this.productosFiltrados 
      : this.productos;
    
    // Obtener fecha actual para el mes
    const meses = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const fechaActual = new Date();
    const mesActual = meses[fechaActual.getMonth()];
    
    // Obtener nombre del usuario administrador actual
    const usuarioActual = this.authService.getCurrentUser();
    const nombreAdministrador = usuarioActual?.nombre || 'ADMINISTRADOR';
    
    // Generar nombre del archivo
    const nombreArchivo = `EXPORTACIÓN PRODUCTOS PASAJE ${mesActual}-${new UpperCasePipe().transform(nombreAdministrador)}`;
    
    this.excelService.exportarProductos(productosExportar, nombreArchivo);
  }

  /**
   * 📥 Ir a importar productos
   */
  importarProductos(): void {
    this.router.navigate(['/productos/importar']);
  }
}
