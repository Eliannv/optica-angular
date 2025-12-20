import { Component, OnInit } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { Observable } from 'rxjs';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Router } from '@angular/router';

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
  terminoBusqueda: string = '';

  constructor(
    private proveedoresService: ProveedoresService,
    private router: Router
  ) {}

  ngOnInit() {
    this.proveedoresService.getProveedores().subscribe(proveedores => {
      this.proveedores = proveedores;
      this.proveedoresFiltrados = proveedores;
      this.totalProveedores = proveedores.length;
      this.actualizarPaginacion();
    });
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

  crearProveedor() {
    this.router.navigate(['/proveedores/crear']);
  }

  eliminarProveedor(id: string) {
    if (confirm('¿Está seguro de eliminar este proveedor?')) {
      this.proveedoresService.deleteProveedor(id).then(() => {
        alert('Proveedor eliminado exitosamente');
      }).catch(error => {
        console.error('Error al eliminar proveedor:', error);
        alert('Error al eliminar el proveedor');
      });
    }
  }

  verDetalle(proveedor: Proveedor) {
    this.proveedorSeleccionado = proveedor;
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.proveedorSeleccionado = null;
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
}
