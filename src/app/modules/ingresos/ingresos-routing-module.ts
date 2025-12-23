import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarIngresosComponent } from './pages/listar-ingresos/listar-ingresos';
import { CrearIngresoComponent } from './pages/crear-ingreso/crear-ingreso';
import { VerIngresoComponent } from './pages/ver-ingreso/ver-ingreso';

const routes: Routes = [
  { path: '', component: ListarIngresosComponent },
  { path: 'nuevo', component: CrearIngresoComponent },
  { path: 'ver/:id', component: VerIngresoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IngresosRoutingModule { }
