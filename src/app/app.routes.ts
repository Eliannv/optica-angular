import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { RolUsuario } from './core/models/usuario.model';

export const routes: Routes = [

  // 🔓 Login público
  {
    path: 'login',
    loadComponent: () =>
      import('./shared/components/auth/auth-carousel')
        .then(m => m.AuthCarousel)
  },

  // 🔓 Recuperar contraseña (público)
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./shared/components/auth/forgot-password')
        .then(m => m.ForgotPasswordComponent)
  },

  // 🟢 IMPRESIÓN DE HISTORIAL CLÍNICO (PROTEGIDA)
  {
    path: 'historial-print/:id',
    loadComponent: () =>
      import('./modules/clientes/pages/historial-print/historial-print')
        .then(m => m.HistorialPrintComponent),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Clientes e Historial Clínico
  {
    path: 'clientes',
    loadChildren: () =>
      import('./modules/clientes/clientes-module')
        .then(m => m.ClientesModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Productos
  {
    path: 'productos',
    loadChildren: () =>
      import('./modules/productos/productos-module')
        .then(m => m.ProductosModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Ingresos de Inventario
  {
    path: 'ingresos',
    loadChildren: () =>
      import('./modules/ingresos/ingresos-module')
        .then(m => m.IngresosModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Proveedores
  {
    path: 'proveedores',
    loadChildren: () =>
      import('./modules/proveedores/proveedores-module')
        .then(m => m.ProveedoresModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Ventas (POS)
  {
    path: 'ventas',
    loadChildren: () =>
      import('./modules/ventas/ventas-routing-module')
        .then(m => m.VentasRoutingModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Facturas
  {
    path: 'facturas',
    loadChildren: () =>
      import('./modules/factura/facturas-routing-module')
        .then(m => m.FacturasRoutingModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Empleados
  {
    path: 'empleados',
    loadComponent: () =>
      import('./modules/empleados/empleados.component')
        .then(m => m.EmpleadosComponent),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  // 🔁 Redirecciones
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
