/**
 * Componente de gestión administrativa de clientes.
 *
 * Este componente proporciona una vista limpia y enfocada únicamente en la
 * gestión administrativa de clientes, sin información clínica ni financiera.
 *
 * Funcionalidades:
 * - Listar clientes activos
 * - Buscar clientes (nombre, cédula, teléfono)
 * - Crear nuevo cliente
 * - Editar información personal
 * - Activar/desactivar clientes
 * - Ver estado de historial clínico (sin detalles)
 * - Paginación de resultados
 *
 * Restricciones:
 * - NO muestra historial clínico detallado
 * - NO muestra facturas
 * - NO muestra cuentas ni ventas
 * - Vista liviana y rápida
 */

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { ClientesService } from '../../../../core/services/clientes';
import { FacturasService } from '../../../../core/services/facturas';
import { AuthService } from '../../../../core/services/auth.service';
import { Cliente } from '../../../../core/models/cliente.model';

@Component({
  imports: [CommonModule, FormsModule],
  standalone: true,
  selector: 'app-lista-clientes',
  templateUrl: './lista-clientes.html',
  styleUrl: './lista-clientes.css'
})
export class ListaClientesComponent implements OnInit {

  terminoBusqueda = '';
  totalClientes = 0;

  clientes: Cliente[] = [];
  clientesFiltrados: Cliente[] = [];
  clientesPaginados: Cliente[] = [];
  paginaActual = 1;
  clientesPorPagina = 10;
  Math = Math;

  cargando = true;
  filtroEstado: 'todos' | 'conHistorial' | 'sinHistorial' = 'todos';
  filtroCredito: 'todos' | 'conCredito' | 'sinCredito' = 'todos';

  deudas: Record<string, { deudaTotal: number; pendientes: number; creditosActivos: number; creditoPersonalActivo: boolean }> = {};
  
  // Modal de información
  clienteSeleccionado: Cliente | null = null;
  mostrarModal = false;

  /**
   * Verifica si el usuario actual es administrador.
   * Solo administradores pueden eliminar clientes.
   */
  get esAdmin(): boolean {
    return this.authService.isAdmin();
  }

  constructor(
    private readonly router: Router,
    private readonly clientesSrv: ClientesService,
    private readonly facturasSrv: FacturasService,
    private readonly authService: AuthService
  ) {}

  /**
   * Inicializa el componente cargando la lista de clientes.
   */
  async ngOnInit(): Promise<void> {
    await this.cargarClientes();
    this.cargando = false;
  }

  /**
   * Carga todos los clientes activos ordenados por fecha de creación.
   */
  private async cargarClientes(): Promise<void> {
    const data = await firstValueFrom(this.clientesSrv.getClientes());
    this.clientes = (data as Cliente[]).sort((a, b) => this.getCreatedMs(b) - this.getCreatedMs(a));
    this.aplicarFiltro();
    await this.cargarDeudasClientes(this.clientes);
  }

  private async cargarDeudasClientes(lista: Cliente[]): Promise<void> {
    const tasks = lista.map(async c => {
      if (!c?.id) return;
      try {
        const res = await this.facturasSrv.getResumenDeuda(c.id);
        this.deudas[c.id] = res;
      } catch (e) {
        console.error('Error deuda cliente', c.id, e);
        this.deudas[c.id] = { deudaTotal: 0, pendientes: 0, creditosActivos: 0, creditoPersonalActivo: false };
      }
    });

    await Promise.all(tasks);
    this.aplicarFiltro();
  }

  /**
   * Extrae el timestamp de creación de un cliente en milisegundos.
   */
  private getCreatedMs(c: any): number {
    const v = c?.createdAt;
    if (!v) return 0;
    try {
      if (typeof v?.toDate === 'function') return v.toDate().getTime();
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v;
    } catch {}
    return 0;
  }

  /**
   * Activa el filtrado de clientes basado en el término de búsqueda actual.
   */
  buscarClientes(): void {
    this.aplicarFiltro();
  }

