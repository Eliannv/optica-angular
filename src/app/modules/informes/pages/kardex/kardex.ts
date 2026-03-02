import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { MovimientoStockService } from '../../../../core/services/movimiento-stock.service';
import { ProductosService } from '../../../../core/services/productos';
import { SucursalesService } from '../../../../core/services/sucursales.service';
import {
  MovimientoStock,
  FiltrosKardex,
  ResumenKardex
} from '../../../../core/models/movimiento-stock.model';
import { Producto } from '../../../../core/models/producto.model';
import { Sucursal } from '../../../../core/models/sucursal.model';
import { EmpleadosService } from '../../../../core/services/empleados.service';

/**
 * Componente de Kardex - Reporte detallado de movimientos de inventario.
 *
 * Permite consultar el historial completo de entradas, salidas y ajustes de stock
 * con filtros por producto, sucursal y rango de fechas.
 *
 * Calcula automáticamente:
 * - Total de entradas/salidas
 * - Stock final
 * - Utilidad de ventas
 * - Costo total de compras
 */
@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './kardex.html',
  styleUrl: './kardex.css'
})
export class KardexComponent implements OnInit, OnDestroy {
  private readonly movimientoStockSrv = inject(MovimientoStockService);
  private readonly productosSrv = inject(ProductosService);
  private readonly sucursalesSrv = inject(SucursalesService);
  private readonly fb = inject(FormBuilder);

  // Estado de la UI
  loading = false;
  mostrandoResultados = false;

  // Buscador de productos con dropdown
  terminoBusquedaProducto = '';
  productosFiltrados: Producto[] = [];
  mostrarDropdownProductos = false;
  productoSeleccionado: Producto | null = null;

  // Paginación del dropdown
  productosPorPagina = 10;
  productosVisibles = 10;

  // Filtros avanzados de productos
  mostrarFiltrosAvanzados = false;
  grupoSeleccionado = '';
  proveedorSeleccionado = '';
  stockSeleccionado = '';
  gruposDisponibles: string[] = [];
  proveedoresDisponibles: string[] = [];
  usuariosDict: { [id: string]: string } = {};

  // Productos recientes
  mostrarRecientes = false;
  productosRecientes: Producto[] = [];

  // Formulario de filtros
  filtrosForm!: FormGroup;

  // Datos para los selectores
  productos: Producto[] = [];
  sucursales: Sucursal[] = [];

  // Datos del Kardex
  movimientos: MovimientoStock[] = [];
  resumen: ResumenKardex = {
    totalEntradas: 0,
    totalSalidas: 0,
    stockFinal: 0,
    utilidadTotal: 0,
    costoTotalEntradas: 0,
    valorTotalVentas: 0,
    cantidadMovimientos: 0
  };

