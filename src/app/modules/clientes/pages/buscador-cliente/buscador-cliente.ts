/**
 * Componente de búsqueda de cliente para Historial Clínico.
 *
 * Este componente sirve como punto de entrada al módulo de Historial Clínico,
 * requiriendo que el usuario primero seleccione un cliente antes de acceder
 * a la información clínica y financiera.
 *
 * Funcionalidades:
 * - Búsqueda de clientes por nombre, cédula o teléfono
 * - Búsqueda en tiempo real (sin necesidad de botón)
 * - Selección de cliente para ver su ficha completa
 * - Creación rápida de nuevo cliente
 *
 * Beneficios:
 * - No carga todos los clientes automáticamente
 * - Mejor rendimiento (carga bajo demanda)
 * - Enfoque clínico (no administrativo)
 */

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { ClientesService } from '../../../../core/services/clientes';
import { Cliente } from '../../../../core/models/cliente.model';

@Component({
  imports: [FormsModule],
  standalone: true,
  selector: 'app-buscador-cliente',
  templateUrl: './buscador-cliente.html',
  styleUrl: './buscador-cliente.css'
})
export class BuscadorClienteComponent implements OnInit {

  terminoBusqueda = '';
  clientes: Cliente[] = [];
  clientesFiltrados: Cliente[] = [];
  mostrarResultados = false;
  cargando = false;

  // Límite de resultados mostrados
  readonly MAX_RESULTADOS = 10;

  constructor(
    private readonly router: Router,
    private readonly clientesSrv: ClientesService
  ) {}

  async ngOnInit(): Promise<void> {
    // No cargamos clientes automáticamente - solo al buscar
  }

  /**
   * Realiza la búsqueda de clientes basada en el término ingresado.
   * Se activa automáticamente al escribir en el campo de búsqueda.
   */
  async buscarClientes(): Promise<void> {
    const termino = this.terminoBusqueda.trim().toLowerCase();
    
    // Si no hay término, limpiar resultados
    if (!termino) {
      this.clientesFiltrados = [];
      this.mostrarResultados = false;
      return;
    }

    // Si el término es muy corto, no buscar aún
    if (termino.length < 2) {
      return;
    }

    this.cargando = true;
    this.mostrarResultados = true;

    try {
      // Cargar clientes si no están en memoria
      if (this.clientes.length === 0) {
        const data = await firstValueFrom(this.clientesSrv.getClientes());
        this.clientes = data as Cliente[];
      }

      // Filtrar clientes
      this.clientesFiltrados = this.clientes
        .filter(c => {
          const nombreCompleto = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.toLowerCase();
          const cedula = (c.cedula ?? '').toLowerCase();
          const telefono = (c.telefono ?? '').toLowerCase();
          
          return nombreCompleto.includes(termino) || 
                 cedula.includes(termino) || 
                 telefono.includes(termino);
        })
        .slice(0, this.MAX_RESULTADOS); // Limitar resultados

    } catch (error) {
      console.error('Error al buscar clientes:', error);
      this.clientesFiltrados = [];
    } finally {
      this.cargando = false;
    }
  }

  /**
   * Selecciona un cliente y navega a su ficha completa.
   */
  seleccionarCliente(cliente: Cliente): void {
    if (!cliente.id) return;
    
    // Navegar a la ficha del cliente
    this.router.navigate(['/clientes/ficha', cliente.id], {
      queryParams: { returnTo: this.router.url }
    });
  }

  /**
   * Limpia la búsqueda y resultados.
   */
  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.clientesFiltrados = [];
    this.mostrarResultados = false;
  }

  /**
   * Navega al formulario de creación de nuevo cliente.
   */
  crearCliente(): void {
    this.router.navigate(['/clientes/crear'], {
      queryParams: { returnTo: '/clientes/historial-clinico' }
    });
  }

  /**
   * Cierra la lista de resultados.
   */
  cerrarResultados(): void {
    this.mostrarResultados = false;
  }

  /**
   * Función de trackeo para optimizar el renderizado.
   */
  trackByClienteId(index: number, item: Cliente): string {
    return item.id || `index-${index}`;
  }
}
