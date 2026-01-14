import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CrearProveedor } from './pages/crear-proveedor/crear-proveedor';
import { ListarProveedores } from './pages/listar-proveedores/listar-proveedores';

const routes: Routes = [
  { path: '', component: ListarProveedores },
  { path: 'crear', component: CrearProveedor },
  { path: 'editar/:id', component: CrearProveedor },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProveedoresRoutingModule { }
