import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

/**
 * Configuración de rutas del módulo de Informes.
 * 
 * Define las rutas disponibles para los diferentes tipos de informes:
 * - /informes/cobros-cliente - Informe de cobros realizados a clientes
 * - (Futuro) /informes/egreso-mercaderia - Informe de egresos de mercadería
 * - (Futuro) Otros informes según necesidades del negocio
 */
const routes: Routes = [
  {
    path: '',
    redirectTo: 'cobros-cliente',
    pathMatch: 'full'
  },
  {
    path: 'cobros-cliente',
    loadComponent: () =>
      import('./pages/cobros-cliente/cobros-cliente')
        .then(m => m.CobrosClienteComponent)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InformesRoutingModule { }
