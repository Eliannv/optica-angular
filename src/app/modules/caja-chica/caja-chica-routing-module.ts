import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';
import { AbrirCajaComponent } from './pages/abrir-caja/abrir-caja';
import { ImprimirCajaChicaComponent } from './pages/imprimir-caja-chica/imprimir-caja-chica';

const routes: Routes = [
  { path: '', component: ListarCajasComponent },
  { path: 'nueva', component: AbrirCajaComponent },
  { path: 'ver/:id', component: VerCajaComponent },
  { path: 'registrar/:id', component: RegistrarMovimientoComponent },
  { path: 'imprimir', component: ImprimirCajaChicaComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaChicaRoutingModule { }
