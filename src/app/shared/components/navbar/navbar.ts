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
    private router: Router,
    public themeService: ThemeService,
    private authService: AuthService
  ) {
    this.currentUser$ = this.authService.authState$;
  }

  toggleSidebar() {
    this.toggleSidebarEvent.emit();
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  get userName(): string {
    const user = this.authService.getCurrentUser();
    return user?.nombre || 'Usuario';
  }

  get userRole(): string {
    const user = this.authService.getCurrentUser();
    return user?.rol === RolUsuario.ADMINISTRADOR ? 'Administrador' : 'Operador';
  }
}
