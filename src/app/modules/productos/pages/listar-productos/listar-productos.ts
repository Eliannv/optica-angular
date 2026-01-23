import { Component, OnInit, inject } from '@angular/core';
import { Producto } from '../../../../core/models/producto.model';
import { ProductosService } from '../../../../core/services/productos';
import { ExcelService } from '../../../../core/services/excel.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { UpperCasePipe } from '@angular/common';

/**
 * Componente para listar y gestionar productos
 * 
 * @description
 * Permite visualizar productos con filtrado por grupo, búsqueda, ordenamiento, paginación,
 * exportación/importación Excel, activación/desactivación y edición de observaciones.
 * 
 * @example
 * ```html
 * <app-listar-productos></app-listar-productos>
 * ```
 */
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
  Math = Math;
  productoSeleccionado: Producto | null = null;
  mostrarModal: boolean = false;
  terminoBusqueda: string = '';
  grupoSeleccionado: string = '';
  ordenamiento: string = 'reciente';

  constructor(
    private productosService: ProductosService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  private excelService = inject(ExcelService);
  private authService = inject(AuthService);

  /**
   * Inicializa el componente y carga los productos
   * 
   * @description
   * Se suscribe a los parámetros de consulta para detectar cambios en el grupo seleccionado
   * y carga todos los productos (activos e inactivos) desde Firestore.
   */
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.grupoSeleccionado = params['grupo'] || '';
      
      this.productosService.getProductosTodosInclusoInactivos().subscribe(productos => {
        this.productos = productos;
        this.aplicarFiltros();
      });
    });
  }

  /**
   * Actualiza la paginación mostrando los productos correspondientes a la página actual
   */
  actualizarPaginacion() {
    const inicio = (this.paginaActual - 1) * this.productosPorPagina;
    const fin = inicio + this.productosPorPagina;
    this.productosPaginados = [...this.productosFiltrados.slice(inicio, fin)];
  }

  /**
   * Navega a la página siguiente si existe
   */
  paginaSiguiente() {
    if (this.paginaActual * this.productosPorPagina < this.totalProductos) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la página anterior si existe
   */
  paginaAnterior() {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la primera página
   */
  irPrimeraPagina(): void {
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Navega a la última página
   */
  irUltimaPagina(): void {
    this.paginaActual = Math.ceil(this.totalProductos / this.productosPorPagina);
    this.actualizarPaginacion();
  }

  /**
   * Redirige a la página de creación de nuevo ingreso
   */
  nuevoIngreso() {
    this.router.navigate(['/ingresos/nuevo']);
  }

  /**
   * Activa o desactiva un producto (soft delete)
   * 
   * @param producto - Producto a modificar
   * 
   * @description
   * Muestra un diálogo de confirmación y alterna el estado activo/inactivo del producto.
   * Recarga automáticamente la lista tras el cambio.
   */
  toggleEstadoProducto(producto: Producto) {
    const esActivo = producto.activo !== false;
    const accion = esActivo ? 'desactivar' : 'activar';
    const metodo = esActivo 
      ? this.productosService.desactivarProducto(producto.id!) 
      : this.productosService.activarProducto(producto.id!);

    Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} producto?`,
      text: esActivo 
        ? 'El producto se desactivará pero podrá reactivarlo después'
        : 'El producto será reactivado y aparecerá en las listas',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        metodo
          .then(() => {
            const mensaje = esActivo 
              ? 'Producto desactivado exitosamente' 
              : 'Producto activado exitosamente';
            Swal.fire(esActivo ? 'Desactivado' : 'Activado', mensaje, 'success');
            this.recargarProductos();
          })
          .catch(error => {
            console.error('Error al cambiar estado del producto:', error);
            Swal.fire('Error', `No se pudo ${accion} el producto`, 'error');
          });
      }
    });
  }

  /**
   * Recarga la lista de productos desde Firestore
   * 
   * @private
   */
  private recargarProductos() {
    this.productosService.getProductosTodosInclusoInactivos().subscribe(productos => {
      this.productos = productos;
      this.aplicarFiltros();
    });
  }

  /**
   * Permite editar la observación de un producto mediante un diálogo modal
   * 
   * @param producto - Producto cuya observación se editará
   * 
   * @description
   * Muestra un textarea en SweetAlert2 con la observación actual y actualiza
   * Firestore si el usuario confirma. Actualiza también la lista local.
   */
  async editarObservacion(producto: Producto): Promise<void> {
    const { value: nuevaObservacion } = await Swal.fire({
      title: `Editar observación - ${producto.nombre}`,
      input: 'textarea',
      inputValue: producto.observacion || '',
      inputPlaceholder: 'Escribe las observaciones del producto...',
      inputAttributes: {
        rows: '5'
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar'
    });

    if (nuevaObservacion !== undefined) {
      try {
        await this.productosService.updateProducto(producto.id!, {
          observacion: nuevaObservacion || ''
        });
        
        const index = this.productos.findIndex(p => p.id === producto.id);
        if (index !== -1) {
          this.productos[index].observacion = nuevaObservacion || '';
        }
        
        Swal.fire('Guardado', 'Observación actualizada exitosamente', 'success');
      } catch (error) {
        console.error('Error al actualizar observación:', error);
        Swal.fire('Error', 'No se pudo actualizar la observación', 'error');
      }
    }
  }

  /**
   * Muestra el modal con los detalles completos de un producto
   * 
   * @param producto - Producto a visualizar
   */
  verDetalle(producto: Producto) {
    this.productoSeleccionado = producto;
    this.mostrarModal = true;
  }

  /**
   * Cierra el modal de detalle de producto
   */
  cerrarModal() {
    this.mostrarModal = false;
    this.productoSeleccionado = null;
  }

  /**
   * Función de rastreo para ngFor optimizado
   * 
   * @param index - Índice del elemento en el array
   * @param producto - Producto actual
   * @returns ID único del producto o el índice como fallback
   */
  trackByProductoId(index: number, producto: Producto): string {
    return producto.id || index.toString();
  }

  /**
   * Aplica filtros combinados de grupo, búsqueda y ordenamiento
   * 
   * @description
   * Filtra por grupo (desde URL), por término de búsqueda (nombre, modelo, color, grupo, 
   * proveedor, idInterno) y aplica ordenamiento (reciente o por código).
   * Resetea la paginación a la primera página.
   */
  aplicarFiltros() {
    let productosFiltrados = [...this.productos];

    if (this.grupoSeleccionado) {
      productosFiltrados = productosFiltrados.filter(producto => 
        producto.grupo?.toUpperCase() === this.grupoSeleccionado.toUpperCase()
      );
    }

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

    if (this.ordenamiento === 'codigo') {
      productosFiltrados.sort((a, b) => {
        const codigoA = (a.idInterno || 0) as number;
        const codigoB = (b.idInterno || 0) as number;
        return codigoA - codigoB;
      });
    } else if (this.ordenamiento === 'reciente') {
      productosFiltrados.sort((a, b) => {
        const fechaA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const fechaB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return fechaB - fechaA;
      });
    }

    this.productosFiltrados = productosFiltrados;
    this.totalProductos = this.productosFiltrados.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Ejecuta la búsqueda aplicando todos los filtros activos
   */
  buscarProductos() {
    this.aplicarFiltros();
  }

  /**
   * Limpia el campo de búsqueda y recarga todos los productos filtrados
   */
  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.aplicarFiltros();
  }

  /**
   * Cambia el tipo de ordenamiento de la lista
   * 
   * @param nuevoOrdenamiento - Tipo de ordenamiento ('reciente' o 'codigo')
   */
  cambiarOrdenamiento(nuevoOrdenamiento: string) {
    this.ordenamiento = nuevoOrdenamiento;
    this.aplicarFiltros();
  }

  /**
   * Exporta los productos filtrados a un archivo Excel
   * 
   * @description
   * Genera un archivo Excel con el nombre "EXPORTACIÓN PRODUCTOS PASAJE {MES}-{NOMBRE_ADMIN}".
   * Exporta los productos filtrados si existen filtros activos, o todos los productos si no.
   */
  exportarProductos(): void {
    const productosExportar = this.productosFiltrados.length > 0 
      ? this.productosFiltrados 
      : this.productos;
    
    const meses = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const fechaActual = new Date();
    const mesActual = meses[fechaActual.getMonth()];
    
    const usuarioActual = this.authService.getCurrentUser();
    const nombreAdministrador = usuarioActual?.nombre || 'ADMINISTRADOR';
    
    const nombreArchivo = `EXPORTACIÓN PRODUCTOS PASAJE ${mesActual}-${new UpperCasePipe().transform(nombreAdministrador)}`;
    
    this.excelService.exportarProductos(productosExportar, nombreArchivo);
  }

  /**
   * Redirige a la página de importación de productos desde Excel
   */
  importarProductos(): void {
    this.router.navigate(['/productos/importar']);
  }
}
