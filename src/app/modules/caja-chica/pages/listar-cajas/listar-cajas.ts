/**
 * 🚀 OPTIMIZADO: Componente para listar y gestionar cajas chicas con paginación y filtro por periodo.
 *
 * Propósito:
 * Dashboard de cajas chicas con carga eficiente, navegación bidireccional y filtro automático por periodo.
 *
 * ✅ OPTIMIZACIONES APLICADAS:
 * - ✔ Paginación backend real (limit + startAfter)
 * - ✔ Navegación anterior/siguiente con historial
 * - ✔ Filtro por periodo (selección automática del periodo actual)
 * - ✔ Solo mantiene página actual en memoria
 * - ✔ Gestión de memoria automática
 * - ✔ Reduce lecturas Firestore
 *
 * Funcionalidades:
 * - Paginación: 10 cajas por página (navegación bidireccional)
 * - Filtro: Periodo automático (mes/año de caja banco)
 * - Acciones: abrir, ver, registrar movimiento, cerrar
 * - Formateo: fechas y montos localizados
 *
 * @component ListarCajasComponent
 * @standalone false
 * @module CajaChicaModule
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { CajaBanco } from '../../../../core/models/caja-banco.model';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit, OnDestroy {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private router = inject(Router);
  private subscriptions = new Subscription();

  // 📋 Datos visibles
  cajasVisibles: CajaChica[] = [];
  
  // 📄 Control de paginación (navegación anterior/siguiente)
  paginaActual = 1;
  pageSize = 10;
  lastVisible: QueryDocumentSnapshot<DocumentData> | null = null;
  firstVisible: QueryDocumentSnapshot<DocumentData> | null = null;
  hasMore = false;
  cargando = false;

  // 🔍 Historial de páginas para navegación hacia atrás
  paginasHistorial: Array<{
    firstDoc: QueryDocumentSnapshot<DocumentData> | null;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    pageNumber: number;
  }> = [];

  // 🎯 Filtro de periodo (siempre activo)
  cajaBancoSeleccionada: string | null = null; // ID de caja banco para filtrar por periodo
  fechaSeleccionada: string = ''; // Fecha específica para filtrar (formato YYYY-MM-DD)
  minFechaPeriodo: string = ''; // Fecha mínima permitida según periodo
  maxFechaPeriodo: string = ''; // Fecha máxima permitida según periodo

  // 📆 Cajas banco disponibles (para selector de periodo)
  cajasBancoDisponibles: CajaBanco[] = [];
  cargandoPeriodos = false;

  ngOnInit(): void {
    this.cargarPeriodosDisponibles();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // Liberar memoria
    this.cajasVisibles = [];
    this.cajasBancoDisponibles = [];
    this.lastVisible = null;
  }

  /**   * 📆 Carga las cajas banco disponibles para el selector de periodo.
   * Selecciona automáticamente el periodo más reciente (actual).
   */
  cargarPeriodosDisponibles(): void {
    this.cargandoPeriodos = true;
    const sub = this.cajaBancoService.getCajasBanco().subscribe({
      next: (cajasBanco) => {
        // Ordenar por fecha descendente (más recientes primero)
        this.cajasBancoDisponibles = cajasBanco.sort((a, b) => {
          const fechaA = (a.fecha as any)?.toMillis?.() || new Date(a.fecha).getTime();
          const fechaB = (b.fecha as any)?.toMillis?.() || new Date(b.fecha).getTime();
          return fechaB - fechaA;
        });
        
        // Seleccionar automáticamente el periodo más reciente
        if (this.cajasBancoDisponibles.length > 0) {
          this.cajaBancoSeleccionada = this.cajasBancoDisponibles[0].id || null;
          // Calcular rango de fechas del periodo
          this.calcularRangoFechasPeriodo();
          // Cargar cajas del periodo actual
          this.cargarCajasPaginadas();
        }
        
        this.cargandoPeriodos = false;
      },
      error: (error) => {
        console.error('Error al cargar periodos:', error);
        this.cargandoPeriodos = false;
      }
    });
    this.subscriptions.add(sub);
  }

  /**   *  Carga la primera página de cajas chicas.
   * Reinicia el estado y carga la página inicial.
   */
  async cargarCajasPaginadas(resetear: boolean = true): Promise<void> {
    if (resetear) {
      // 🧹 Limpiar estado anterior
      this.cajasVisibles = [];
      this.paginaActual = 1;
      this.paginasHistorial = [];
      this.lastVisible = null;
      this.firstVisible = null;
      this.hasMore = false;
    }

    this.cargando = true;

    try {
      const opciones: any = {
        pageSize: this.pageSize
      };

      // Aplicar filtro por periodo (siempre activo)
      if (this.cajaBancoSeleccionada) {
        opciones.cajaBancoId = this.cajaBancoSeleccionada;
      }

      // Aplicar filtro por fecha específica si está seleccionada
      if (this.fechaSeleccionada) {
        opciones.fecha = this.fechaSeleccionada;
      }

      const resultado = await this.cajaChicaService.getCajasChicasPaginadas(opciones);

      this.cajasVisibles = resultado.cajas;
      this.lastVisible = resultado.lastVisible;
      this.firstVisible = resultado.cajas.length > 0 ? resultado.lastVisible : null;
      this.hasMore = resultado.hasMore;

      // Guardar primera página en historial
      if (this.cajasVisibles.length > 0) {
        this.paginasHistorial.push({
          firstDoc: null,
          lastDoc: this.lastVisible,
          pageNumber: 1
        });
      }

    } catch (error) {
      console.error('❌ Error al cargar cajas:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las cajas chicas',
        timer: 3000
      });
    } finally {
      this.cargando = false;
    }
  }

  /**
   * 📄 Navega a la página siguiente.
   */
  async paginaSiguiente(): Promise<void> {
    if (!this.hasMore || this.cargando) return;

    this.cargando = true;

    try {
      const opciones: any = {
        pageSize: this.pageSize,
        lastVisible: this.lastVisible
      };

      // Aplicar filtro por periodo activo
      if (this.cajaBancoSeleccionada) {
        opciones.cajaBancoId = this.cajaBancoSeleccionada;
      }

      const resultado = await this.cajaChicaService.getCajasChicasPaginadas(opciones);

      this.cajasVisibles = resultado.cajas;
      this.lastVisible = resultado.lastVisible;
      this.firstVisible = resultado.cajas.length > 0 ? resultado.lastVisible : null;
      this.hasMore = resultado.hasMore;
      this.paginaActual++;

      // Guardar en historial
      if (this.cajasVisibles.length > 0) {
        this.paginasHistorial.push({
          firstDoc: this.firstVisible,
          lastDoc: this.lastVisible,
          pageNumber: this.paginaActual
        });
      }

    } catch (error) {
      console.error('❌ Error al cargar siguiente página:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la página siguiente',
        timer: 3000
      });
    } finally {
      this.cargando = false;
    }
  }

  /**
   * 📄 Navega a la página anterior.
   */
  async paginaAnterior(): Promise<void> {
    if (this.paginaActual <= 1 || this.cargando) return;

    this.cargando = true;

    try {
      // Eliminar la página actual del historial
      this.paginasHistorial.pop();
      this.paginaActual--;

      // Obtener la página anterior (ahora la última en el historial)
      const paginaAnterior = this.paginasHistorial[this.paginasHistorial.length - 1];

      if (!paginaAnterior || paginaAnterior.pageNumber === 1) {
        // Si no hay historial o es la primera página, recargarla
        await this.cargarCajasPaginadas(true);
        return;
      }

      // Cargar desde el snapshot del historial
      const opciones: any = {
        pageSize: this.pageSize,
        lastVisible: this.paginasHistorial[this.paginasHistorial.length - 2]?.lastDoc || undefined
      };

      // Aplicar filtro por periodo activo
      if (this.cajaBancoSeleccionada) {
        opciones.cajaBancoId = this.cajaBancoSeleccionada;
      }

      const resultado = await this.cajaChicaService.getCajasChicasPaginadas(opciones);

      this.cajasVisibles = resultado.cajas;
      this.lastVisible = paginaAnterior.lastDoc;
      this.firstVisible = paginaAnterior.firstDoc;
      this.hasMore = true; // Sabemos que hay más porque veníamos de una página posterior

    } catch (error) {
      console.error('❌ Error al cargar página anterior:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la página anterior',
        timer: 3000
      });
    } finally {
      this.cargando = false;
    }
  }

  /**
   * 📄 Navega a la primera página.
   */
  async irPrimeraPagina(): Promise<void> {
    if (this.paginaActual === 1 || this.cargando) return;
    await this.cargarCajasPaginadas(true);
  }

  /**
   * 📆 Calcula el rango de fechas permitidas según el periodo seleccionado.
   */
  calcularRangoFechasPeriodo(): void {
    if (!this.cajaBancoSeleccionada) {
      this.minFechaPeriodo = '';
      this.maxFechaPeriodo = '';
      return;
    }

    const cajaBanco = this.cajasBancoDisponibles.find(c => c.id === this.cajaBancoSeleccionada);
    if (!cajaBanco || !cajaBanco.fecha) {
      this.minFechaPeriodo = '';
      this.maxFechaPeriodo = '';
      return;
    }

    const fecha = (cajaBanco.fecha as any).toDate ? (cajaBanco.fecha as any).toDate() : new Date(cajaBanco.fecha);
    const año = fecha.getFullYear();
    const mes = fecha.getMonth(); // 0-11

    // Primer día del mes
    const primerDia = new Date(año, mes, 1);
    // Último día del mes
    const ultimoDia = new Date(año, mes + 1, 0);

    // Formatear a YYYY-MM-DD
    this.minFechaPeriodo = this.formatoFechaInput(primerDia);
    this.maxFechaPeriodo = this.formatoFechaInput(ultimoDia);
  }

  /**
   * Formatea una fecha a formato YYYY-MM-DD para input type="date".
   */
  formatoFechaInput(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  /**
   * 📆 Cambia el filtro de periodo y recarga desde el inicio.
   */
  cambiarFiltroPeriodo(cajaBancoId: string | null): void {
    this.cajaBancoSeleccionada = cajaBancoId;
    this.fechaSeleccionada = ''; // Resetear fecha al cambiar periodo
    this.calcularRangoFechasPeriodo();
    this.cargarCajasPaginadas(true);
  }

  /**
   * 📅 Cambia el filtro de fecha específica y recarga.
   */
  cambiarFiltroFecha(fecha: string): void {
    this.fechaSeleccionada = fecha;
    this.cargarCajasPaginadas(true);
  }

  /**
   * 🔄 Limpia el filtro de fecha.
   */
  limpiarFiltroFecha(): void {
    this.fechaSeleccionada = '';
    this.cargarCajasPaginadas(true);
  }

  /**
   * Navega hacia el formulario de apertura de nueva caja chica.
   */
  abrirCaja(): void {
    this.router.navigate(['/caja-chica/nueva']);
  }

  /**
   * Navega a la página de detalles de una caja chica específica.
   */
  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-chica/ver', cajaId], {
      queryParams: { returnTo: this.router.url }
    });
  }

  /**
   * Navega al formulario de registro de movimiento para una caja específica.
   */
  registrarMovimiento(cajaId: string): void {
    this.router.navigate(['/caja-chica/registrar', cajaId]);
  }

  /**
   * Cierra una caja chica después de obtener confirmación del usuario.
   */
  async cerrarCaja(cajaId: string): Promise<void> {
    const confirmar = await Swal.fire({
      icon: 'question',
      title: '¿Cerrar Caja Chica?',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    });

    if (!confirmar.isConfirmed) return;

    try {
      await this.cajaChicaService.cerrarCajaChica(cajaId);
      await Swal.fire({
        icon: 'success',
        title: '¡Caja cerrada!',
        text: 'La caja chica se cerró exitosamente',
        timer: 2000,
        showConfirmButton: false
      });
      this.cargarCajasPaginadas(true);
    } catch (error: any) {
      console.error('Error al cerrar caja:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cerrar la caja chica'
      });
    }
  }

  /**
   * Retorna la clase CSS Bootstrap para el badge de estado de caja.
   */
  getEstadoBadgeClass(estado: string): string {
    return estado === 'ABIERTA' ? 'badge-success' : 'badge-danger';
  }

  /**
   * Formatea una fecha de Firestore al formato local (DD/MM/YYYY).
   */
  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  /**
   * Formatea un monto numérico como moneda USD en formato español.
   */
  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  /**
   * Retorna el periodo (mes/año) de una caja banco para mostrar en el selector.
   */
  getPeriodoDisplay(cajaBanco: CajaBanco): string {
    if (!cajaBanco.fecha) return 'Periodo desconocido';
    
    const fecha = (cajaBanco.fecha as any).toDate ? (cajaBanco.fecha as any).toDate() : new Date(cajaBanco.fecha);
    const mes = fecha.toLocaleDateString('es-ES', { month: 'long' });
    const año = fecha.getFullYear();
    
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${año}`;
  }
}
