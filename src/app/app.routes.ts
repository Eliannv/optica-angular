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

  // 🔐 Rutas protegidas - OPERADOR y ADMINISTRADOR: Clientes e Historial Clínico
  {
    path: 'clientes',
    loadChildren: () =>
      import('./modules/clientes/clientes-module')
        .then(m => m.ClientesModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Rutas protegidas - ADMINISTRADOR: Productos
  {
    path: 'productos',
    loadChildren: () =>
      import('./modules/productos/productos-module')
        .then(m => m.ProductosModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Rutas protegidas - ADMINISTRADOR: Proveedores
  {
    path: 'proveedores',
    loadChildren: () =>
      import('./modules/proveedores/proveedores-module')
        .then(m => m.ProveedoresModule),
    canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Rutas protegidas - OPERADOR y ADMINISTRADOR: Ventas (POS)
  {
    path: 'ventas',
    loadChildren: () =>
      import('./modules/ventas/ventas-routing-module')
        .then(m => m.VentasRoutingModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  // 🔐 Rutas protegidas - OPERADOR y ADMINISTRADOR: Facturas
  {
    path: 'facturas',
    loadChildren: () =>
      import('./modules/factura/facturas-routing-module')
        .then(m => m.FacturasRoutingModule),
    canActivate: [authGuard, roleGuard([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR])]
  },

  // 🔁 Redirecciones
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
