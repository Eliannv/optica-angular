import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';

const routes: Routes = [
  { path: '', component: ListarCajasComponent },
  { path: ':id/ver', component: VerCajaComponent },
  { path: 'registrar-movimiento', component: RegistrarMovimientoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaBancoRoutingModule { }
