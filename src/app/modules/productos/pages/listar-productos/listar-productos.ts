import { Component, OnInit, inject } from '@angular/core';
import { Producto } from '../../../../core/models/producto.model';
import { ProductosService } from '../../../../core/services/productos';
import { ExcelService } from '../../../../core/services/excel.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { UpperCasePipe } from '@angular/common';
import { DocumentSnapshot } from '@angular/fire/firestore';

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
  // 🚀 PAGINACIÓN REAL DESDE FIRESTORE
  productosPaginados: Producto[] = [];
  paginaActual: number = 1;
  productosPorPagina: number = 10;
  totalProductos: number = 0;
  Math = Math;
  
  // 🎯 Snapshots para navegación Firestore
  lastVisible: DocumentSnapshot | null = null;
  firstVisible: DocumentSnapshot | null = null;
  hasMore: boolean = false;
  isLoading: boolean = false;
  
  // 🔍 Historial de páginas para navegación hacia atrás
  paginasHistorial: Array<{
    firstDoc: DocumentSnapshot | null;
    lastDoc: DocumentSnapshot | null;
    pageNumber: number;
  }> = [];
  
  productoSeleccionado: Producto | null = null;
  mostrarModal: boolean = false;
  terminoBusqueda: string = '';
  grupoSeleccionado: string = '';
  ordenamiento: string = 'codigo'; // Cambiado a 'codigo' por defecto para mejor performance

  // ⚠️ Mantenemos productos y productosFiltrados para exportación
  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];

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
   * y carga SOLO los primeros 10 productos con paginación real desde Firestore.
   */
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.grupoSeleccionado = params['grupo'] || '';
      
      // 🚀 PAGINACIÓN REAL: Cargar solo primera página
      this.cargarPrimeraPage();
      
      // ⚠️ Cargar todos los productos SOLO para exportación (lazy)
      this.cargarProductosParaExportacion();
    });
  }

  /**
   * 🚀 Carga la primera página de productos con paginación real
   */
  private async cargarPrimeraPage(): Promise<void> {
    this.isLoading = true;
    this.paginaActual = 1;
    this.paginasHistorial = [];
    
    try {
      const resultado = await this.productosService.getProductosPaginadosReal({
        pageSize: this.productosPorPagina,
        ordenamiento: this.ordenamiento as 'reciente' | 'codigo',
        terminoBusqueda: this.terminoBusqueda,
        grupoSeleccionado: this.grupoSeleccionado
      });
      
      this.productosPaginados = resultado.productos;
      this.lastVisible = resultado.lastDoc;
      this.firstVisible = resultado.firstDoc;
      this.hasMore = resultado.hasMore;
      
      // Guardar en historial
      if (resultado.firstDoc) {
        this.paginasHistorial.push({
          firstDoc: resultado.firstDoc,
          lastDoc: resultado.lastDoc,
          pageNumber: 1
        });
      }
      
      // Actualizar total estimado (solo para UI)
      this.totalProductos = resultado.productos.length;
      
    } catch (error) {
      console.error('Error al cargar productos:', error);
      Swal.fire('Error', 'No se pudieron cargar los productos', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * ⚠️ Carga todos los productos SOLO para exportación
   * Se ejecuta en background sin bloquear la UI
   */
  private cargarProductosParaExportacion(): void {
    this.productosService.getProductosTodosInclusoInactivos().subscribe(productos => {
      this.productos = productos;
      
      // Aplicar los mismos filtros que en la paginación
      let filtrados = [...productos];
      
      if (this.grupoSeleccionado) {
        filtrados = filtrados.filter(producto => 
          producto.grupo?.toUpperCase() === this.grupoSeleccionado.toUpperCase()
        );
      }
      
      if (this.terminoBusqueda.trim()) {
        const termino = this.terminoBusqueda.toLowerCase().trim();
        filtrados = filtrados.filter(producto => {
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
      
      this.productosFiltrados = filtrados;
    });
  }

  /**
   * ⚠️ DEPRECATED: Ya no se usa paginación en memoria
   * Ahora la paginación es real desde Firestore
   */
  actualizarPaginacion() {
    // Método mantenido por compatibilidad pero ya no se usa
    console.warn('actualizarPaginacion() está deprecated - usando paginación real de Firestore');
  }

  /**
   * 🚀 Navega a la página siguiente (PAGINACIÓN REAL)
   */
  async paginaSiguiente(): Promise<void> {
    if (!this.hasMore || this.isLoading) {
      return;
    }
    
    this.isLoading = true;
    
    try {
      const resultado = await this.productosService.getProductosPaginadosReal({
        pageSize: this.productosPorPagina,
        lastVisible: this.lastVisible,
        direction: 'next',
        ordenamiento: this.ordenamiento as 'reciente' | 'codigo',
        terminoBusqueda: this.terminoBusqueda,
        grupoSeleccionado: this.grupoSeleccionado
      });
      
      this.productosPaginados = resultado.productos;
      this.lastVisible = resultado.lastDoc;
      this.firstVisible = resultado.firstDoc;
      this.hasMore = resultado.hasMore;
      this.paginaActual++;
      
      // Guardar en historial
      if (resultado.firstDoc) {
        this.paginasHistorial.push({
          firstDoc: resultado.firstDoc,
          lastDoc: resultado.lastDoc,
          pageNumber: this.paginaActual
        });
      }
      
    } catch (error) {
      console.error('Error al cargar página siguiente:', error);
      Swal.fire('Error', 'No se pudo cargar la siguiente página', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🚀 Navega a la página anterior (PAGINACIÓN REAL)
   */
  async paginaAnterior(): Promise<void> {
    if (this.paginaActual <= 1 || this.isLoading) {
      return;
    }
    
    this.isLoading = true;
    
    try {
      // Eliminar la página actual del historial
      this.paginasHistorial.pop();
      this.paginaActual--;
      
      // Obtener la página anterior (ahora la última en el historial)
      const paginaAnterior = this.paginasHistorial[this.paginasHistorial.length - 1];
      
      if (!paginaAnterior) {
        // Si no hay historial, recargar primera página
        await this.cargarPrimeraPage();
        return;
      }
      
      // Si es la primera página, recargarla directamente
      if (paginaAnterior.pageNumber === 1) {
        await this.cargarPrimeraPage();
        return;
      }
      
      // Cargar desde el snapshot del historial usando el lastDoc de la página anterior
      const resultado = await this.productosService.getProductosPaginadosReal({
        pageSize: this.productosPorPagina,
        lastVisible: this.paginasHistorial[this.paginasHistorial.length - 2]?.lastDoc || null,
        direction: 'next',
        ordenamiento: this.ordenamiento as 'reciente' | 'codigo',
        terminoBusqueda: this.terminoBusqueda,
        grupoSeleccionado: this.grupoSeleccionado
      });
      
      this.productosPaginados = resultado.productos;
      this.lastVisible = paginaAnterior.lastDoc;
      this.firstVisible = paginaAnterior.firstDoc;
      this.hasMore = true; // Sabemos que hay más porque veníamos de una página posterior
      
    } catch (error) {
      console.error('Error al cargar página anterior:', error);
      Swal.fire('Error', 'No se pudo cargar la página anterior', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🚀 Navega a la primera página (PAGINACIÓN REAL)
   */
  async irPrimeraPagina(): Promise<void> {
    if (this.paginaActual === 1 || this.isLoading) {
      return;
    }
    
    await this.cargarPrimeraPage();
  }

  /**
   * ⚠️ Navegar a última página no es eficiente con paginación cursor
   * Se deshabilita esta funcionalidad
   */
  irUltimaPagina(): void {
    Swal.fire({
      icon: 'info',
      title: 'Navegación optimizada',
      text: 'Para mejor rendimiento, usa los botones Siguiente/Anterior para navegar por las páginas.',
      confirmButtonText: 'Entendido'
    });
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
   * Recarga automáticamente la página actual tras el cambio.
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
            
            // 🚀 Recargar página actual con paginación real
            this.recargarPaginaActual();
          })
          .catch(error => {
            console.error('Error al cambiar estado del producto:', error);
            Swal.fire('Error', `No se pudo ${accion} el producto`, 'error');
          });
      }
    });
  }

  /**
   * 🚀 Recarga la página actual de productos
   * 
   * @private
   */
  private async recargarPaginaActual(): Promise<void> {
    if (this.paginaActual === 1) {
      await this.cargarPrimeraPage();
    } else {
      // Si no estamos en la primera página, ir a la primera por simplicidad
      await this.irPrimeraPagina();
    }
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
        
        // 🚀 Actualizar en la lista paginada actual
        const index = this.productosPaginados.findIndex(p => p.id === producto.id);
        if (index !== -1) {
          this.productosPaginados[index].observacion = nuevaObservacion || '';
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
   * 🚀 Aplica filtros y recarga desde la primera página
   * 
   * @description
   * Resetea la paginación y vuelve a consultar Firestore con los nuevos filtros.
   */
  async aplicarFiltros(): Promise<void> {
    await this.cargarPrimeraPage();
    // También actualizar los productos para exportación
    this.cargarProductosParaExportacion();
  }

  /**
   * 🚀 Ejecuta la búsqueda aplicando todos los filtros activos
   */
  async buscarProductos(): Promise<void> {
    await this.aplicarFiltros();
  }

  /**
   * 🚀 Limpia el campo de búsqueda y recarga productos
   */
  async limpiarBusqueda(): Promise<void> {
    this.terminoBusqueda = '';
    await this.aplicarFiltros();
  }

  /**
   * 🚀 Cambia el tipo de ordenamiento y recarga
   * 
   * @param nuevoOrdenamiento - Tipo de ordenamiento ('reciente' o 'codigo')
   */
  async cambiarOrdenamiento(nuevoOrdenamiento: string): Promise<void> {
    this.ordenamiento = nuevoOrdenamiento;
    await this.aplicarFiltros();
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
    
    // Ordenar productos por idInterno ascendente antes de exportar
    const productosOrdenados = [...productosExportar].sort((a, b) => {
      const idA = (a as any).idInterno || 0;
      const idB = (b as any).idInterno || 0;
      return idA - idB;
    });
    
    const meses = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const fechaActual = new Date();
    const mesActual = meses[fechaActual.getMonth()];
    
    const usuarioActual = this.authService.getCurrentUser();
    const nombreAdministrador = usuarioActual?.nombre || 'ADMINISTRADOR';
    
    const nombreArchivo = `EXPORTACIÓN PRODUCTOS PASAJE ${mesActual}-${new UpperCasePipe().transform(nombreAdministrador)}`;
    
    this.excelService.exportarProductos(productosOrdenados, nombreArchivo);
  }

  /**
   * Redirige a la página de importación de productos desde Excel
   */
  importarProductos(): void {
    this.router.navigate(['/productos/importar']);
  }
}
