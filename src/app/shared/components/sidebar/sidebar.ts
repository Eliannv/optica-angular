import { Component, output, signal, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { RolUsuario } from '../../../core/models/usuario.model';

interface MenuItem {
  label: string;
  icon: SafeHtml | string;
  route: string;
  active: boolean;
  badge?: number;
  roles: RolUsuario[]; // Roles permitidos para ver este item
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
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-eye-icon lucide-eye">
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        `),
      route: '/productos',
      active: false,
      roles: [RolUsuario.ADMINISTRADOR] // Solo administradores
    },
    {
      label: 'Proveedores',
      icon: this.sanitizer.bypassSecurityTrustHtml(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package-search-icon lucide-package-search"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
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
}
