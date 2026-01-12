import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CajaBancoRoutingModule } from './caja-banco-routing-module';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';

@NgModule({
  declarations: [
    ListarCajasComponent,
    VerCajaComponent,
    RegistrarMovimientoComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CajaBancoRoutingModule
  ]
})
export class CajaBancoModule { }
