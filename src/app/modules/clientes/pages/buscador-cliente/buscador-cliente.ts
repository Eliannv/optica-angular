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
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ClientesService } from '../../../../core/services/clientes';
import { Cliente } from '../../../../core/models/cliente.model';

@Component({
  imports: [CommonModule, FormsModule],
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

  // ✅ Promesa compartida para evitar múltiples cargas simultáneas
  private cargaClientesPromise: Promise<Cliente[]> | null = null;

  constructor(
    private readonly router: Router,
    private readonly clientesSrv: ClientesService
  ) {}

  async ngOnInit(): Promise<void> {
    // 🚀 Pre-cargar clientes para que estén listos cuando el usuario busque
    await this.cargarClientesSiEsNecesario();
  }

  /**
   * Carga clientes desde Firestore solo si no están ya cargados.
   * Usa una promesa compartida para evitar múltiples cargas simultáneas.
   * ✅ ACTUALIZADO: Usa query directa para garantizar datos frescos.
   */
  private async cargarClientesSiEsNecesario(): Promise<Cliente[]> {
    // Si ya tenemos clientes cargados, retornarlos
    if (this.clientes.length > 0) {
      return this.clientes;
    }

    // Si ya hay una carga en proceso, esperar a que termine
    if (this.cargaClientesPromise) {
      return this.cargaClientesPromise;
    }

    // Iniciar nueva carga
    this.cargando = true;
    
    // ✅ Usar query directa en lugar de Observable para garantizar datos frescos
    this.cargaClientesPromise = this.clientesSrv.getAllClientesDirect()
      .then(data => {
        this.clientes = data;
        this.cargaClientesPromise = null; // Limpiar la promesa
        return this.clientes;
      })
      .catch(error => {
        console.error('❌ Error al cargar clientes:', error);
        this.clientes = [];
        this.cargaClientesPromise = null; // Limpiar la promesa
        return [];
      })
      .finally(() => {
        this.cargando = false;
      });

    return this.cargaClientesPromise;
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
      this.mostrarResultados = false;
      return;
    }

    this.mostrarResultados = true;

    try {
      // ✅ Asegurar que los clientes estén cargados (usa promesa compartida)
      await this.cargarClientesSiEsNecesario();

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

      console.log('✅ Resultados encontrados:', this.clientesFiltrados.length);

    } catch (error) {
      console.error('❌ Error al filtrar clientes:', error);
      this.clientesFiltrados = [];
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
