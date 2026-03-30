import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarProductos } from './pages/listar-productos/listar-productos';
import { AgregarProductosIngresoComponent } from './pages/agregar-productos-ingreso/agregar-productos-ingreso';
import { ImportarProductosComponent } from './pages/importar-productos/importar-productos';
import { ImprimirCodigosComponent } from './pages/imprimir-codigos/imprimir-codigos';

const routes: Routes = [
  { path: '', component: ListarProductos },
  { path: 'importar', component: ImportarProductosComponent },
  { path: 'ingreso/:id/agregar-productos', component: AgregarProductosIngresoComponent },
  { path: 'imprimir-codigos', component: ImprimirCodigosComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductosRoutingModule { }
