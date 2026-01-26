import { Component, OnInit } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { Ingreso } from '../../../../core/models/ingreso.model';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { Timestamp } from '@angular/fire/firestore';

/**
 * Componente para listar y gestionar proveedores
 * 
 * @description
 * Permite visualizar proveedores con filtrado, búsqueda, paginación,
 * activación/desactivación, consulta de saldo y visualización de facturas/ingresos.
 * 
 * @example
 * ```html
 * <app-listar-proveedores></app-listar-proveedores>
 * ```
 */
@Component({
  selector: 'app-listar-proveedores',
  standalone: false,
  templateUrl: './listar-proveedores.html',
  styleUrl: './listar-proveedores.css',
})
export class ListarProveedores implements OnInit {
  proveedores: Proveedor[] = [];
  proveedoresFiltrados: Proveedor[] = [];
  proveedoresPaginados: Proveedor[] = [];
  paginaActual: number = 1;
  proveedoresPorPagina: number = 10;
  totalProveedores: number = 0;
  Math = Math;
  proveedorSeleccionado: Proveedor | null = null;
  mostrarModal: boolean = false;
  mostrarModalFacturas: boolean = false;
  terminoBusqueda: string = '';
  ingresosPorProveedor: Ingreso[] = [];
  ingresosCargando: boolean = false;
  proveedorFacturasId: string = '';
  saldosCalculados: { [proveedorId: string]: number } = {};

  constructor(
    private proveedoresService: ProveedoresService,
    private ingresosService: IngresosService,
    private router: Router
  ) {}

  /**
   * Inicializa el componente y carga los proveedores
   * 
   * @description
   * Carga todos los proveedores (activos e inactivos) desde Firestore
   * y calcula sus saldos desde el documento del proveedor.
   */
  ngOnInit() {
    this.cargarProveedores();
  }

  /**
   * Carga todos los proveedores desde Firestore
   * 
   * @private
   */
  private cargarProveedores() {
    this.proveedoresService.getProveedoresTodosInclusoInactivos().subscribe(proveedores => {
      this.proveedores = proveedores;
      this.proveedoresFiltrados = proveedores;
      this.totalProveedores = proveedores.length;
      this.actualizarPaginacion();
      
      this.proveedores.forEach(proveedor => {
        this.saldosCalculados[proveedor.nombre] = proveedor.saldo || 0;
      });
    });
  }

  /**
   * Obtiene el saldo de un proveedor desde el caché de saldos calculados
   * 
   * @param proveedorNombre - Nombre del proveedor
   * @returns Saldo del proveedor o 0 si no existe
   */
  getSaldoProveedor(proveedorNombre: string | undefined): number {
    if (!proveedorNombre) return 0;
    return this.saldosCalculados[proveedorNombre] || 0;
  }

  /**
   * Actualiza la paginación mostrando los proveedores de la página actual
   */
  actualizarPaginacion() {
    const inicio = (this.paginaActual - 1) * this.proveedoresPorPagina;
    const fin = inicio + this.proveedoresPorPagina;
    this.proveedoresPaginados = [...this.proveedoresFiltrados.slice(inicio, fin)];
  }

