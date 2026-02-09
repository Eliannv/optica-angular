/**
 * Componente para seleccionar o crear historiales clínicos de un cliente.
 *
 * Este componente actúa como vista intermedia entre la lista de clientes y la creación de ventas.
 * Permite al usuario:
 * - Ver todos los historiales clínicos del cliente paginados
 * - Crear un nuevo historial clínico
 * - Seleccionar un historial existente para crear una venta
 * - Editar un historial existente
 * - Ver detalles de un historial en modal
 *
 * Optimizaciones:
 * - Carga paginada de historiales (evita lecturas innecesarias)
 * - Ordenamiento por fecha descendente (más recientes primero)
 * - Lazy loading: solo carga historiales cuando se accede a este componente
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { HistoriaClinica } from '../../../../core/models/historia-clinica.model';
import { Cliente } from '../../../../core/models/cliente.model';

@Component({
  selector: 'app-seleccionar-historial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seleccionar-historial.html',
  styleUrl: './seleccionar-historial.css'
})
export class SeleccionarHistorialComponent implements OnInit, OnDestroy {
  
  clienteId = '';
  cliente: Cliente | null = null;
  
  historiales: HistoriaClinica[] = [];
  cargando = true;
  cargandoMas = false;
  
  // Paginación
  limitePorPagina = 10;
  ultimoDocumento: any = null;
  hayMasHistoriales = true;
  totalHistoriales = 0;
  
  // Modal de detalles
  mostrarModal = false;
  historialSeleccionado: HistoriaClinica | null = null;
  
  private subscription: Subscription | null = null;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly clientesSrv: ClientesService,
    private readonly historialSrv: HistorialClinicoService
  ) {}

  async ngOnInit(): Promise<void> {
    // Obtener clienteId de query params
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';
    
    if (!this.clienteId) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se especificó un cliente',
        confirmButtonText: 'Volver'
      });
      this.router.navigate(['/clientes/historial']);
      return;
    }

    await this.cargarCliente();
    await this.cargarHistoriales();
    this.cargando = false;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Carga los datos del cliente desde Firestore.
   */
  private async cargarCliente(): Promise<void> {
    try {
      this.cliente = await firstValueFrom(
        this.clientesSrv.getClienteById(this.clienteId)
      );
      
      if (!this.cliente) {
        throw new Error('Cliente no encontrado');
      }
    } catch (error) {
      console.error('Error cargando cliente:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la información del cliente',
        confirmButtonText: 'Volver'
      });
      this.router.navigate(['/clientes/historial']);
    }
  }

  /**
   * Carga la primera página de historiales clínicos del cliente.
   */
  private async cargarHistoriales(): Promise<void> {
    try {
      // Obtener total de historiales
      this.totalHistoriales = await this.historialSrv.contarHistoriales(this.clienteId);
      
      // Cargar primera página
      this.subscription = this.historialSrv
        .getHistorialesPaginados(this.clienteId, this.limitePorPagina)
        .subscribe({
          next: (historiales) => {
            this.historiales = historiales;
            this.hayMasHistoriales = historiales.length >= this.limitePorPagina;
            
            if (historiales.length > 0) {
              this.ultimoDocumento = historiales[historiales.length - 1];
            }
          },
          error: (error) => {
            console.error('Error cargando historiales:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudieron cargar los historiales clínicos',
              confirmButtonText: 'Entendido'
            });
          }
        });
    } catch (error) {
      console.error('Error al contar historiales:', error);
    }
  }

  /**
   * Carga la siguiente página de historiales (paginación).
   */
  async cargarMasHistoriales(): Promise<void> {
    if (!this.hayMasHistoriales || this.cargandoMas) return;
    
    this.cargandoMas = true;
    
    try {
      this.historialSrv
        .getHistorialesPaginados(this.clienteId, this.limitePorPagina, this.ultimoDocumento)
        .subscribe({
          next: (nuevosHistoriales) => {
            if (nuevosHistoriales.length > 0) {
              this.historiales = [...this.historiales, ...nuevosHistoriales];
              this.ultimoDocumento = nuevosHistoriales[nuevosHistoriales.length - 1];
              this.hayMasHistoriales = nuevosHistoriales.length >= this.limitePorPagina;
            } else {
              this.hayMasHistoriales = false;
            }
            this.cargandoMas = false;
          },
          error: (error) => {
            console.error('Error cargando más historiales:', error);
            this.cargandoMas = false;
          }
        });
    } catch (error) {
      console.error('Error en paginación:', error);
      this.cargandoMas = false;
    }
  }

  /**
   * Navega al formulario para crear un nuevo historial clínico.
   */
  nuevoHistorial(): void {
    this.router.navigate(['/clientes/crear-historial'], {
      queryParams: { clienteId: this.clienteId }
    });
  }

  /**
   * Usa un historial existente para crear una venta.
   * Navega a crear-venta con clienteId e historialId.
   */
  usarParaVenta(historial: HistoriaClinica): void {
    if (!historial.id) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El historial no tiene un ID válido',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    this.router.navigate(['/ventas/crear'], {
      queryParams: {
        clienteId: this.clienteId,
        historialId: historial.id
      }
    });
  }

  /**
   * Navega al formulario de edición de un historial existente.
   */
  editarHistorial(historial: HistoriaClinica): void {
    if (!historial.id) return;
    
    this.router.navigate(['/clientes/crear-historial'], {
      queryParams: { 
        clienteId: this.clienteId,
        historialId: historial.id 
      }
    });
  }

  /**
   * Muestra los detalles de un historial en un modal.
   */
  verDetalles(historial: HistoriaClinica): void {
    this.historialSeleccionado = historial;
    this.mostrarModal = true;
  }

  /**
   * Cierra el modal de detalles.
   */
  cerrarModal(): void {
    this.mostrarModal = false;
    this.historialSeleccionado = null;
  }

  /**
   * Formatea la fecha de creación para visualización.
   */
  formatearFecha(fecha: any): string {
    if (!fecha) return 'Sin fecha';
    
    try {
      // Manejar Firestore Timestamp
      if (typeof fecha.toDate === 'function') {
        return fecha.toDate().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Manejar Date
      if (fecha instanceof Date) {
        return fecha.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      return 'Fecha inválida';
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'Error en fecha';
    }
  }

  /**
   * Vuelve a la lista de clientes.
   */
  volver(): void {
    this.router.navigate(['/clientes/historial']);
  }

  /**
   * Función de trackeo para optimizar el renderizado de la lista.
   */
  trackByHistorialId(index: number, item: HistoriaClinica): string {
    return item.id || index.toString();
  }
}
