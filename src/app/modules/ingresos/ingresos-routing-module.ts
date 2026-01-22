import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarIngresosComponent } from './pages/listar-ingresos/listar-ingresos';
import { CrearIngresoComponent } from './pages/crear-ingreso/crear-ingreso';
import { VerIngresoComponent } from './pages/ver-ingreso/ver-ingreso';

const routes: Routes = [
  { path: '', component: ListarIngresosComponent },
  { path: 'nuevo', component: CrearIngresoComponent },
  { path: 'ver/:id', component: VerIngresoComponent },
];

/**
 * Módulo de enrutamiento para el módulo de Ingresos.
 *
 * **Rutas configuradas:**
 * 1. '' → ListarIngresosComponent
 *    - Ruta: /ingresos
 *    - Mostrar lista paginada de ingresos con filtros
 *
 * 2. 'nuevo' → CrearIngresoComponent
 *    - Ruta: /ingresos/nuevo
 *    - Crear nuevo ingreso (seleccionar proveedor, número factura, etc)
 *
 * 3. 'ver/:id' → VerIngresoComponent
 *    - Ruta: /ingresos/ver/:id
 *    - Ver detalles completos de un ingreso específico
 *    - Incluye impresión A4
 *
 * **Patrón:**
 * - forChild() utiliza RouterModule.forChild (Feature Module pattern)
 * - Esta ruta se carga de forma lazy desde app.routes.ts
 * - Cada componente es standalone (no necesita NgModule)
 *
 * @module IngresosRoutingModule
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IngresosRoutingModule { }
