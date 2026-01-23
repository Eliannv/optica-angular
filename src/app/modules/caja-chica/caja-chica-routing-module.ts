/**
 * Módulo de enrutamiento para la funcionalidad de Caja Chica.
 *
 * Define todas las rutas disponibles dentro del módulo de cajas chicas.
 * Este módulo es importado por CajaChicaModule y exporta las rutas definidas.
 *
 * Rutas definidas:
 * - '' (raíz): ListarCajasComponent
 *   Muestra el dashboard con lista de todas las cajas (filtrable)
 *   Ruta completa: /caja-chica
 *
 * - 'nueva': AbrirCajaComponent
 *   Formulario para crear una nueva caja chica
 *   Ruta completa: /caja-chica/nueva
 *
 * - 'ver/:id': VerCajaComponent
 *   Vista detallada de una caja específica con movimientos
 *   Parámetro: id = ID de Firestore de la caja
 *   Ruta completa: /caja-chica/ver/{cajaId}
 *
 * - 'registrar/:id': RegistrarMovimientoComponent
 *   Formulario para registrar movimiento en una caja
 *   Parámetro: id = ID de Firestore de la caja
 *   Ruta completa: /caja-chica/registrar/{cajaId}
 *
 * Integración con AppRoutes:
 * En src/app/app.routes.ts se define lazy loading:
 * {
 *   path: 'caja-chica',
 *   loadChildren: () => import('./modules/caja-chica/caja-chica-routing-module').then(m => m.CajaChicaRoutingModule)
 * }
 *
 * @module CajaChicaRoutingModule
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';
import { AbrirCajaComponent } from './pages/abrir-caja/abrir-caja';

/**
 * Array de rutas para el módulo Caja Chica.
 *
 * Mapeo de rutas a componentes:
 * - Ruta vacía → ListarCajasComponent (página de inicio del módulo)
 * - 'nueva' → AbrirCajaComponent (creación de caja)
 * - 'ver/:id' → VerCajaComponent (detalles de caja)
 * - 'registrar/:id' → RegistrarMovimientoComponent (registro de movimiento)
 *
 * Guard/Protección:
 * Actualmente no hay guards específicos definidos en estas rutas.
 * Se pueden agregar canActivate/canDeactivate si es necesario en el futuro
 * (ej: auth guard, unsaved changes guard para formularios).
 *
 * Parámetros dinámicos:
 * - :id = Identificador de documento Firestore de la caja chica
 *   Se extrae en componentes via ActivatedRoute.snapshot.paramMap.get('id')
 */
const routes: Routes = [
  { path: '', component: ListarCajasComponent },
  { path: 'nueva', component: AbrirCajaComponent },
  { path: 'ver/:id', component: VerCajaComponent },
  { path: 'registrar/:id', component: RegistrarMovimientoComponent },
];

/**
 * Clase decoradora del módulo de enrutamiento de Caja Chica.
 *
 * Responsabilidades:
 * - Registrar las rutas del módulo usando RouterModule.forChild()
 * - Exportar RouterModule para que componentes padres puedan usarlo
 *
 * Diferencia de forChild vs forRoot:
 * - forRoot(): Se usa una sola vez en la app raíz (en app.config.ts)
 * - forChild(): Se usa en módulos lazy-loaded como este
 *
 * Exportaciones:
 * - RouterModule: Necesario para que el módulo padres tenga acceso a directivas
   * como [routerLink], routerLinkActive, etc.
 *
 * @class CajaChicaRoutingModule
 * @NgModule configuration object
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaChicaRoutingModule { }
