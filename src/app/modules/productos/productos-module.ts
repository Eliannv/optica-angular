import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductosRoutingModule } from './productos-routing-module';
import { ListarProductos } from './pages/listar-productos/listar-productos';
import { CrearProducto } from './pages/crear-producto/crear-producto';
import { AgregarProductosIngresoComponent } from './pages/agregar-productos-ingreso/agregar-productos-ingreso';

@NgModule({
  declarations: [
    CrearProducto,
    ListarProductos
  ],
  imports: [
    CommonModule,
    FormsModule,
    ProductosRoutingModule,
    // Importar componentes standalone
    AgregarProductosIngresoComponent
  ]
})
export class ProductosModule { }
