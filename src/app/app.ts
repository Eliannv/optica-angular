/**
 * Componente raíz de la aplicación que gestiona el layout principal y la estructura global.
 * 
 * Responsabilidades principales:
 * - Control del layout responsivo (desktop/mobile) con sidebar adaptativo
 * - Gestión del ciclo de vida de autenticación y monitoreo de sesión
 * - Monitoreo de conectividad a internet con notificaciones en tiempo real
 * - Renderizado condicional entre vistas autenticadas y públicas
 * - Splash screen inicial para mejorar la experiencia de carga
 * 
 * Estructura del layout:
 * - Navbar: barra de navegación superior fija
 * - Sidebar: menú lateral (drawer en móvil, fijo en desktop)
 * - Main: contenido principal con router-outlet
 * - Footer: pie de página
 */

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
  /** Título de la aplicación */
  protected readonly title = signal('optica-angular');
  
  /** Indica si la vista es móvil (ancho < 1150px) */
  mobileView = false;
  
  /** Controla la visibilidad del sidebar en vista móvil */
  sidebarVisible = false;
  
  /** Controla la visualización del splash screen inicial */
  showSplash = true;
  
  /** Rutas públicas de autenticación (sin navbar/sidebar) */
  private authRoutes = ['/login', '/register'];

  /** Suscripción al estado de autenticación */
  private authSubscription?: Subscription;
  
  /** Suscripción al estado de conectividad */
  private connectivitySubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private sessionService: SessionService,
    private connectivityService: ConnectivityService
  ) {
    this.checkScreenSize();
  }

  /**
   * Inicializa el componente y configura los monitores globales.
   * 
   * Configura:
   * - Ocultación del splash screen tras 2 segundos
   * - Cierre automático del sidebar en móvil al cambiar de ruta
   * - Monitoreo de autenticación para control de sesiones inactivas
   * - Monitoreo de conectividad con notificaciones toast
   */
  ngOnInit(): void {
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

  /**
   * Limpia recursos y detiene monitores al destruir el componente.
   * Cancela suscripciones y detiene el monitoreo de inactividad.
   */
  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.connectivitySubscription?.unsubscribe();
    this.sessionService.stopInactivityMonitoring();
  }

  /**
   * Listener del evento de redimensionamiento de ventana.
   * Actualiza el estado de vista móvil/desktop dinámicamente.
   */
  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  /**
   * Verifica el tamaño de la pantalla y actualiza el estado del layout.
   * Define el breakpoint en 1150px para cambiar entre móvil y desktop.
   * Cierra automáticamente el sidebar al pasar a vista desktop.
   */
  private checkScreenSize(): void {
    this.mobileView = window.innerWidth < 1150;
    if (!this.mobileView) {
      this.sidebarVisible = false;
    }
  }

  /**
   * Alterna la visibilidad del sidebar en vista móvil.
   * Utilizado por el navbar para abrir/cerrar el menú lateral.
   */
  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  /**
   * Determina si la ruta actual es una ruta de autenticación pública.
   * Las rutas de autenticación no muestran navbar, sidebar ni footer.
   * 
   * @returns true si la ruta actual es de autenticación, false en caso contrario.
   */
  isAuthRoute(): boolean {
    const currentRoute = this.router.url;
    return this.authRoutes.some(route => currentRoute.startsWith(route));
  }

  /**
   * Verifica si el usuario actual tiene permisos de administrador.
   * Utilizado para aplicar temas y mostrar/ocultar funcionalidades administrativas.
   * 
   * @returns true si el usuario es administrador, false en caso contrario.
   * @todo Implementar verificación real del rol desde AuthService.
   */
  isAdminUser(): boolean {
    // TODO: Implementar lógica real consultando authService.currentUser.rol
    return true;
  }
}

