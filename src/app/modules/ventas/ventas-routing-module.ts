import { CrearVentaComponent } from './crear-venta/crear-venta';
import { Routes } from '@angular/router';
import { cajaChicaGuard } from '../../core/guards/caja-chica.guard';

export const VentasRoutingModule: Routes = [
  {
    path: 'crear',
    canActivate: [cajaChicaGuard],
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
