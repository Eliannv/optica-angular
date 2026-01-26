import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FacturasService } from '../../../../core/services/facturas';
import { firstValueFrom } from 'rxjs';
import { ProductosService } from '../../../../core/services/productos';
import { ClientesService } from '../../../../core/services/clientes';

/**
 * Componente VerFacturaComponent - Visualización de detalles de factura individual.
 *
 * **Responsabilidades:**
 * - Cargar factura por ID desde Firestore
 * - Mostrar detalles completos (cliente, items, totales, etc)
 * - Proporcionar funcionalidad de reimpresión con ticket POS
 * - Enriquecer items con códigos de producto si no existen
 * - Limpiar recursos al destruir componente
 *
 * **Características técnicas:**
 * - Componente standalone moderno
 * - Implementa OnDestroy para gestión de suscripciones (good practice)
 * - Carga asincrónica: Spinner mientras loading=true, contenido cuando loading=false
 * - Reimpresión: Abre ventana con formato 80mm (POS/ticket printer), enriquece códigos
 * - Manejo de errores: Fallback graceful si código de producto no está disponible
 *
 * **Flujo de datos:**
 * 1. Constructor → Obtiene ID de route.snapshot.paramMap
 * 2. Constructor → Suscribe a getFacturaById() Observable
 * 3. Cuando responde: Asigna factura, setea loading=false, template renderiza
 * 4. Usuario hace click en Reimprimir → Enriquece items → Abre window.open()
 * 5. Window se carga → Triggeriza print() → Usuario selecciona impresora
 * 6. Después de print (o timeout 2s) → Cierra ventana automáticamente
 * 7. OnDestroy → Unsubscribe de Observable, limpia estado del documento
 *
 * **Integración:**
 * - FacturasService.getFacturaById(id): Observable<Factura>
 * - ProductosService.getProductoById(id): Observable<Producto> (para enriquecimiento)
 * - ActivatedRoute.snapshot.paramMap: Route parameters ({id})
 * - Router: Navegación SPA (volver a listado)
 *
 * **URL de activación:**
 * - /facturas/:id
 * - Ejemplo: /facturas/abc123xyz
 *
 * @component
 * @selector app-ver-factura
 * @standalone true
 * @imports [CommonModule]
 *
 * @example
 * // En routing:
 * { path: ':id', component: VerFacturaComponent }
 *
 * // Navegación desde ListarFacturasComponent:
 * this.router.navigate(['/facturas', '12345xyz']);
 */
@Component({
  selector: 'app-ver-factura',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ver-factura.html',
  styleUrl: './ver-factura.css'
})
export class VerFacturaComponent implements OnDestroy {
  /**
   * Objeto factura cargado desde Firestore.
   * Contiene: id, clienteId, clienteNombre, items[], total, saldoPendiente, fecha, metodoPago, etc.
   * Se asigna cuando Observable de FacturasService emite.
   * @type {any}
   * @default null (hasta que se complete la carga)
   */
  factura: any = null;

  clienteTelefono: string = '';

  /**
   * Indicador de estado de carga.
   * true: Mostrando spinner, esperando que Observable emita
   * false: Factura cargada, renderizar contenido
   * @type {boolean}
   * @default true
   * @remarks Template usa *ngIf="loading" para spinner y *ngIf="!loading" para contenido
   */
  loading = true;

  /**
   * Suscripción a Observable de getFacturaById().
   * Se mantiene para permitir unsubscribe en ngOnDestroy.
   * @type {Subscription | undefined}
   * @private
   * @remarks Si no se unsubscribe, puede causar memory leaks (Observable nunca se completa)
   */
  private sub?: Subscription;

