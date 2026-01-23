import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FacturasService } from '../../../../core/services/facturas';

/**
 * Tipo literal para estados de filtro de facturas.
 * @typedef {'TODAS' | 'PENDIENTES' | 'PAGADAS'} FiltroEstado
 */
type FiltroEstado = 'TODAS' | 'PENDIENTES' | 'PAGADAS';

/**
 * Componente ListarFacturasComponent - Listado paginado y filtrable de facturas.
 *
 * **Responsabilidades:**
 * - Cargar todas las facturas desde Firestore
 * - Aplicar filtros por estado (TODAS, PENDIENTES, PAGADAS) y búsqueda por texto
 * - Paginar resultados (10 facturas por página)
 * - Proporcionar acciones: Ver detalles, Cobrar deuda, Nueva venta
 *
 * **Características técnicas:**
 * - Componente standalone moderno
 * - Ordenamiento persistente por fecha descendente (más recientes primero)
 * - Filtrado multi-criterio: cliente, método pago, ID personalizado, ID Firestore
 * - Conversión segura de Timestamps Firestore, Date Objects y strings a milisegundos
 * - Búsqueda en tiempo real (trimmed y case-insensitive)
 *
 * **Flujo de datos:**
 * 1. Constructor → Carga facturas de FacturasService → Subscribe mantiene sincronización
 * 2. Cada carga → Ordena por fecha DESC → Aplica filtros → Actualiza paginación
 * 3. Usuario interactúa → Cambia filtro/búsqueda → Re-ejecuta filtrar() → Reinicia página 1
 * 4. Usuario navega páginas → Actualiza inicio/fin para slice de array paginado
 * 5. Usuario hace acción → Navega a componentes relacionados (detalles, deuda, venta)
 *
 * **Integración:**
 * - Usa FacturasService para CRUD de facturas (getFacturas retorna Observable)
 * - Usa Router para navegación SPA a detalles (/facturas/:id), deuda (queryParam), venta
 * - Template: listar-facturas.html (ngIf con paginasPaginadas, ngFor, ngClick handlers)
 *
 * @component
 * @selector app-listar-facturas
 * @standalone true
 * @imports [CommonModule, FormsModule]
 *
 * @example
 * // En routing module:
 * {
 *   path: 'facturas',
 *   loadChildren: () => import('./modules/factura/factura.module')
 *     .then(m => m.FacturaModule)
 * }
 */
@Component({
  selector: 'app-listar-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listar-facturas.html',
  styleUrl: './listar-facturas.css'
})
export class ListarFacturasComponent {
  /**
   * Referencia global a Number (para uso en template con ngFor).
   * @type {typeof Number}
   */
  Number = Number;

  /**
   * Estado actual del filtro seleccionado en UI.
   * Valores válidos: 'TODAS' (sin filtro), 'PENDIENTES' (saldoPendiente > 0), 'PAGADAS' (saldoPendiente <= 0)
   * @type {FiltroEstado}
   * @default 'TODAS'
   */
  filtroEstado: FiltroEstado = 'TODAS';

  /**
   * Término de búsqueda ingresado por el usuario en campo de texto.
   * Se evalúa contra: clienteNombre, metodoPago, idPersonalizado, id Firestore
   * @type {string}
   * @default ''
   */
  term: string = '';

  /**
   * Colección completa de facturas cargadas desde Firestore (sin filtros aplicados).
   * Se mantiene ordenada por fecha descendente.
   * @type {any[]}
   * @private Usar filtradas[] para datos filtrados
   */
  facturas: any[] = [];

  /**
   * Resultado del filtrado actual (aplicados estado y búsqueda de texto).
   * Se usa como fuente para paginación.
   * @type {any[]}
   * @private Usar facturasPaginadas[] para datos mostrados en UI
   */
  filtradas: any[] = [];

