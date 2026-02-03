import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InformesRoutingModule } from './informes-routing-module';

/**
 * Módulo de Informes y Reportes del Sistema.
 * 
 * **Propósito:**
 * Centralizar todos los informes y reportes del sistema en un único módulo,
 * facilitando la gestión y el acceso a diferentes tipos de informes.
 * 
 * **Informes disponibles:**
 * - Cobros Cliente: Reporte detallado de cobros realizados con filtros avanzados
 * - (Futuro) Egreso de Mercadería: Control de salidas de inventario
 * - (Futuro) Análisis de Ventas: Estadísticas y métricas de ventas
 * - (Futuro) Estado de Inventario: Reporte de stock y productos
 * 
 * **Características:**
 * - Lazy loading para optimizar rendimiento
 * - Componentes standalone para mayor modularidad
 * - Filtros avanzados en cada informe
 * - Impresión de reportes en formato A4
 * - Exportación de datos (futuro)
 * 
 * **Acceso:**
 * Los informes están protegidos por guards de autenticación y roles.
 * Generalmente requieren permisos de Administrador u Operador según el tipo.
 */
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    InformesRoutingModule
  ]
})
export class InformesModule { }
