import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CrearVentaComponent } from './crear-venta/crear-venta';

const routes: Routes = [
  { path: 'crear', component: CrearVentaComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VentasRoutingModule {}
