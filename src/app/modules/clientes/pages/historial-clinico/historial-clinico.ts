import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { FacturasService } from '../../../../core/services/facturas'; // ✅ NUEVO

import { Cliente } from '../../../../core/models/cliente.model';
import { HistoriaClinica } from '../../../../core/models/historia-clinica.model';

type ClienteUI = Cliente & { id: string; tieneHistorial: boolean };

@Component({
  imports: [CommonModule, FormsModule],
  standalone: true,
  selector: 'app-historial-clinico',
  templateUrl: './historial-clinico.html',
  styleUrl: './historial-clinico.css'
})
export class HistorialClinicoComponent implements OnInit {

  terminoBusqueda = '';
  totalClientes = 0;

  clientes: ClienteUI[] = [];
  clientesFiltrados: ClienteUI[] = [];
  clientesPaginados: ClienteUI[] = [];
  paginaActual: number = 1;
  clientesPorPagina: number = 10;
  Math = Math; // Para usar Math.min en el template

  cargando = true;

  // ✅ NUEVO: deuda por cliente
  deudas: Record<string, { deudaTotal: number; pendientes: number }> = {};

  // ✅ NUEVO: filtro de estado
  filtroEstado: 'todos' | 'deudores' | 'conHistorial' | 'sinHistorial' = 'todos';

  // Modal
  clienteSeleccionado: ClienteUI | null = null;
  historialClinico: HistoriaClinica | null = null;
  mostrarModal: boolean = false;
  cargandoHistorial: boolean = false;

  constructor(
    private router: Router,
    private clientesSrv: ClientesService,
    private historialSrv: HistorialClinicoService,
    private facturasSrv: FacturasService // ✅ NUEVO
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarClientes();
    this.cargando = false;
  }

  private async cargarClientes(): Promise<void> {
    const data = await firstValueFrom(this.clientesSrv.getClientes());

    const clientesBase: ClienteUI[] = (data as any[]).map(c => ({
      ...(c as Cliente),
      id: (c as any).id,
      tieneHistorial: false
    }));

    const withHistorial = await Promise.all(
      clientesBase.map(async (c) => {
        const snap = await this.historialSrv.obtenerHistorial(c.id);
        return { ...c, tieneHistorial: snap.exists() };
      })
    );

    this.clientes = withHistorial.sort((a, b) => this.getCreatedMs(b) - this.getCreatedMs(a));
    this.aplicarFiltro();
    await this.cargarDeudasClientes(this.clientes);
  }

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

  imprimirHistorial(clienteId: string) {
  this.router.navigate(['/historial-print', clienteId]);
}


  // ✅ NUEVO: cargar deuda total por cliente
  private async cargarDeudasClientes(lista: ClienteUI[]): Promise<void> {
    // carga en paralelo
    const tasks = lista.map(async c => {
      if (!c?.id) return;
      try {
        const res = await this.facturasSrv.getResumenDeuda(c.id);
        this.deudas[c.id] = res;
      } catch (e) {
        console.error('Error deuda cliente', c.id, e);
        this.deudas[c.id] = { deudaTotal: 0, pendientes: 0 };
      }
    });

    await Promise.all(tasks);
  }

