import { Component, OnInit } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { Observable } from 'rxjs';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Router } from '@angular/router';

@Component({
  selector: 'app-listar-proveedores',
  standalone: false,
  templateUrl: './listar-proveedores.html',
  styleUrl: './listar-proveedores.css',
})
export class ListarProveedores implements OnInit {
  proveedores$!: Observable<Proveedor[]>;

  constructor(
    private proveedoresService: ProveedoresService,
    private router: Router
  ) {}

  ngOnInit() {
    this.proveedores$ = this.proveedoresService.getProveedores();
  }

  crearProveedor() {
    this.router.navigate(['/proveedores/crear']);
  }

  eliminarProveedor(id: string) {
    if (confirm('¿Está seguro de eliminar este proveedor?')) {
      this.proveedoresService.deleteProveedor(id).then(() => {
        alert('Proveedor eliminado exitosamente');
      }).catch(error => {
        console.error('Error al eliminar proveedor:', error);
        alert('Error al eliminar el proveedor');
      });
    }
  }
}
