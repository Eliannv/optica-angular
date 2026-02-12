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
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { ExcelService } from '../../../../core/services/excel.service';
import { PrintService } from '../../../../core/services/print.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Cliente } from '../../../../core/models/cliente.model';
import { HistoriaClinica } from '../../../../core/models/historia-clinica.model';

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
  filtroDeuda: 'todos' | 'conDeuda' | 'sinDeuda' = 'todos';

  deudas: Record<string, { deudaTotal: number; pendientes: number; creditosActivos: number; creditoPersonalActivo: boolean }> = {};
  cajaChicaAbierta = false;
  
  // Modal de información
  clienteSeleccionado: Cliente | null = null;
  mostrarModal = false;

  // Modal de historiales por periodo
  mostrarHistorialesModal = false;
  clienteHistorialSeleccionado: Cliente | null = null;
  historialesPeriodo: HistoriaClinica[] = [];
  historialesPeriodoCargando = false;

  /**
   * Verifica si el usuario actual es administrador.
   * Solo administradores pueden eliminar clientes.
   */
  get esAdmin(): boolean {
    return this.authService.isAdmin();
  }

  /**
   * Obtiene el resumen de deuda de un cliente si existe.
   */
  getDeuda(cliente: Cliente | null | undefined): { deudaTotal: number; pendientes: number; creditosActivos: number; creditoPersonalActivo: boolean } | undefined {
    const id = cliente?.id;
    return id ? this.deudas[id] : undefined;
  }

  constructor(
    private readonly router: Router,
    private readonly clientesSrv: ClientesService,
    private readonly facturasSrv: FacturasService,
    private readonly historialSrv: HistorialClinicoService,
    private readonly excelService: ExcelService,
    private readonly printSrv: PrintService,
    private readonly cajaChicaService: CajaChicaService,
    private readonly authService: AuthService
  ) {}

  /**
   * Inicializa el componente cargando la lista de clientes.
   */
  async ngOnInit(): Promise<void> {
    await this.cargarClientes();
    await this.validarCajaChica();
    this.cargando = false;
  }

  /**
   * Valida si existe alguna caja chica abierta.
   */
  private async validarCajaChica(): Promise<void> {
    try {
      const validacion = await this.cajaChicaService.validarCajaAbierta();
      this.cajaChicaAbierta = validacion.valida;
    } catch (error) {
      console.error('Error verificando caja chica:', error);
      this.cajaChicaAbierta = false;
    }
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

    if (this.filtroDeuda === 'conDeuda') {
      base = base.filter(c => c.id && (this.deudas[c.id]?.deudaTotal ?? 0) > 0);
    } else if (this.filtroDeuda === 'sinDeuda') {
      base = base.filter(c => c.id && (this.deudas[c.id]?.deudaTotal ?? 0) === 0);
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
     * Inicia una venta directa sin historial clínico para el cliente
     */
    ventaSinHistorial(clienteId: string) {
      if (!clienteId) return;
      this.router.navigate(['/ventas/crear'], { queryParams: { clienteId, sinHistorial: true } });
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
   * Abre la ventana con historiales del cliente por periodo de caja banco.
   */
  async abrirHistorialesPeriodo(cliente: Cliente): Promise<void> {
    if (!cliente?.id) return;
    this.clienteHistorialSeleccionado = cliente;
    this.mostrarHistorialesModal = true;
    await this.cargarHistorialesPeriodo(cliente.id);
  }

  /**
   * Navega a la ficha clinica del cliente.
   */
  irFichaClinica(clienteId: string): void {
    this.router.navigate(['/clientes/ficha', clienteId]);
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
   * Cierra el modal de historiales por periodo.
   */
  cerrarHistorialesModal(): void {
    this.mostrarHistorialesModal = false;
    this.clienteHistorialSeleccionado = null;
    this.historialesPeriodo = [];
  }

  /**
   * Navega al formulario para crear un nuevo historial clinico del cliente.
   */
  crearHistorialClinicoDesdeModal(): void {
    if (!this.clienteHistorialSeleccionado?.id) return;
    this.router.navigate(['/clientes/crear-historial'], {
      queryParams: {
        clienteId: this.clienteHistorialSeleccionado.id,
        returnTo: '/clientes/lista'
      }
    });
    this.cerrarHistorialesModal();
  }

  /**
   * Carga los 3 historiales mas recientes del cliente.
   */
  private async cargarHistorialesPeriodo(clienteId: string): Promise<void> {
    this.historialesPeriodo = [];
    this.historialesPeriodoCargando = true;

    try {
      const paginaResult = await this.historialSrv.getHistorialesPaginadosOnce(
        clienteId,
        3
      );
      this.historialesPeriodo = paginaResult.items;
    } catch (error) {
      console.error('Error cargando historiales recientes:', error);
    } finally {
      this.historialesPeriodoCargando = false;
    }
  }

  /**
   * Convierte una fecha a Date manejando Timestamp de Firestore.
   */
  private convertirFecha(fecha: any): Date | null {
    if (!fecha) return null;
    if (typeof fecha?.toDate === 'function') return fecha.toDate();
    if (fecha instanceof Date) return fecha;
    const f = new Date(fecha);
    return isNaN(f.getTime()) ? null : f;
  }

  /**
   * Formatea la fecha de creación para visualización.
   */
  formatearFechaHistorial(fechaHoraChequeo: any, updatedAt?: any, createdAt?: any): string {
    const f = this.obtenerFechaHistorial(fechaHoraChequeo, updatedAt, createdAt);
    if (!f) return 'Fecha invalida';
    return f.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Prioriza fechaHoraChequeo, luego updatedAt y finalmente createdAt.
   */
  private obtenerFechaHistorial(fechaHoraChequeo: any, updatedAt?: any, createdAt?: any): Date | null {
    return (
      this.convertirFecha(fechaHoraChequeo) ||
      this.convertirFecha(updatedAt) ||
      this.convertirFecha(createdAt)
    );
  }

  /**
   * Exporta un historial clinico a Excel.
   */
  async exportarExcel(historial: HistoriaClinica): Promise<void> {
    if (!historial.id || !this.clienteHistorialSeleccionado?.id) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede exportar: datos incompletos'
      });
      return;
    }

    try {
      const snap = await this.historialSrv.obtenerHistorialPorId(
        this.clienteHistorialSeleccionado.id,
        historial.id
      );

      if (!snap.exists()) {
        await Swal.fire({
          icon: 'warning',
          title: 'Sin historial',
          text: 'Este historial clinico no existe'
        });
        return;
      }

      const historialCompleto = snap.data() as HistoriaClinica;
      await this.excelService.exportarHistorialClinicoPedido(
        this.clienteHistorialSeleccionado,
        historialCompleto
      );

      await Swal.fire({
        icon: 'success',
        title: 'Exportado',
        text: 'El pedido fue exportado a Excel',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al generar el archivo Excel'
      });
    }
  }

  /**
   * Imprime un historial clinico.
   */
  async imprimirHistorial(historial: HistoriaClinica): Promise<void> {
    if (!historial.id || !this.clienteHistorialSeleccionado?.id) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El historial no tiene un ID valido',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    try {
      const facturas = await firstValueFrom(
        this.facturasSrv.getPendientesPorCliente(this.clienteHistorialSeleccionado.id)
      );
      this.printSrv.imprimirHistorialClinico(this.clienteHistorialSeleccionado, historial, facturas);
    } catch (error) {
      console.error('Error al imprimir historial:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la informacion para imprimir',
        confirmButtonText: 'Entendido'
      });
    }
  }

  /**
   * Navega al formulario de edicion del historial.
   */
  editarHistorial(historial: HistoriaClinica): void {
    if (!historial.id || !this.clienteHistorialSeleccionado?.id) return;
    this.router.navigate(['/clientes/crear-historial'], {
      queryParams: {
        clienteId: this.clienteHistorialSeleccionado.id,
        historialId: historial.id,
        returnTo: '/clientes/lista'
      }
    });
    this.cerrarHistorialesModal();
  }

  /**
   * Usa un historial para crear una venta.
   */
  usarParaVenta(historial: HistoriaClinica): void {
    if (!historial.id || !this.clienteHistorialSeleccionado?.id) return;
    this.router.navigate(['/ventas/crear'], {
      queryParams: {
        clienteId: this.clienteHistorialSeleccionado.id,
        historialId: historial.id
      }
    });
    this.cerrarHistorialesModal();
  }

  /**
   * Inicia el proceso de cobro de deuda para un cliente.
   */
  async cobrarDeuda(clienteId: string): Promise<void> {
    try {
      const validacion = await this.cajaChicaService.validarCajaAbierta();
      if (validacion.valida) {
        this.router.navigate(['/ventas/deuda'], {
          queryParams: { clienteId }
        });
        return;
      }

      await Swal.fire({
        icon: 'error',
        title: 'Caja Chica Requerida',
        text: 'Debe tener al menos una caja chica ABIERTA para cobrar deudas (puede ser de cualquier fecha).',
        confirmButtonText: 'Ir a Caja Chica',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        this.router.navigate(['/caja-chica']);
      });
    } catch (error) {
      console.error('Error verificando caja chica:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al verificar la caja chica. Intente nuevamente.',
        confirmButtonText: 'Volver'
      });
    }
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
