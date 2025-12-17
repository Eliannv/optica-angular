import { Component, signal, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

// Importar componentes
import { NavbarComponent } from './shared/components/navbar/navbar';
import { SidebarComponent } from './shared/components/sidebar/sidebar';
import { FooterComponent } from './shared/components/footer/footer';
import { SplashScreenComponent } from './shared/components/splash-screen/splash-screen';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    NavbarComponent,
    SidebarComponent,
    FooterComponent,
    SplashScreenComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('optica-angular');
  
  // Control de vista
  mobileView = false;
  sidebarVisible = false;
  showSplash = true;
  
  // Rutas de autenticación
  private authRoutes = ['/login', '/register', '/forgot-password'];

  constructor(private router: Router) {
    this.checkScreenSize();
  }

  ngOnInit() {
    // Ocultar splash screen después de 2 segundos
    setTimeout(() => {
      this.showSplash = false;
    }, 2000);

    // Escuchar cambios de ruta para cerrar sidebar en móvil
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.mobileView) {
          this.sidebarVisible = false;
        }
      });
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.mobileView = window.innerWidth < 1150;
    if (!this.mobileView) {
      this.sidebarVisible = false;
    }
  }

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
  }

  isAuthRoute(): boolean {
    const currentRoute = this.router.url;
    return this.authRoutes.some(route => currentRoute.startsWith(route));
  }

  isAdminUser(): boolean {
    // Implementar lógica para verificar si es admin
    // Por ahora retorna true ya que mencionaste que es solo para admin
    return true;
  }
}