  // Subscripciones
  private subs = new Subscription();
  private readonly empleadosService = inject(EmpleadosService);

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarCatalogos();
    this.cargarFiltrosAvanzados();
    this.cargarProductosRecientes();
    this.empleadosService.getTodosLosUsuarios().subscribe(usuarios => {
      this.usuariosDict = usuarios.reduce((dict, usuario) => {
        if (usuario.id !== undefined && usuario.id !== null) {
          dict[String(usuario.id)] = `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`;
        }
        return dict;
      }, {} as { [id: string]: string });
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /**
   * Inicializa el formulario de filtros con valores por defecto.
   */
  private inicializarFormulario(): void {
    // Fechas por defecto: último mes
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    this.filtrosForm = this.fb.group({
      productoId: [''],
      sucursalId: [''],
      fechaInicio: [this.formatearFecha(inicioMes)],
      fechaFin: [this.formatearFecha(hoy)],
      tipo: [''] // Todos los tipos por defecto
    });
  }

  /**
   * Carga los catálogos de productos y sucursales para los filtros.
   */
  private cargarCatalogos(): void {
    // Cargar productos
    const subProductos = this.productosSrv.getProductos().subscribe({
      next: (prods: Producto[]) => {
        this.productos = prods.sort((a: Producto, b: Producto) =>
          (a.nombre ?? '').localeCompare(b.nombre ?? '')
        );
      },
      error: (err: any) => {
        console.error('Error al cargar productos:', err);
        Swal.fire('Error', 'No se pudieron cargar los productos', 'error');
      }
    });

    // Cargar sucursales
    const subSucursales = this.sucursalesSrv.getSucursales().subscribe({
      next: (sucs: Sucursal[]) => {
        this.sucursales = sucs;
      },
      error: (err: any) => {
        console.error('Error al cargar sucursales:', err);
        Swal.fire('Error', 'No se pudieron cargar las sucursales', 'error');
      }
    });

    this.subs.add(subProductos);
    this.subs.add(subSucursales);
  }

  /**
   * Carga los filtros avanzados (grupos y proveedores únicos).
   */
  private cargarFiltrosAvanzados(): void {
    const sub = this.productosSrv.getProductos().subscribe({
      next: (productos: Producto[]) => {
        // Extraer grupos únicos
        this.gruposDisponibles = [...new Set(
          productos
            .map(p => p.grupo)
            .filter((g): g is string => !!g)
        )].sort();

        // Extraer proveedores únicos
        this.proveedoresDisponibles = [...new Set(
          productos
            .map(p => p.proveedor)
            .filter((prov): prov is string => !!prov)
        )].sort();
      }
    });

    this.subs.add(sub);
  }

  /**
   * Carga los productos recientes ordenados por fecha de creación.
   */
  private cargarProductosRecientes(): void {
    const sub = this.productosSrv.getProductos().subscribe({
      next: (productos: Producto[]) => {
        // Ordenar por createdAt descendente y tomar los primeros 10
        this.productosRecientes = productos
          .filter(p => p.createdAt)
          .sort((a, b) => {
            const fechaA = this.convertirAFecha(a.createdAt);
            const fechaB = this.convertirAFecha(b.createdAt);
            return fechaB.getTime() - fechaA.getTime();
          })
          .slice(0, 10);
      }
    });

    this.subs.add(sub);
  }

  /**
   * Convierte un timestamp de Firestore a Date.
   */
  private convertirAFecha(timestamp: any): Date {
    if (timestamp?.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
    return new Date();
  }

  /**
   * Ejecuta la consulta del Kardex con los filtros seleccionados.
   */
  async consultarKardex(): Promise<void> {
    const valores = this.filtrosForm.value;

    // Validación: al menos debe seleccionar un producto para optimizar consulta
    if (!this.productoSeleccionado) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un producto',
        text: 'Debes seleccionar al menos un producto para consultar el Kardex.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    this.loading = true;
    this.mostrandoResultados = false;

    try {
      // Construir filtros
      const filtros: FiltrosKardex = {
        productoId: this.productoSeleccionado.id,
        sucursalId: valores.sucursalId || undefined,
        tipo: valores.tipo || undefined,
        fechaInicio: valores.fechaInicio ? new Date(valores.fechaInicio) : undefined,
        fechaFin: valores.fechaFin ? new Date(valores.fechaFin + 'T23:59:59') : undefined
      };

      // Consultar con resumen
      const resultado = await this.movimientoStockSrv.obtenerKardexConResumen(filtros);

      this.movimientos = resultado.movimientos;
      this.resumen = resultado.resumen;
      this.mostrandoResultados = true;

      if (this.movimientos.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No se encontraron movimientos con los filtros seleccionados.',
          confirmButtonText: 'OK'
        });
      }

    } catch (error) {
      console.error('Error al consultar Kardex:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al consultar el Kardex. Verifica los índices de Firestore.',
        footer: '<small>Consulta GUIAS/KARDEX-INDICES-FIRESTORE.md</small>'
      });
    } finally {
      this.loading = false;
    }
  }

  /**
   * Limpia los filtros y resultados.
   */
  limpiarFiltros(): void {
    this.inicializarFormulario();
    this.movimientos = [];
    this.mostrandoResultados = false;
    this.terminoBusquedaProducto = '';
    this.productosFiltrados = [];
    this.mostrarDropdownProductos = false;
    this.productoSeleccionado = null;
    this.resumen = {
      totalEntradas: 0,
      totalSalidas: 0,
      stockFinal: 0,
      utilidadTotal: 0,
      costoTotalEntradas: 0,
      valorTotalVentas: 0,
      cantidadMovimientos: 0
    };
  }

  /**
   * Exporta el Kardex a CSV.
   */
  exportarCSV(): void {
    if (this.movimientos.length === 0) {
      Swal.fire('Sin datos', 'No hay movimientos para exportar', 'info');
      return;
    }

    // Construir CSV
    const headers = [
      'Fecha',
      'Tipo',
      'Documento',
      'Entrada',
      'Salida',
      'Stock',
      'Costo Unit.',
      'Precio Venta',
      'Sucursal',
      'Usuario'
    ];

    const rows = this.movimientos.map(m => [
      this.formatearFechaHora(m.createdAt),
      m.tipo,
      m.referenciaId || '-',
      (m.tipo === 'INGRESO' || m.tipo === 'ANULACION' || (m.tipo === 'AJUSTE' && m.cantidad > 0)) ? Math.abs(m.cantidad) : '',
      (m.tipo === 'VENTA NORMAL' || m.tipo === 'VENTA' || m.tipo === 'SALIDA' || (m.tipo === 'AJUSTE' && m.cantidad < 0)) ? Math.abs(m.cantidad) : '',
      m.stockNuevo,
      m.costoUnitario?.toFixed(2) || '0.00',
      m.precioVenta?.toFixed(2) || '-',
      m.sucursalId || '-',
      m.usuarioId || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const productoNombre = this.productos.find(p => p.id === this.filtrosForm.value.productoId)?.nombre || 'producto';

    link.setAttribute('href', url);
    link.setAttribute('download', `kardex_${productoNombre}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Imprime el Kardex.
   */
  imprimir(): void {
    window.print();
  }

  /**
   * Retorna el nombre del producto seleccionado.
   */
  get productoSeleccionadoNombre(): string {
    return this.productoSeleccionado?.nombre || 'Producto';
  }

  /**
   * Busca productos según el término de búsqueda y filtros.
   */
  buscarProductos(): void {
    const termino = this.terminoBusquedaProducto.toLowerCase().trim();

    if (termino.length === 0) {
      this.productosFiltrados = [];
      this.mostrarDropdownProductos = false;
      this.productosVisibles = this.productosPorPagina;
      return;
    }

    let resultados = this.productos.filter(producto => {
      const nombre = (producto.nombre || '').toLowerCase();
      const codigo = (producto.codigo || '').toLowerCase();
      const idInterno = String(producto.idInterno || '').toLowerCase();
      const modelo = (producto.modelo || '').toLowerCase();

      return nombre.includes(termino) ||
             codigo.includes(termino) ||
             idInterno.includes(termino) ||
             modelo.includes(termino);
    });

    // Aplicar filtros avanzados
    resultados = this.aplicarFiltrosAvanzados(resultados);

    this.productosFiltrados = resultados;
    // Resetear paginación
    this.productosVisibles = this.productosPorPagina;
    this.mostrarDropdownProductos = this.productosFiltrados.length > 0;
  }

  /**
   * Aplica filtros avanzados (grupo, proveedor, stock).
   */
  private aplicarFiltrosAvanzados(productos: Producto[]): Producto[] {
    let resultado = [...productos];

    if (this.grupoSeleccionado) {
      resultado = resultado.filter(p => p.grupo === this.grupoSeleccionado);
    }

    if (this.proveedorSeleccionado) {
      resultado = resultado.filter(p => p.proveedor === this.proveedorSeleccionado);
    }

    if (this.stockSeleccionado) {
      if (this.stockSeleccionado === 'ILIMITADO') {
        resultado = resultado.filter(p => p.tipo_control_stock === 'ILIMITADO');
      } else if (this.stockSeleccionado === 'DISPONIBLE') {
        resultado = resultado.filter(p => p.tipo_control_stock !== 'ILIMITADO' && (p.stock || 0) > 0);
      } else if (this.stockSeleccionado === 'SIN_STOCK') {
        resultado = resultado.filter(p => p.tipo_control_stock !== 'ILIMITADO' && (p.stock || 0) === 0);
      }
    }

    return resultado;
  }

  /**
   * Toggle de filtros avanzados.
   */
  toggleFiltrosAvanzados(): void {
    this.mostrarFiltrosAvanzados = !this.mostrarFiltrosAvanzados;
    if (this.mostrarRecientes) {
      this.mostrarRecientes = false;
    }
  }

  /**
   * Toggle de productos recientes.
   */
  toggleRecientes(): void {
    this.mostrarRecientes = !this.mostrarRecientes;
    if (this.mostrarFiltrosAvanzados) {
      this.mostrarFiltrosAvanzados = false;
    }
  }

  /**
   * Aplicar filtros avanzados y actualizar resultados.
   */
  aplicarFiltros(): void {
    this.buscarProductos();
  }

  /**
   * Limpiar filtros avanzados.
   */
  limpiarFiltrosAvanzados(): void {
    this.grupoSeleccionado = '';
    this.proveedorSeleccionado = '';
    this.stockSeleccionado = '';
    this.buscarProductos();
  }

  /**
   * Carga 10 productos más en el dropdown.
   */
  cargarMasProductos(): void {
    this.productosVisibles += this.productosPorPagina;
  }

  /**
   * Obtiene los productos visibles según la paginación.
   */
  get productosAMostrar(): Producto[] {
    return this.productosFiltrados.slice(0, this.productosVisibles);
  }

  /**
   * Verifica si hay más productos para cargar.
   */
  get hayMasProductos(): boolean {
    return this.productosVisibles < this.productosFiltrados.length;
  }

  /**
   * Selecciona un producto del dropdown.
   */
  seleccionarProducto(producto: Producto): void {
    this.productoSeleccionado = producto;
    this.terminoBusquedaProducto = producto.nombre || '';
    this.mostrarDropdownProductos = false;
    this.productosFiltrados = [];
    this.mostrarRecientes = false; // Cerrar panel de recientes
  }

  /**
   * Limpia la búsqueda de producto.
   */
  limpiarBusquedaProducto(): void {
    this.terminoBusquedaProducto = '';
    this.productosFiltrados = [];
    this.mostrarDropdownProductos = false;
    this.productoSeleccionado = null;
    this.productosVisibles = this.productosPorPagina;
  }

  /**
   * Cierra el dropdown de productos.
   */
  cerrarDropdownProductos(): void {
    this.mostrarDropdownProductos = false;
  }

  /**
   * Formatea una fecha a YYYY-MM-DD para inputs tipo date.
   */
  private formatearFecha(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  /**
   * Formatea un Timestamp de Firestore a formato legible.
   */
  formatearFechaHora(timestamp: any): string {
    if (!timestamp) return '-';

    let fecha: Date;
    if (timestamp.toDate) {
      fecha = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      fecha = timestamp;
    } else if (timestamp.seconds) {
      fecha = new Date(timestamp.seconds * 1000);
    } else {
      return '-';
    }

    return fecha.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Retorna clase CSS según el tipo de movimiento.
   */
  obtenerClaseTipo(tipo: string): string {
    switch (tipo) {
      case 'INGRESO':
        return 'badge-ingreso';
      case 'VENTA NORMAL':
      case 'VENTA':
        return 'badge-venta';
      case 'SALIDA':
        return 'badge-salida';
      case 'AJUSTE':
        return 'badge-ajuste';
      case 'ANULACION':
        return 'badge-anulacion';
      default:
        return 'badge-anulacion';
    }
  }
}
