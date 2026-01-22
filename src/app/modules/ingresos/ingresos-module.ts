import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IngresosRoutingModule } from './ingresos-routing-module';

/**
 * Módulo de Ingresos - Feature Module lazy-loaded.
 *
 * **Propósito:**
 * - Encapsula toda la funcionalidad de gestión de ingresos
 * - Se carga bajo demanda cuando usuario navega a /ingresos
 * - Reduce bundle initial (code splitting)
 *
 * **Componentes incluidos:**
 * - ListarIngresosComponent (standalone)
 * - CrearIngresoComponent (standalone)
 * - VerIngresoComponent (standalone)
 *
 * **Módulos importados:**
 * - CommonModule: Directivas básicas (NgIf, NgFor, etc)
 * - FormsModule: Two-way binding [(ngModel)]
 * - ReactiveFormsModule: Formularios reactivos (FormBuilder, FormGroup)
 * - IngresosRoutingModule: Configuración de rutas internas
 *
 * **Patrón:**
 * - Feature Module (lazy-loaded desde app.routes.ts)
 * - Lazy loading: loadChildren: () => import(...).then(m => m.IngresosModule)
 * - Cada componente es standalone pero se agrupan en módulo
 *
 * @module IngresosModule
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IngresosRoutingModule
  ]
})
export class IngresosModule { }
