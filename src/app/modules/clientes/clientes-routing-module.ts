/**
 * Módulo de enrutamiento para el módulo de clientes.
 *
 * ✅ REFACTORIZADO: Separación de responsabilidades
 * - Gestión administrativa de clientes (lista-clientes)
 * - Atención clínica (historial-clinico con buscador)
 * - Ficha completa del cliente con pestañas (información, historial, facturas, cuentas)
 *
 * Define las rutas y navegación dentro del módulo de clientes:
 * - Lista administrativa de clientes
 * - Buscador de clientes para historial clínico
 * - Ficha del cliente con pestañas
 * - Creación de nuevos clientes
 * - Selección/visualización de historiales clínicos
 * - Creación/edición de historiales clínicos
 *
 * Todas las rutas utilizan componentes standalone para aprovechar las ventajas
 * de modularidad y tree-shaking de Angular.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ListaClientesComponent } from './pages/lista-clientes/lista-clientes';
import { BuscadorClienteComponent } from './pages/buscador-cliente/buscador-cliente';
import { FichaClienteComponent } from './pages/ficha-cliente/ficha-cliente';
import { CrearCliente } from './pages/crear-cliente/crear-cliente';
import { CrearHistorialClinicoComponent } from './pages/crear-historial-clinico/crear-historial-clinico';
import { HistorialClinicoComponent } from './pages/historial-clinico/historial-clinico';
import { SeleccionarHistorialComponent } from './pages/seleccionar-historial/seleccionar-historial';

const routes: Routes = [
  // Ruta por defecto: redirige a lista de clientes
  { path: '', redirectTo: 'lista', pathMatch: 'full' },
  
  // ✅ NUEVO: Gestión administrativa de clientes
  { 
    path: 'lista', 
    component: ListaClientesComponent 
  },
  
  // ✅ REFACTORIZADO: Historial clínico ahora es un buscador
  { 
    path: 'historial-clinico', 
    component: BuscadorClienteComponent 
  },
  
  // Alias para compatibilidad
  { 
    path: 'historial', 
    redirectTo: 'historial-clinico', 
    pathMatch: 'full' 
  },
  
  // ✅ NUEVO: Ficha completa del cliente con pestañas
  { 
    path: 'ficha/:id', 
    component: FichaClienteComponent 
  },
  
  // Crear/editar cliente
  { 
    path: 'crear', 
    component: CrearCliente 
  },
  
  // Lista de historiales de un cliente
  { 
    path: 'historiales', 
    component: SeleccionarHistorialComponent 
  },
  
  // Crear/editar historial clínico
  { 
    path: 'crear-historial', 
    component: CrearHistorialClinicoComponent 
  },
  
  // Mantener por compatibilidad
  { 
    path: ':id/crear-historial-clinico', 
    component: CrearHistorialClinicoComponent 
  },
  
  // 🔙 COMPATIBILIDAD: Ruta antigua de historial-clinico (lista completa)
  // Se mantiene temporalmente para no romper navegación existente
  { 
    path: 'historial-clinico-old', 
    component: HistorialClinicoComponent 
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientesRoutingModule {}
