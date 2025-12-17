import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProveedoresRoutingModule } from './proveedores-routing-module';
import { CrearProveedor } from './pages/crear-proveedor/crear-proveedor';
import { ListarProveedores } from './pages/listar-proveedores/listar-proveedores';

@NgModule({
  declarations: [
    CrearProveedor,
    ListarProveedores
  ],
  imports: [
    CommonModule,
    FormsModule,
    ProveedoresRoutingModule
  ]
})
export class ProveedoresModule { }
