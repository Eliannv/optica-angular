import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarFacturasComponent } from './pages/listar-facturas/listar-facturas';
import { VerFacturaComponent } from './pages/ver-factura/ver-factura';

/**
 * Configuración de rutas para el módulo de Facturas.
 *
 * **Rutas definidas:**
 *
 * 1. Ruta raíz (path: '')
 *    - Componente: ListarFacturasComponent
 *    - URL completa: /facturas
 *    - Propósito: Mostrar listado paginado y filtrable de todas las facturas
 *    - Features:
 *      • Filtrado por estado: TODAS, PENDIENTES, PAGADAS
 *      • Búsqueda en tiempo real: cliente, método pago, ID
 *      • Paginación: 10 facturas por página
 *      • Acciones: Ver detalles, Cobrar deuda, Nueva venta
 *
 * 2. Ruta parametrizada (path: ':id')
 *    - Componente: VerFacturaComponent
 *    - URL completa: /facturas/:id (ejemplo: /facturas/abc123xyz)
 *    - Parámetro: id (string) - ID Firestore del documento de factura
 *    - Propósito: Mostrar detalles completos de una factura específica
 *    - Features:
 *      • Carga desde Firestore por ID
 *      • Impresión de ticket POS (80mm)
 *      • Enriquecimiento de códigos de producto
 *      • Navegación de vuelta a listado
 *
 * **Patrón de enrutamiento:**
 * - RouterModule.forChild(routes): Pattern para módulos lazy-loaded
 * - forChild: Registra rutas como sub-rutas (relativas a ruta padre)
 * - forRoot: Se usa en app.config.ts (para rutas globales)
 * - Diferencia: forChild no redefine router (evita conflictos)
 *
 * **Integración:**
 * - Exporta RouterModule para que módulo padre pueda usarlo
 * - Imports: [RouterModule.forChild(routes)] registra rutas
 * - Exports: [RouterModule] permite que módulo padre importe
 *
 * **Flujo de navegación:**
 * 1. Usuario en /facturas → ListarFacturasComponent
 * 2. Usuario hace clic en una factura → Navigate a /facturas/:id
 * 3. VerFacturaComponent se carga con ID como parámetro
 * 4. Usuario hace clic "Volver" → Navigate a /facturas
 * 5. ListarFacturasComponent se restaura (o recarga)
 *
 * **Data sharing:**
 * - No se define data adicional (title, guards, etc)
 * - Componentes obtienen ID de route.snapshot.paramMap.get('id')
 * - Ruta no tiene guardias de activación (acceso libre)
 *
 * **Performance:**
 * - forChild es más eficiente que forRoot (solo registra sub-rutas)
 * - Lazy loading del módulo reduce inicial bundle
 * - Rutas son inmediatas (no async resolvers)
 *
 * **Casos especiales:**
 * - ID inválido: VerFacturaComponent maneja gracefully (loading spinner)
 * - Ruta no encontrada: Usa wildcard routing de app.routes.ts
 * - Navegación hacia atrás: Browser back button funciona automáticamente
 *
 * **Mejoras futuras:**
 * - Agregar canActivate guard: CanActivateFn para proteger rutas
 * - Agregar data: { title: 'Facturas', icon: 'receipt' }
 * - Agregar resolver: Precargar factura antes de componente
 * - Agregar canDeactivate: Confirmar si tiene cambios sin guardar
 *
 * @const routes Configuración de rutas para el módulo de facturas
 * @type {Routes}
 * @length 2
 *
 * @example
 * // Rutas que se generan:
 * // GET /facturas
 * //   → ListarFacturasComponent (listado)
 * //
 * // GET /facturas/abc123xyz
 * //   → VerFacturaComponent (detalles de factura con ID abc123xyz)
 *
 * @remarks
 * - forChild se usa porque módulo es lazy-loaded (sub-módulo)
 * - Routes son tipo Angular (no son Express routes)
 * - Componentes son standalone (no requieren declaración en módulo)
 * - Parámetro :id es requerido (no es opcional)
 */
const routes: Routes = [
  { path: '', component: ListarFacturasComponent },
  { path: ':id', component: VerFacturaComponent }
];

/**
 * FacturasRoutingModule - Enrutador encapsulado para el módulo de Facturas.
 *
 * **Responsabilidades:**
 * - Definir rutas internas del módulo de facturas
 * - Usar patrón forChild (lazy-loaded module pattern)
 * - Exportar RouterModule para que pueda ser importado por FacturaModule
 *
 * **Configuración:**
 * - Imports: [RouterModule.forChild(routes)]
 *   • forChild registra las rutas de este módulo como sub-rutas
 *   • No redefine el router global (evita conflictos)
 * - Exports: [RouterModule]
 *   • Permite que otros módulos accedan a RouterModule (reutilización)
 *   • FacturaModule importa este módulo, no necesita importar RouterModule directamente
 *
 * **Patrón lazy-loaded:**
 * ```
 * app.routes.ts:
 *   { path: 'facturas', loadChildren: () => import('./modules/factura/factura.module') }
 *        ↓
 * factura.module.ts:
 *   imports: [FacturasRoutingModule]
 *        ↓
 * facturas-routing-module.ts:
 *   RouterModule.forChild(routes)  ← Sub-rutas relativas a /facturas
 * ```
 *
 * **Ventajas del patrón:**
 * - Modularidad: Rutas encapsuladas en su módulo
 * - Escalabilidad: Cada módulo tiene su propio router
 * - Lazy loading: Rutas se cargan solo cuando necesario
 * - Mantenibilidad: Fácil encontrar rutas en su módulo
 *
 * **Diferencia forChild vs forRoot:**
 * - forRoot: Configura el router global (solo en root module, app.config.ts)
 * - forChild: Registra sub-rutas para lazy-loaded modules
 * - Usar forChild en módulos = mejor práctica
 * - Usar forRoot en app.config.ts = requerido
 *
 * **Ciclo de vida:**
 * 1. App inicia con app.config.ts (Router.forRoot)
 * 2. Usuario navega a /facturas
 * 3. Angular lazy-loads FacturaModule
 * 4. FacturaModule instancia FacturasRoutingModule
 * 5. RouterModule.forChild(routes) registra /facturas y /facturas/:id
 * 6. Componente se carga según ruta
 *
 * @class FacturasRoutingModule
 * @imports [RouterModule.forChild(routes)]
 * @exports [RouterModule]
 *
 * @remarks
 * - Es un módulo de enrutamiento puro (solo configura router)
 * - No declara ni exporta componentes (los importa FacturaModule)
 * - Sigue convención Angular de módulos de routing: *-routing.module.ts
 * - Debe ser importado por FacturaModule
 *
 * @example
 * // En factura.module.ts:
 * @NgModule({
 *   imports: [CommonModule, FacturasRoutingModule]
 * })
 * export class FacturaModule { }
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FacturasRoutingModule {}
