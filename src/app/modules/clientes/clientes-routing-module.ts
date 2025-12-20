import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CrearCliente } from './pages/crear-cliente/crear-cliente';
import { CrearHistorialClinicoComponent } from './pages/crear-historial-clinico/crear-historial-clinico';
import { HistorialClinicoComponent } from './pages/historial-clinico/historial-clinico';
// ✅ NUEVO: pantalla de entrada (buscar/seleccionar/crear cliente)

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
