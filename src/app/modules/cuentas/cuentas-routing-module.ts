/**
 * Configuración de rutas del módulo de Cuentas.
 *
 * Define las rutas disponibles dentro del módulo:
 * - /cuentas/pagar - Gestión de cuentas por pagar
 * - /cuentas/cobrar - Gestión de cuentas por cobrar
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'pagar',
    pathMatch: 'full'
  },
  {
    path: 'pagar',
    loadComponent: () =>
      import('./pages/cuentas-por-pagar/cuentas-por-pagar')
        .then(m => m.CuentasPorPagarComponent)
  },
  {
    path: 'cobrar',
    loadComponent: () =>
      import('./pages/cuentas-por-cobrar/cuentas-por-cobrar')
        .then(m => m.CuentasPorCobrarComponent)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CuentasRoutingModule { }
