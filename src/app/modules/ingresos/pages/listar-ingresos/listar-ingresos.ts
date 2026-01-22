import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Ingreso } from '../../../../core/models/ingreso.model';
import { IngresosService } from '../../../../core/services/ingresos.service';
import Swal from 'sweetalert2';

/**
 * Tipo literal para filtro de estado de ingresos.
 * @typedef {'TODOS' | 'BORRADOR' | 'FINALIZADO'} FiltroEstado
 */
type FiltroEstado = 'TODOS' | 'BORRADOR' | 'FINALIZADO';

/**
 * Tipo literal para filtro de rango de fechas de ingresos.
 * - TODAS: Sin filtro de fecha
 * - HOY: Solo ingresos del día actual
 * - SEMANA: Últimos 7 días
 * - MES: Último mes (30 días)
 * - ANO: Último año (365 días)
 * - ESPECIFICA: Fecha exacta seleccionada por usuario
 * @typedef {'TODAS' | 'HOY' | 'SEMANA' | 'MES' | 'ANO' | 'ESPECIFICA'} FiltroFecha
 */
type FiltroFecha = 'TODAS' | 'HOY' | 'SEMANA' | 'MES' | 'ANO' | 'ESPECIFICA';

/**
 * Componente ListarIngresosComponent - Listado paginado y filtrable de ingresos de compras.
 *
 * **Responsabilidades:**
 * - Cargar todos los ingresos desde Firestore
 * - Aplicar filtros por fecha (rango predefido o específica) y búsqueda por texto
 * - Paginar resultados (10 ingresos por página)
 * - Calcular análisis financiero: total facturas, pagado, deuda sucursal
 * - Proporcionar acciones: Ver detalles, Crear nuevo ingreso
 *
 * **Características técnicas:**
 * - Componente standalone moderno con Angular 17+
 * - Ordenamiento persistente por fecha descendente (más recientes primero)
 * - Filtrado multi-criterio: fecha (6 opciones) + búsqueda por texto
 * - Búsqueda en tiempo real: número factura, proveedor, ID personalizado, ID Firestore
 * - Análisis financiero en tiempo real: totalización + cálculo de deuda
 * - Conversión segura de Timestamps Firestore, Date Objects y strings
 *
 * **Flujo de datos:**
 * 1. ngOnInit → cargarIngresos() suscribe a Observable
 * 2. Observable emite → Normaliza totales → Ordena DESC por fecha
 * 3. cargarIngresos() → Aplica filtros → Calcula análisis financiero
 * 4. Análisis → Obtiene deuda sucursal de servicio (Promise) → Calcula pagado
 * 5. Usuario interactúa → Cambia filtro → Re-ejecuta filtrar() → Recalcula paginación
 * 6. Usuario navega páginas → Actualiza paginación → Template renderiza nueva página
 * 7. Usuario hace acción → Navega a detalles o crear nuevo ingreso
 *
 * **Integración:**
 * - Usa IngresosService para CRUD de ingresos (getIngresos retorna Observable)
 * - Usa Router para navegación SPA a detalles y crear nuevo
 * - Template: listar-ingresos.html (filtros, tabla, paginación, análisis financiero)
 *
 * **Señales modernas (Angular 17+):**
 * - No se usan en este componente (solo en formularios)
 * - Alternativa: Usar signals para estado reactivo si se refactoriza
 *
 * @component
 * @selector app-listar-ingresos
 * @standalone true
 * @imports [CommonModule, FormsModule]
 *
 * @example
 * // En routing module:
 * {
 *   path: 'ingresos',
 *   loadChildren: () => import('./modules/ingresos/ingresos.module')
 *     .then(m => m.IngresosModule)
 * }
 */
@Component({
  selector: 'app-listar-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listar-ingresos.html',
  styleUrls: ['./listar-ingresos.css'],
})
export class ListarIngresosComponent implements OnInit {
  /**
   * Referencia inyectada a Angular Router para navegación SPA.
   * @type {Router}
   * @private
   */
  private router = inject(Router);

  /**
   * Referencia inyectada a IngresosService para operaciones CRUD.
   * @type {IngresosService}
   * @private
   */
  private ingresosService = inject(IngresosService);

  /**
   * Referencia global a Number (para uso en template con ngFor).
   * @type {typeof Number}
   */
  Number = Number;

  /**
   * Referencia global a Math (para uso en template con operaciones matemáticas).
   * @type {typeof Math}
   */
  Math = Math;

  /**
   * Colección completa de ingresos cargados desde Firestore (sin filtros).
   * Se mantiene ordenada por fecha descendente.
   * @type {Ingreso[]}
   * @private Usar filtrados[] para datos filtrados
   */
  ingresos: Ingreso[] = [];

  /**
   * Resultado del filtrado actual (aplicados fecha y búsqueda de texto).
   * Se usa como fuente para paginación.
   * @type {Ingreso[]}
   * @private Usar ingresosPaginados[] para datos mostrados en UI
   */
  filtrados: Ingreso[] = [];

  /**
   * Ingresos de la página actual después de aplicar paginación.
   * Array de length <= ingresosPorPagina, vinculado al template para renderizado.
   * @type {Ingreso[]}
   * @private Vinculado al template con *ngFor="let ingreso of ingresosPaginados"
   */
  ingresosPaginados: Ingreso[] = [];

  /**
   * Suma total de todos los ingresos finalizados (análisis financiero).
   * Calculado en calcularAnalisisFinanciero(), usado en tabla resumen.
   * @type {number}
   * @default 0
   * @remarks Representa monto total facturado de proveedores
   */
  totalFacturas = 0;

  /**
   * Cantidad de dinero pagado (totalFacturas - deudaSucursal).
   * Calculado después de obtener deudaSucursal del servicio.
   * @type {number}
   * @default 0
   * @remarks Dinero que ya ha sido pagado a proveedores
   */
  totalPagado = 0;

  /**
   * Deuda actual acumulada de la sucursal con proveedores.
   * Obtenido de IngresosService.calcularDeudaSucursal() (Promise async).
   * @type {number}
   * @default 0
   * @remarks Se recalcula cada vez que se carga la lista (refrescar datos)
   */
  deudaSucursal = 0;

  /**
   * Cantidad de ingresos finalizados en la colección actual.
   * Usado para estadísticas y análisis en tabla resumen.
   * @type {number}
   * @default 0
   * @remarks Utilizado solo con fines informativos/estadísticos
   */
  countFacturas = 0;

  /**
   * Rango de fecha actual seleccionado en filtro UI.
   * Valores: TODAS (sin filtro), HOY, SEMANA, MES, ANO, ESPECIFICA (date picker)
   * @type {FiltroFecha}
   * @default 'TODAS'
   * @remarks Cambios disparan re-filtrado automático (a través de binding en template)
   */
  filtroFecha: FiltroFecha = 'TODAS';

  /**
   * Fecha específica para filtro cuando filtroFecha === 'ESPECIFICA'.
   * Formato: string ISO 8601 (de input type="date")
   * @type {string}
   * @default ''
   * @remarks Usado solo si filtroFecha === 'ESPECIFICA', ignorado en otros casos
   */
  fechaEspecifica: string = '';

  /**
   * Término de búsqueda ingresado por usuario en campo de texto.
   * Se evalúa contra: numeroFactura, proveedor, idPersonalizado, id Firestore
   * @type {string}
   * @default ''
   * @remarks Búsqueda es case-insensitive y trimmed (sin espacios extras)
   */
  term: string = '';

  /**
   * Número de página actual (1-indexed para UI).
   * @type {number}
   * @default 1
   * @remarks Convertida a offset en code: (paginaActual - 1) * ingresosPorPagina
   */
  paginaActual: number = 1;

  /**
   * Cantidad máxima de ingresos a mostrar por página.
   * @type {number}
   * @default 10
   * @remarks Este valor define el "page size" para slicing de array filtrado
   */
  ingresosPorPagina: number = 10;

  /**
   * Cantidad total de ingresos en resultado filtrado actual.
   * Se usa para validar si hay más páginas en paginaSiguiente/Anterior.
   * @type {number}
   * @default 0
   * @private Calculado automáticamente en filtrar()
   */
  totalIngresos: number = 0;

  /**
   * Hook de inicialización del ciclo de vida Angular.
   * Se ejecuta después de que Angular ha inicializado todas las propiedades.
   *
   * **Responsabilidades:**
   * - Dispara carga inicial de ingresos desde Firestore
   * - Inicia suscripciones a datos
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta automáticamente por Angular una sola vez
   * - Mejor práctica: Usar ngOnInit en lugar de constructor para operaciones async
   * - La suscripción persiste durante toda la vida del componente (sin unsubscribe)
   */
  ngOnInit() {
    this.cargarIngresos();
  }

