import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarFacturasComponent } from './pages/listar-facturas/listar-facturas';
import { VerFacturaComponent } from './pages/ver-factura/ver-factura';


const routes: Routes = [
  { path: '', component: ListarFacturasComponent },
  { path: ':id', component: VerFacturaComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FacturasRoutingModule {}
