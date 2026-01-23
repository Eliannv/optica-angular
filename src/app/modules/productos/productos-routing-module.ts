import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarProductos } from './pages/listar-productos/listar-productos';
import { AgregarProductosIngresoComponent } from './pages/agregar-productos-ingreso/agregar-productos-ingreso';
import { ImportarProductosComponent } from './pages/importar-productos/importar-productos';

const routes: Routes = [
  { path: '', component: ListarProductos },
  { path: 'importar', component: ImportarProductosComponent },
  { path: 'ingreso/:id/agregar-productos', component: AgregarProductosIngresoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductosRoutingModule { }
