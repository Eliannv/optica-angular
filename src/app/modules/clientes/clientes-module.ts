/**
 * Módulo principal de gestión de clientes.
 *
 * Este módulo agrupa toda la funcionalidad relacionada con la gestión de clientes
 * en el sistema de la óptica, incluyendo el registro, edición, visualización y
 * eliminación (soft-delete) de clientes, así como la gestión de sus historiales
 * clínicos oftalmológicos.
 *
 * El módulo utiliza lazy-loading para optimizar el tiempo de carga inicial de la
 * aplicación y se carga únicamente cuando el usuario navega a rutas de clientes.
 */

import { NgModule } from '@angular/core';
import { ClientesRoutingModule } from './clientes-routing-module';

@NgModule({
  imports: [
    ClientesRoutingModule
  ]
})
export class ClientesModule {}