  /**
   * Facturas de la página actual después de aplicar paginación.
   * Array de length <= facturasPorPagina, vinculado al template para renderizado.
   * @type {any[]}
   * @private Vinculado al template con *ngFor="let factura of facturasPaginadas"
   */
  facturasPaginadas: any[] = [];

  /**
   * Número de página actual (1-indexed para UI, convertida a offset en code).
   * @type {number}
   * @default 1
   * @see actualizarPaginacion()
   */
  paginaActual: number = 1;

  /**
   * Cantidad máxima de facturas a mostrar por página.
   * @type {number}
   * @default 10
   * @remarks Este valor define el "page size" para slicing de array filtrado
   */
  facturasPorPagina: number = 10;

  /**
   * Cantidad total de facturas en resultado filtrado actual.
   * Se usa para validar si hay más páginas en paginaSiguiente/Anterior.
   * @type {number}
   * @default 0
   * @private Calculado automáticamente en filtrar()
   */
  totalFacturas: number = 0;

  /**
   * Referencia global a Math (para uso en template con operaciones matemáticas).
   * @type {typeof Math}
   */
  Math = Math;

  /**
   * Inicializa el componente y configura la suscripción a datos de facturas.
   *
   * **Flujo de inicialización:**
   * 1. Suscribe a FacturasService.getFacturas() (Observable continuo)
   * 2. Normaliza valores numéricos (total, saldoPendiente) para evitar NaN en template
   * 3. Ordena por fecha descendente (más recientes al inicio)
   * 4. Aplica filtros iniciales y actualiza paginación
   *
   * **Transformación de datos:**
   * - Convierte total y saldoPendiente a Number (si son string/undefined)
   * - Mantiene resto de campos sin cambios (spread operator)
   *
   * **Notas técnicas:**
   * - La suscripción persiste durante toda la vida del componente (no es un pipe)
   * - Datos se cargan asincronamente (setTimeout podría afectar observables)
   * - Cada cambio en Firestore triggeriza actualización automática
   *
   * @param {FacturasService} facturasSrv - Servicio inyectado para operaciones CRUD de facturas
   * @param {Router} router - Servicio inyectado para navegación SPA
   *
   * @returns {void}
   *
   * @remarks
   * - Usa inyección de dependencias estándar de Angular (parámetros del constructor)
   * - La suscripción se mantiene abierta (sin unsubscribe) - considerar agregar OnDestroy en futuras mejoras
   * - El ordenamiento inicial se preserva a través de filtros (ver filtrar método)
   */
  constructor(private facturasSrv: FacturasService, private router: Router) {
    this.facturasSrv.getFacturas().subscribe((data: any[]) => {
      this.facturas = (data || []).map(f => ({
        ...f,
        total: Number(f?.total || 0),
        saldoPendiente: Number(f?.saldoPendiente || 0),
      }));

      // Ordenar por más recientes al inicio
      this.facturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

      this.filtrar();
    });
  }

