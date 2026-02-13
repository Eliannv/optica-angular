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

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { DocumentSnapshot } from '@angular/fire/firestore';

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
export class ListaClientesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  terminoBusqueda = '';
  totalClientes = 0;

  // 🚀 PAGINACIÓN REAL DESDE FIRESTORE
  clientesPaginados: Cliente[] = [];
  paginaActual: number = 1;
  clientesPorPagina: number = 10;
  Math = Math;
  
  // 🎯 Snapshots para navegación Firestore
  lastVisible: DocumentSnapshot | null = null;
  firstVisible: DocumentSnapshot | null = null;
  hasMore: boolean = false;
  isLoading: boolean = false;
  
  // 🔍 Historial de páginas para navegación hacia atrás
  paginasHistorial: Array<{
    firstDoc: DocumentSnapshot | null;
    lastDoc: DocumentSnapshot | null;
    pageNumber: number;
  }> = [];

  // ⚠️ Mantenemos clientes solo para exportación (carga lazy)
  clientes: Cliente[] = [];
  clientesFiltrados: Cliente[] = [];

  cargando = true;
  filtroEstado: 'todos' | 'conHistorial' | 'sinHistorial' = 'todos';
  filtroCredito: 'todos' | 'conCredito' | 'sinCredito' = 'todos';
  filtroDeuda: 'todos' | 'conDeuda' | 'sinDeuda' = 'todos';
  ordenamiento: 'reciente' | 'nombre' = 'reciente';

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
   * Inicializa el componente cargando la lista de clientes con paginación real.
   */
  async ngOnInit(): Promise<void> {
    this.cargando = true;
    await this.validarCajaChica();
    // 🚀 PAGINACIÓN REAL: Cargar solo primera página
    await this.cargarPrimeraPage();
    this.cargando = false;
  }

  /**
   * Limpia suscripciones al destruir el componente
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // 🗑️ Liberar memoria
    this.clientes = [];
    this.clientesFiltrados = [];
    this.clientesPaginados = [];
    this.deudas = {};
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
   * 🚀 Carga la primera página de clientes con paginación real
   */
  private async cargarPrimeraPage(): Promise<void> {
    this.isLoading = true;
    this.paginaActual = 1;
    this.paginasHistorial = [];
    this.deudas = {}; // 🗑️ Limpiar deudas de página anterior
    
    try {
      const resultado = await this.clientesSrv.getClientesPaginadosReal({
        pageSize: this.clientesPorPagina,
        ordenamiento: this.ordenamiento,
        terminoBusqueda: this.terminoBusqueda,
        filtroEstado: this.filtroEstado, // 🎯 Pasar filtro de historial a Firestore
        filtroCredito: this.filtroCredito,
        filtroDeuda: this.filtroDeuda
      });
      
      this.clientesPaginados = resultado.clientes;
      this.lastVisible = resultado.lastDoc;
      this.firstVisible = resultado.firstDoc;
      this.hasMore = resultado.hasMore;
      
      // Guardar en historial
      if (resultado.firstDoc) {
        this.paginasHistorial.push({
          firstDoc: resultado.firstDoc,
          lastDoc: resultado.lastDoc,
          pageNumber: 1
        });
      }
      
      // Actualizar total estimado (solo para UI)
      this.totalClientes = resultado.clientes.length;
      
      // 🚀 Cargar deudas SOLO de la página actual
      await this.cargarDeudasPaginaActual();
      
      // ⚠️ NO aplicar filtros locales - mantener los 10 clientes cargados
      // Los filtros de crédito/deuda son solo informativos (badges visuales)
      
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🗑️ DEPRECATED: Método legacy mantenido por compatibilidad
   * Ahora se usa cargarPrimeraPage() con paginación real
   */
  private async cargarClientes(): Promise<void> {
    console.warn('cargarClientes() está deprecated - usando paginación real');
    await this.cargarPrimeraPage();
  }

  /**
   * 🚀 Carga deudas SOLO de los clientes de la página actual
   * NO carga deudas de todos los clientes (optimización crítica)
   */
  private async cargarDeudasPaginaActual(): Promise<void> {
    const tasks = this.clientesPaginados.map(async c => {
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
  }

  /**
   * 🗑️ DEPRECATED: Método legacy
   * Ahora se usa cargarDeudasPaginaActual() para evitar sobrecarga
   */
  private async cargarDeudasClientes(lista: Cliente[]): Promise<void> {
    console.warn('cargarDeudasClientes() está deprecated - usando cargarDeudasPaginaActual()');
    await this.cargarDeudasPaginaActual();
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
    // 🚀 Recargar desde primera página con el nuevo término
    this.cargarPrimeraPage();
  }

  /**
   * Limpia el término de búsqueda y muestra todos los clientes.
   */
  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.cargarPrimeraPage();
  }

  /**
   * ⚠️ ACTUALIZADO: Ahora recarga desde primera página con los filtros
   * - filtroEstado (con/sin historial) → Se aplica en Firestore ✅
   * - filtroCredito y filtroDeuda → Se aplican en Firestore ✅
   */
  aplicarFiltro(): void {
    this.cargarPrimeraPage();
  }

  /**
   * 🗑️ DEPRECATED: Ya no se usan filtros locales que oculten clientes
   * Los filtros de crédito/deuda son solo badges informativos
   */
  private aplicarFiltrosLocales(): void {
    // Método deprecated - los filtros ya no ocultan clientes
    // Solo el filtro de historial se aplica en Firestore
    console.warn('aplicarFiltrosLocales() está deprecated - filtros son solo visuales');
  }

  /**
   * ⚠️ DEPRECATED: Ya no se usa paginación en memoria
   * Ahora la paginación es real desde Firestore
   */
  actualizarPaginacion(): void {
    console.warn('actualizarPaginacion() está deprecated - usando paginación real de Firestore');
  }

  /**
   * 🚀 Navega a la página siguiente (PAGINACIÓN REAL)
   */
  async paginaSiguiente(): Promise<void> {
    if (!this.hasMore || this.isLoading) {
      return;
    }
    
    this.isLoading = true;
    this.deudas = {}; // 🗑️ Limpiar deudas de página anterior
    
    try {
      const resultado = await this.clientesSrv.getClientesPaginadosReal({
        pageSize: this.clientesPorPagina,
        lastVisible: this.lastVisible,
        direction: 'next',
        ordenamiento: this.ordenamiento,
        terminoBusqueda: this.terminoBusqueda,
        filtroEstado: this.filtroEstado, // 🎯 Pasar filtro de historial
        filtroCredito: this.filtroCredito,
        filtroDeuda: this.filtroDeuda
      });
      
      this.clientesPaginados = resultado.clientes;
      this.lastVisible = resultado.lastDoc;
      this.firstVisible = resultado.firstDoc;
      this.hasMore = resultado.hasMore;
      this.paginaActual++;
      
      // Guardar en historial
      if (resultado.firstDoc) {
        this.paginasHistorial.push({
          firstDoc: resultado.firstDoc,
          lastDoc: resultado.lastDoc,
          pageNumber: this.paginaActual
        });
      }
      
      // 🚀 Cargar deudas SOLO de la nueva página
      await this.cargarDeudasPaginaActual();
      
    } catch (error) {
      console.error('Error al cargar página siguiente:', error);
      Swal.fire('Error', 'No se pudo cargar la siguiente página', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🚀 Navega a la página anterior (PAGINACIÓN REAL)
   */
  async paginaAnterior(): Promise<void> {
    if (this.paginaActual <= 1 || this.isLoading) {
      return;
    }
    
    this.isLoading = true;
    this.deudas = {}; // 🗑️ Limpiar deudas de página anterior
    
    try {
      // Eliminar la página actual del historial
      this.paginasHistorial.pop();
      this.paginaActual--;
      
      // Obtener la página anterior (ahora la última en el historial)
      const paginaAnterior = this.paginasHistorial[this.paginasHistorial.length - 1];
      
      if (!paginaAnterior) {
        // Si no hay historial, recargar primera página
        await this.cargarPrimeraPage();
        return;
      }
      
      // Si es la primera página, recargarla directamente
      if (paginaAnterior.pageNumber === 1) {
        await this.cargarPrimeraPage();
        return;
      }
      
      // Cargar desde el snapshot del historial usando el lastDoc de la página anterior
      const resultado = await this.clientesSrv.getClientesPaginadosReal({
        pageSize: this.clientesPorPagina,
        lastVisible: this.paginasHistorial[this.paginasHistorial.length - 2]?.lastDoc || null,
        direction: 'next',
        ordenamiento: this.ordenamiento,
        terminoBusqueda: this.terminoBusqueda,
        filtroEstado: this.filtroEstado, // 🎯 Pasar filtro de historial
        filtroCredito: this.filtroCredito,
        filtroDeuda: this.filtroDeuda
      });
      
      this.clientesPaginados = resultado.clientes;
      this.lastVisible = paginaAnterior.lastDoc;
      this.firstVisible = paginaAnterior.firstDoc;
      this.hasMore = true; // Sabemos que hay más porque veníamos de una página posterior
      
      // 🚀 Cargar deudas SOLO de la nueva página
      await this.cargarDeudasPaginaActual();
      
    } catch (error) {
      console.error('Error al cargar página anterior:', error);
      Swal.fire('Error', 'No se pudo cargar la página anterior', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🚀 Navega a la primera página (PAGINACIÓN REAL)
   */
  async irPrimeraPagina(): Promise<void> {
    if (this.paginaActual === 1 || this.isLoading) {
      return;
    }
    
    await this.cargarPrimeraPage();
  }

  /**
   * ⚠️ Navegar a última página no es eficiente con paginación cursor
   * Se deshabilita esta funcionalidad
   */
  irUltimaPagina(): void {
    Swal.fire({
      icon: 'info',
      title: 'Navegación optimizada',
      text: 'Para mejor rendimiento, usa los botones Siguiente/Anterior para navegar por las páginas.',
      confirmButtonText: 'Entendido'
    });
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
   * 🚀 Abre la ventana con historiales del cliente por periodo de caja banco.
   * LAZY LOAD: Solo carga cuando el usuario hace click
   */
  async abrirHistorialesPeriodo(cliente: Cliente): Promise<void> {
    if (!cliente?.id) return;
    this.clienteHistorialSeleccionado = cliente;
    this.mostrarHistorialesModal = true;
    // 🚀 Cargar SOLO cuando se abre el modal
    await this.cargarHistorialesPeriodo(cliente.id);
  }

  /**
   * Navega a la ficha clinica del cliente.
   */
  irFichaClinica(clienteId: string): void {
    this.router.navigate(['/clientes/ficha', clienteId], {
      queryParams: { returnTo: this.router.url }
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
   * Cierra el modal de historiales por periodo.
   * 🗑️ Libera memoria limpiando los historiales cargados
   */
  cerrarHistorialesModal(): void {
    this.mostrarHistorialesModal = false;
    this.clienteHistorialSeleccionado = null;
    // 🗑️ Liberar memoria de historiales
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
   * 🚀 Carga los 3 historiales más recientes del cliente.
   * LAZY LOAD: Solo se ejecuta cuando se abre el modal
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
          queryParams: { 
            clienteId,
            returnTo: this.router.url
          }
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
   * 🚀 Recarga la página actual en lugar de todos los clientes
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
      // 🚀 Recargar solo la página actual
      await this.cargarPrimeraPage();
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
