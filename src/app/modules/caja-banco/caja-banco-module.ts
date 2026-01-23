/**
 * Módulo de gestión de Caja Banco.
 *
 * Este módulo centraliza la funcionalidad de caja banco mensual, permitiendo:
 * - Crear y gestionar cajas banco diarias (apertura/cierre)
 * - Registrar movimientos financieros (ingresos/egresos)
 * - Consultar detalles de cajas específicas
 * - Generar reportes mensuales
 *
 * El módulo establece relaciones con cajas chicas, permitiendo integrar
 * los cierres de cajas chicas como ingresos en la caja banco.
 *
 * @module CajaBancoModule
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CajaBancoRoutingModule } from './caja-banco-routing-module';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';

/**
 * Módulo que agrupa los componentes y rutas relacionados con la gestión
 * de cajas banco.
 *
 * Proporciona:
 * - ListarCajasComponent: lista cajas banco del período actual
 * - VerCajaComponent: detalle de una caja banco específica
 * - RegistrarMovimientoComponent: ingreso/egreso de movimientos
 */
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
export class CajaBancoModule {}
