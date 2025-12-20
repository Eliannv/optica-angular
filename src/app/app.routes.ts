import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [

  // 🔓 Login público
  {
    path: 'login',
    loadComponent: () =>
      import('./shared/components/auth/auth-carousel')
        .then(m => m.AuthCarousel)
  },

  // 🔐 Rutas protegidas
  {
    path: 'clientes',
    loadChildren: () =>
      import('./modules/clientes/clientes-module')
        .then(m => m.ClientesModule),
    canActivate: [authGuard]
  },

  {
    path: 'productos',
    loadChildren: () =>
      import('./modules/productos/productos-module')
        .then(m => m.ProductosModule),
    canActivate: [authGuard]
  },

  {
    path: 'proveedores',
    loadChildren: () =>
      import('./modules/proveedores/proveedores-module')
        .then(m => m.ProveedoresModule),
    canActivate: [authGuard]
  },

  // ✅ NUEVO: Ventas (POS)
  {
    path: 'ventas',
    loadChildren: () =>
      import('./modules/ventas/ventas-routing-module')
        .then(m => m.VentasRoutingModule),
    canActivate: [authGuard]
  },

  // ✅ NUEVO: Facturas
  {
    path: 'facturas',
    loadChildren: () =>
      import('./modules/factura/facturas-routing-module')
        .then(m => m.FacturasRoutingModule),
    canActivate: [authGuard]
  },

  // 🔁 Redirecciones
  { path: '', redirectTo: 'clientes', pathMatch: 'full' },
  { path: '**', redirectTo: 'clientes' }
];
