/**
 * Configuración de rutas de la aplicación.
 * 
 * Define todas las rutas disponibles con lazy loading para optimizar el rendimiento.
 * Utiliza guards para proteger rutas según autenticación y roles de usuario.
 * 
 * Estructura de protección:
 * - authGuard: Verifica que el usuario esté autenticado
 * - roleGuard: Valida permisos según rol (ADMINISTRADOR, OPERADOR)
 * 
 * Tipos de carga:
 * - loadComponent: Componentes standalone cargados de forma diferida
 * - loadChildren: Módulos completos con sus propias rutas lazy-loaded
 * 
 * Roles disponibles:
 * - ADMINISTRADOR: Acceso completo al sistema
 * - OPERADOR: Acceso limitado (clientes, ventas, facturas, cajas)
 */

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { RolUsuario } from './core/models/usuario.model';

export const routes: Routes = [

  /* ==========================================================================
     RUTAS PÚBLICAS (Sin autenticación requerida)
     ========================================================================== */

  /**
   * Ruta de autenticación pública.
   * Permite login, registro y recuperación de contraseña mediante carrusel.
   */
  {
    path: 'login',
    loadComponent: () =>
      import('./shared/components/auth/auth-carousel')
        .then(m => m.AuthCarousel)
  },

  /* ==========================================================================
     RUTAS PROTEGIDAS - MÓDULO CLIENTES
     Acceso: Operadores y Administradores
     ========================================================================== */

  /**
   * Impresión de historial clínico.
   * Vista optimizada para impresión sin navbar/sidebar.
   */
  {
    path: 'historial-print/:id',
    loadComponent: () =>
      import('./modules/clientes/pages/historial-print/historial-print')
        .then(m => m.HistorialPrintComponent),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  /**
   * Módulo de clientes e historial clínico.
   * Incluye listado, creación, edición y gestión de historiales médicos.
   */
  {
    path: 'clientes',
    loadChildren: () =>
      import('./modules/clientes/clientes-module')
        .then(m => m.ClientesModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  /* ==========================================================================
     RUTAS PROTEGIDAS - INVENTARIO Y PROVEEDORES
     Acceso: Solo Administradores
     ========================================================================== */

  /**
   * Módulo de productos.
   * Gestión completa del catálogo de productos (óptica, lentes, accesorios).
   */
  {
    path: 'productos',
    loadChildren: () =>
      import('./modules/productos/productos-module')
        .then(m => m.ProductosModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  /**
   * Módulo de ingresos de inventario.
   * Registro de entradas de mercancía y actualización de stock.
   */
  {
    path: 'ingresos',
    loadChildren: () =>
      import('./modules/ingresos/ingresos-module')
        .then(m => m.IngresosModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  /**
   * Módulo de proveedores.
   * Administración de proveedores y gestión de relaciones comerciales.
   */
  {
    path: 'proveedores',
    loadChildren: () =>
      import('./modules/proveedores/proveedores-module')
        .then(m => m.ProveedoresModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  /* ==========================================================================
     RUTAS PROTEGIDAS - VENTAS Y FACTURACIÓN
     Acceso: Operadores y Administradores
     ========================================================================== */

  /**
   * Módulo de ventas (Punto de Venta - POS).
   * Sistema de registro de ventas con cálculo automático y generación de tickets.
   */
  {
    path: 'ventas',
    loadChildren: () =>
      import('./modules/ventas/ventas-routing-module')
        .then(m => m.VentasRoutingModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  /**
   * Módulo de facturas.
   * Consulta, generación y gestión de facturas emitidas.
   */
  {
    path: 'facturas',
    loadChildren: () =>
      import('./modules/factura/facturas-routing-module')
        .then(m => m.FacturasRoutingModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  /* ==========================================================================
     RUTAS PROTEGIDAS - GESTIÓN FINANCIERA
     Acceso: Operadores y Administradores
     ========================================================================== */

  /**
   * Módulo de caja chica.
   * Control diario de efectivo, ingresos y egresos menores.
   */
  {
    path: 'caja-chica',
    loadChildren: () =>
      import('./modules/caja-chica/caja-chica-module')
        .then(m => m.CajaChicaModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  /**
   * Módulo de caja banco.
   * Gestión de movimientos bancarios, transferencias y pagos con tarjeta.
   */
  {
    path: 'caja-banco',
    loadChildren: () =>
      import('./modules/caja-banco/caja-banco-module')
        .then(m => m.CajaBancoModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  /* ==========================================================================
     RUTAS PROTEGIDAS - ADMINISTRACIÓN
     Acceso: Solo Administradores
     ========================================================================== */

  /**
   * Gestión de empleados.
   * Administración de usuarios, roles, permisos y asignación de sucursales.
   */
  {
    path: 'empleados',
    loadComponent: () =>
      import('./modules/empleados/empleados.component')
        .then(m => m.EmpleadosComponent),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  /* ==========================================================================
     REDIRECCIONES
     Manejo de rutas raíz y no encontradas
     ========================================================================== */

  /** Ruta raíz redirige a login */
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  
  /** Rutas no encontradas redirigen a login */
  { path: '**', redirectTo: 'login' }
];
