import { Component, signal, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { SessionService } from './core/services/session.service';
import { ConnectivityService } from './core/services/connectivity.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

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
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('optica-angular');
  
  // Control de vista
  mobileView = false;
  sidebarVisible = false;
  showSplash = true;
  
  // Rutas de autenticación
  private authRoutes = ['/login', '/register', '/forgot-password'];

  // Suscripciones
  private authSubscription?: Subscription;
  private connectivitySubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private sessionService: SessionService,
    private connectivityService: ConnectivityService
  ) {
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

    // Monitorear autenticación y activar/desactivar monitoreo de inactividad
    this.authSubscription = this.authService.authState$.subscribe(user => {
      if (user) {
        // Usuario autenticado → Iniciar monitoreo de inactividad
        this.sessionService.startInactivityMonitoring();
      } else {
        // Usuario no autenticado → Detener monitoreo
        this.sessionService.stopInactivityMonitoring();
      }
    });

    // Monitorear conectividad global
    this.connectivitySubscription = this.connectivityService.getOnlineStatus().subscribe(isOnline => {
      if (!isOnline && this.authService.isAuthenticated() && !this.isAuthRoute()) {
        Swal.fire({
          icon: 'error',
          title: 'Conexión perdida',
          text: 'Se ha perdido la conexión a internet. Algunas funciones pueden no estar disponibles.',
          confirmButtonColor: '#d33',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true
        });
      } else if (isOnline && this.authService.isAuthenticated() && !this.isAuthRoute()) {
        Swal.fire({
          icon: 'success',
          title: 'Conexión restaurada',
          text: 'La conexión a internet ha sido restaurada.',
          confirmButtonColor: '#28a745',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      }
    });
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.connectivitySubscription?.unsubscribe();
    this.sessionService.stopInactivityMonitoring();
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

