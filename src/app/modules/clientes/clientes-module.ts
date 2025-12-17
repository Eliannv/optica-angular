import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClientesRoutingModule } from './clientes-routing-module';
import { FormsModule } from '@angular/forms';
import { ListarClientes } from './pages/listar-clientes/listar-clientes';
import { CrearCliente } from './pages/crear-cliente/crear-cliente';


@NgModule({
  declarations: [ListarClientes, CrearCliente],
  imports: [
    CommonModule,
    FormsModule,
    ClientesRoutingModule
  ]
})
export class ClientesModule { }
