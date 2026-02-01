/**
 * Módulo de gestión de Cuentas por Pagar y Cobrar.
 *
 * Este módulo centraliza la funcionalidad de control de deudas, permitiendo:
 * - Registrar cuentas por pagar (deudas que tenemos)
 * - Registrar cuentas por cobrar (deudas que nos deben)
 * - Realizar abonos parciales a las cuentas
 * - Consultar el estado de las cuentas
 * - Filtrar por estado (activas/canceladas)
 * - Integración automática con caja/banco
 *
 * Todas las operaciones impactan directamente en caja/banco:
 * - PAGAR: registrar suma a caja, pagar descuenta de caja
 * - COBRAR: registrar descuenta de caja, cobrar suma a caja
 *
 * @module CuentasModule
 */

import { NgModule } from '@angular/core';
import { CuentasRoutingModule } from './cuentas-routing-module';

/**
 * Módulo que agrupa las rutas relacionadas con la gestión
 * de cuentas por pagar y cobrar.
 *
 * Los componentes son standalone y se cargan mediante lazy loading
 * a través del routing module.
 */
@NgModule({
  imports: [
    CuentasRoutingModule
  ]
})
export class CuentasModule { }