  /**
   * Convierte fecha en cualquier formato a milisegundos desde epoch (1970-01-01).
   *
   * **Soporta múltiples formatos:**
   * - Timestamp Firestore (objeto con método toDate())
   * - Date object nativo de JavaScript
   * - String ISO 8601 (Date constructor lo parsea)
   * - Number (milisegundos o segundos, se asume milisegundos)
   *
   * **Algoritmo:**
   * 1. Si v es undefined/null → retorna 0 (valores indefinidos al final)
   * 2. Si tiene método toDate (Firestore) → llama y obtiene milisegundos
   * 3. Si es instanceof Date → obtiene milisegundos directamente
   * 4. Si es string/number → crea Date e intenta parsear
   * 5. Si parse falla (isNaN) → retorna 0 (fallback seguro)
   *
   * **Casos de uso:**
   * - Comparar fechas para ordenamiento (sort callback)
   * - Validar que fecha es válida (retorna 0 si no lo es)
   * - Normalizar diferentes tipos de entrada de timestamp
   *
   * **Nota técnica:**
   * Este método es privado porque es interno de lógica de ordenamiento.
   * El frontend no debería depender de él directamente (implementación detail).
   *
   * @param {any} f - Factura objeto que contiene campo "fecha" a convertir
   * @returns {number} Milisegundos desde epoch (1970-01-01T00:00:00Z)
   *          Retorna 0 si la fecha es inválida o undefined
   *
   * @example
   * this.getFechaMs({fecha: new Date()}) // → 1705305600000
   * this.getFechaMs({fecha: firestore.Timestamp.now()}) // → 1705305600000
   * this.getFechaMs({fecha: '2024-01-15'}) // → 1705276800000
   * this.getFechaMs({}) // → 0 (sin fecha)
   *
   * @private
   */
  private getFechaMs(f: any): number {
    const v = f?.fecha;
    if (!v) return 0;

    // Firestore Timestamp
    if (typeof v?.toDate === 'function') return v.toDate().getTime();

    // Date
    if (v instanceof Date) return v.getTime();

    // string/number
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /**
   * Aplica filtros de estado y búsqueda de texto a la colección de facturas.
   *
   * **Algoritmo de filtrado (secuencial):**
   *
   * **Paso 1: Filtro por estado**
   * - TODAS: Sin restricción (usa array completo)
   * - PENDIENTES: Solo donde saldoPendiente > 0
   * - PAGADAS: Solo donde saldoPendiente <= 0
   *
   * **Paso 2: Filtro por texto (búsqueda)**
   * - Si term está vacío: Usa resultado del paso 1 sin filtro adicional
   * - Si term tiene contenido: Busca case-insensitive en 4 campos:
   *   • clienteNombre (nombre del cliente que factura)
   *   • metodoPago (forma de pago: efectivo, tarjeta, etc)
   *   • idPersonalizado (ID custom de factura)
   *   • id (ID Firestore del documento)
   * - El operador OR dice: Si coincide CUALQUIERA de estos campos, incluir factura
   *
   * **Paso 3: Mantener ordenamiento**
   * - Reordena resultado filtrado por fecha descendente (más recientes primero)
   * - Asegura consistencia visual aunque cambien filtros
   *
   * **Paso 4: Actualizar paginación**
   * - Reestablece página actual a 1 (reinicia desde inicio)
   * - Recalcula totalFacturas con largo de resultados filtrados
   * - Llama actualizarPaginacion() para slice de página 1
   *
   * **Flujo de ejecución:**
   * filtrar() → (1) filtro estado → (2) filtro texto → (3) re-sort → (4) reset paginación
   *
   * **Casos especiales:**
   * - Búsqueda vacía: Ignora paso 2, muestra todos del estado seleccionado
   * - Búsqueda sin resultados: totalFacturas = 0, facturasPaginadas vacío
   * - Cambio de filtro: Reseta a página 1 automáticamente
   * - Ordenamiento: Se aplica DESPUÉS del filtrado (no afecta búsqueda)
   *
   * **Performance:**
   * - O(n) para cada paso de filtro
   * - Búsqueda es case-insensitive y trimmed (sin espacios extras)
   * - Array spread ([...]) genera copia para no mutar this.facturas
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta en constructor inicial y cada vez que usuario cambia filtro/búsqueda
   * - Modificables: this.filtroEstado (dropdown) y this.term (input text)
   * - Afecta: this.filtradas (resultado post-filtrado) y this.facturasPaginadas (UI)
   *
   * @example
   * // Usuario selecciona PENDIENTES y busca "García":
   * this.filtroEstado = 'PENDIENTES';
   * this.term = 'García';
   * this.filtrar();
   * // Resultado: Solo facturas sin pagar donde cliente/pago/id contiene "garcía"
   */
  filtrar() {
    const t = (this.term || '').trim().toLowerCase();

    // 1) filtro por estado
    let base = [...this.facturas];

    if (this.filtroEstado === 'PENDIENTES') {
      base = base.filter(f => (Number(f.saldoPendiente) || 0) > 0);
    } else if (this.filtroEstado === 'PAGADAS') {
      base = base.filter(f => (Number(f.saldoPendiente) || 0) <= 0);
    }

    // 2) filtro texto
    if (!t) {
      this.filtradas = base;
    } else {
      this.filtradas = base.filter(f =>
        (f.clienteNombre || '').toLowerCase().includes(t) ||
        (f.metodoPago || '').toLowerCase().includes(t) ||
        (f.idPersonalizado || '').toLowerCase().includes(t) ||
        (f.id || '').toLowerCase().includes(t)
      );
    }

    // 3) mantener orden "últimas primero" siempre
    this.filtradas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

    this.totalFacturas = this.filtradas.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Actualiza el slice de facturas mostradas en la página actual.
   *
   * **Algoritmo:**
   * 1. Calcula índice inicial: (paginaActual - 1) * facturasPorPagina
   *    Ejemplo: página 2 → (2-1)*10 = 10 (comienza en índice 10)
   * 2. Calcula índice final: inicio + facturasPorPagina
   *    Ejemplo: página 2 → 10+10 = 20 (termina antes de índice 20)
   * 3. Usa slice() para extraer subarray [inicio, fin)
   * 4. Envuelve en [...] para crear nueva referencia (Angular change detection)
   *
   * **Casos especiales:**
   * - Última página incompleta: slice retorna lo que queda (< facturasPorPagina items)
   * - Página vacía: Retorna array vacío (resultado de filtrado sin coincidencias)
   * - Primera página: inicio = 0, fin = facturasPorPagina (10 items típicamente)
   *
   * **Performance:**
   * - O(k) donde k = facturasPorPagina (copia solo items de página actual)
   * - No modifica this.filtradas (lee-only)
   * - Operación muy rápida incluso con miles de facturas en filtradas[]
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta automáticamente en filtrar() y en paginaSiguiente/Anterior()
   * - Modifica: this.facturasPaginadas (vinculado al template)
   * - Lee: this.paginaActual, this.filtradas (input)
   * - Resultado: Array de length [0, facturasPorPagina] máximo
   *
   * @example
   * // Página 1: índices 0-9
   * this.paginaActual = 1;
   * this.actualizarPaginacion();
   * // facturasPaginadas = filtradas.slice(0, 10)
   *
   * // Página 3: índices 20-29
   * this.paginaActual = 3;
   * this.actualizarPaginacion();
   * // facturasPaginadas = filtradas.slice(20, 30)
   */
  actualizarPaginacion(): void {
    const inicio = (this.paginaActual - 1) * this.facturasPorPagina;
    const fin = inicio + this.facturasPorPagina;
    this.facturasPaginadas = [...this.filtradas.slice(inicio, fin)];
  }

  /**
   * Navega a la siguiente página de resultados (si existe).
   *
   * **Validación:**
   * - Verifica que paginaActual * facturasPorPagina < totalFacturas
   * - Ejemplo: página 2 (índice 20) < total 100 → Existe página 3
   * - Si condición es falsa → No hace nada (ya está en última página)
   *
   * **Flujo:**
   * 1. Valida que hay más datos
   * 2. Incrementa paginaActual en 1
   * 3. Llama actualizarPaginacion() para re-slice
   * 4. Template re-renderiza con nuevos items
   *
   * **Casos especiales:**
   * - Última página completa: Botón "Siguiente" deshabilitado (template debe usar ngIf)
   * - Última página incompleta: Botón deshabilitado pero cálculo es correcto
   * - Búsqueda sin resultados: Botón deshabilitado (totalFacturas = 0)
   *
   * **Performance:**
   * - O(k) donde k = facturasPorPagina (copia solo items nuevos)
   * - Llamada rápida, no implica nuevo filtrado
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Siguiente" (ngClick handler)
   * - Modifica: this.paginaActual, this.facturasPaginadas
   * - Valida: totalFacturas vs índice actual
   * - Responsabilidad del template: Deshabilitar botón cuando !puedeIrAlaSiguiente()
   *
   * @example
   * // Usuario en página 1 de 5:
   * this.paginaActual = 1;
   * this.totalFacturas = 45;
   * this.paginaSiguiente();
   * // Resultado: paginaActual = 2, facturasPaginadas = slice [10,20]
   *
   * // Usuario en página 5 de 5:
   * this.paginaActual = 5;
   * this.totalFacturas = 45;
   * this.paginaSiguiente();
   * // No hace nada (5*10=50 no < 45)
   */
  paginaSiguiente(): void {
    if (this.paginaActual * this.facturasPorPagina < this.totalFacturas) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la página anterior de resultados (si no es la primera).
   *
   * **Validación:**
   * - Verifica que paginaActual > 1
   * - Si es falsa (estamos en página 1) → No hace nada
   *
   * **Flujo:**
   * 1. Valida que no estemos en primera página
   * 2. Decrementa paginaActual en 1
   * 3. Llama actualizarPaginacion() para re-slice
   * 4. Template re-renderiza con items de página anterior
   *
   * **Casos especiales:**
   * - Primera página: Botón "Anterior" deshabilitado (template debe usar ngIf)
   * - Una sola página: Botón "Anterior" siempre deshabilitado
   *
   * **Performance:**
   * - O(k) donde k = facturasPorPagina (copia items nuevos)
   * - Operación instantánea
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Anterior" (ngClick handler)
   * - Modifica: this.paginaActual, this.facturasPaginadas
   * - Valida: paginaActual > 1
   * - Responsabilidad del template: Deshabilitar botón cuando !puedeIrAlAnterior()
   *
   * @example
   * // Usuario en página 3 de 5:
   * this.paginaActual = 3;
   * this.paginaAnterior();
   * // Resultado: paginaActual = 2, facturasPaginadas = slice [10,20]
   *
   * // Usuario en página 1 de 5:
   * this.paginaActual = 1;
   * this.paginaAnterior();
   * // No hace nada (1 no > 1)
   */
  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la vista de detalles de una factura específica.
   *
   * **Ruta destino:** /facturas/:id
   *
   * **Parámetro:**
   * - id (string): ID Firestore del documento de factura a visualizar
   *
   * **Flujo:**
   * 1. Obtiene el ID de factura desde parámetro de método
   * 2. Llama router.navigate() con ruta parametrizada
   * 3. Componente VerFacturaComponent se carga y obtiene ID de route.params
   * 4. VerFacturaComponent carga detalles desde Firestore
   *
   * **Integración con template:**
   * - Se llama con (ngClick)="ver(factura.id)" en tabla de facturas
   * - Cada fila es clickeable y navega a detalles de esa factura
   *
   * **Notas técnicas:**
   * - router.navigate() es navegación SPA (no recarga página)
   * - Mantiene estado de app pero limpia componente anterior
   * - Historia de navegación se agrega al browser stack (back button funciona)
   *
   * @param {string} id - ID Firestore de la factura a visualizar
   * @returns {void} (Promesa resuelta pero no awaiteada)
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en factura de tabla
   * - Usa inyección de Router en constructor
   * - Responsabilidad del template: Proporcionar ID correcto en ngClick
   *
   * @example
   * // Template:
   * // <tr (ngClick)="ver(factura.id)">
   * //   <td>{{ factura.clienteNombre }}</td>
   * // </tr>
   *
   * // Cuando usuario hace clic:
   * this.ver('abc123xyz');
   * // Navega a /facturas/abc123xyz
   * // VerFacturaComponent se carga con route.params.id = 'abc123xyz'
   */
  ver(id: string) {
    this.router.navigate(['/facturas', id]);
  }

  /**
   * Navega a módulo de cobro de deuda de cliente específico.
   *
   * **Ruta destino:** /ventas/deuda (con queryParam clienteId)
   *
   * **Parámetros:**
   * - clienteId (string): ID del cliente para filtrar deudas pendientes
   * - ev (Event, optional): Evento de click que se stopPropagation() para evitar navegación padre
   *
   * **Validaciones:**
   * 1. Verifica que ev sea proporcional para stopPropagation()
   * 2. Verifica que clienteId no esté vacío (retorna sin hacer nada si lo es)
   *
   * **Flujo:**
   * 1. Detiene propagación de evento (no triggeriza handlers padres)
   * 2. Valida que clienteId existe (no undefined/empty)
   * 3. Navega a /ventas/deuda con clienteId como query parameter
   * 4. Componente de deuda carga y filtra por clienteId
   *
   * **Integración con template:**
   * - Se llama con (ngClick)="cobrarDeuda(factura.clienteId, $event)"
   * - Típicamente en botón dentro de fila de tabla
   * - $event es necesario para event.stopPropagation()
   *
   * **Query Parameters:**
   * - clienteId: Usado por componente de deuda para inicializar filtros
   * - Valor: ID Firestore del cliente
   *
   * **Notas técnicas:**
   * - ev?.stopPropagation() previene que click bubble up (si hay click en fila)
   * - router.navigate() con queryParams agrega ?clienteId=xxx a URL
   * - queryParams se obtienen en destino con route.snapshot.queryParams
   *
   * @param {string} clienteId - ID Firestore del cliente para cobro de deuda
   * @param {Event} [ev] - Evento de DOM (opcional, para stopPropagation)
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Cobrar deuda" de factura
   * - Valida clienteId antes de navegar (evita rutas inválidas)
   * - stopPropagation() es necesario si botón está dentro de fila clickeable
   *
   * @example
   * // Template:
   * // <tr (ngClick)="ver(factura.id)">
   * //   <td>{{ factura.clienteNombre }}</td>
   * //   <td>
   * //     <button (ngClick)="cobrarDeuda(factura.clienteId, $event)">
   * //       Cobrar Deuda
   * //     </button>
   * //   </td>
   * // </tr>
   *
   * // Cuando usuario hace clic en botón:
   * this.cobrarDeuda('cliente123', mockClickEvent);
   * // stopPropagation evita que se ejecute ver(factura.id)
   * // Navega a /ventas/deuda?clienteId=cliente123
   */
  cobrarDeuda(clienteId: string, ev?: Event) {
    ev?.stopPropagation();
    if (!clienteId) return;
    this.router.navigate(['/ventas/deuda'], {
      queryParams: { clienteId }
    });
  }

  /**
   * Navega a la página de creación de nueva venta/historial clínico.
   *
   * **Ruta destino:** /clientes/historial-clinico
   *
   * **Flujo:**
   * 1. Usuario hace clic en botón "Nueva Venta"
   * 2. Navega a módulo de clientes, página de historial clínico
   * 3. Usuario puede crear nueva venta para cliente existente
   *
   * **Integración con template:**
   * - Típicamente en botón de acción: (ngClick)="nuevaVenta()"
   * - No requiere parámetros (usuario selecciona cliente en destino)
   *
   * **Flujo de usuario:**
   * ListarFacturasComponent → Nueva Venta → HistorialClinicoComponent
   *
   * **Notas técnicas:**
   * - Router.navigate() es navegación SPA
   * - Destino es módulo de clientes (lazy-loaded)
   * - Historia de navegación permite volver atrás con browser back button
   *
   * @returns {void} (Promesa resuelta pero no awaiteada)
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Nueva Venta"
   * - No requiere parámetros (usuario selecciona destino en siguiente componente)
   * - Navega a componente de historial clínico donde inicia nueva venta
   *
   * @example
   * // Template:
   * // <button (ngClick)="nuevaVenta()" class="btn btn-primary">
   * //   Nueva Venta
   * // </button>
   *
   * // Cuando usuario hace clic:
   * this.nuevaVenta();
   * // Navega a /clientes/historial-clinico
   * // Usuario ve formulario para crear nueva venta
   */
  nuevaVenta() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}

