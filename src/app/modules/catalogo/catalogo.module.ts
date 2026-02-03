import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogoRoutingModule } from './catalogo-routing.module';
import { ListarCatalogoComponent } from './pages/listar-catalogo/listar-catalogo';
import { FormCatalogoComponent } from './pages/form-catalogo/form-catalogo';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    CatalogoRoutingModule,
    ListarCatalogoComponent,
    FormCatalogoComponent
  ]
})
export class CatalogoModule { }
