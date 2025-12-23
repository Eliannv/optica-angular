import { Component, output, signal, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { RolUsuario } from '../../../core/models/usuario.model';

interface MenuItem {
  label: string;
  icon: SafeHtml | string;
  route?: string;
  queryParams?: any; // Parámetros de consulta para la ruta
  active: boolean;
  badge?: number;
  roles: RolUsuario[]; // Roles permitidos para ver este item
  children?: MenuItem[]; // Submenús
  expanded?: boolean; // Estado de expansión
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  closeSidebar = output<void>();

  collapsed = false;
  
  private authService = inject(AuthService);
  
  // Todos los items del menú con sus permisos
  private allMenuItems: MenuItem[];
  
  // Items filtrados según el rol del usuario
  menuItems: MenuItem[] = [];

  constructor(
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.allMenuItems = [
  {
    label: 'Historial Clínico',
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
    roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR] // Operadores y Administradores
  },
      /*{

        label: 'Principal',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-layout-dashboard-icon lucide-layout-dashboard">
            <rect width="7" height="9" x="3" y="3" rx="1"/>
            <rect width="7" height="5" x="14" y="3" rx="1"/>
            <rect width="7" height="9" x="14" y="12" rx="1"/>
            <rect width="7" height="5" x="3" y="16" rx="1"/>
          </svg>
        `),
        route: '/dashboard',
        active: false
      },*/
      /*{
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
        route: '/clientes/listar',
        active: true
      },*/
      {
        label: 'Productos',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store-icon lucide-store"><path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/></svg>
        `),
      route: '/productos',
      active: false,
      roles: [RolUsuario.ADMINISTRADOR], // Solo administradores
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
        },
      ]
    },
    {
          label: 'Ingresos',
          icon: this.sanitizer.bypassSecurityTrustHtml(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package-search-icon lucide-package-search"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
        `),
          route: '/ingresos',
          active: false,
          roles: [RolUsuario.ADMINISTRADOR]
        },
        
    {
      label: 'Proveedores',
      icon: this.sanitizer.bypassSecurityTrustHtml(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck-icon lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
        `),
      route: '/proveedores',
      active: false,
      roles: [RolUsuario.ADMINISTRADOR] // Solo administradores
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
  roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR] // Operadores y Administradores
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
  roles: [RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR] // Operadores y Administradores
}/*,

    {
      label: 'Reportes',
      icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-no-axes-combined-icon lucide-chart-no-axes-combined"><path d="M12 16v5"/><path d="M16 14v7"/><path d="M20 10v11"/><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"/><path d="M4 18v3"/><path d="M8 14v7"/></svg>
        `),
        route: '/reportes',
        active: false
      },
      {
        label: 'Configuración',
        icon: this.sanitizer.bypassSecurityTrustHtml(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-settings-icon lucide-settings">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        `),
        route: '/configuracion',
        active: false
      }*/
    ];
    
    // Filtrar menú según el rol del usuario
    this.filterMenuByRole();
  }

  /**
   * Filtrar items del menú según el rol del usuario actual
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

  toggleSidebar() {
    this.collapsed = !this.collapsed;
  }

  onLogoClick() {
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 1150;
      
      // Solo permitir toggle en escritorio
      if (!isMobile) {
        this.collapsed = !this.collapsed;
      }
    }
  }

  onMenuItemClick() {
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
   * Toggle del submenú (expandir/colapsar)
   */
  toggleSubmenu(item: MenuItem, event: Event) {
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
   * Verificar si el item tiene hijos
   */
  hasChildren(item: MenuItem): boolean {
    return !!(item.children && item.children.length > 0);
  }
}