  /**
   * Carga todos los ingresos desde Firestore y actualiza UI.
   *
   * **Flujo de carga:**
   * 1. Suscribe a IngresosService.getIngresos() Observable
   * 2. Normaliza valores numéricos (total) para evitar NaN en cálculos
   * 3. Ordena por fecha descendente (más recientes al inicio)
   * 4. Aplica filtros iniciales (TODAS las fechas, sin búsqueda)
   * 5. Calcula análisis financiero (totales, deuda sucursal)
   *
   * **Transformación de datos:**
   * - Convierte total a Number (si es string/undefined)
   * - Mantiene resto de campos sin cambios (spread operator)
   *
   * **Manejo de errores:**
   * - Log de error en consola (error silencioso para usuario)
   * - No interrumpe flujo de componente
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta en ngOnInit (carga inicial)
   * - Puede ser llamado manualmente para refrescar datos
   * - La suscripción persiste hasta que componente sea destroyed
   * - SweetAlert2 está importado pero no se usa aquí (para operaciones posteriores)
   *
   * @example
   * // Refrescar datos:
   * this.cargarIngresos(); // Recarga desde Firestore
   */
  cargarIngresos() {
    this.ingresosService.getIngresos().subscribe({
      next: (ingresos) => {
        this.ingresos = ingresos.map(i => ({
          ...i,
          total: Number(i?.total || 0)
        }));

        // Ordenar por más recientes
        this.ingresos.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

        this.filtrar();

        // Calcular análisis financiero
        this.calcularAnalisisFinanciero();
      },
      error: (err) => console.error('Error al cargar ingresos:', err),
    });
  }

  /**
   * Calcula análisis financiero completo: totales, deuda, cantidad de registros.
   *
   * **Algoritmo:**
   *
   * **Paso 1: Filtrar ingresos finalizados**
   * - Obtiene solo registros con estado === 'FINALIZADO'
   * - Los borradores no se incluyen en el análisis
   *
   * **Paso 2: Contar registros finalizados**
   * - countFacturas = cantidad de ingresos finalizados
   * - Usado para estadísticas en tabla resumen
   *
   * **Paso 3: Sumar totales**
   * - totalFacturas = suma de field 'total' de todos los finalizados
   * - Cada registro contribuye su monto total
   * - Acumulación con reduce: (sum + monto) para cada registro
   *
   * **Paso 4: Obtener deuda actual (async)**
   * - Llama IngresosService.calcularDeudaSucursal() que retorna Promise<number>
   * - deudaSucursal = dinero adeudado actualmente
   * - Operación asincrónica (puede demorar segundos)
   * - No bloquea UI (Promise, no await en método síncrono)
   *
   * **Paso 5: Calcular pagado**
   * - totalPagado = totalFacturas - deudaSucursal
   * - Dinero que ya ha sido pagado (lo contrario de lo adeudado)
   * - Se calcula dentro del .then() después de obtener deudaSucursal
   *
   * **Manejo de errores:**
   * - Promesa falla: .catch() captura error y loguea en consola
   * - No interrumpe flujo (error silencioso para usuario)
   * - Valores previos se mantienen si error ocurre
   *
   * **Performance:**
   * - O(n) para filter (iterar todos los ingresos)
   * - O(n) para reduce (iterar los finalizados)
   * - O(1) para deuda (lectura de Firestore, pero cacheada)
   * - Operación no bloquea render (async)
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta al final de cargarIngresos()
   * - Los valores calculados se usan en template para tabla resumen
   * - deudaSucursal puede no estar disponible inmediatamente (async)
   * - Template debería mostrar spinner si deudaSucursal aún cargando
   *
   * @example
   * // Resultado esperado:
   * this.countFacturas = 45 (cantidad de ingresos finalizados)
   * this.totalFacturas = 15000.50 (suma de todos los totales)
   * this.deudaSucursal = 5000.00 (deuda actual de la sucursal)
   * this.totalPagado = 10000.50 (lo que ya se pagó)
   */
  private calcularAnalisisFinanciero() {
    // Contar facturas finalizadas
    const ingresosFinalizados = this.ingresos.filter((ing: any) => ing.estado === 'FINALIZADO');
    this.countFacturas = ingresosFinalizados.length;

    // Sumar total de facturas finalizadas
    this.totalFacturas = ingresosFinalizados.reduce((sum: number, ing: any) => {
      return sum + (ing.total || 0);
    }, 0);

    // Cargar deuda actual de la sucursal
    this.ingresosService.calcularDeudaSucursal().then(deuda => {
      this.deudaSucursal = deuda;
      // Total pagado = Total facturas - Deuda actual
      this.totalPagado = this.totalFacturas - this.deudaSucursal;
    }).catch(error => {
      console.error('Error al calcular deuda de sucursal:', error);
    });
  }

