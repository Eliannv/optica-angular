/**
 * Módulo de gestión de cajas chicas del sistema financiero.
 *
 * Responsabilidades:
 * Este módulo encapsula toda la funcionalidad relacionada con cajas chicas,
 * que son mecanismos de contabilidad para gastos pequeños y ágiles que no
 * necesitan pasar por la caja banco principal.
 *
 * Características principales:
 * - Apertura de nuevas cajas chicas con monto inicial asignado
 * - Registro de movimientos (ingresos y egresos) durante la operación diaria
 * - Visualización detallada de cajas y estado financiero
 * - Cierre de cajas con transferencia automática de saldo a caja banco
 * - Generación y impresión de reportes de cierre con detalles para auditoría
 * - Filtrado y búsqueda de cajas (todas, abiertas, cerradas)
 *
 * Componentes declarados:
 * - ListarCajasComponent: Dashboard de cajas (lista y filtros)
 * - AbrirCajaComponent: Formulario de apertura de nueva caja
 * - VerCajaComponent: Detalles de caja + movimientos + acciones
 * - RegistrarMovimientoComponent: Formulario de registro de transacciones
 *
 * Módulos importados:
 * - CommonModule: Directivas *ngIf, *ngFor, etc
 * - FormsModule: Soporte para formularios template-driven (si aplica)
 * - ReactiveFormsModule: FormBuilder, FormGroup para formularios reactivos
 * - CajaChicaRoutingModule: Rutas internas del módulo
 *
 * Lazy loading:
 * Este módulo está lazy-loaded desde app.routes.ts:
 * { path: 'caja-chica', loadChildren: () => import(...).then(m => m.CajaChicaModule) }
 *
 * Integración con servicios:
 * - CajaChicaService: Operaciones CRUD en Firestore para cajas y movimientos
 * - CajaBancoService: Validación de existencia de caja banco
 * - AuthService: Obtención de usuario actual para auditoría
 *
 * @module CajaChicaModule
 * @example
 * // En app.routes.ts
 * {
 *   path: 'caja-chica',
 *   loadChildren: () => import('./modules/caja-chica/caja-chica-module').then(m => m.CajaChicaModule),
 *   canActivate: [authGuard]
 * }
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CajaChicaRoutingModule } from './caja-chica-routing-module';
import { ListarCajasComponent } from './pages/listar-cajas/listar-cajas';
import { VerCajaComponent } from './pages/ver-caja/ver-caja';
import { RegistrarMovimientoComponent } from './pages/registrar-movimiento/registrar-movimiento';
import { AbrirCajaComponent } from './pages/abrir-caja/abrir-caja';

/**
 * Clase decoradora del módulo de Caja Chica.
 *
 * Responsabilidades:
 * - Declarar todos los componentes que pertenecen a este módulo
 * - Importar módulos de dependencia necesarios (CommonModule, Forms, Routing)
 * - Exportar las rutas para uso en la aplicación
 *
 * Componentes declarados:
 * Los cuatro componentes de cajas chicas están declarados aquí:
 * - ListarCajasComponent: dashboard y listado
 * - AbrirCajaComponent: formulario de apertura
 * - VerCajaComponent: detalles y acciones
 * - RegistrarMovimientoComponent: registro de transacciones
 *
 * Nota sobre standalone:
 * Estos componentes NO son standalone (standalone: false).
 * Necesitan estar declarados en este módulo para funcionar correctamente.
 * Si se requiere convertir a standalone en el futuro, se cambiaría la estrategia
 * de declaración y se usaría importDirectly en componentes padre.
 *
 * @class CajaChicaModule
 * @NgModule configuration object
 */
@NgModule({
  declarations: [
    ListarCajasComponent,
    VerCajaComponent,
    RegistrarMovimientoComponent,
    AbrirCajaComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CajaChicaRoutingModule
  ]
})
export class CajaChicaModule { }
