import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CrearProducto } from './pages/crear-producto/crear-producto';
import { ListarProductos } from './pages/listar-productos/listar-productos';

const routes: Routes = [
  { path: '', component: ListarProductos },
  { path: 'crear', component: CrearProducto },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductosRoutingModule { }
