import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

    this.clientes = withHistorial;
    this.aplicarFiltro();

    // ✅ NUEVO: cargar deuda por cliente (después de tener clientes listos)
    await this.cargarDeudasClientes(this.clientes);
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

  private aplicarFiltro(): void {
    const t = (this.terminoBusqueda || '').trim().toLowerCase();

    if (!t) {
      this.clientesFiltrados = [...this.clientes];
    } else {
      this.clientesFiltrados = this.clientes.filter(c => {
        const nombre = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.toLowerCase();
        const cedula = (c.cedula ?? '').toLowerCase();
        const telefono = (c.telefono ?? '').toLowerCase();
        return nombre.includes(t) || cedula.includes(t) || telefono.includes(t);
      });
    }

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

  trackByClienteId(index: number, item: ClienteUI) {
    return item.id;
  }
}
