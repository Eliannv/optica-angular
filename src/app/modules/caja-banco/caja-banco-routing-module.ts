/**
 * Configuración de rutas del módulo Caja Banco.
 *
 * Define las rutas de navegación para:
 * - Listar cajas banco
 * - Ver detalle de caja específica
 * - Registrar movimientos financieros
 *
 * @module CajaBancoRoutingModule
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';

/**
 * Rutas disponibles bajo el prefijo de caja-banco.
 *
 * @constant routes
 * @type {Routes}
 */
const routes: Routes = [
  { path: '', component: ListarCajasComponent },
  { path: ':id/ver', component: VerCajaComponent },
  { path: 'registrar-movimiento', component: RegistrarMovimientoComponent }
];

/**
 * Módulo de enrutamiento para la funcionalidad de Caja Banco.
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaBancoRoutingModule {}
