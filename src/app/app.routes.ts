import { Routes } from '@angular/router';

export const routes: Routes = [
    {
    path: 'clientes',
    loadChildren: () =>
      import('./modules/clientes/clientes-module').then(m => m.ClientesModule)
  },
  { path: '', redirectTo: 'clientes', pathMatch: 'full' }
];
