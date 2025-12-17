import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductosRoutingModule } from './productos-routing-module';
import { CrearProducto } from './pages/crear-producto/crear-producto';
import { ListarProductos } from './pages/listar-productos/listar-productos';

@NgModule({
  declarations: [
    CrearProducto,
    ListarProductos
  ],
  imports: [
    CommonModule,
    FormsModule,
    ProductosRoutingModule
  ]
})
export class ProductosModule { }
