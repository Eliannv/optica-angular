import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FacturasRoutingModule } from './facturas-routing-module';

/**
 * Módulo FacturaModule - Gestión y visualización de facturas.
 *
 * **Responsabilidades:**
 * - Agrupar componentes relacionados con facturas (lazy-loaded)
 * - Proporcionar enrutamiento interno (facturas-routing-module)
 * - Encapsular funcionalidad de facturas del resto de la aplicación
 *
 * **Componentes incluidos (via lazy loading):**
 * - ListarFacturasComponent: Listado paginado y filtrable de facturas
 * - VerFacturaComponent: Detalles de factura individual + impresión
 *
 * **Servicios:**
 * - FacturasService: CRUD para facturas en Firestore
 * - ProductosService: Búsqueda de productos (enriquecimiento de códigos)
 * - Proporcionados a nivel app (app.config.ts), compartidos con otros módulos
 *
 * **Integración en app:**
 * - Lazy-loaded desde app.routes.ts: `loadChildren: () => import('./modules/factura/factura.module')`
 * - Ruta base: /facturas
 * - Rutas internas:
 *   • /facturas → ListarFacturasComponent (listado)
 *   • /facturas/:id → VerFacturaComponent (detalles)
 *
 * **Patrón arquitectónico:**
 * - Módulo lazy-loaded (no cargado al inicio de aplicación)
 * - Componentes standalone modernos (no necesitan declaración en módulo)
 * - Enrutamiento encapsulado (FacturasRoutingModule)
 * - Separación de concerns: Facturas es independiente de otros módulos
 *
 * **Importaciones:**
 * - CommonModule: Directivas básicas (ngIf, ngFor, ngClass, etc)
 * - FacturasRoutingModule: Configuración de rutas internas (forChild pattern)
 *
 * **Declaraciones:**
 * - Vacías: Componentes son standalone, no necesitan declaración
 * - Componentes se registran en rutas (FacturasRoutingModule) en su lugar
 *
 * **Notas técnicas:**
 * - Angular 17+: Componentes standalone reducen necesidad de módulos
 * - Módulo se mantiene para lazy loading y enrutamiento encapsulado
 * - forChild pattern: FacturasRoutingModule usa RouterModule.forChild()
 * - forRoot está en app.config.ts (RouterModule.forRoot en provideRouter)
 *
 * **Ciclo de vida del módulo:**
 * 1. App inicia sin cargar este módulo (lazy)
 * 2. Usuario navega a /facturas
 * 3. Angular lazy-loads el módulo: import('./modules/factura/factura.module')
 * 4. FacturaModule se instancia
 * 5. FacturasRoutingModule se configura (RouterModule.forChild)
 * 6. Rutas se registran en router principal
 * 7. ListarFacturasComponent o VerFacturaComponent se carga según ruta
   *
 * **Performance impact:**
 * - Lazy loading: Módulo no se descarga hasta que se necesita
 * - Reduces initial bundle size (app.js más pequeño)
 * - Lazy route matching es overhead mínimo
 * - Total time to interactive (TTI) mejora
 *
 * @module FacturaModule
 * @imports [CommonModule, FacturasRoutingModule]
 * @declarations []
 *
 * @example
 * // En app.routes.ts:
 * {
 *   path: 'facturas',
 *   loadChildren: () => import('./modules/factura/factura.module')
 *     .then(m => m.FacturaModule),
 *   data: { title: 'Facturas' }
 * }
 */
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FacturasRoutingModule
  ]
})
export class FacturaModule { }
