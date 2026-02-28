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
  exactRouteMatch?: boolean; // Si es false, permite coincidencia parcial en routerLinkActive
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
      // 👥 PERSONAS
      {
        label: 'Personas',
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
        route: '/clientes/lista',
        active: false,
        roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR],
        expanded: false,
        children: [
          {
            label: 'Clientes',
            icon: '',
            route: '/clientes/lista',
            active: false,
            roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'Fichas clínicas',
            icon: '',
            route: '/clientes/historial-clinico',
            active: false,
            roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'Empleados',
            icon: '',
            route: '/empleados',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'Proveedores',
            icon: '',
            route: '/proveedores',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          }
        ]
      },
      
      // 🛒 VENTAS
      {
        label: 'Ventas',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M8 13h8"/>
            <path d="M8 17h8"/>
          </svg>
        `),
        route: '/ventas/crear',
        active: false,
        roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR],
        expanded: false,
        children: [
          {
            label: 'POS',
            icon: '',
            route: '/ventas/crear',
            active: false,
            roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'Facturas',
            icon: '',
            route: '/facturas',
            active: false,
            roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'Deudas',
            icon: '',
            route: '/ventas/deuda',
            active: false,
            roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
          },
          {
                label: 'Cobros Tarjeta',
                icon: '',
                route: '/caja-banco/ventas-tarjeta',
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              }
        ]
      },

      // 🛒 VENTAS
      {
        label: 'Tesorería',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-receipt-icon lucide-receipt"><path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/></svg>
        `),
        route: '/ventas/crear',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR],
        expanded: false,
        children: [
          {
            label: 'Cuentas por Pagar',
            icon: '',
            route: '/cuentas/pagar',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'Cuentas por Cobrar',
            icon: '',
            route: '/cuentas/cobrar',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          }
        ]
      },

      // 🏦 FINANZAS
      {
        label: 'Finanzas',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-landmark-icon lucide-landmark"><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></svg>
        `),
        route: '/caja-chica',
        active: false,
        roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR],
        expanded: false,
        children: [
          {
            label: 'Caja Chica',
            icon: '',
            route: '/caja-chica',
            active: false,
            roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR],
            expanded: false,
            children: [
              {
                label: 'Registrar Movimiento',
                icon: '',
                route: '/caja-chica/registrar',
                active: false,
                roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR],
                exactRouteMatch: false // Permite /caja-chica/registrar/:id también
              },
              {
                label: 'Ver Cajas',
                icon: '',
                route: '/caja-chica',
                active: false,
                roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
              },
              {
                label: 'Ver Caja Actual',
                icon: '',
                route: '/ver-caja-chica-actual',
                active: false,
                roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
              }
            ]
          },
          {
            label: 'Caja Banco',
            icon: '',
            route: '/caja-banco',
            active: false,
            roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR],
            expanded: false,
            children: [
              {
                label: 'Registrar Movimiento',
                icon: '',
                route: '/caja-banco/registrar-movimiento',
                active: false,
                roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
              },
              {
                label: 'Ver Cajas',
                icon: '',
                route: '/caja-banco',
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              },
              {
                label: 'Ver Caja Actual',
                icon: '',
                route: '/ver-caja-banco-actual',
                active: false,
                roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]
              }
            ]
          }
        ]
      },

      // 📦 INVENTARIO
      {
        label: 'Inventario',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-box-icon lucide-box"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
        `),
        route: '/productos',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR],
        expanded: false,
        children: [
          {
            label: 'Productos',
            icon: '',
            route: '/productos',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR],
            expanded: false,
            children: [
              {
                label: 'Todos los Productos',
                icon: '',
                route: '/productos',
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              },
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
                label: 'LIQUIDO DE LENTES DE...',
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
            label: 'Mercadería',
            icon: '',
            route: '/ingresos',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR],
            expanded: false,
            children: [
              {
                label: 'Ingresos',
                icon: '',
                route: '/ingresos',
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              },
              {
                label: 'Egresos',
                icon: '',
                route: '/egresos-mercaderia',
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              }
            ]
          },
          {
            label: 'Catálogo',
            icon: '',
            route: '/catalogo',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR],
            expanded: false,
            children: [
              {                label: 'Todos los Items',
                icon: '',
                route: '/catalogo',
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              },
              {                label: 'Tipos de Lunas',
                icon: '',
                route: '/catalogo',
                queryParams: { categoria: 'LUNA' },
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              },
              {
                label: 'Lentes de Contacto',
                icon: '',
                route: '/catalogo',
                queryParams: { categoria: 'LENTE_CONTACTO' },
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              },
              {
                label: 'Líquidos Limpia Lunas',
                icon: '',
                route: '/catalogo',
                queryParams: { categoria: 'LIQUIDO' },
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              },
              {
                label: 'Servicios',
                icon: '',
                route: '/catalogo',
                queryParams: { categoria: 'SERVICIO' },
                active: false,
                roles: [RolUsuario.ADMINISTRADOR]
              }
            ]
          }
        ]
      },

      // 📊 INFORMES
      {
        label: 'Informes',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-bar-chart-icon lucide-file-bar-chart"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 18v-2"/><path d="M12 18v-4"/><path d="M16 18v-6"/></svg>
        `),
        route: '/informes',
        active: false,
        roles: [RolUsuario.ADMINISTRADOR],
        expanded: false,
        children: [
          {
            label: 'Ventas Generales',
            icon: '',
            route: '/informes',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          },
          {
            label: 'Kardex',
            icon: '',
            route: '/informes/kardex',
            active: false,
            roles: [RolUsuario.ADMINISTRADOR]
          }
        ]
      },

      // ⚙️ CONFIGURACIÓN
      {
        label: 'Configuración',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cog-icon lucide-cog"><path d="M11 10.27 7 3.34"/><path d="m11 13.73-4 6.93"/><path d="M12 22v-2"/><path d="M12 2v2"/><path d="M14 12h8"/><path d="m17 20.66-1-1.73"/><path d="m17 3.34-1 1.73"/><path d="M2 12h2"/><path d="m20.66 17-1.73-1"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m3.34 7 1.73 1"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="8"/></svg>
        `),
        route: '/administracion',
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
   * 
   * Filtra recursivamente todos los niveles de children.
   */
  private filterMenuByRole(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.menuItems = [];
      return;
    }
    
    // Filtrar items recursivamente
    this.menuItems = this.filterItemsByRole(this.allMenuItems, currentUser.rol);
  }

  /**
   * Filtra recursivamente los items del menú según el rol.
   * 
   * @param items - Array de items a filtrar
   * @param rol - Rol del usuario actual
   * @returns Array de items filtrados con sus children también filtrados
   */
  private filterItemsByRole(items: MenuItem[], rol: RolUsuario): MenuItem[] {
    return items
      .filter(item => item.roles.includes(rol))
      .map(item => {
        if (item.children && item.children.length > 0) {
          return {
            ...item,
            children: this.filterItemsByRole(item.children, rol)
          };
        }
        return item;
      });
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
   * 
   * Se agrega un pequeño delay antes de colapsar para permitir que el routerLink
   * complete la navegación antes de que el DOM se modifique.
   */
  onMenuItemClick(): void {
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 1150;
      
      if (isMobile) {
        // Móvil: cerrar drawer completamente
        this.closeSidebar.emit();
      } else {
        // Escritorio: colapsar sidebar con delay para permitir navegación
        setTimeout(() => {
          this.collapsed = true;
        }, 100);
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
