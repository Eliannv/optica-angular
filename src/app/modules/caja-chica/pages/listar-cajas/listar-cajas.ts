/**
 * Componente para listar, filtrar y gestionar cajas chicas.
 *
 * Propósito:
 * Proporciona un dashboard consolidado de todas las cajas chicas del sistema,
 * permitiendo visualización, filtrado y acciones rápidas. Es el punto de entrada
 * principal para el módulo de cajas chicas.
 *
 * Funcionalidades:
 * - Cargar lista completa de cajas (ABIERTA y CERRADA)
 * - Filtrado dinámico: todas, solo abiertas, solo cerradas
 * - Acciones rápidas:
 *   • Abrir nueva caja chica
 *   • Ver detalles de una caja
 *   • Registrar movimientos en caja abierta
 *   • Cerrar caja (con confirmación y transferencia a caja banco)
 * - Formateo de información (fechas, montos)
 *
 * Gestión de datos:
 * - cajas: Array completo de todas las cajas
 * - cajasAbiertas: Array filtrado según filtro activo (display en template)
 * - cargando: Flag para estados de carga
 * - filtro: Valor actual del filtro seleccionado
 *
 * Ciclo de vida:
 * - OnInit: Carga lista de cajas y aplica filtro inicial
 * - No necesita OnDestroy (sin suscripciones manual cleanup)
 *
 * @component ListarCajasComponent
 * @standalone false
 * @module CajaChicaModule
 */

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaChica } from '../../../../core/models/caja-chica.model';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private router = inject(Router);

  cajas: CajaChica[] = [];
  cajasAbiertas: CajaChica[] = [];
  cargando = false;
  filtro = 'todas'; // 'todas', 'abiertas', 'cerradas'

  ngOnInit(): void {
    this.cargarCajas();
  }

  /**
   * Carga todas las cajas chicas del sistema desde el servicio.
   *
   * Operación:
   * 1. Establece cargando = true
   * 2. Suscribe a cajaChicaService.getCajasChicas() (Observable)
   * 3. En éxito:
   *    - Asigna array a propiedad this.cajas
   *    - Aplica filtro actual via actualizarFiltro()
   *    - Resetea cargando = false
   * 4. En error:
   *    - Registra en consola
   *    - Resetea cargando = false
   *    - No muestra alerta al usuario (carga silenciosa)
   *
   * El filtro se aplica automáticamente después de cargar.
   * Esto permite mantener filtro activo incluso después de recargar datos.
   *
   * @returns void
   */
  cargarCajas(): void {
    this.cargando = true;
    this.cajaChicaService.getCajasChicas().subscribe({
      next: (cajas) => {
        this.cajas = cajas;
        this.actualizarFiltro();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar cajas:', error);
        this.cargando = false;
      }
    });
  }

  /**
   * Actualiza la lista visible (cajasAbiertas) según el filtro actual.
   *
   * Filtrado:
   * - 'abiertas': Retorna array con cajas donde estado === 'ABIERTA'
   * - 'cerradas': Retorna array con cajas donde estado === 'CERRADA'
   * - 'todas' (default): Retorna array completo sin filtrar
   *
   * Implementación:
   * - Usa Array.filter() para crear nuevo array (inmutable)
   * - Asigna a this.cajasAbiertas para renderizar en template
   * - Template vinculado a cajasAbiertas, no a cajas directamente
   *
   * Se llama automáticamente:
   * - Después de cargarCajas()
   * - Cuando cambiarFiltro() es ejecutado
   *
   * @returns void
   */
  actualizarFiltro(): void {
    if (this.filtro === 'abiertas') {
      this.cajasAbiertas = this.cajas.filter(c => c.estado === 'ABIERTA');
    } else if (this.filtro === 'cerradas') {
      this.cajasAbiertas = this.cajas.filter(c => c.estado === 'CERRADA');
    } else {
      this.cajasAbiertas = this.cajas;
    }
  }

  /**
   * Cambia el filtro activo y recalcula la visualización.
   *
   * Pasos:
   * 1. Asigna nuevoFiltro a this.filtro
   * 2. Llama actualizarFiltro() para recalcular cajasAbiertas
   * 3. Template se actualiza automáticamente (data binding)
   *
   * Valores válidos:
   * - 'todas': Mostrar todas las cajas
   * - 'abiertas': Solo cajas con estado ABIERTA
   * - 'cerradas': Solo cajas con estado CERRADA
   *
   * Típicamente se invoca desde botones de filtro en el template.
   *
   * @param nuevoFiltro String con valor de filtro ('todas' | 'abiertas' | 'cerradas')
   * @returns void
   */
  cambiarFiltro(nuevoFiltro: string): void {
    this.filtro = nuevoFiltro;
    this.actualizarFiltro();
  }

  /**
   * Navega hacia el formulario de apertura de nueva caja chica.
   *
   * Ruta destino: '/caja-chica/nueva'
   * El componente AbrirCajaComponent se encargará del resto del flujo.
   *
   * @returns void
   */
  abrirCaja(): void {
    this.router.navigate(['/caja-chica/nueva']);
  }

  /**
   * Navega a la página de detalles de una caja chica específica.
   *
   * Ruta destino: '/caja-chica/ver/:id'
   * El componente VerCajaComponent cargar los detalles de la caja.
   *
   * Nota:
   * - Funciona para cajas abiertas y cerradas
   * - El cajaId debe existir en Firestore
   * - Si no existe, VerCajaComponent mostrará error
   *
   * @param cajaId ID único de la caja a visualizar
   * @returns void
   */
  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-chica/ver', cajaId]);
  }

  /**
   * Navega al formulario de registro de movimiento para una caja específica.
   *
   * Ruta destino: '/caja-chica/registrar/:id'
   * El componente RegistrarMovimientoComponent se encargará del flujo.
   *
   * Caso de uso:
   * - Registrar ingreso o egreso rápidamente desde listado
   * - Típicamente se usa cuando caja está ABIERTA
   *
   * Validación:
   * - El servicio validará que la caja esté abierta
   * - Si está cerrada, mostrará error
   *
   * @param cajaId ID de la caja en la que se registrará el movimiento
   * @returns void
   */
  registrarMovimiento(cajaId: string): void {
    this.router.navigate(['/caja-chica/registrar', cajaId]);
  }

  /**
   * Cierra una caja chica después de obtener confirmación del usuario.
   *
   * Flujo:
   * 1. Solicita confirmación via SweetAlert2
   * 2. Si no confirma: retorna sin hacer cambios
   * 3. Si confirma:
   *    - Llama cajaChicaService.cerrarCajaChica(cajaId)
   *    - Si éxito: muestra alerta de éxito (timer: 2000ms) y recarga lista
   *    - Si error: registra en consola y muestra alerta de error
   *
   * Efectos secundarios:
   * - Transfiere saldo a caja banco (realizado por servicio)
   * - Marca caja como CERRADA en Firestore
   * - Recarga lista de cajas (para actualizar estados)
   *
   * Advertencia:
   * - Alerta de confirmación tiene color rojo (confirmButtonColor: '#dc3545')
   * - Indica naturaleza destructiva de la acción
   *
   * @param cajaId ID de la caja a cerrar
   * @returns Promise<void>
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
      this.cargarCajas();
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
   *
   * Mapeo:
   * - 'ABIERTA' → 'badge-success' (verde)
   * - Cualquier otro estado → 'badge-danger' (rojo)
   *
   * Uso: Se asigna en template [ngClass]="getEstadoBadgeClass(caja.estado)"
   *
   * Valores de estado típicos:
   * - 'ABIERTA': Caja activa aceptando movimientos
   * - 'CERRADA': Caja finalizada, saldo transferido a caja banco
   *
   * @param estado String del estado de la caja
   * @returns Nombre de clase CSS Bootstrap para badge
   */
  getEstadoBadgeClass(estado: string): string {
    return estado === 'ABIERTA' ? 'badge-success' : 'badge-danger';
  }

  /**
   * Formatea una fecha de Firestore al formato local (DD/MM/YYYY).
   *
   * Maneja múltiples tipos:
   * - Timestamp de Firestore (tiene método toDate())
   * - Date nativa de JavaScript
   * - Cadena ISO u otro tipo parseble
   *
   * Fallback: Retorna '-' si fecha es null/undefined
   * Localización: Usa 'es-ES' para formato español
   *
   * @param fecha Timestamp de Firestore, Date, o valor parseble a Date
   * @returns Fecha formateada "DD/MM/YYYY" o '-'
   */
  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  /**
   * Formatea un monto numérico como moneda USD en formato español.
   *
   * Utiliza Intl.NumberFormat con:
   * - style: 'currency' (incluye símbolo $)
   * - currency: 'USD'
   * - Localización: 'es-ES'
   *
   * Fallback: Si monto es undefined/null, usa 0
   * Ejemplo: 1234.56 → "$1.234,56"
   *
   * @param monto Cantidad numérica a formatear
   * @returns Monto formateado con símbolo y separadores locales
   */
  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }
}
