import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ListarClientes } from './pages/listar-clientes/listar-clientes';
import { CrearCliente } from './pages/crear-cliente/crear-cliente';
import { CrearHistorialClinicoComponent } from './pages/crear-historial-clinico/crear-historial-clinico';

const routes: Routes = [
  { path: '', component: ListarClientes },
  { path: 'crear', component: CrearCliente },
  { path: ':id/crear-historial-clinico', component: CrearHistorialClinicoComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientesRoutingModule {}