  /**
   * Convierte fecha en cualquier formato a milisegundos desde epoch.
   *
   * **Soporta múltiples formatos:**
   * - Timestamp Firestore (objeto con método toDate())
   * - Date object nativo de JavaScript
   * - String ISO 8601 (Date constructor lo parsea)
   * - Number (milisegundos, asumido)
   *
   * **Algoritmo:**
   * 1. Si fecha es undefined/null → retorna 0 (valores indefinidos al final)
   * 2. Si tiene método toDate (Firestore) → llama y obtiene milisegundos
   * 3. Si es instanceof Date → obtiene milisegundos directamente
   * 4. Si es string/number → crea Date e intenta parsear
   * 5. Si parse falla (isNaN) → retorna 0 (fallback seguro)
   *
   * **Casos de uso:**
   * - Comparar fechas para ordenamiento (sort callback)
   * - Validar que fecha es válida (retorna 0 si no lo es)
   * - Normalizar diferentes tipos de input de timestamp
   *
   * @param {Ingreso} ingreso - Objeto ingreso que contiene campo "fecha"
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
   *
   * @remarks
   * - Método privado porque es implementación interna de ordenamiento
   * - El frontend no debería depender dirección de él (detalle de implementación)
   */
  private getFechaMs(ingreso: Ingreso): number {
    const v = ingreso?.fecha;
    if (!v) return 0;

    // Firestore Timestamp
    if (typeof (v as any)?.toDate === 'function') return (v as any).toDate().getTime();

    // Date
    if (v instanceof Date) return v.getTime();

    // string/number
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /**
   * Aplica filtros de fecha y búsqueda de texto a la colección de ingresos.
   *
   * **Algoritmo de filtrado (secuencial):**
   *
   * **Paso 1: Filtro por rango de fecha**
   * - Si filtroFecha === 'TODAS': Sin restricción (usa array completo)
   * - Si filtroFecha !== 'TODAS': Llama cumpleFiltroFecha() para cada ingreso
   *   • HOY: Solo ingresos del día actual (00:00:00 a 23:59:59)
   *   • SEMANA: Últimos 7 días desde hoy
   *   • MES: Último mes (30 días)
   *   • ANO: Último año (365 días)
   *   • ESPECIFICA: Fecha exacta seleccionada por usuario (si fechaEspecifica está completa)
   *
   * **Paso 2: Filtro por búsqueda de texto**
   * - Si term está vacío: Usa resultado del paso 1 sin filtro adicional
   * - Si term tiene contenido: Busca case-insensitive en 4 campos:
   *   • numeroFactura (guía de remisión/factura)
   *   • proveedor (nombre del proveedor)
   *   • idPersonalizado (ID custom del sistema)
   *   • id (ID Firestore del documento)
   * - El operador OR dice: Si coincide CUALQUIERA de estos campos, incluir ingreso
   * - Búsqueda es trimmed (sin espacios extras) y case-insensitive
   *
   * **Paso 3: Mantener ordenamiento**
   * - Reordena resultado filtrado por fecha descendente (más recientes primero)
   * - Asegura consistencia visual aunque cambien filtros
   *
   * **Paso 4: Actualizar paginación**
   * - Reestablece página actual a 1 (reinicia desde inicio)
   * - Recalcula totalIngresos con largo de resultados filtrados
   * - Llama actualizarPaginacion() para slice de página 1
   *
   * **Flujo de ejecución:**
   * filtrar() → (1) filtro fecha → (2) filtro texto → (3) re-sort → (4) reset paginación
   *
   * **Casos especiales:**
   * - Búsqueda vacía: Ignora paso 2, muestra todos del rango seleccionado
   * - Búsqueda sin resultados: totalIngresos = 0, ingresosPaginados vacío
   * - Cambio de filtro: Reseta a página 1 automáticamente
   * - Filtro ESPECIFICA sin fecha: Se ignora (vuelve a TODAS)
   *
   * **Performance:**
   * - O(n) para cada paso de filtro
   * - Búsqueda es case-insensitive y trimmed
   * - Array spread ([...]) genera copia para no mutar this.ingresos
   * - Sort es O(n log n) pero se ejecuta al final (después de filtrar)
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta en cargarIngresos() inicial y cada vez que usuario cambia filtro/búsqueda
   * - Modificables: this.filtroFecha (dropdown), this.fechaEspecifica (date picker), this.term (input text)
   * - Afecta: this.filtrados (resultado post-filtrado) y this.ingresosPaginados (UI)
   *
   * @example
   * // Usuario selecciona SEMANA y busca "Proveedor García":
   * this.filtroFecha = 'SEMANA';
   * this.term = 'García';
   * this.filtrar();
   * // Resultado: Solo ingresos últimos 7 días donde factura/proveedor/id contiene "garcía"
   */
  filtrar() {
    const t = (this.term || '').trim().toLowerCase();
    let base = [...this.ingresos];

    // 1) Filtro por fecha
    if (this.filtroFecha !== 'TODAS') {
      base = base.filter(i => this.cumpleFiltroFecha(i));
    }

    // 2) Filtro por texto (número de factura o proveedor)
    if (t) {
      base = base.filter(i =>
        (i.numeroFactura || '').toLowerCase().includes(t) ||
        (i.proveedor || '').toLowerCase().includes(t) ||
        (i.idPersonalizado || '').toLowerCase().includes(t) ||
        (i.id || '').toLowerCase().includes(t)
      );
    }

    // Mantener orden por fecha
    base.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

    this.filtrados = base;
    this.totalIngresos = base.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Valida si un ingreso cumple el filtro de fecha especificado.
   *
   * **Casos de validación:**
   *
   * **HOY:** Verificar que fecha sea de hoy (sin considerar hora)
   * - Obtiene fecha del ingreso (date object puro)
   * - Normaliza a media noche (00:00:00)
   * - Compara igualdad de timestamp con "hoy" normalizado
   * - Retorna true si el ingreso es de hoy, false en otro caso
   *
   * **SEMANA:** Ingresos dentro de últimos 7 días
   * - Calcula fecha de hace 7 días desde hoy a media noche
   * - Retorna true si fechaIngreso >= hace7Días (inclusivo)
   * - Incluye hoy y hasta 7 días atrás
   *
   * **MES:** Ingresos dentro de último mes
   * - Resta 1 mes de la fecha actual
   * - Retorna true si fechaIngreso >= hace1Mes
   * - Aproximadamente 30 días (depende de mes actual)
   *
   * **ANO:** Ingresos dentro de último año
   * - Resta 1 año de la fecha actual
   * - Retorna true si fechaIngreso >= hace1Año
   * - Aproximadamente 365 días
   *
   * **ESPECIFICA:** Fecha exacta seleccionada por usuario
   * - Si no hay fecha específica ingresada: Retorna true (sin filtro)
   * - Si hay fecha: Convierte string de input a Date (normalizado a media noche)
   * - Compara igualdad de timestamp con fecha ingreso normalizada
   * - Retorna true si fechas coinciden (sin importar hora)
   *
   * **Fallback:** Si tipo de filtro no es reconocido
   * - Retorna true (permite ingreso, sin restricción)
   *
   * **Notas técnicas:**
   * - Todas las comparaciones se normalizan a media noche (00:00:00)
   * - Esto permite comparar solo fechas, ignorando hora
   * - setHours(0, 0, 0, 0) modifica el objeto Date en lugar
   * - El timezone local afecta los cálculos (Date objeto es local aware)
   *
   * @param {Ingreso} ingreso - Ingreso a validar contra filtro de fecha
   * @returns {boolean} True si ingreso cumple el filtro, false en otro caso
   *
   * @remarks
   * - Se ejecuta dentro de filter() si this.filtroFecha !== 'TODAS'
   * - Usa getFechaDate() para obtener Date puro desde cualquier formato
   * - Si getFechaDate() retorna null: Retorna false (fecha inválida)
   * - El método es privado (implementación interna del filtrado)
   *
   * @example
   * // Hoy es 2024-01-15
   * this.filtroFecha = 'HOY';
   * // Retorna true para ingresos de 2024-01-15 (a cualquier hora)
   * // Retorna false para ingresos de 2024-01-14 o 2024-01-16
   *
   * this.filtroFecha = 'SEMANA';
   * // Retorna true para ingresos desde 2024-01-08 hasta 2024-01-15
   *
   * this.filtroFecha = 'ESPECIFICA';
   * this.fechaEspecifica = '2024-01-10';
   * // Retorna true solo para ingresos de 2024-01-10
   */
  private cumpleFiltroFecha(ingreso: Ingreso): boolean {
    const fechaIngreso = this.getFechaDate(ingreso.fecha);
    if (!fechaIngreso) return false;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    switch (this.filtroFecha) {
      case 'HOY':
        const ingresoDay = new Date(fechaIngreso);
        ingresoDay.setHours(0, 0, 0, 0);
        return ingresoDay.getTime() === hoy.getTime();

      case 'SEMANA':
        const semanaAtras = new Date(hoy);
        semanaAtras.setDate(semanaAtras.getDate() - 7);
        return fechaIngreso >= semanaAtras;

      case 'MES':
        const mesAtras = new Date(hoy);
        mesAtras.setMonth(mesAtras.getMonth() - 1);
        return fechaIngreso >= mesAtras;

      case 'ANO':
        const anoAtras = new Date(hoy);
        anoAtras.setFullYear(anoAtras.getFullYear() - 1);
        return fechaIngreso >= anoAtras;

      case 'ESPECIFICA':
        if (!this.fechaEspecifica) return true;
        const especifica = new Date(this.fechaEspecifica);
        especifica.setHours(0, 0, 0, 0);
        const ingresoDate = new Date(fechaIngreso);
        ingresoDate.setHours(0, 0, 0, 0);
        return ingresoDate.getTime() === especifica.getTime();

      default:
        return true;
    }
  }

  /**
   * Calcula el total de dinero de todos los ingresos filtrados.
   *
   * **Algoritmo:**
   * - Itera sobre this.filtrados[] (resultado post-filtrado)
   * - Suma el campo 'total' de cada ingreso
   * - Convierte a Number para garantizar aritmética correcta
   * - Si total es undefined: Usa 0 como fallback
   * - Acumula en sum usando reduce
   * - Retorna suma total
   *
   * **Casos especiales:**
   * - Array vacío: Retorna 0 (reduce con valor inicial 0)
   * - Algunos ingresos sin total: Se asumen como 0
   * - Valores negativos: Se incluyen en la suma (posibles devoluciones)
   *
   * **Performance:**
   * - O(n) donde n = cantidad de ingresos filtrados
   * - Operación rápida incluso con miles de registros
   * - No modifica estado (read-only sobre filtrados[])
   *
   * @returns {number} Suma total de field 'total' de ingresos filtrados
   *          Retorna 0 si no hay ingresos o todos están vacíos
   *
   * @remarks
   * - Se ejecuta en template cuando se necesita mostrar total
   * - Usa Number() para normalizar tipos (protección defensiva)
   * - El '|| 0' proporciona fallback si total es undefined/null/NaN
   *
   * @example
   * this.filtrados = [
   *   {total: 100.50},
   *   {total: 200.00},
   *   {total: '150.25'} // String será convertido a Number
   * ]
   * this.obtenerTotalDeuda() // → 450.75
   */
  obtenerTotalDeuda(): number {
    return this.filtrados.reduce((sum, ingreso) => {
      return sum + (Number(ingreso.total) || 0);
    }, 0);
  }

  /**
   * Convierte fecha en cualquier formato a Date object puro.
   *
   * **Soporta múltiples formatos:**
   * - Timestamp Firestore (objeto con método toDate())
   * - Date object nativo de JavaScript
   * - String ISO 8601 (Date constructor lo parsea)
   * - Number (milisegundos, asumido)
   *
   * **Algoritmo:**
   * 1. Si fecha es undefined/null → retorna null (valor inválido)
   * 2. Si tiene método toDate (Firestore) → llama y retorna Date
   * 3. Si es instanceof Date → retorna como está
   * 4. Si es string/number → crea Date e intenta parsear
   * 5. Si parse falla (isNaN) → retorna null (fallback indicando error)
   *
   * **Casos de uso:**
   * - Obtener Date puro para manipulaciones (normalizar, restar, etc)
   * - Validar que fecha es válida (retorna null si no lo es)
   * - Comparar fechas (Date objects son comparables)
   *
   * **Diferencia con getFechaMs():**
   * - getFechaMs() retorna milisegundos (number)
   * - getFechaDate() retorna Date object
   * - Usa getFechaDate() cuando necesitas manipulaciones de fecha
   * - Usa getFechaMs() cuando necesitas comparaciones numéricas
   *
   * @param {any} fecha - Timestamp en cualquier formato válido
   * @returns {Date | null} Date object si parsing exitoso, null si falla
   *          Nunca retorna Date inválida (getTime() sería NaN)
   *
   * @example
   * this.getFechaDate(firestore.Timestamp.now()) // → Date object
   * this.getFechaDate(new Date()) // → Date object (mismo objeto)
   * this.getFechaDate('2024-01-15T10:30:00Z') // → Date object
   * this.getFechaDate('2024-01-15') // → Date object (00:00:00)
   * this.getFechaDate(undefined) // → null
   * this.getFechaDate('invalid') // → null
   *
   * @private
   *
   * @remarks
   * - Método privado porque es utilidad interna del componente
   * - Retorna null (no 0 o fecha por defecto) para fallos
   * - Permite al código diferenciar "inválido" de "epoch"
   */
  private getFechaDate(fecha: any): Date | null {
    if (!fecha) return null;

    // Firestore Timestamp
    if (typeof fecha?.toDate === 'function') return fecha.toDate();

    // Date
    if (fecha instanceof Date) return fecha;

    // string/number
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Actualiza el slice de ingresos mostrados en la página actual.
   *
   * **Algoritmo:**
   * 1. Calcula índice inicial: (paginaActual - 1) * ingresosPorPagina
   *    Ejemplo: página 2 → (2-1)*10 = 10 (comienza en índice 10)
   * 2. Calcula índice final: inicio + ingresosPorPagina
   *    Ejemplo: página 2 → 10+10 = 20 (termina antes de índice 20)
   * 3. Usa slice() para extraer subarray [inicio, fin)
   * 4. Envuelve en [...] para crear nueva referencia (Angular change detection)
   *
   * **Casos especiales:**
   * - Última página incompleta: slice retorna lo que queda (< ingresosPorPagina items)
   * - Página vacía: Retorna array vacío (resultado de filtrado sin coincidencias)
   * - Primera página: inicio = 0, fin = ingresosPorPagina (10 items típicamente)
   *
   * **Performance:**
   * - O(k) donde k = ingresosPorPagina (copia solo items de página actual)
   * - No modifica this.filtrados (lee-only)
   * - Operación muy rápida incluso con miles de ingresos en filtrados[]
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta automáticamente en filtrar() y en paginaSiguiente/Anterior()
   * - Modifica: this.ingresosPaginados (vinculado al template)
   * - Lee: this.paginaActual, this.filtrados (input)
   * - Resultado: Array de length [0, ingresosPorPagina] máximo
   *
   * @example
   * // Página 1: índices 0-9
   * this.paginaActual = 1;
   * this.actualizarPaginacion();
   * // ingresosPaginados = filtrados.slice(0, 10)
   *
   * // Página 3: índices 20-29
   * this.paginaActual = 3;
   * this.actualizarPaginacion();
   * // ingresosPaginados = filtrados.slice(20, 30)
   */
  actualizarPaginacion(): void {
    const inicio = (this.paginaActual - 1) * this.ingresosPorPagina;
    const fin = inicio + this.ingresosPorPagina;
    this.ingresosPaginados = [...this.filtrados.slice(inicio, fin)];
  }

  /**
   * Navega a la siguiente página de resultados (si existe).
   *
   * **Validación:**
   * - Verifica que paginaActual * ingresosPorPagina < totalIngresos
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
   * - Búsqueda sin resultados: Botón deshabilitado (totalIngresos = 0)
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Siguiente" (ngClick handler)
   * - Modifica: this.paginaActual, this.ingresosPaginados
   * - Valida: totalIngresos vs índice actual
   * - Responsabilidad del template: Deshabilitar botón cuando !puedeIrAlaSiguiente()
   *
   * @example
   * // Usuario en página 1 de 5:
   * this.paginaActual = 1;
   * this.totalIngresos = 45;
   * this.paginaSiguiente();
   * // Resultado: paginaActual = 2, ingresosPaginados = slice [10,20]
   *
   * // Usuario en página 5 de 5:
   * this.paginaActual = 5;
   * this.totalIngresos = 45;
   * this.paginaSiguiente();
   * // No hace nada (5*10=50 no < 45)
   */
  paginaSiguiente(): void {
    if (this.paginaActual * this.ingresosPorPagina < this.totalIngresos) {
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
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Anterior" (ngClick handler)
   * - Modifica: this.paginaActual, this.ingresosPaginados
   * - Valida: paginaActual > 1
   * - Responsabilidad del template: Deshabilitar botón cuando !puedeIrAlAnterior()
   *
   * @example
   * // Usuario en página 3 de 5:
   * this.paginaActual = 3;
   * this.paginaAnterior();
   * // Resultado: paginaActual = 2, ingresosPaginados = slice [10,20]
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
   * Navega a la página de creación de nuevo ingreso.
   *
   * **Ruta destino:** /ingresos/nuevo
   *
   * **Flujo:**
   * 1. Usuario hace clic en botón "Nuevo Ingreso"
   * 2. router.navigate() a ruta /ingresos/nuevo
   * 3. CrearIngresoComponent se carga
   * 4. Usuario completa formulario de ingreso con factura y productos
   * 5. Después de guardar, navega de vuelta a /ingresos (listado)
   *
   * **Integración con template:**
   * - Se llama con (ngClick)="nuevoIngreso()" en botón de acción
   * - Típicamente al inicio de la página o en toolbar
   *
   * **Notas técnicas:**
   * - router.navigate() es SPA (no recarga página)
   * - Mantiene estado de app pero limpia componente anterior
   * - Historia de navegación se agrega al browser stack
   *
   * @returns {void} (Promesa resuelta pero no awaiteada)
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en botón "Nuevo Ingreso"
   * - Usa inyección de Router en constructor
   * - Responsabilidad del template: Proporcionar botón clickeable
   *
   * @example
   * // Template:
   * // <button (ngClick)="nuevoIngreso()" class="btn btn-primary">
   * //   Nuevo Ingreso
   * // </button>
   *
   * // Cuando usuario hace clic:
   * this.nuevoIngreso();
   * // Navega a /ingresos/nuevo
   * // CrearIngresoComponent se carga
   */
  nuevoIngreso() {
    this.router.navigate(['/ingresos/nuevo']);
  }

  /**
   * Navega a la vista de detalles de un ingreso específico.
   *
   * **Ruta destino:** /ingresos/ver/:id
   *
   * **Parámetro:**
   * - id (string): ID Firestore del documento de ingreso a visualizar
   *
   * **Flujo:**
   * 1. Obtiene el ID de ingreso desde parámetro de método
   * 2. Llama router.navigate() con ruta parametrizada
   * 3. Componente VerIngresoComponent se carga y obtiene ID de route.params
   * 4. VerIngresoComponent carga detalles y productos del ingreso
   *
   * **Integración con template:**
   * - Se llama con (ngClick)="verIngreso(ingreso)" en tabla de ingresos
   * - Cada fila es clickeable y navega a detalles de ese ingreso
   * - También se puede usar en botón de acción dentro de fila
   *
   * **Validación:**
   * - Verifica que ingreso.id exista antes de navegar
   * - Si id es undefined: No navega (previene error de ruta inválida)
   *
   * **Notas técnicas:**
   * - router.navigate() es SPA (no recarga página)
   * - Mantiene estado pero limpia componente anterior
   * - Historia de navegación permite volver con back button
   *
   * @param {Ingreso} ingreso - Objeto ingreso a visualizar detalles
   * @returns {void} (Promesa resuelta pero no awaiteada)
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en ingreso de tabla
   * - Valida que ingreso.id exista (seguridad)
   * - Responsabilidad del template: Proporcionar ingreso completo en ngClick
   *
   * @example
   * // Template:
   * // <tr (ngClick)="verIngreso(ingreso)">
   * //   <td>{{ ingreso.proveedor }}</td>
   * //   <td>{{ ingreso.numeroFactura }}</td>
   * // </tr>
   *
   * // Cuando usuario hace clic:
   * this.verIngreso({id: 'abc123xyz', proveedor: 'Proveedor A', ...});
   * // Navega a /ingresos/ver/abc123xyz
   * // VerIngresoComponent se carga
   */
  verIngreso(ingreso: Ingreso) {
    if (ingreso.id) {
      this.router.navigate(['/ingresos/ver', ingreso.id]);
    }
  }

  /**
   * Formatea una fecha en cualquier formato a string legible.
   *
   * **Formato de salida:** DD/MM/YYYY
   * - Ejemplo: "15/01/2024"
   * - Siempre 2 dígitos para día y mes (zero-padded)
   * - Año completo de 4 dígitos
   *
   * **Algoritmo:**
   * 1. Convierte fecha a Date puro usando getFechaDate()
   * 2. Si getFechaDate() retorna null: Retorna '-' (fecha inválida)
   * 3. Extrae componentes: día, mes, año
   * 4. Aplica padStart(2, '0') para zero-padding
   *   • "1" → "01"
   *   • "12" → "12"
   * 5. Concatena con formato: DD/MM/YYYY
   *
   * **Casos especiales:**
   * - Fecha undefined/null: Retorna '-' (marcador de inválido)
   * - Fecha string inválida: Retorna '-' (getFechaDate() maneja)
   * - Dates cercanas a midnight: Manejo correcto (Date object es timezone-aware)
   *
   * **Performance:**
   * - O(1) (operaciones simples de string)
   * - Operación rápida
   *
   * @param {any} fecha - Fecha en cualquier formato válido
   * @returns {string} String formateado DD/MM/YYYY o '-' si fecha inválida
   *
   * @remarks
   * - Se ejecuta en template: {{ formatearFecha(ingreso.fecha) }}
   * - Alternativa: Usar Pipe personalizado o Angular date pipe
   * - Angular date pipe: {{ ingreso.fecha | date:'dd/MM/yyyy' }} (más eficiente)
   * - Este método es útil si se necesita lógica adicional
   *
   * @example
   * this.formatearFecha(new Date('2024-01-15')) // → "15/01/2024"
   * this.formatearFecha('2024-01-05') // → "05/01/2024"
   * this.formatearFecha(undefined) // → "-"
   * this.formatearFecha('invalid') // → "-"
   */
  formatearFecha(fecha: any): string {
    const d = this.getFechaDate(fecha);
    if (!d) return '-';

    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();

    return `${dia}/${mes}/${ano}`;
  }
}
