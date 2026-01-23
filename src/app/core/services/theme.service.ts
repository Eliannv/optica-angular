/**
 * Gestiona el tema visual de la aplicación (claro/oscuro) con persistencia en localStorage.
 * Proporciona cambio dinámico de tema mediante signals de Angular y aplica las
 * preferencias del usuario automáticamente al cargar la aplicación.
 *
 * El tema se persiste usando la clave 'optica-theme' en localStorage y también
 * respeta las preferencias del sistema operativo cuando no hay configuración guardada.
 *
 * Los estilos CSS del tema se manejan mediante el atributo data-theme en el elemento html.
 * Ver GUIA-TEMAS.md para documentación completa de variables CSS y colores.
 *
 * Forma parte del módulo core y se inyecta globalmente en la aplicación.
 */
import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'optica-theme';
  currentTheme = signal<Theme>('light');

  constructor() {
    this.loadTheme();
  }

  /**
   * Carga el tema guardado desde localStorage o aplica las preferencias del sistema.
   * Se ejecuta automáticamente en la inicialización del servicio.
   */
  private loadTheme(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    this.setTheme(theme);
  }

  /**
   * Establece el tema visual de la aplicación.
   * Actualiza el signal reactivo, persiste en localStorage y modifica el DOM.
   *
   * @param theme Tema a aplicar ('light' o 'dark').
   */
  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /**
   * Alterna entre tema claro y oscuro.
   * Útil para botones de cambio rápido de tema.
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Verifica si el tema actual es oscuro.
   *
   * @returns true si el tema es oscuro, false si es claro.
   */
  isDark(): boolean {
    return this.currentTheme() === 'dark';
  }
}
