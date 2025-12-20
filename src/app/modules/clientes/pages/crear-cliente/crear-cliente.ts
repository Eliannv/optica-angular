import { Component } from '@angular/core';
import { Cliente } from '../../../../core/models/cliente.model';
import { ClientesService } from '../../../../core/services/clientes';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';

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
    private router: Router,
    private route: ActivatedRoute
  ) {}
async guardar() {
  const ref = await this.clientesService.createCliente(this.cliente);

  const returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '/clientes/listar';

  this.router.navigate([returnTo], {
    queryParams: { selectedId: ref.id }
  });
}
}

