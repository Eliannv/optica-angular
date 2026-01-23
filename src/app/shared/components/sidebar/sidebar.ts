/**
 * Componente de barra lateral de navegación del sistema.
 *
 * Este componente proporciona un menú de navegación lateral adaptable con las siguientes características:
 * - Sistema de permisos basado en roles (RolUsuario)
 * - Modo colapsable para optimizar espacio de pantalla
 * - Soporte para submenús desplegables
 * - Comportamiento responsive (drawer en móvil, sidebar en escritorio)
 * - Integración con Angular Router para navegación
 * - Sanitización de iconos SVG con DomSanitizer
 * - Cierre de sesión con confirmación
 *
 * El menú se filtra automáticamente según el rol del usuario autenticado,
 * mostrando únicamente las opciones permitidas para cada perfil.
 */

import { Component, output, Inject, PLATFORM_ID, inject, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { RolUsuario } from '../../../core/models/usuario.model';
import Swal from 'sweetalert2';

/**
 * Interfaz que define la estructura de un elemento del menú.
 */
interface MenuItem {
  label: string;
  icon: SafeHtml | string;
  route?: string;
  queryParams?: any;
  active: boolean;
  badge?: number;
  roles: RolUsuario[];
  children?: MenuItem[];
  expanded?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit {
  closeSidebar = output<void>();

  collapsed = false;
  
  private readonly authService = inject(AuthService);
  private readonly allMenuItems: MenuItem[];
  
  menuItems: MenuItem[] = [];

  constructor(
    private readonly sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    this.allMenuItems = [
      {
        label: 'Clientes',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="lucide lucide-users-icon lucide-users">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <path d="M16 3.128a4 4 0 0 1 0 7.744"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
        `),
        route: '/clientes/historial-clinico',
        active: true,
        badge: 0,
        roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
      },
      {
        label: 'Ventas (POS)',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
            <path d="M12 18V6"/>
          </svg>
        `),
        route: '/ventas/crear',
        active: false,
        roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
      },
      {
        label: 'Facturas',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M8 13h8"/>
            <path d="M8 17h8"/>
          </svg>
        `),
        route: '/facturas',
        active: false,
        roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
      },
      {
        label: 'Caja Chica',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-vault-icon lucide-vault"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><path d="m7.9 7.9 2.7 2.7"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/><path d="m13.4 10.6 2.7-2.7"/><circle cx="7.5" cy="16.5" r=".5" fill="currentColor"/><path d="m7.9 16.1 2.7-2.7"/><circle cx="16.5" cy="16.5" r=".5" fill="currentColor"/><path d="m13.4 13.4 2.7 2.7"/><circle cx="12" cy="12" r="2"/></svg>
        `),
        route: '/caja-chica',
        active: false,
        roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
      },
      {
        label: 'Caja Banco',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-landmark-icon lucide-landmark"><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></svg>
        `),
        route: '/caja-banco',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR]
      },
      {
        label: 'Productos',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store-icon lucide-store"><path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/></svg>
        `),
        route: '/productos',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR],
        expanded: false,
        children: [
          {
            label: 'ARMAZONES',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'ARMAZONES' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'LENTES DE CONTACTO',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'LENTES DE CONTACTO' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'LIQUIDO DE LENTES DE CONTACTO',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'LIQUIDO DE LENTES DE CONTACTO' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'LIQUIDO DESEMPAÑANTE',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'LIQUIDO DESEMPAÑANTE' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'GAFAS',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'GAFAS' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'LUNAS',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'LUNAS' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'SERVICIOS',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'SERVICIOS' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'VARIOS',
            icon: '',
            route: '/productos',
            queryParams: { grupo: 'VARIOS' },
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          }
        ]
      },
      {
        label: 'Proveedores',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck-icon lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
        `),
        route: '/proveedores',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR]
      },
      {
        label: 'Empleados',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-id-card-lanyard-icon lucide-id-card-lanyard"><path d="M13.5 8h-3"/><path d="m15 2-1 2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"/><path d="M16.899 22A5 5 0 0 0 7.1 22"/><path d="m9 2 3 6"/><circle cx="12" cy="15" r="3"/></svg>
        `),
        route: '/empleados',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR]
      },
      {
        label: 'Ingresos',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package-search-icon lucide-package-search"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
        `),
        route: '/ingresos',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR]
      }
    ];
  }

  /**
   * Inicializa el componente y configura el filtrado del menú.
   *
   * Aplica el filtro de menú basado en el rol del usuario autenticado y
   * se suscribe a cambios en el estado de autenticación para actualizar
   * el menú dinámicamente si el usuario cambia.
   */
  ngOnInit(): void {
    this.filterMenuByRole();
    
    this.authService.authState$.subscribe(() => {
      this.filterMenuByRole();
    });
  }

  /**
   * Filtra los elementos del menú según el rol del usuario actual.
   *
   * Solo muestra los items del menú para los cuales el usuario tiene
   * permisos según su rol (ADMINISTRADOR u OPERADOR). Si no hay usuario
   * autenticado, el menú queda vacío.
   */
  private filterMenuByRole(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.menuItems = [];
      return;
    }
    
    // Filtrar items que incluyan el rol del usuario
    this.menuItems = this.allMenuItems.filter(item => 
      item.roles.includes(currentUser.rol)
    );
  }

  /**
   * Alterna el estado colapsado/expandido del sidebar.
   */
  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
  }

  /**
   * Maneja el clic en el logo del sidebar.
   *
   * En modo escritorio (ancho >= 1150px), alterna el estado colapsado/expandido.
   * En modo móvil, no realiza ninguna acción para evitar comportamiento confuso.
   */
  onLogoClick(): void {
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 1150;
      
      // Solo permitir toggle en escritorio
      if (!isMobile) {
        this.collapsed = !this.collapsed;
      }
    }
  }

  /**
   * Maneja el clic en un elemento del menú.
   *
   * En modo móvil (ancho < 1150px), cierra completamente el drawer lateral.
   * En modo escritorio, colapsa el sidebar para maximizar el espacio de trabajo.
   */
  onMenuItemClick(): void {
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 1150;
      
      if (isMobile) {
        // Móvil: cerrar drawer completamente
        this.closeSidebar.emit();
      } else {
        // Escritorio: colapsar sidebar
        this.collapsed = true;
      }
    }
  }

  /**
   * Alterna la expansión de un submenú.
   *
   * Expande o colapsa los elementos hijos de un item del menú. Si el sidebar
   * está colapsado cuando se hace clic en un item con hijos, lo expande
   * automáticamente para mostrar el submenú.
   *
   * @param item Elemento del menú con posibles hijos.
   * @param event Evento del clic para prevenir propagación.
   */
  toggleSubmenu(item: MenuItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (item.children && item.children.length > 0) {
      item.expanded = !item.expanded;
      
      // Si el sidebar está colapsado, expandirlo al hacer clic en un item con hijos
      if (this.collapsed) {
        this.collapsed = false;
      }
    }
  }

  /**
   * Verifica si un elemento del menú tiene submenús.
   *
   * @param item Elemento del menú a verificar.
   * @returns true si el item tiene hijos, false en caso contrario.
   */
  hasChildren(item: MenuItem): boolean {
    return !!(item.children && item.children.length > 0);
  }

  /**
   * Cierra la sesión del usuario con confirmación.
   *
   * Muestra un diálogo de confirmación antes de cerrar sesión. Si el usuario
   * confirma, llama al servicio de autenticación y muestra un mensaje de éxito.
   */
  logout(): void {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: '¿Estás seguro de que deseas salir?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout().subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Sesión cerrada',
              text: 'Has cerrado sesión correctamente',
              showConfirmButton: false,
              timer: 1500
            });
          }
        });
      }
    });
  }
}
