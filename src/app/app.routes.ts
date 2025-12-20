import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Ruta pública - Login
  {
    path: 'login',
    loadComponent: () =>
      import('./shared/components/auth/auth-carousel').then(m => m.AuthCarousel)
  },

  // Rutas protegidas - Requieren autenticación
  {
    path: 'clientes',
    loadChildren: () =>
      import('./modules/clientes/clientes-module').then(m => m.ClientesModule),
    canActivate: [authGuard]
  },
  {
    path: 'productos',
    loadChildren: () =>
      import('./modules/productos/productos-module').then(m => m.ProductosModule),
    canActivate: [authGuard]
  },
  {
    path: 'proveedores',
    loadChildren: () =>
      import('./modules/proveedores/proveedores-module').then(m => m.ProveedoresModule),
    canActivate: [authGuard]
  },

  // Redireccionamientos
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
