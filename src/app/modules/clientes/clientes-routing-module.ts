/**
 * Módulo de enrutamiento para el módulo de clientes.
 *
 * Define las rutas y navegación dentro del módulo de clientes, incluyendo:
 * - Lista de historiales clínicos (ruta por defecto)
 * - Creación de nuevos clientes
 * - Selección/visualización de historiales clínicos de un cliente (✅ NUEVO)
 * - Creación/edición de historiales clínicos
 *
 * ✅ NUEVO FLUJO: Los usuarios ahora seleccionan historiales desde una vista intermedia
 * antes de crear ventas, permitiendo múltiples historiales por cliente.
 *
 * Todas las rutas utilizan componentes standalone para aprovechar las ventajas
 * de modularidad y tree-shaking de Angular.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CrearCliente } from './pages/crear-cliente/crear-cliente';
import { CrearHistorialClinicoComponent } from './pages/crear-historial-clinico/crear-historial-clinico';
import { HistorialClinicoComponent } from './pages/historial-clinico/historial-clinico';
import { SeleccionarHistorialComponent } from './pages/seleccionar-historial/seleccionar-historial';

const routes: Routes = [
  { path: '', redirectTo: 'historial-clinico', pathMatch: 'full' },
  { path: 'historial-clinico', component: HistorialClinicoComponent },
  { path: 'historial', redirectTo: 'historial-clinico', pathMatch: 'full' }, // Alias
  { path: 'crear', component: CrearCliente },
  { 
    path: 'historiales', 
    component: SeleccionarHistorialComponent 
  }, // ✅ NUEVO: Lista de historiales de un cliente
  { 
    path: 'crear-historial', 
    component: CrearHistorialClinicoComponent 
  }, // ✅ ACTUALIZADO: Ruta simplificada
  { 
    path: ':id/crear-historial-clinico', 
    component: CrearHistorialClinicoComponent 
  } // Mantener por compatibilidad
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientesRoutingModule {}
