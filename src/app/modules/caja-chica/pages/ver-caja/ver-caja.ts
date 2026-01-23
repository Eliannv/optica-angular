/**
 * Componente para visualizar y gestionar los detalles de una caja chica específica.
 *
 * Propósito:
 * Este componente es responsable de presentar la información completa de una caja chica,
 * incluyendo datos generales, movimientos registrados y resumen financiero. Permite
 * al operador de caja realizar acciones críticas como registrar nuevos movimientos,
 * cerrar la caja (transfiriendo el saldo a caja banco) y eliminar movimientos errados.
 *
 * Funcionalidades principales:
 * - Cargar y mostrar información general de la caja (fecha, usuario, estado, montos)
 * - Listar todos los movimientos (ingresos y egresos) con detalles de fecha, monto y saldo
 * - Mostrar resumen financiero consolidado (totales de ingresos, egresos, saldo final)
 * - Registrar nuevos movimientos en la caja abierta
 * - Cerrar la caja chica e integrar el saldo con caja banco
 * - Eliminar movimientos registrados (con confirmación del usuario)
 * - Generar e imprimir reportes de cierre detallados con información para auditoría
 *
 * Flujo de cierre:
 * 1. Usuario confirma cierre de caja
 * 2. Sistema valida que la caja esté abierta
 * 3. Se transfiere el saldo actual a caja banco (via cajaChicaService)
 * 4. Se marca la caja como CERRADA en Firestore
 * 5. Se limpia referencia en localStorage
 * 6. Se ofrece opción de imprimir reporte de cierre
 *
 * Conversión de Timestamps:
 * El método privado en imprimirReporteCierre() convierte Timestamps de Firestore a Date
 * para evitar errores NG02100 de Angular al renderizar en templates.
 *
 * @component VerCajaComponent
 * @standalone false
 * @module CajaChicaModule
 */

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CajaChica, MovimientoCajaChica, ResumenCajaChica } from '../../../../core/models/caja-chica.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ver-caja',
  standalone: false,
  templateUrl: './ver-caja.html',
  styleUrls: ['./ver-caja.css']
})
export class VerCajaComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  cajaId: string = '';
  caja: CajaChica | null = null;
  movimientos: MovimientoCajaChica[] = [];
  resumen: ResumenCajaChica | null = null;
  cargando = false;
  error = '';
  esAdmin = false;

  ngOnInit(): void {
    this.cajaId = this.route.snapshot.paramMap.get('id') || '';
    this.esAdmin = this.authService.isAdmin();
    this.cargarDetalles();
  }

  /**
   * Carga todos los detalles asociados a la caja chica actual.
   *
   * Realiza tres cargas paralelas:
   * 1. Información general de la caja (getCajaChicaById)
   * 2. Lista de todos los movimientos registrados (getMovimientosCajaChica)
   * 3. Resumen financiero calculado (getResumenCajaChica)
   *
   * Las cargas son independientes, mejorando el rendimiento. El flag `cargando`
   * se mantiene en true hasta que todas se resuelvan. Si cajaId no está disponible,
   * el método retorna sin ejecutar las cargas.
   *
   * @returns void
   */
  cargarDetalles(): void {
    if (!this.cajaId) return;

    this.cargando = true;
    this.error = '';

    this.cajaChicaService.getCajaChicaById(this.cajaId).subscribe({
      next: (caja) => this.caja = caja,
      error: (error) => this.manejarErrorCarga('caja', error)
    });

    this.cajaChicaService.getMovimientosCajaChica(this.cajaId).subscribe({
      next: (movimientos) => this.movimientos = movimientos,
      error: (error) => this.manejarErrorCarga('movimientos', error)
    });

    this.cajaChicaService.getResumenCajaChica(this.cajaId).then(
      (resumen) => {
        this.resumen = resumen;
        this.cargando = false;
      },
      (error) => this.manejarErrorCarga('resumen', error)
    );
  }

  /**
   * Maneja errores ocurridos durante la carga de datos del servicio.
   *
   * Registra el error en consola con contexto del tipo que falló.
   * Para el tipo 'caja', asigna un mensaje de error a la propiedad del componente
   * para mostrar al usuario en la UI.
   *
   * Nota: El flag `cargando` NO se resetea aquí, solo en el path exitoso de cargarDetalles().
   * Esto puede dejar la UI "congelada" si ocurren errores. Considerar resetear cargando en futuro.
   *
   * @param tipo Categoría del dato que falló ('caja', 'movimientos', 'resumen')
   * @param error Objeto de error retornado por RxJS o Promise
   * @returns void
   */
  private manejarErrorCarga(tipo: string, error: any): void {
    console.error(`Error al cargar ${tipo}:`, error);
    if (tipo === 'caja') {
      this.error = 'Error al cargar la caja chica';
    }
  }

  /**
   * Navega hacia el formulario de registro de movimiento para la caja actual.
   *
   * Redirige al usuario a '/caja-chica/registrar/:id' donde puede ingresar
   * datos del nuevo movimiento (tipo, descripción, monto, etc).
   *
   * @returns void
   */
  registrarMovimiento(): void {
    this.router.navigate(['/caja-chica/registrar', this.cajaId]);
  }

  /**
   * Inicia el flujo de cierre de caja chica.
   *
   * Proceso:
   * 1. Solicita confirmación al usuario via SweetAlert2
   * 2. Si no confirma, retorna sin hacer cambios
   * 3. Si confirma, obtiene el monto actual de la caja
   * 4. Llama a cajaChicaService.cerrarCajaChica() que:
   *    - Actualiza estado de caja a CERRADA
   *    - Transfiere saldo a caja banco vía registrarMovimiento automático
   * 5. Limpia localStorage (bandera cajaChicaAbierta)
   * 6. Pregunta si desea imprimir reporte (opcional)
   * 7. Redirige a lista de cajas
   *
   * Errores:
   * - Si el servicio falla, muestra alerta con mensaje de error
   * - Los errores se registran en consola para debugging
   *
   * @returns Promise<void>
   */
  async cerrarCaja(): Promise<void> {
    const confirmar = await Swal.fire({
      icon: 'question',
      title: 'Cerrar Caja Chica',
      text: 'El saldo será sumado a Caja Banco. ¿Deseas continuar?',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmar.isConfirmed) return;

    try {
      const montoActual = this.caja?.monto_actual || 0;

      // Cerrar la Caja Chica
      // Esto automáticamente dispara el registro del movimiento en caja_banco
      await this.cajaChicaService.cerrarCajaChica(this.cajaId, montoActual);
      localStorage.removeItem('cajaChicaAbierta');

      // Preguntar si desea imprimir el reporte
      const imprimirResult = await Swal.fire({
        icon: 'success',
        title: 'Caja cerrada correctamente',
        text: 'Saldo sumado a Caja Banco exitosamente. ¿Deseas imprimir el reporte de cierre?',
        showCancelButton: true,
        confirmButtonText: 'Sí, imprimir',
        cancelButtonText: 'No, solo cerrar'
      });

      if (imprimirResult.isConfirmed) {
        await this.imprimirReporteCierre();
      }

      this.router.navigate(['/caja-chica']);
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al cerrar',
        text: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * Elimina un movimiento específico de la caja chica actual.
   *
   * Proceso:
   * 1. Solicita confirmación al usuario (irreversible)
   * 2. Si no confirma, retorna sin hacer cambios
   * 3. Llama a cajaChicaService.eliminarMovimiento() que:
   *    - Elimina el documento de Firestore
   *    - Recalcula resumen financiero automáticamente
   * 4. Muestra confirmación de éxito
   * 5. Recarga todos los detalles de la caja (lista y resumen)
   *
   * Validaciones:
   * - No valida si el movimiento existe (el servicio lo maneja)
   * - No valida el estado de la caja (debe estar ABIERTA según reglas de negocio)
   *
   * @param movimientoId ID único del movimiento en Firestore
   * @returns Promise<void>
   */
  async eliminarMovimiento(movimientoId: string): Promise<void> {
    const confirmar = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar movimiento',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmar.isConfirmed) return;

    try {
      await this.cajaChicaService.eliminarMovimiento(this.cajaId, movimientoId);
      await Swal.fire({
        icon: 'success',
        title: 'Movimiento eliminado',
        timer: 1500,
        showConfirmButton: false
      });
      this.cargarDetalles();
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al eliminar el movimiento'
      });
    }
  }

  /**
   * Convierte y formatea una fecha de Firestore al formato local (DD/MM/YYYY).
   *
   * Maneja múltiples tipos de entrada:
   * - Timestamp de Firestore (tiene método toDate())
   * - Date nativa de JavaScript
   * - Cadena ISO o cualquier valor reconocible por new Date()
   *
   * Localización: Usa formato 'es-ES' para mostrar en español.
   * Si la fecha es null/undefined, retorna '-' para mejor UX.
   *
   * @param fecha Timestamp de Firestore, Date o valor que pueda parsearse a Date
   * @returns Fecha formateada "DD/MM/YYYY" o '-' si es inválida
   */
  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  /**
   * Extrae y formatea la hora de una fecha al formato local (HH:MM).
   *
   * Maneja los mismos tipos que formatoFecha(). Retorna '-' para valores inválidos.
   * Localización: Usa formato 'es-ES' con 24 horas.
   *
   * Uso común: Mostrar hora de creación de movimientos junto a la fecha.
   *
   * @param fecha Timestamp de Firestore, Date o valor parseble a Date
   * @returns Hora formateada "HH:MM" o '-' si es inválida
   */
  formatoHora(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Formatea un monto numérico como moneda USD en formato español.
   *
   * Utiliza Intl.NumberFormat con:
   * - style: 'currency' (incluye símbolo $)
   * - currency: 'USD'
   * - Localización: 'es-ES'
   *
   * Si el monto es undefined o null, usa 0 como fallback.
   * Ejemplo: 1234.56 → "$1.234,56" (en formato español)
   *
   * @param monto Cantidad numérica a formatear
   * @returns Monto formateado con símbolo USD y separadores locales
   */
  formatoMoneda(monto: number | undefined): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  /**
   * Retorna la clase CSS Bootstrap para el badge de tipo de movimiento.
   *
   * Mapeo:
   * - 'INGRESO' → 'badge-success' (verde, para ingresos)
   * - Cualquier otro tipo → 'badge-warning' (naranja, para egresos)
   *
   * Uso: Se asigna directamente en template [ngClass]="getTipoBadgeClass(mov.tipo)"
   *
   * @param tipo Tipo de movimiento ('INGRESO', 'EGRESO', etc)
   * @returns Nombre de clase CSS Bootstrap para el badge
   */
  getTipoBadgeClass(tipo: string): string {
    return tipo === 'INGRESO' ? 'badge-success' : 'badge-warning';
  }

  /**
   * Navega de regreso a la lista de todas las cajas chicas.
   *
   * Ruta destino: '/caja-chica' (lista general)
   * Se ejecuta via Router.navigate()
   *
   * @returns void
   */
  volver(): void {
    this.router.navigate(['/caja-chica']);
  }

  /**
   * Genera e imprime un reporte detallado del cierre de la caja chica.
   *
   * Responsabilidades:
   * 1. Convierte Timestamps de Firestore a Date para evitar errores NG02100 en Angular
   * 2. Prepara datos de la caja, movimientos y resumen
   * 3. Genera HTML completo del reporte (via generarHTMLReporte)
   * 4. Abre ventana de impresión (via abrirVentanaImpresion)
   * 5. Captura errores y muestra alerta de error si falla
   *
   * Conversión de Timestamps:
   * - Si la fecha es null/undefined → retorna new Date()
   * - Si ya es Date → retorna sin cambios
   * - Si tiene método toDate() (Firestore Timestamp) → lo llama
   * - Fallback: new Date(fecha) para otros tipos
   *
   * Contenido del reporte:
   * - Encabezado con nombre de empresa y tipo de documento
   * - Información general (fechas, usuario, estado)
   * - Resumen financiero (montos iniciales, ingresos, egresos, saldo final)
   * - Tabla detallada de todos los movimientos
   * - Sección de observaciones (si existen)
   * - Área de firmas (responsable y supervisor)
   * - Footer con información del sistema
   *
   * @returns Promise<void>
   */
  async imprimirReporteCierre(): Promise<void> {
    try {
      // Convertir Timestamps a Date para evitar errores NG02100
      const convertirTimestamp = (fecha: any): Date => {
        if (!fecha) return new Date();
        if (fecha instanceof Date) return fecha;
        if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
        return new Date(fecha);
      };

      // Preparar datos para el reporte con conversión de Timestamps
      const caja = {
        ...this.caja,
        fecha: convertirTimestamp(this.caja?.fecha),
        cerrado_en: this.caja?.cerrado_en ? convertirTimestamp(this.caja.cerrado_en) : null,
        createdAt: this.caja?.createdAt ? convertirTimestamp(this.caja.createdAt) : new Date()
      };

      const movimientos = this.movimientos.map(m => ({
        ...m,
        fecha: convertirTimestamp(m.fecha),
        createdAt: m.createdAt ? convertirTimestamp(m.createdAt) : new Date()
      }));

      const resumen = { ...this.resumen };
      const fechaReporte = new Date();
      const usuarioCierre = this.authService.getCurrentUser()?.nombre || 'N/A';

      // Generar HTML del reporte
      const htmlReporte = this.generarHTMLReporte({
        caja,
        movimientos,
        resumen,
        fechaReporte,
        usuarioCierre
      });

      // Abrir ventana de impresión
      this.abrirVentanaImpresion(htmlReporte);
    } catch (error) {
      console.error('❌ Error al preparar reporte:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el reporte para impresión'
      });
    }
  }

  /**
   * Abre una ventana del navegador con el HTML del reporte e inicia impresión automática.
   *
   * Flujo:
   * 1. Abre nueva ventana con configuración específica (height=800,width=900)
   * 2. Si el bloqueador de ventanas emergentes impide la apertura, muestra alerta
   * 3. Escribe el contenido HTML en la ventana
   * 4. Cuando el documento está listo, dispara window.print()
   * 5. Cierra automáticamente la ventana después de imprimir (o timeout de 3 segundos)
   *
   * Seguridad de cierre:
   * - Variable `closed` evita cerrar múltiples veces
   * - Event listener 'afterprint' cierra cuando termina la impresión
   * - Timeout fallback de 3 segundos previene ventanas huérfanas
   *
   * Debugging:
   * - Log en consola: "✅ Reporte enviado a impresión"
   * - Helpers: w.focus() y setTimeout para timing de documentos lentos
   *
   * @param htmlReporte String HTML completo del reporte con estilos inline
   * @returns void (operación asincrónica con efectos secundarios visuales)
   */
  private abrirVentanaImpresion(htmlReporte: string): void {
    const w = window.open('', 'PRINT_CAJA_CHICA', 'height=800,width=900');
    if (!w) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir la ventana de impresión. Verifique los bloqueadores de ventanas emergentes.'
      });
      return;
    }

    w.document.write(htmlReporte);
    w.document.close();

    // Disparar impresión automáticamente cuando el contenido esté listo
    const triggerPrint = () => {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        w.close();
      };

      try {
        w.focus();
        w.addEventListener('afterprint', safeClose, { once: true });
        w.print();
        // Fallback: cerrar si afterprint no se dispara
        setTimeout(safeClose, 3000);
      } catch (err) {
        safeClose();
      }
    };

    if (w.document.readyState === 'complete') {
      setTimeout(triggerPrint, 150);
    } else {
      w.onload = () => setTimeout(triggerPrint, 150);
    }

    console.log('✅ Reporte enviado a impresión');
  }

  /**
   * Genera el HTML completo del reporte de cierre de caja chica listo para impresión.
   *
   * Estructura del documento HTML:
   * 1. Declaración DOCTYPE y meta tags (encoding, viewport)
   * 2. Estilos CSS internos (@media print para optimización de impresión)
   * 3. Body con estructura semántica:
   *    - Encabezado: Nombre de empresa y tipo de reporte
   *    - Información general: Fechas de apertura/cierre, usuario, estado
   *    - Resumen financiero: Cálculos y balances
   *    - Detalle de movimientos: Tabla con fila por movimiento
   *    - Observaciones (condicional)
   *    - Firmas: Espacios para responsable y supervisor
   *    - Footer: Información del sistema
   *
   * Funciones locales:
   * - formatoMoneda(): Convierte números a USD con localización es-CO
   * - formatoFecha(): Retorna "DD/MM/YYYY HH:MM" en localización es-CO
   * - formatoFechaSolo(): Retorna solo "DD/MM/YYYY"
   * - formatoHora(): Retorna solo "HH:MM"
   * - filasMovimientos: Mapea array de movimientos a <tr> HTML
   *
   * Estilos de impresión:
   * - Optimiza para papel A4 (max-width: 900px)
   * - Media query @media print elimina márgenes y fondo
   * - Evita saltos de página en tablas (page-break-inside: avoid)
   * - Colores diferenciados para ingresos (verde #28a745) y egresos (rojo #dc3545)
   *
   * Variables esperadas en `data`:
   * - data.caja: Objeto CajaChica con campos fecha, cerrado_en, usuario_nombre, estado, observacion, monto_inicial, monto_actual
   * - data.movimientos: Array de MovimientoCajaChica[] con campo tipo ('INGRESO'|'EGRESO')
   * - data.resumen: ResumenCajaChica con totales
   * - data.fechaReporte: Date para timestamp de impresión
   * - data.usuarioCierre: String con nombre del operador
   *
   * @param data Objeto con propiedades: caja, movimientos, resumen, fechaReporte, usuarioCierre
   * @returns String HTML listo para renderizar en ventana de impresión
   */
  private generarHTMLReporte(data: any): string {
    const formatoMoneda = (valor: number) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor);
    };

    const formatoFecha = (fecha: Date) => {
      return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(fecha));
    };

    const formatoFechaSolo = (fecha: Date) => {
      return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(fecha));
    };

    const formatoHora = (fecha: Date) => {
      return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(fecha));
    };

    const filasMovimientos = data.movimientos.map((mov: any) => `
      <tr>
        <td>${formatoFechaSolo(mov.fecha)}<br><small>${formatoHora(mov.createdAt)}</small></td>
        <td class="text-center ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo}</td>
        <td>${mov.descripcion}</td>
        <td class="text-right ${mov.tipo === 'INGRESO' ? 'tipo-ingreso' : 'tipo-egreso'}">${mov.tipo === 'INGRESO' ? '+' : '-'}${formatoMoneda(mov.monto)}</td>
        <td class="text-right">${formatoMoneda(mov.saldo_nuevo)}</td>
        <td class="text-center">${mov.comprobante || '-'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte de Cierre - Caja Chica</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #333; background: #fff; padding: 20px; }
          .reporte-container { max-width: 900px; margin: 0 auto; background: white; }
          .reporte-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .reporte-header h1 { font-size: 20px; margin-bottom: 5px; font-weight: bold; }
          .reporte-header h2 { font-size: 14px; margin-bottom: 8px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px; }
          .fecha-reporte { font-size: 10px; color: #666; }
          .reporte-info { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; background: #f8f8f8; padding: 12px; border-radius: 4px; }
          .reporte-info-item { display: flex; flex-direction: column; }
          .reporte-info-item .label { font-weight: bold; font-size: 10px; color: #666; margin-bottom: 3px; }
          .reporte-info-item .value { font-size: 11px; color: #333; }
          .reporte-resumen { background: #f0f0f0; padding: 12px; margin-bottom: 20px; border-left: 4px solid #007bff; border-radius: 3px; }
          .reporte-resumen h3 { font-size: 12px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
          .reporte-resumen-item { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
          .reporte-resumen-item span:first-child { font-weight: 500; }
          .reporte-resumen-item.total-final { background: white; padding: 8px; margin-top: 8px; border-top: 2px solid #333; font-weight: bold; font-size: 12px; }
          .tipo-ingreso { color: #28a745; font-weight: bold; }
          .tipo-egreso { color: #dc3545; font-weight: bold; }
          .reporte-section { margin-bottom: 20px; }
          .reporte-section h3 { font-size: 12px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #333; padding-bottom: 8px; }
          .reporte-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .reporte-table thead { background: #e0e0e0; font-weight: bold; }
          .reporte-table th { padding: 8px 5px; text-align: left; border: 1px solid #999; font-size: 9px; }
          .reporte-table td { padding: 7px 5px; border: 1px solid #ddd; }
          .reporte-table tbody tr:nth-child(even) { background: #f9f9f9; }
          .reporte-table tbody tr:hover { background: #f0f0f0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .reporte-empty { text-align: center; padding: 20px; background: #f8f8f8; color: #999; border-radius: 4px; }
          .reporte-firma { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 20px; }
          .reporte-firma-item { flex: 1; text-align: center; font-size: 10px; }
          .reporte-firma-item .linea { width: 80%; height: 1px; background: #000; margin: 30px auto 5px; }
          .reporte-firma-item small { display: block; font-size: 9px; color: #666; margin-top: 3px; }
          .reporte-footer { text-align: center; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; font-size: 9px; color: #999; }
          .reporte-footer p { margin: 3px 0; }
          @media print {
            body { padding: 0; margin: 0; }
            .reporte-container { box-shadow: none; }
            .reporte-table tbody tr { page-break-inside: avoid; }
            .reporte-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="reporte-container">
          <div class="reporte-header">
            <h1>ÓPTICA MACÍAS</h1>
            <h2>REPORTE DE CIERRE DE CAJA CHICA</h2>
            <div class="fecha-reporte">Fecha de impresión: ${formatoFecha(data.fechaReporte)}</div>
          </div>
          <div class="reporte-info">
            <div class="reporte-info-item">
              <span class="label">Fecha de Apertura:</span>
              <span class="value">${formatoFechaSolo(data.caja.fecha)}</span>
            </div>
            <div class="reporte-info-item">
              <span class="label">Fecha de Cierre:</span>
              <span class="value">${formatoFechaSolo(data.caja.cerrado_en)}</span>
            </div>
            <div class="reporte-info-item">
              <span class="label">Usuario:</span>
              <span class="value">${data.caja.usuario_nombre || '-'}</span>
            </div>
            <div class="reporte-info-item">
              <span class="label">Estado:</span>
              <span class="value">${data.caja.estado}</span>
            </div>
          </div>
          <div class="reporte-resumen">
            <h3>RESUMEN FINANCIERO</h3>
            <div class="reporte-resumen-item">
              <span>Monto Inicial:</span>
              <span>${formatoMoneda(data.caja.monto_inicial)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Total Ingresos (${data.movimientos.filter((m: any) => m.tipo === 'INGRESO').length} movimientos):</span>
              <span class="tipo-ingreso">+${formatoMoneda(data.resumen.total_ingresos || 0)}</span>
            </div>
            <div class="reporte-resumen-item">
              <span>Total Egresos:</span>
              <span class="tipo-egreso">-${formatoMoneda(data.resumen.total_egresos || 0)}</span>
            </div>
            <div class="reporte-resumen-item total-final">
              <span>SALDO FINAL:</span>
              <span>${formatoMoneda(data.caja.monto_actual)}</span>
            </div>
          </div>
          <div class="reporte-section">
            <h3>DETALLE DE MOVIMIENTOS</h3>
            ${data.movimientos.length > 0 ? `
              <table class="reporte-table">
                <thead>
                  <tr>
                    <th style="width: 15%;">Fecha/Hora</th>
                    <th style="width: 10%;" class="text-center">Tipo</th>
                    <th style="width: 35%;">Descripción</th>
                    <th style="width: 15%;" class="text-right">Monto</th>
                    <th style="width: 15%;" class="text-right">Saldo</th>
                    <th style="width: 10%;" class="text-center">Comprobante</th>
                  </tr>
                </thead>
                <tbody>${filasMovimientos}</tbody>
              </table>
            ` : `
              <div class="reporte-empty">No se registraron movimientos en esta caja</div>
            `}
          </div>
          ${data.caja.observacion ? `
            <div class="reporte-section">
              <h3>OBSERVACIONES</h3>
              <p>${data.caja.observacion}</p>
            </div>
          ` : ''}
          <div class="reporte-firma">
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Responsable de Caja</div>
              <small>${data.caja.usuario_nombre}</small>
            </div>
            <div class="reporte-firma-item">
              <div class="linea"></div>
              <div>Supervisor/Gerente</div>
            </div>
          </div>
          <div class="reporte-footer">
            <p>Este documento es un reporte interno de cierre de caja chica</p>
            <p>Generado por el Sistema de Gestión - Óptica Macías</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
