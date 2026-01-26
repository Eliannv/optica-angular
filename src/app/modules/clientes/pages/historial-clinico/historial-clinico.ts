/**
 * Componente principal para la gestión de historiales clínicos de clientes.
 *
 * Este componente proporciona una vista completa de todos los clientes con funcionalidades de:
 * - Búsqueda y filtrado avanzado (por nombre, cédula, teléfono, estado)
 * - Paginación de resultados
 * - Visualización de deudas pendientes por cliente
 * - Modal para ver detalles del historial clínico
 * - Acciones CRUD sobre clientes e historiales
 * - Validación de caja chica antes de crear ventas o cobrar deudas
 *
 * Integra múltiples servicios (clientes, historial, facturas, caja chica) para
 * proporcionar una experiencia cohesiva en la gestión de clientes.
 */

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { FacturasService } from '../../../../core/services/facturas';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { AuthService } from '../../../../core/services/auth.service';

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
  paginaActual = 1;
  clientesPorPagina = 10;
  Math = Math;

  cargando = true;
  deudas: Record<string, { deudaTotal: number; pendientes: number; creditosActivos: number; creditoPersonalActivo: boolean }> = {};
  filtroEstado: 'todos' | 'deudores' | 'conHistorial' | 'sinHistorial' = 'todos';
  filtroCredito: 'todos' | 'conCredito' | 'sinCredito' = 'todos';
  ordenarPor: 'fecha' | 'credito' = 'fecha';
  cajaChicaAbierta = false;

  clienteSeleccionado: ClienteUI | null = null;
  historialClinico: HistoriaClinica | null = null;
  mostrarModal = false;
  cargandoHistorial = false;

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
    private readonly historialSrv: HistorialClinicoService,
    private readonly facturasSrv: FacturasService,
    private readonly cajasChicaService: CajaChicaService,
    private readonly authService: AuthService
  ) {}

  /**
   * Inicializa el componente cargando clientes y validando estado de caja chica.
   *
   * Realiza una carga inicial de todos los clientes activos, verifica si tienen
   * historial clínico, y valida si existe una caja chica abierta para habilitar
   * operaciones de venta y cobro.
   */
  async ngOnInit(): Promise<void> {
    await this.cargarClientes();
    // ✅ NUEVO: validar caja chica abierta
    const validacion = await this.cajasChicaService.validarCajaChicaHoy();
    this.cajaChicaAbierta = validacion.valida && validacion.tipo === 'ABIERTA';
    this.cargando = false;
  }

  /**
   * Carga todos los clientes activos con su información de historial y deudas.
   *
   * Obtiene la lista de clientes de Firestore, verifica si cada uno tiene historial
   * clínico, ordena por fecha de creación descendente, y carga las deudas pendientes
   * de cada cliente en paralelo.
   */
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

  /**
   * Extrae el timestamp de creación de un cliente en milisegundos.
   *
   * Maneja diferentes formatos de fecha (Firestore Timestamp, Date, number)
   * y los convierte a milisegundos para permitir ordenamiento consistente.
   *
   * @param c Cliente con posible campo createdAt.
   * @returns Timestamp en milisegundos o 0 si no existe.
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
   * Navega a la página de impresión del historial clínico.
   *
   * @param clienteId Identificador del cliente cuyo historial se imprimirá.
   */
  imprimirHistorial(clienteId: string): void {
  this.router.navigate(['/historial-print', clienteId]);
}


  /**
   * Carga en paralelo las deudas pendientes de todos los clientes.
   *
   * Para cada cliente, consulta el servicio de facturas y almacena el resumen
   * de deuda en el diccionario 'deudas'. Maneja errores individuales sin
   * interrumpir el proceso completo.
   *
   * @param lista Arreglo de clientes para los cuales cargar deudas.
   */
  private async cargarDeudasClientes(lista: ClienteUI[]): Promise<void> {
    // carga en paralelo
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
   * Aplica filtros múltiples a la lista de clientes.
   *
   * Combina filtrado por texto (nombre, cédula, teléfono) con filtros de estado
   * (deudores, con historial, sin historial). Los resultados se ordenan por fecha
   * de creación descendente y se reinicia la paginación.
   */
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

    // 3) Filtro crédito personal
    if (this.filtroCredito === 'conCredito') {
      base = base.filter(c => !!this.deudas[c.id]?.creditoPersonalActivo);
    } else if (this.filtroCredito === 'sinCredito') {
      base = base.filter(c => !this.deudas[c.id]?.creditoPersonalActivo);
    }

    // 4) Ordenar (por defecto más reciente; opcional: crédito personal primero)
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
    const sortByFecha = (a: ClienteUI, b: ClienteUI) => getCreatedMs(b) - getCreatedMs(a);
    const sortByCredito = (a: ClienteUI, b: ClienteUI) => {
      const aCredito = this.deudas[a.id]?.creditoPersonalActivo ? 1 : 0;
      const bCredito = this.deudas[b.id]?.creditoPersonalActivo ? 1 : 0;
      if (aCredito !== bCredito) return bCredito - aCredito; // Sí primero
      return sortByFecha(a, b);
    };
    this.clientesFiltrados = base.sort(this.ordenarPor === 'credito' ? sortByCredito : sortByFecha);

    this.totalClientes = this.clientesFiltrados.length;
    this.paginaActual = 1; // Resetear a la primera página al filtrar
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
   *
   * Incluye el parámetro returnTo para volver a esta página después de guardar.
   */
  crearCliente(): void {
    this.router.navigate(['/clientes/crear'], {
      queryParams: { returnTo: '/clientes/historial-clinico' }
    });
  }

  /**
   * Muestra el modal con los detalles del historial clínico de un cliente.
   *
   * Carga asíncronamente el historial clínico del cliente seleccionado desde
   * Firestore y lo muestra en un modal. Maneja estados de carga y errores.
   *
   * @param cliente Cliente cuyos detalles se mostrarán.
   */
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

  /**
   * Cierra el modal y limpia los datos del cliente y historial seleccionados.
   */
  cerrarModal(): void {
    this.mostrarModal = false;
    this.clienteSeleccionado = null;
    this.historialClinico = null;
  }

  /**
   * Navega al formulario de creación de historial clínico.
   *
   * @param clienteId Identificador del cliente para el cual crear el historial.
   */
  crearHistorial(clienteId: string): void {
    this.router.navigate([`/clientes/${clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'create' }
    });
  }

  /**
   * Navega al formulario de edición de historial clínico.
   *
   * @param clienteId Identificador del cliente cuyo historial se editará.
   */
  editarHistorial(clienteId: string): void {
    this.router.navigate([`/clientes/${clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'edit' }
    });
  }

  /**
   * Inicia el proceso de creación de recibo (venta) para un cliente.
   *
   * Antes de navegar al módulo de ventas, valida que exista una caja chica
   * abierta. Si la caja está cerrada o no existe, muestra mensajes de error
   * apropiados y redirige a la gestión de caja chica.
   *
   * @param clienteId Identificador del cliente para el cual crear la venta.
   */
  async crearRecibo(clienteId: string): Promise<void> {
    // 🔒 VALIDACIÓN: Verificar estado detallado de caja chica
    try {
      const validacion = await this.cajasChicaService.validarCajaChicaHoy();
      
      // ✅ Caja ABIERTA - Permitir entrada
      if (validacion.valida && validacion.tipo === 'ABIERTA') {
        this.router.navigate(['/ventas/crear'], {
          queryParams: { clienteId }
        });
        return;
      }
      
      // ❌ Caja CERRADA - Mostrar error específico
      if (validacion.tipo === 'CERRADA') {
        let fechaDisplay = 'hoy';
        if (validacion.caja?.fecha) {
          try {
            const fecha = validacion.caja.fecha instanceof Date ? validacion.caja.fecha : (validacion.caja.fecha as any).toDate?.() || new Date(validacion.caja.fecha);
            if (!isNaN(fecha.getTime())) {
              fechaDisplay = fecha.toLocaleDateString('es-ES');
            }
          } catch (e) {
            fechaDisplay = 'hoy';
          }
        }
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica Cerrada',
          text: `La caja chica de ${fechaDisplay} ya fue cerrada. No se pueden crear ventas con una caja cerrada.`,
          confirmButtonText: 'Abrir Nueva Caja Chica',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/caja-chica']);
        });
        return;
      }
      
      // ❌ NO EXISTE caja para hoy
      await Swal.fire({
        icon: 'error',
        title: 'Caja Chica No Encontrada',
        text: 'No hay una caja chica abierta para hoy. Debe crear una caja chica antes de poder registrar ventas.',
        confirmButtonText: 'Crear Caja Chica',
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
   * Inicia el proceso de cobro de deuda para un cliente.
   *
   * Similar a crearRecibo, valida que exista una caja chica abierta antes
   * de permitir registrar abonos. Redirige al módulo de deudas con el cliente
   * preseleccionado.
   *
   * @param clienteId Identificador del cliente para cobrar deuda.
   */
  async cobrarDeuda(clienteId: string): Promise<void> {
    // 🔒 VALIDACIÓN: Verificar estado detallado de caja chica
    try {
      const validacion = await this.cajasChicaService.validarCajaChicaHoy();
      
      // ✅ Caja ABIERTA - Permitir entrada
      if (validacion.valida && validacion.tipo === 'ABIERTA') {
        this.router.navigate(['/ventas/deuda'], {
          queryParams: { clienteId }
        });
        return;
      }
      
      // ❌ Caja CERRADA - Mostrar error específico
      if (validacion.tipo === 'CERRADA') {
        let fechaDisplay = 'hoy';
        if (validacion.caja?.fecha) {
          try {
            const fecha = validacion.caja.fecha instanceof Date ? validacion.caja.fecha : (validacion.caja.fecha as any).toDate?.() || new Date(validacion.caja.fecha);
            if (!isNaN(fecha.getTime())) {
              fechaDisplay = fecha.toLocaleDateString('es-ES');
            }
          } catch (e) {
            fechaDisplay = 'hoy';
          }
        }
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica Cerrada',
          text: `La caja chica de ${fechaDisplay} ya fue cerrada. No se pueden registrar abonos con una caja cerrada.`,
          confirmButtonText: 'Abrir Nueva Caja Chica',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/caja-chica']);
        });
        return;
      }
      
      // ❌ NO EXISTE caja para hoy
      await Swal.fire({
        icon: 'error',
        title: 'Caja Chica No Encontrada',
        text: 'No hay una caja chica abierta para hoy. Debe crear una caja chica antes de poder registrar abonos.',
        confirmButtonText: 'Crear Caja Chica',
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
   *
   * Valida que el cliente no tenga deudas pendientes antes de permitir la
   * desactivación. Solicita confirmación al usuario y recarga la lista tras
   * la operación exitosa.
   *
   * @param clienteId Identificador del cliente a desactivar.
   */
  async eliminarCliente(clienteId: string): Promise<void> {
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

  tieneCreditoPersonal(clienteId: string): boolean {
    return !!this.deudas[clienteId]?.creditoPersonalActivo;
  }

  /**
   * Función de trackeo para optimizar el renderizado de la lista de clientes.
   *
   * Angular usa esta función para identificar únicamente cada cliente en el
   * *ngFor, mejorando el rendimiento al evitar re-renders innecesarios.
   *
   * @param index Índice del elemento en el arreglo.
   * @param item Cliente a trackear.
   * @returns Identificador único del cliente.
   */
  trackByClienteId(index: number, item: ClienteUI): string {
    return item.id;
  }
}