  // 🔎 Buscar
  buscarClientes(): void {
    this.aplicarFiltro();
  }

  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.aplicarFiltro();
  }

  aplicarFiltro(): void {
    const t = (this.terminoBusqueda || '').trim().toLowerCase();

    // 1) Texto
    let base = !t
      ? [...this.clientes]
      : this.clientes.filter(c => {
          const nombre = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.toLowerCase();
          const cedula = (c.cedula ?? '').toLowerCase();
          const telefono = (c.telefono ?? '').toLowerCase();
          return nombre.includes(t) || cedula.includes(t) || telefono.includes(t);
        });

    // 2) Filtro estado
    if (this.filtroEstado === 'deudores') {
      base = base.filter(c => (this.deudas[c.id]?.deudaTotal || 0) > 0);
    } else if (this.filtroEstado === 'conHistorial') {
      base = base.filter(c => !!c.tieneHistorial);
    } else if (this.filtroEstado === 'sinHistorial') {
      base = base.filter(c => !c.tieneHistorial);
    }

    // 3) Ordenar por más reciente (por si cambió por filtrado)
    const getCreatedMs = (c: any): number => {
      const v = c?.createdAt;
      if (!v) return 0;
      try {
        if (typeof v?.toDate === 'function') return v.toDate().getTime();
        if (v instanceof Date) return v.getTime();
        if (typeof v === 'number') return v;
      } catch {}
      return 0;
    };
    this.clientesFiltrados = base.sort((a, b) => getCreatedMs(b) - getCreatedMs(a));

    this.totalClientes = this.clientesFiltrados.length;
    this.paginaActual = 1; // Resetear a la primera página al filtrar
    this.actualizarPaginacion();
  }

  actualizarPaginacion(): void {
    const inicio = (this.paginaActual - 1) * this.clientesPorPagina;
    const fin = inicio + this.clientesPorPagina;
    this.clientesPaginados = [...this.clientesFiltrados.slice(inicio, fin)];
  }

  paginaSiguiente(): void {
    if (this.paginaActual * this.clientesPorPagina < this.totalClientes) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  paginaAnterior(): void {
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
    this.paginaActual = Math.ceil(this.totalClientes / this.clientesPorPagina);
    this.actualizarPaginacion();
  }

  // ✅ Acciones
  crearCliente(): void {
    this.router.navigate(['/clientes/crear'], {
      queryParams: { returnTo: '/clientes/historial-clinico' }
    });
  }

  // ✅ Ver detalles en modal
  async verDetalle(cliente: ClienteUI): Promise<void> {
    this.clienteSeleccionado = cliente;
    this.mostrarModal = true;
    this.cargandoHistorial = true;
    this.historialClinico = null;

    try {
      if (cliente.id) {
        const snap = await this.historialSrv.obtenerHistorial(cliente.id);
        if (snap.exists()) {
          this.historialClinico = snap.data() as HistoriaClinica;
        }
      }
    } catch (error) {
      console.error('Error al cargar historial clínico:', error);
    } finally {
      this.cargandoHistorial = false;
    }
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.clienteSeleccionado = null;
    this.historialClinico = null;
  }

  // ✅ Si NO tiene historial => crear
  crearHistorial(clienteId: string): void {
    this.router.navigate([`/clientes/${clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'create' }
    });
  }

  // ✅ Editar
  editarHistorial(clienteId: string): void {
    this.router.navigate([`/clientes/${clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'edit' }
    });
  }

  // ✅ Crear Recibo (POS)
  crearRecibo(clienteId: string): void {
    // Validar que exista una caja chica abierta
    const cajaChicaAbierta = localStorage.getItem('cajaChicaAbierta');
    if (!cajaChicaAbierta) {
      Swal.fire({
        icon: 'error',
        title: 'Caja Chica Requerida',
        text: 'Debe crear primero la caja chica de este día para empezar con una nueva venta',
        confirmButtonText: 'Ir a Caja Chica',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/caja-chica']);
        }
      });
      return;
    }

    this.router.navigate(['/ventas/crear'], {
      queryParams: { clienteId }
    });
  }

  // ✅ NUEVO: Cobrar deuda (solo navega)
  cobrarDeuda(clienteId: string): void {
    this.router.navigate(['/ventas/deuda'], {
      queryParams: { clienteId }
    });
  }

  // ✅ Eliminar Cliente
  async eliminarCliente(clienteId: string): Promise<void> {
    // Validar si el cliente tiene deuda
    const deuda = this.deudas[clienteId];
    if (deuda && deuda.deudaTotal > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No se puede desactivar',
        text: 'Este cliente tiene deuda pendiente. Cancele la deuda antes de desactivar.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Confirmación con Swal
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
      // Recargar clientes
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

  trackByClienteId(index: number, item: ClienteUI) {
    return item.id;
  }
}
