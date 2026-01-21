import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';
import { ImprimirCajaBancoComponent } from './pages/imprimir-caja-banco/imprimir-caja-banco';
import { ImprimirCajaBancoMensualComponent } from './pages/imprimir-caja-banco-mensual/imprimir-caja-banco-mensual';

const routes: Routes = [
  { path: '', component: ListarCajasComponent },
  { path: ':id/ver', component: VerCajaComponent },
  { path: 'registrar-movimiento', component: RegistrarMovimientoComponent },
  { path: 'imprimir/:id', component: ImprimirCajaBancoComponent },
  { path: 'imprimir-mensual/:year/:month', component: ImprimirCajaBancoMensualComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaBancoRoutingModule { }
