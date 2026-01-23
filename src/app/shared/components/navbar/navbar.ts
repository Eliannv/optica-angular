/**
 * Componente de barra de navegación superior del sistema.
 *
 * Este componente proporciona la navegación principal y acciones rápidas en la parte
 * superior de la aplicación. Incluye:
 * - Toggle del sidebar/drawer para navegación lateral
 * - Información del usuario autenticado (nombre y rol)
 * - Selector de tema claro/oscuro
 * - Marca/logo de la aplicación
 * - Diseño responsive que se adapta a diferentes tamaños de pantalla
 *
 * El navbar es sticky y permanece visible durante el scroll para mantener
 * acceso constante a las funciones principales.
 */

import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { RolUsuario } from '../../../core/models/usuario.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  toggleSidebarEvent = output<void>();
  currentUser$;

  constructor(
    private readonly router: Router,
    public readonly themeService: ThemeService,
    private readonly authService: AuthService
  ) {
    this.currentUser$ = this.authService.authState$;
  }

  /**
   * Emite evento para alternar la visibilidad del sidebar.
   *
   * En móviles, este método abre/cierra el drawer lateral. En escritorio,
   * puede colapsar/expandir el sidebar según la implementación del componente padre.
   */
  toggleSidebar(): void {
    this.toggleSidebarEvent.emit();
  }

  /**
   * Alterna entre tema claro y oscuro del sistema.
   *
   * Utiliza el ThemeService para cambiar el tema globalmente y persiste
   * la preferencia del usuario en localStorage.
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Obtiene el nombre del usuario autenticado.
   *
   * @returns Nombre del usuario actual o 'Usuario' si no está disponible.
   */
  get userName(): string {
    const user = this.authService.getCurrentUser();
    return user?.nombre || 'Usuario';
  }

  /**
   * Obtiene el rol del usuario autenticado en formato legible.
   *
   * @returns 'Administrador' si el usuario es ADMINISTRADOR, 'Operador' en caso contrario.
   */
  get userRole(): string {
    const user = this.authService.getCurrentUser();
    return user?.rol === RolUsuario.ADMINISTRADOR ? 'Administrador' : 'Operador';
  }
}
