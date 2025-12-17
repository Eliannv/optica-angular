import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  toggleSidebarEvent = output<void>();

  constructor(
    private router: Router,
    public themeService: ThemeService
  ) {}

  toggleSidebar() {
    this.toggleSidebarEvent.emit();
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  logout() {
    // Implementar lógica de cierre de sesión
    this.router.navigate(['/login']);
  }
}
