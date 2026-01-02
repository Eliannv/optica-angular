import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProveedoresRoutingModule } from './proveedores-routing-module';
import { EnterNextDirective } from '../../shared/directives/enter-next.directive';
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
    EnterNextDirective,
    ProveedoresRoutingModule
  ],
  providers: [DatePipe]
})
export class ProveedoresModule { }
