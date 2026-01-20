import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CajaChicaRoutingModule } from './caja-chica-routing-module';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';
import { AbrirCajaComponent } from './pages/abrir-caja/abrir-caja';
import { ImprimirCajaChicaComponent } from './pages/imprimir-caja-chica/imprimir-caja-chica';

@NgModule({
  declarations: [
    ListarCajasComponent,
    VerCajaComponent,
    RegistrarMovimientoComponent,
    AbrirCajaComponent,
    ImprimirCajaChicaComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CajaChicaRoutingModule
  ]
})
export class CajaChicaModule { }
