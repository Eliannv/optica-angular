import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarCatalogoComponent } from './pages/listar-catalogo/listar-catalogo';
import { FormCatalogoComponent } from './pages/form-catalogo/form-catalogo';
import { ImportarProductosComponent } from '../productos/pages/importar-productos/importar-productos';

const routes: Routes = [
  { path: '', component: ListarCatalogoComponent },
  { path: 'importar', component: ImportarProductosComponent, data: { modo: 'CATALOGO' } },
  { path: 'crear', component: FormCatalogoComponent },
  { path: 'editar/:id', component: FormCatalogoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CatalogoRoutingModule { }
