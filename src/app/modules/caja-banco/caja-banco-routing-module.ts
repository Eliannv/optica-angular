/**
 * Configuración de rutas del módulo Caja Banco.
 *
 * Define las rutas de navegación para:
 * - Listar cajas banco (Solo ADMINISTRADOR)
 * - Ver detalle de caja específica (Solo ADMINISTRADOR)
 * - Registrar movimientos financieros (OPERADOR y ADMINISTRADOR)
 * - Ver ventas con tarjeta (Solo ADMINISTRADOR)
 *
 * @module CajaBancoRoutingModule
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';
import { VentasTarjetaComponent } from './pages/ventas-tarjeta/ventas-tarjeta';
import { roleGuard } from '../../core/guards/role.guard';
import { RolUsuario } from '../../core/models/usuario.model';

/**
 * Rutas disponibles bajo el prefijo de caja-banco.
 *
 * Protegidas por roleGuard según los permisos de cada funcionalidad.
 *
 * @constant routes
 * @type {Routes}
 */
const routes: Routes = [
  { 
    path: '', 
    component: ListarCajasComponent,
    canActivate: [roleGuard([RolUsuario.ADMINISTRADOR])]
  },
  { 
    path: ':id/ver', 
    component: VerCajaComponent,
    canActivate: [roleGuard([RolUsuario.ADMINISTRADOR])]
  },
  { 
    path: 'registrar-movimiento', 
    component: RegistrarMovimientoComponent,
    canActivate: [roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },
  { 
    path: 'ventas-tarjeta', 
    component: VentasTarjetaComponent,
    canActivate: [roleGuard([RolUsuario.ADMINISTRADOR])]
  }
];

/**
 * Módulo de enrutamiento para la funcionalidad de Caja Banco.
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaBancoRoutingModule {}
