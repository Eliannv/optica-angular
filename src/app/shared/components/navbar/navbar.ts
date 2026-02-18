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

import { Component, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { RolUsuario } from '../../../core/models/usuario.model';
import { SelectorSucursalComponent } from '../selector-sucursal/selector-sucursal.component';

interface SeccionMenu {
  nombre: string;
  ruta: string;
  categoria: string;
  keywords: string[];
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SelectorSucursalComponent],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  toggleSidebarEvent = output<void>();
  currentUser$;

  // Búsqueda global
  terminoBusqueda = '';
  mostrarSugerencias = false;
  seccionesFiltradas: SeccionMenu[] = [];
  indiceSugerenciaSeleccionada = -1;

  // Lista de secciones disponibles
  private readonly secciones: SeccionMenu[] = [
    // Personas
    { nombre: 'Clientes', ruta: '/clientes', categoria: 'Personas', keywords: ['cliente', 'persona', 'contacto'] },
    { nombre: 'Crear Cliente', ruta: '/clientes/crear', categoria: 'Personas', keywords: ['nuevo', 'agregar', 'crear', 'cliente'] },
    { nombre: 'Fichas Clínicas', ruta: '/clientes/historial-clinico', categoria: 'Personas', keywords: ['ficha', 'clinica', 'historial', 'medico', 'paciente', 'clinico'] },
    { nombre: 'Empleados', ruta: '/empleados', categoria: 'Personas', keywords: ['empleado', 'trabajador', 'staff', 'personal'] },
    { nombre: 'Proveedores', ruta: '/proveedores', categoria: 'Personas', keywords: ['proveedor', 'distribuidor'] },
    
    // Ventas
    { nombre: 'Punto de Venta (POS)', ruta: '/ventas/crear', categoria: 'Ventas', keywords: ['pos', 'venta', 'factura', 'vender'] },
    { nombre: 'Facturas', ruta: '/facturas', categoria: 'Ventas', keywords: ['factura', 'recibo', 'comprobante'] },
    { nombre: 'Cobrar Deudas', ruta: '/ventas/deuda', categoria: 'Ventas', keywords: ['deuda', 'cobrar', 'pendiente', 'crédito'] },
    
    // Finanzas
    { nombre: 'Caja Chica', ruta: '/caja-chica', categoria: 'Finanzas', keywords: ['caja', 'efectivo', 'dinero'] },
    { nombre: 'Caja Banco', ruta: '/caja-banco', categoria: 'Finanzas', keywords: ['banco', 'cuenta', 'deposito'] },
    { nombre: 'Cobros Tarjeta', ruta: '/caja-banco/ventas-tarjeta', categoria: 'Finanzas', keywords: ['tarjeta', 'cobro', 'visa', 'mastercard'] },
    { nombre: 'Cuentas por Pagar', ruta: '/cuentas/pagar', categoria: 'Finanzas', keywords: ['pagar', 'deuda', 'proveedor'] },
    { nombre: 'Cuentas por Cobrar', ruta: '/cuentas/cobrar', categoria: 'Finanzas', keywords: ['cobrar', 'cliente', 'credito'] },
    
    // Inventario - Productos
    { nombre: 'Todos los Productos', ruta: '/productos', categoria: 'Inventario', keywords: ['producto', 'inventario', 'stock'] },
    { nombre: 'Importar productos', ruta: '/productos/importar', categoria: 'Inventario', keywords: ['producto', 'inventario', 'importar'] },
    { nombre: 'Armazones', ruta: '/productos', categoria: 'Inventario', keywords: ['armazon', 'montura', 'marco'] },
    { nombre: 'Lentes de Contacto', ruta: '/productos', categoria: 'Inventario', keywords: ['lente', 'contacto', 'pupilente'] },
    { nombre: 'Lunas', ruta: '/productos', categoria: 'Inventario', keywords: ['luna', 'cristal', 'mica'] },
    { nombre: 'Gafas', ruta: '/productos', categoria: 'Inventario', keywords: ['gafa', 'sol', 'anteojos'] },
    
    // Inventario - Mercadería
    { nombre: 'Ingresos Mercadería', ruta: '/ingresos', categoria: 'Inventario', keywords: ['ingreso', 'compra', 'mercaderia'] },
    { nombre: 'Crear ingreso', ruta: '/ingresos/nuevo', categoria: 'Inventario', keywords: ['ingreso', 'compra', 'mercaderia'] },
    { nombre: 'Egresos Mercadería', ruta: '/egresos-mercaderia', categoria: 'Inventario', keywords: ['egreso', 'salida', 'mercaderia'] },
    
    // Inventario - Catálogo
    { nombre: 'Catálogo Completo', ruta: '/catalogo', categoria: 'Inventario', keywords: ['catalogo', 'precio', 'lista'] },
    { nombre: 'Importar catalogo', ruta: '/catalogo/importar', categoria: 'Inventario', keywords: ['catalogo', 'importar'] },
    
    // Informes
    { nombre: 'Informes', ruta: '/informes', categoria: 'Informes', keywords: ['informe', 'reporte', 'estadistica'] },
    
    // Administración
    { nombre: 'Configuración', ruta: '/configuracion', categoria: 'Administración', keywords: ['config', 'ajuste', 'preferencia'] },
  ];

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

  /**
   * Busca secciones según el término ingresado.
   */
  buscarSecciones(): void {
    const termino = this.terminoBusqueda.toLowerCase().trim();
    
    if (termino.length < 2) {
      this.seccionesFiltradas = [];
      this.mostrarSugerencias = false;
      this.indiceSugerenciaSeleccionada = -1;
      return;
    }

    this.seccionesFiltradas = this.secciones.filter(seccion => {
      const nombreMatch = seccion.nombre.toLowerCase().includes(termino);
      const categoriaMatch = seccion.categoria.toLowerCase().includes(termino);
      const keywordsMatch = seccion.keywords.some(k => k.toLowerCase().includes(termino));
      
      return nombreMatch || categoriaMatch || keywordsMatch;
    }).slice(0, 8); // Máximo 8 resultados

    this.mostrarSugerencias = this.seccionesFiltradas.length > 0;
    this.indiceSugerenciaSeleccionada = -1;
  }

  /**
   * Maneja la navegación con teclado en el campo de búsqueda.
   */
  manejarTecla(event: KeyboardEvent): void {
    if (!this.mostrarSugerencias || this.seccionesFiltradas.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.indiceSugerenciaSeleccionada = 
          (this.indiceSugerenciaSeleccionada + 1) % this.seccionesFiltradas.length;
        this.scrollToSelected();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.indiceSugerenciaSeleccionada = 
          this.indiceSugerenciaSeleccionada <= 0 
            ? this.seccionesFiltradas.length - 1 
            : this.indiceSugerenciaSeleccionada - 1;
        this.scrollToSelected();
        break;

      case 'Enter':
        event.preventDefault();
        if (this.indiceSugerenciaSeleccionada >= 0) {
          this.navegarA(this.seccionesFiltradas[this.indiceSugerenciaSeleccionada]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.limpiarBusqueda();
        break;
    }
  }

  /**
   * Hace scroll al elemento seleccionado en la lista de sugerencias.
   */
  private scrollToSelected(): void {
    setTimeout(() => {
      const selected = document.querySelector('.result-item.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  /**
   * Navega a la sección seleccionada.
   */
  navegarA(seccion: SeccionMenu): void {
    // Si la sección es un filtro de productos, agregar queryParams
    if (seccion.nombre.includes('Armazones')) {
      this.router.navigate([seccion.ruta], { queryParams: { grupo: 'ARMAZONES' } });
    } else if (seccion.nombre.includes('Lentes de Contacto')) {
      this.router.navigate([seccion.ruta], { queryParams: { grupo: 'LENTES DE CONTACTO' } });
    } else if (seccion.nombre.includes('Lunas')) {
      this.router.navigate([seccion.ruta], { queryParams: { grupo: 'LUNAS' } });
    } else if (seccion.nombre.includes('Gafas')) {
      this.router.navigate([seccion.ruta], { queryParams: { grupo: 'GAFAS' } });
    } else {
      this.router.navigate([seccion.ruta]);
    }
    
    this.limpiarBusqueda();
  }

  /**
   * Limpia el campo de búsqueda y oculta sugerencias.
   */
  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.seccionesFiltradas = [];
    this.mostrarSugerencias = false;
    this.indiceSugerenciaSeleccionada = -1;
  }

  /**
   * Cierra las sugerencias al hacer clic fuera.
   */
  @HostListener('document:click', ['$event'])
  clickOut(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-container')) {
      this.mostrarSugerencias = false;
    }
  }
}
