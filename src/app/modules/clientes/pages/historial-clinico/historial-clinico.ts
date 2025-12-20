import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { Cliente } from '../../../../core/models/cliente.model';

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

  cargando = true;

  constructor(
    private router: Router,
    private clientesSrv: ClientesService,
    private historialSrv: HistorialClinicoService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarClientes();
    this.cargando = false;
  }

  private async cargarClientes(): Promise<void> {
    const data = await firstValueFrom(this.clientesSrv.getClientes());

    // ✅ convertir a ClienteUI (agregamos tieneHistorial)
    const clientesBase: ClienteUI[] = (data as any[]).map(c => ({
      ...(c as Cliente),
      id: (c as any).id,
      tieneHistorial: false
    }));

    // ✅ revisar si existe historial por cada cliente
    const withHistorial = await Promise.all(
      clientesBase.map(async (c) => {
        const snap = await this.historialSrv.obtenerHistorial(c.id);
        return { ...c, tieneHistorial: snap.exists() };
      })
    );

    this.clientes = withHistorial;
    this.aplicarFiltro();
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
  }

  // ✅ Acciones
  crearCliente(): void {
    this.router.navigate(['/clientes/crear'], {
      queryParams: { returnTo: '/clientes/historial-clinico' }
    });
  }

  // Si tiene historial => ver/abrir (o si tu ruta actual es el mismo form, igual sirve)
 abrirHistorial(clienteId: string): void {
  this.router.navigate(['/clientes/historial-clinico/ver', clienteId]);
}


  // Si NO tiene historial => crear
  crearHistorial(clienteId: string): void {
    this.router.navigate([`/clientes/${clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'create' } // opcional
    });
  }

  // Editar (solo cuando existe historial)
  editarHistorial(clienteId: string): void {
    this.router.navigate([`/clientes/${clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'edit' } // opcional
    });
  }

  trackByClienteId(index: number, item: ClienteUI) {
    return item.id;
  }
}
