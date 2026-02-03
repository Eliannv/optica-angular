import { Routes } from '@angular/router';

/**
 * Rutas para el módulo de Egresos de Mercadería
 * 
 * Componentes standalone lazy-loaded:
 * - /egresos-mercaderia/listado - Listado e informe de egresos
 * - /egresos-mercaderia/registrar - Formulario de registro de egreso
 * - /egresos-mercaderia/ver/:id - Ver detalle de un egreso
 */
export const EGRESOS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'listado',
    pathMatch: 'full'
  },
  {
    path: 'listado',
    loadComponent: () => import('./pages/listado-egresos/listado-egresos').then(m => m.ListadoEgresos),
    title: 'Egresos de Mercadería'
  },
  {
    path: 'registrar',
    loadComponent: () => import('./pages/registrar-egreso/registrar-egreso').then(m => m.RegistrarEgreso),
    title: 'Registrar Egreso'
  },
  {
    path: 'ver/:id',
    loadComponent: () => import('./pages/ver-egreso/ver-egreso').then(m => m.VerEgresoComponent),
    title: 'Detalle de Egreso'
  }
];
