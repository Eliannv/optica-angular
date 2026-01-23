/**
 * @file footer.ts
 * @description Componente de pie de página de la aplicación con información de copyright,
 * versión del sistema y enlaces a redes sociales. Incluye soporte para modo oscuro mediante ThemeService.
 */

import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * @component FooterComponent
 * @description Componente standalone que renderiza el pie de página con:
 * - Año actual dinámico
 * - Versión de la aplicación
 * - Detección del tema actual (claro/oscuro)
 * - Enlaces a redes sociales
 * 
 * El footer utiliza señales de Angular para reaccionar automáticamente a cambios de tema.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class FooterComponent {
  /**
   * Año actual calculado dinámicamente en tiempo de creación del componente.
   * @type {number}
   */
  readonly currentYear: number = new Date().getFullYear();

  /**
   * Versión actual de la aplicación mostrada en el footer.
   * @type {string}
   */
  readonly appVersion: string = '1.0.0';

  /**
   * Servicio de temas para detectar el modo oscuro/claro.
   * @private
   */
  private readonly themeService = inject(ThemeService);

  /**
   * Señal computada que indica si el tema actual es oscuro.
   * Se recalcula automáticamente cuando cambia el tema.
   * @type {Signal<boolean>}
   */
  readonly isDark = computed(() => this.themeService.currentTheme() === 'dark');
}
