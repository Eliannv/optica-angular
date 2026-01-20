import { Component, OnInit } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { Ingreso } from '../../../../core/models/ingreso.model';
import { Observable } from 'rxjs';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { Timestamp } from '@angular/fire/firestore';

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
  Math = Math; // Para usar Math.min en el template
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

  ngOnInit() {
    // 🔹 Cargar TODOS los proveedores (activos e inactivos)
    this.proveedoresService.getProveedoresTodosInclusoInactivos().subscribe(proveedores => {
      this.proveedores = proveedores;
      this.proveedoresFiltrados = proveedores;
      this.totalProveedores = proveedores.length;
      this.actualizarPaginacion();
      
      // Usar el saldo directamente del documento del proveedor en Firestore
      this.proveedores.forEach(proveedor => {
        this.saldosCalculados[proveedor.nombre] = proveedor.saldo || 0;
      });
    });
  }

  // Obtener saldo para mostrar en tabla (usa el saldo guardado en Firestore)
  getSaldoProveedor(proveedorNombre: string | undefined): number {
    if (!proveedorNombre) return 0;
    return this.saldosCalculados[proveedorNombre] || 0;
  }

  actualizarPaginacion() {
    const inicio = (this.paginaActual - 1) * this.proveedoresPorPagina;
    const fin = inicio + this.proveedoresPorPagina;
    this.proveedoresPaginados = [...this.proveedoresFiltrados.slice(inicio, fin)];
  }

  paginaSiguiente() {
    if (this.paginaActual * this.proveedoresPorPagina < this.totalProveedores) {
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
    this.paginaActual = Math.ceil(this.totalProveedores / this.proveedoresPorPagina);
    this.actualizarPaginacion();
  }
  crearProveedor() {
    this.router.navigate(['/proveedores/crear']);
  }

  editarProveedor(proveedor: Proveedor, event: any) {
    event.stopPropagation();
    this.router.navigate(['/proveedores/editar', proveedor.id]);
  }

  eliminarProveedor(id: string) {
    Swal.fire({
      title: '¿Desactivar proveedor?',
      text: 'El proveedor se desactivará pero podrá reactivarlo después',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.proveedoresService.desactivarProveedor(id).then(() => {
          Swal.fire({
            icon: 'success',
            title: 'Desactivado',
            text: 'Proveedor desactivado exitosamente',
            timer: 2000,
            showConfirmButton: false
          });
          // Recargar proveedores
          this.proveedoresService.getProveedoresTodosInclusoInactivos().subscribe(proveedores => {
            this.proveedores = proveedores;
            this.proveedoresFiltrados = proveedores;
            this.totalProveedores = proveedores.length;
            this.paginaActual = 1;
            this.actualizarPaginacion();
          });
        }).catch(error => {
          console.error('Error al desactivar proveedor:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al desactivar el proveedor'
          });
        });
      }
    });
  }

  /**
   * 🔄 Toggle de estado Activo/Desactivado para proveedores
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
            const mensaje = esActivo ? 'Proveedor desactivado exitosamente' : 'Proveedor activado exitosamente';
            Swal.fire(
              esActivo ? 'Desactivado' : 'Activado',
              mensaje,
              'success'
            );
            // Recargar la lista
            this.proveedoresService.getProveedoresTodosInclusoInactivos().subscribe(proveedores => {
              this.proveedores = proveedores;
              this.proveedoresFiltrados = proveedores;
              this.totalProveedores = proveedores.length;
              this.paginaActual = 1;
              this.actualizarPaginacion();
            });
          })
          .catch(error => {
            console.error('Error al cambiar estado del proveedor:', error);
            Swal.fire('Error', `No se pudo ${accion} el proveedor`, 'error');
          });
      }
    });
  }

  verDetalle(proveedor: Proveedor) {
    this.proveedorSeleccionado = proveedor;
    this.mostrarModal = true;
    
    // Actualizar saldo en el caché desde el documento del proveedor
    if (proveedor.nombre) {
      this.saldosCalculados[proveedor.nombre] = proveedor.saldo || 0;
    }
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.proveedorSeleccionado = null;
  }

  // Abrir modal para ver facturas del proveedor
  async verFacturasProveedor(proveedor: Proveedor, event: any) {
    event.stopPropagation();
    
    if (!proveedor.nombre) return;
    
    this.proveedorSeleccionado = proveedor;
    this.ingresosCargando = true;
    this.mostrarModalFacturas = true;

    try {
      this.ingresosService.getIngresosPorProveedor(proveedor.nombre).subscribe(
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

  // Cerrar modal de facturas
  cerrarModalFacturas() {
    this.mostrarModalFacturas = false;
    this.proveedorSeleccionado = null;
    this.ingresosPorProveedor = [];
  }

  // Ver detalle de un ingreso
  verDetalleIngreso(ingreso: Ingreso) {
    this.cerrarModalFacturas();
    // Navegar a ver-ingreso con el ID del ingreso
    this.router.navigate(['/ingresos/ver', ingreso.id]);
  }

  trackByProveedorId(index: number, proveedor: Proveedor): string {
    return proveedor.id || index.toString();
  }

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
    this.paginaActual = 1; // Resetear a la primera página
    this.actualizarPaginacion();
  }

  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.buscarProveedores();
  }

  convertirFecha(fecha: any): Date | null {
    if (!fecha) return null;
    // Si es un Timestamp de Firestore, convertir a Date
    if (fecha.toDate && typeof fecha.toDate === 'function') {
      return fecha.toDate();
    }
    // Si ya es un Date, retornarlo como está
    if (fecha instanceof Date) {
      return fecha;
    }
    // Si es un string, intentar convertirlo
    if (typeof fecha === 'string') {
      return new Date(fecha);
    }
    return null;
  }
}
