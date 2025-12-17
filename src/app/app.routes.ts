import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'clientes',
    loadChildren: () =>
      import('./modules/clientes/clientes-module').then(m => m.ClientesModule)
  },
  {
    path: 'productos',
    loadChildren: () =>
      import('./modules/productos/productos-module').then(m => m.ProductosModule)
  },
  {
    path: 'proveedores',
    loadChildren: () =>
      import('./modules/proveedores/proveedores-module').then(m => m.ProveedoresModule)
  },
  { path: '', redirectTo: 'clientes', pathMatch: 'full' }
];
