import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ClientesRoutingModule } from './clientes-routing-module';
import { EnterNextDirective } from '../../shared/directives/enter-next.directive';

import { CrearCliente } from './pages/crear-cliente/crear-cliente';

@NgModule({
  declarations: [
    CrearCliente
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    EnterNextDirective,
    ClientesRoutingModule
  ]
})
export class ClientesModule {}
