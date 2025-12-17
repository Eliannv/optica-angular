import { Component } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Router } from '@angular/router';

@Component({
  selector: 'app-crear-proveedor',
  standalone: false,
  templateUrl: './crear-proveedor.html',
  styleUrl: './crear-proveedor.css',
})
export class CrearProveedor {

  proveedor: Proveedor = {
    nomProv: '',
    rucProv: '',
    repProv: '',
    telProv: '',
    telProv2: '',
    dirProv: '',
    saldo: 0
  };

  constructor(
    private proveedoresService: ProveedoresService,
    private router: Router
  ) {}

  guardar() {
    if (this.proveedor.nomProv && this.proveedor.rucProv) {
      this.proveedor.fecIng = new Date();
      this.proveedoresService.createProveedor(this.proveedor).then(() => {
        alert('Proveedor creado exitosamente');
        this.router.navigate(['/proveedores']);
      }).catch(error => {
        console.error('Error al crear proveedor:', error);
        alert('Error al crear el proveedor');
      });
    } else {
      alert('Por favor complete los campos obligatorios');
    }
  }

  cancelar() {
    this.router.navigate(['/proveedores']);
  }
}