  /**
   * Inicializa el componente y carga la factura desde Firestore.
   *
   * **Flujo de inicialización:**
   * 1. Obtiene ID de ruta: route.snapshot.paramMap.get('id')
   * 2. Si ID es null → Lanza error de compilación (!)
   * 3. Suscribe a facturasSrv.getFacturaById(id) Observable
   * 4. Cuando emite → Asigna this.factura → Setea loading=false
   * 5. Template detecta cambio → Renderiza contenido (change detection automática)
   *
   * **Manejo de parámetros:**
   * - snapshot: Obtiene valor actual sin subscribe (suficiente para paramMap estático)
   * - paramMap.get('id'): Retorna string o null
   * - El '!' fuerza tipo string (asume que ruta siempre tiene id - debería validarse)
   *
   * **Notas técnicas:**
   * - snapshot es para valores que no cambian durante la vida del componente
   * - Si ruta podría cambiar, usar route.params (Observable) en lugar de snapshot
   * - La suscripción persiste hasta que observable complete o sea unsubscribeado
   * - El '!' está permitido porque ruta está configurada con :id obligatorio
   *
   * @param {ActivatedRoute} route - Ruta activada con parámetros (:id)
   * @param {Router} router - Enrutador para navegación (volver a listado)
   * @param {FacturasService} facturasSrv - Servicio para obtener factura por ID
   * @param {ProductosService} productosSrv - Servicio para obtener códigos de productos
   *
   * @returns {void}
   *
   * @remarks
   * - Depende de que la ruta esté configurada correctamente con :id en path
   * - No valida si ID existe (firestore retorna null/undefined si no existe documento)
   * - Debería agregarse validación: if (!this.factura) showError()
   */
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private facturasSrv: FacturasService,
    private productosSrv: ProductosService,
    private clientesSrv: ClientesService
  ) {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.sub = this.facturasSrv.getFacturaById(id).subscribe(f => {
      this.factura = f;
      // Cargar teléfono del cliente
      if (f?.clienteId) {
        this.clientesSrv.getClienteById(f.clienteId).subscribe((cliente: any) => {
          this.clienteTelefono = cliente?.telefono || '';
        });
      }
      this.loading = false;
    });
  }

  /**
   * Navega de vuelta al listado de facturas.
   *
   * **Ruta destino:** /facturas
   *
   * **Flujo:**
   * 1. Usuario hace clic en botón "Volver" o "Atrás"
   * 2. router.navigate() limpia componente actual
   * 3. ListarFacturasComponent se carga (o se restaura del estado de router)
   * 4. Historial de navegación permite volver adelante con browser forward
   *
   * **Alternativa:**
   * - location.back() sería más "user-friendly" (vuelve a página anterior real)
   * - router.navigate(['/facturas']) siempre va a listado (más predecible)
   *
   * **Integración con template:**
   * - Botón de volver: (ngClick)="volver()"
   * - Típicamente al inicio de la página o en header
   *
   * @returns {void} (Promesa resuelta pero no awaiteada)
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Volver"
   * - router.navigate() es SPA (no recarga página)
   * - Estado anterior puede restaurarse (Angular mantiene componentes en cache)
   *
   * @example
   * // Template:
   * // <button (ngClick)="volver()" class="btn btn-secondary">
   * //   Volver
   * // </button>
   *
   * // Cuando usuario hace clic:
   * this.volver();
   * // Navega a /facturas
   * // ListarFacturasComponent se carga
   */
  volver() {
    this.router.navigate(['/facturas']);
  }

  /**
   * Abre ventana de impresión con ticket POS enriquecido (80mm de ancho).
   *
   * **Flujo completo:**
   *
   * **Paso 1: Enriquecimiento de códigos de producto**
   * - Itera sobre items[] de factura
   * - Si item NO tiene código pero tiene productoId:
   *   • Busca producto en ProductosService
   *   • Obtiene código real del producto
   *   • Asigna código al item (por referencia mutado)
   * - Si búsqueda falla o producto no existe:
   *   • Fallback a código existente o productoId
   *   • No interrumpe flujo (try-catch silencia error)
   *
   * **Paso 2: Obtener referencia a HTML del ticket**
   * - Busca elemento .ticket en DOM actual
   * - Si no existe → Retorna sin hacer nada (error silencioso)
   * - Elemento debe estar en template (ver-factura.html)
   *
   * **Paso 3: Crear ventana para impresión**
   * - window.open('', 'PRINT', 'height=600,width=380')
   * - '' = URL vacía (abre documento en blanco)
   * - 'PRINT' = Nombre de ventana (para reutilización)
   * - Retorna null si popup bloqueado por navegador → Retorna
   * - Ventana está lista para escribir contenido
   *
   * **Paso 4: Generar estilos CSS para 80mm (POS printer)**
   * - Estilos de layout para ticket (monospace, ancho fijo 80mm)
   * - Clases CSS para estructuración: .t-center, .t-bold, .t-hr, .t-table-head, .t-table-row
   * - @media print: Elimina márgenes, fuerza tamaño 80mm, sin scroll
   * - Optimizado para impresoras de ticket estándar
   *
   * **Paso 5: Escribir documento HTML en ventana**
   * - w.document.write() reemplaza contenido de ventana
   * - Incluye: HTML boilerplate + estilos CSS + ticket.outerHTML
   * - ticket.outerHTML: Copia completa del elemento .ticket con su HTML
   *
   * **Paso 6: Cerrar y disparar impresión**
   * - w.document.close(): Finaliza documento HTML en ventana
   * - Trigger print cuando document esté listo (readyState === 'complete')
   * - Si ya está completo: setTimeout 150ms para dar tiempo a render
   * - Si aún carga: w.onload = () => setTimeout trigger
   *
   * **Paso 7: Manejo seguro de cierre de ventana**
   * - Escucha evento 'afterprint' (cuando usuario cierra diálogo de impresión)
   * - Si afterprint no se dispara: setTimeout fallback 2000ms
   * - Flag 'closed' evita doble cierre (safeClose idempotente)
   * - Try-catch captura errores de w.focus(), w.print(), w.addEventListener()
   *
   * **Casos especiales:**
   *
   * **Enriquecimiento de códigos:**
   * - Si items no tiene array: No itera (truthy check)
   * - Si item.codigo existe: No busca (evita overwrite)
   * - Si productoId no existe: No busca (valida requisito)
   * - Si búsqueda falla: Usa fallback (no rompe flujo)
   *
   * **Ventana de impresión:**
   * - Si .ticket no existe: No hace nada (error silencioso)
   * - Si window.open bloqueado: Retorna (error silencioso)
   * - Si w.print() lanza: Try-catch + safeClose (robusto)
   *
   * **Cerrado de ventana:**
   * - afterprint PUEDE no dispararse en todos los navegadores
   * - Timeout 2000ms garantiza cierre aunque afterprint falle
   * - Flag 'closed' previene múltiples llamadas a w.close()
   * - safeClose() es idempotente (safe to call multiple times)
   *
   * **Performance:**
   * - Búsquedas async de productos: O(n) donde n = items count
   * - Generación HTML: O(1) (simple string concat)
   * - Apertura ventana: O(1) (nueva ventana del navegador)
   * - Impresión: Bloqueante (browser modal) pero sin bloqueo JS
   *
   * **Seguridad:**
   * - HTML es de la aplicación (ticket.outerHTML), no XSS risk
   * - CSS es hardcoded (no inyectable desde datos)
   * - w.document.write() es seguro aquí (no es entrada de usuario)
   *
   * **Limitaciones conocidas:**
   * - window.open() puede ser bloqueado por navegador (popup blocker)
   * - Algunos navegadores no disparan 'afterprint' (no depender solo de él)
   * - Diferentes navegadores renderizan CSS diferente
   * - Printers tienen capacidades variadas (algunos no respetan 80mm)
   * - Si documento no carga en tiempo (readyState never === 'complete'): Timeout salva
   *
   * @returns {Promise<void>} Operación async (await para esperar completitud)
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Reimprimir"
   * - Operación async pero no es awaiteada (dispara y olvida)
   * - Modifica items[].codigo por referencia (enriquecimiento de datos)
   * - Si factura es null: Retorna inmediatamente (validación)
   *
   * @example
   * // Template:
   * // <button (ngClick)="reimprimir()" class="btn btn-primary">
   * //   Reimprimir Ticket
   * // </button>
   *
   * // Cuando usuario hace clic:
   * this.reimprimir();
   * // 1. Enriquece códigos de producto
   * // 2. Abre ventana
   * // 3. Copia HTML del ticket con estilos 80mm
   * // 4. Dispara impresión
   * // 5. Cierra ventana automáticamente
   *
   * // Flujo de usuario:
   * // Usuario ve diálogo de impresión
   * // Selecciona impresora / PDF
   * // Hace clic "Imprimir"
   * // Ventana se cierra automáticamente
   */
  async reimprimir() {
    if (!this.factura) return;

    // Enriquecer con códigos reales si no vinieron
    if (Array.isArray(this.factura.items)) {
      for (const it of this.factura.items) {
        if (!it.codigo && it.productoId) {
          try {
            const prod: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));
            it.codigo = prod?.codigo || it.codigo || it.productoId;
          } catch (err) {
            it.codigo = it.codigo || it.productoId;
          }
        }
      }
    }

    const ticket = document.querySelector('.ticket');
    if (!ticket) return;

    const w = window.open('', 'PRINT', 'height=600,width=380');
    if (!w) return;

    const styles = `
      html, body { margin: 0; padding: 0; width: 80mm; background: #fff; font-family: monospace; }
      .ticket { padding: 6px 4px; font-size: 12px; line-height: 1.2; width: 80mm; box-sizing: border-box; }
      .t-center { text-align: center; }
      .t-right { text-align: right; }
      .t-bold { font-weight: 700; }
      .t-hr { border-top: 1px dashed #000; margin: 6px 0; }
      .t-kv { display: flex; justify-content: space-between; gap: 4px; }
      .t-kv span:first-child { width: 32mm; }
      .t-kv span:last-child { flex: 1; text-align: right; }
      .t-table-head, .t-table-row { display: grid; grid-template-columns: 8mm 30mm 8mm 12mm 12mm; column-gap: 2mm; row-gap: 0; align-items: center; }
      .t-table-head { font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 4px; }
      .t-table-row { margin: 0 0 2px 0; }
      .t-cell { display: block; }
      .t-cut { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .t-small { font-size: 11px; }
      @media print {
        @page { size: 80mm auto; margin: 0; }
        html, body { width: 80mm; margin: 0; padding: 0; }
        .ticket { width: 80mm; }
      }
    `;

    w.document.write(`
      <html>
        <head>
          <title>Ticket</title>
          <style>${styles}</style>
        </head>
        <body>
          ${ticket.outerHTML}
        </body>
      </html>
    `);

    w.document.close();

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
        setTimeout(safeClose, 2000);
      } catch {
        safeClose();
      }
    };

    if (w.document.readyState === 'complete') {
      setTimeout(triggerPrint, 150);
    } else {
      w.onload = () => setTimeout(triggerPrint, 150);
    }
  }

  /**
   * Hook de ciclo de vida: Limpia recursos cuando componente se destruye.
   *
   * **Responsabilidades:**
   * 1. Unsubscribe de Observable (facturasSrv.getFacturaById)
   *    - Previene memory leaks
   *    - Observable nunca se completa por sí solo
   *    - Sin esto: Suscripción persiste después de que componente es destroyed
   *
   * 2. Remueve clase 'print-ticket' del body (cleanup de CSS)
   *    - Si algún método agregó clase durante impresión
   *    - Asegura que otros componentes no hereden el estado
   *    - Cleanup preventivo (buena práctica)
   *
   * **Cuándo se ejecuta:**
   * - Usuario navega fuera del componente (/facturas/:id → /facturas)
   * - Usuario cierra el navegador/pestaña
   * - Aplicación es destruida
   *
   * **Importancia:**
   * - Implementar OnDestroy es mark de buena arquitectura Angular
   * - Previene memory leaks (suscripciones no unsubscribeadas)
   * - Previene efectos secundarios (clases CSS quedan en DOM)
   * - Best practice en Angular 15+
   *
   * **Nota técnica:**
   * - El '?' en this.sub?.unsubscribe() es optional chaining
   *   (seguro si sub es undefined)
   * - classList.remove() es seguro aunque clase no exista
   * - Ambas operaciones son idempotentes (safe to call multiple times)
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta automáticamente por Angular cuando componente es destroyed
   * - No debe ser llamado manualmente (Angular lo hace)
   * - Implementación de OnDestroy interface es requerida para que Angular lo ejecute
   *
   * @example
   * // Cuando usuario navega:
   * // ListarFacturasComponent activo
   * // Usuario hace clic en factura → VerFacturaComponent se crea
   * // Después usuario hace clic "Volver" → VerFacturaComponent se destruye
   * // Angular llama automáticamente: ngOnDestroy()
   * // Unsubscribe ejecuta → Observable subscription termina
   * // Clase removida → body limpio
   */
  ngOnDestroy() {
    this.sub?.unsubscribe();
    document.body.classList.remove('print-ticket');
  }
}

