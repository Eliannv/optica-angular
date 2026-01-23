/**
 * Módulo de enrutamiento para el módulo de clientes.
 *
 * Define las rutas y navegación dentro del módulo de clientes, incluyendo:
 * - Lista de historiales clínicos (ruta por defecto)
 * - Creación de nuevos clientes
 * - Creación/edición de historiales clínicos
 *
 * Todas las rutas utilizan componentes standalone para aprovechar las ventajas
 * de modularidad y tree-shaking de Angular.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CrearCliente } from './pages/crear-cliente/crear-cliente';
import { CrearHistorialClinicoComponent } from './pages/crear-historial-clinico/crear-historial-clinico';
import { HistorialClinicoComponent } from './pages/historial-clinico/historial-clinico';

const routes: Routes = [
  { path: '', redirectTo: 'historial-clinico', pathMatch: 'full' },
  { path: 'historial-clinico', component: HistorialClinicoComponent },
  { path: 'crear', component: CrearCliente },
  { path: ':id/crear-historial-clinico', component: CrearHistorialClinicoComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientesRoutingModule {}