  /**
   * Navega a la página siguiente si existe
   */
  paginaSiguiente() {
    if (this.paginaActual * this.proveedoresPorPagina < this.totalProveedores) {
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
    this.paginaActual = Math.ceil(this.totalProveedores / this.proveedoresPorPagina);
    this.actualizarPaginacion();
  }

  /**
   * Redirige a la página de creación de nuevo proveedor
   */
  crearProveedor() {
    this.router.navigate(['/proveedores/crear']);
  }

  /**
   * Redirige a la página de edición de un proveedor
   * 
   * @param proveedor - Proveedor a editar
   * @param event - Evento del click para evitar propagación
   */
  editarProveedor(proveedor: Proveedor, event: any) {
    event.stopPropagation();
    this.router.navigate(['/proveedores/editar', proveedor.id]);
  }

  /**
   * Activa o desactiva un proveedor (soft delete)
   * 
   * @param proveedor - Proveedor a modificar
   * 
   * @description
   * Muestra un diálogo de confirmación y alterna el estado activo/inactivo del proveedor.
   * Recarga automáticamente la lista tras el cambio.
   */
  toggleEstadoProveedor(proveedor: Proveedor) {
    const esActivo = proveedor.activo !== false;
    const accion = esActivo ? 'desactivar' : 'activar';
    const metodo = esActivo 
      ? this.proveedoresService.desactivarProveedor(proveedor.id!)
      : this.proveedoresService.activarProveedor(proveedor.id!);

    Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} proveedor?`,
      text: esActivo 
        ? 'El proveedor se desactivará pero podrá reactivarlo después'
        : 'El proveedor será reactivado',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        metodo
          .then(() => {
            const mensaje = esActivo 
              ? 'Proveedor desactivado exitosamente' 
              : 'Proveedor activado exitosamente';
            Swal.fire(esActivo ? 'Desactivado' : 'Activado', mensaje, 'success');
            this.cargarProveedores();
          })
          .catch(error => {
            console.error('Error al cambiar estado del proveedor:', error);
            Swal.fire('Error', `No se pudo ${accion} el proveedor`, 'error');
          });
      }
    });
  }

  /**
   * Muestra el modal con los detalles completos de un proveedor
   * 
   * @param proveedor - Proveedor a visualizar
   */
  verDetalle(proveedor: Proveedor) {
    this.proveedorSeleccionado = proveedor;
    this.mostrarModal = true;
    
    if (proveedor.nombre) {
      this.saldosCalculados[proveedor.nombre] = proveedor.saldo || 0;
    }
  }

  /**
   * Cierra el modal de detalle de proveedor
   */
  cerrarModal() {
    this.mostrarModal = false;
    this.proveedorSeleccionado = null;
  }

  /**
   * Abre el modal con las facturas/ingresos asociados a un proveedor
   * 
   * @param proveedor - Proveedor del cual ver facturas
   * @param event - Evento del click para evitar propagación
   */
  async verFacturasProveedor(proveedor: Proveedor, event: any) {
    event.stopPropagation();
    
    // Usar código del proveedor (que no cambia) en lugar del nombre
    if (!proveedor.codigo) return;
    
    this.proveedorSeleccionado = proveedor;
    this.ingresosCargando = true;
    this.mostrarModalFacturas = true;

    try {
      this.ingresosService.getIngresosPorProveedorCodigo(proveedor.codigo).subscribe(
        ingresos => {
          this.ingresosPorProveedor = ingresos;
          this.ingresosCargando = false;
        },
        error => {
          console.error('Error al obtener ingresos:', error);
          this.ingresosCargando = false;
        }
      );
    } catch (error) {
      console.error('Error:', error);
      this.ingresosCargando = false;
    }
  }

  /**
   * Cierra el modal de facturas/ingresos
   */
  cerrarModalFacturas() {
    this.mostrarModalFacturas = false;
    this.proveedorSeleccionado = null;
    this.ingresosPorProveedor = [];
  }

  /**
   * Navega al detalle de un ingreso específico
   * 
   * @param ingreso - Ingreso a visualizar
   */
  verDetalleIngreso(ingreso: Ingreso) {
    this.cerrarModalFacturas();
    this.router.navigate(['/ingresos/ver', ingreso.id]);
  }

  /**
   * Función de rastreo para ngFor optimizado
   * 
   * @param index - Índice del elemento en el array
   * @param proveedor - Proveedor actual
   * @returns ID único del proveedor o el índice como fallback
   */
  trackByProveedorId(index: number, proveedor: Proveedor): string {
    return proveedor.id || index.toString();
  }

  /**
   * Filtra proveedores según el término de búsqueda
   * 
   * @description
   * Busca coincidencias en nombre, RUC, representante, dirección y código.
   * Resetea la paginación a la primera página.
   */
  buscarProveedores() {
    const termino = this.terminoBusqueda.toLowerCase().trim();

    if (!termino) {
      this.proveedoresFiltrados = this.proveedores;
    } else {
      this.proveedoresFiltrados = this.proveedores.filter(proveedor => {
        const nombre = proveedor.nombre?.toLowerCase() || '';
        const ruc = proveedor.ruc?.toLowerCase() || '';
        const representante = proveedor.representante?.toLowerCase() || '';
        const direccion = proveedor.direccion?.direccion?.toLowerCase() || '';
        const codigo = proveedor.codigo?.toLowerCase() || '';

        return nombre.includes(termino) ||
               ruc.includes(termino) ||
               representante.includes(termino) ||
               direccion.includes(termino) ||
               codigo.includes(termino);
      });
    }

    this.totalProveedores = this.proveedoresFiltrados.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Limpia el campo de búsqueda y recarga todos los proveedores
   */
  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.buscarProveedores();
  }

  /**
   * Convierte un Timestamp de Firestore a Date
   * 
   * @param fecha - Timestamp, Date o string a convertir
   * @returns Objeto Date o null si no es válido
   */
  convertirFecha(fecha: any): Date | null {
    if (!fecha) return null;
    if (fecha.toDate && typeof fecha.toDate === 'function') {
      return fecha.toDate();
    }
    if (fecha instanceof Date) {
      return fecha;
    }
    if (typeof fecha === 'string') {
      return new Date(fecha);
    }
    return null;
  }
}