  /**
   * Limpia el término de búsqueda y muestra todos los clientes.
   */
  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.aplicarFiltro();
  }

  /**
   * Aplica filtros de búsqueda y estado a la lista de clientes.
   */
  aplicarFiltro(): void {
    const t = (this.terminoBusqueda || '').trim().toLowerCase();

    // Filtro por texto
    let base = !t
      ? [...this.clientes]
      : this.clientes.filter(c => {
          const nombre = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.toLowerCase();
          const cedula = (c.cedula ?? '').toLowerCase();
          const telefono = (c.telefono ?? '').toLowerCase();
          return nombre.includes(t) || cedula.includes(t) || telefono.includes(t);
        });

    // Filtro por estado de historial
    if (this.filtroEstado === 'conHistorial') {
      base = base.filter(c => !!c.tieneHistorialClinico);
    } else if (this.filtroEstado === 'sinHistorial') {
      base = base.filter(c => !c.tieneHistorialClinico);
    }

    if (this.filtroCredito === 'conCredito') {
      base = base.filter(c => c.id && !!this.deudas[c.id]?.creditoPersonalActivo);
    } else if (this.filtroCredito === 'sinCredito') {
      base = base.filter(c => c.id && !this.deudas[c.id]?.creditoPersonalActivo);
    }

    this.clientesFiltrados = base;
    this.totalClientes = this.clientesFiltrados.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Actualiza el arreglo de clientes paginados según la página actual.
   */
  actualizarPaginacion(): void {
    const inicio = (this.paginaActual - 1) * this.clientesPorPagina;
    const fin = inicio + this.clientesPorPagina;
    this.clientesPaginados = [...this.clientesFiltrados.slice(inicio, fin)];
  }

  /**
   * Navega a la página siguiente si existe.
   */
  paginaSiguiente(): void {
    if (this.paginaActual * this.clientesPorPagina < this.totalClientes) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la página anterior si existe.
   */
  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la primera página de resultados.
   */
  irPrimeraPagina(): void {
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Navega a la última página de resultados.
   */
  irUltimaPagina(): void {
    this.paginaActual = Math.ceil(this.totalClientes / this.clientesPorPagina);
    this.actualizarPaginacion();
  }

  /**
   * Navega al formulario de creación de nuevo cliente.
   */
  crearCliente(): void {
    this.router.navigate(['/clientes/crear'], {
      queryParams: { returnTo: '/clientes/lista' }
    });
  }

  /**
   * Navega al formulario de edición del cliente.
   */
  editarCliente(clienteId: string): void {
    this.router.navigate(['/clientes/crear'], {
      queryParams: { 
        id: clienteId,
        returnTo: '/clientes/lista'
      }
    });
  }

  /**
   * Muestra el modal con la información personal del cliente.
   */
  async verDetalle(cliente: Cliente): Promise<void> {
    if (this.clienteSeleccionado?.id === cliente.id && this.mostrarModal) {
      this.cerrarModal();
      return;
    }
    this.clienteSeleccionado = cliente;
    this.mostrarModal = true;
  }

  /**
   * Cierra el modal y limpia los datos del cliente seleccionado.
   */
  cerrarModal(): void {
    this.mostrarModal = false;
    this.clienteSeleccionado = null;
  }

  /**
   * Desactiva un cliente mediante soft-delete.
   */
  async desactivarCliente(clienteId: string): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Desactivar cliente?',
      text: 'El cliente se desactivará pero podrá reactivarlo después',
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      await this.clientesSrv.desactivarCliente(clienteId);
      await this.cargarClientes();
      await Swal.fire({
        icon: 'success',
        title: 'Desactivado',
        text: 'Cliente desactivado exitosamente',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al desactivar cliente:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo desactivar el cliente',
        confirmButtonText: 'Entendido'
      });
    }
  }

  /**
   * Función de trackeo para optimizar el renderizado de la lista.
   */
  trackByClienteId(index: number, item: Cliente): string {
    return item.id || `index-${index}`;
  }
}
