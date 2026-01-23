import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductosRoutingModule } from './productos-routing-module';
import { ListarProductos } from './pages/listar-productos/listar-productos';
import { AgregarProductosIngresoComponent } from './pages/agregar-productos-ingreso/agregar-productos-ingreso';

@NgModule({
  declarations: [
    ListarProductos
  ],
  imports: [
    CommonModule,
    FormsModule,
    ProductosRoutingModule,
    AgregarProductosIngresoComponent
  ]
})
export class ProductosModule { }
