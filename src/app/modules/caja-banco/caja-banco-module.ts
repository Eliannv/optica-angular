import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CajaBancoRoutingModule } from './caja-banco-routing-module';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { DetalleCajaBancoComponent } from './pages/detalle-caja-banco/detalle-caja-banco';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';
import { ImprimirCajaBancoComponent } from './pages/imprimir-caja-banco/imprimir-caja-banco';
import { ImprimirCajaBancoMensualComponent } from './pages/imprimir-caja-banco-mensual/imprimir-caja-banco-mensual';

@NgModule({
  declarations: [
    ListarCajasComponent,
    DetalleCajaBancoComponent,
    RegistrarMovimientoComponent,
    ImprimirCajaBancoComponent,
    ImprimirCajaBancoMensualComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CajaBancoRoutingModule
  ]
})
export class CajaBancoModule { }
