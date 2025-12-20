import { CrearVentaComponent } from './crear-venta/crear-venta';
import { Routes } from '@angular/router';

export const VentasRoutingModule: Routes = [
  {
    path: 'crear',
    loadComponent: () =>
      import('./crear-venta/crear-venta')
        .then(m => m.CrearVentaComponent),
  },

  // ✅ NUEVA RUTA
  {
    path: 'deuda',
    loadComponent: () =>
      import('./cobrar-deuda/cobrar-deuda')
        .then(m => m.CobrarDeudaComponent),
  },

  // opcional: redirección dentro de ventas
  { path: '', redirectTo: 'crear', pathMatch: 'full' },
];
