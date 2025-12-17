import { Component } from '@angular/core';
import { Cliente } from '../../../../core/models/cliente.model';
import { ClientesService } from '../../../../core/services/clientes';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-crear-cliente',
  standalone: false,
  templateUrl: './crear-cliente.html',
  styleUrl: './crear-cliente.css',
})
export class CrearCliente {

  cliente: Cliente = {
    nombres: '',
    telefono: '',
    direccion: '',
    email: '',
    apellidos: '',
    cedula: ''
  };

  constructor(
    private clientesService: ClientesService,
    private router: Router
  ) {}

  guardar() {
    this.clientesService.createCliente(this.cliente).then(() => {
      this.router.navigate(['/clientes']);
    });
  }
}
