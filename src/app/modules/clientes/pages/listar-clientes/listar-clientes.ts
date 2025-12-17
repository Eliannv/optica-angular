import { Component, OnInit } from '@angular/core';
import { Cliente } from '../../../../core/models/cliente.model';
import { Observable } from 'rxjs';
import { ClientesService } from '../../../../core/services/clientes';

@Component({
  selector: 'app-listar-clientes',
  standalone: false,
  templateUrl: './listar-clientes.html',
  styleUrl: './listar-clientes.css',
})
export class ListarClientes implements OnInit{
  clientes$!: Observable<Cliente[]>;

  constructor(private clientesService: ClientesService) {}

  ngOnInit() {
    this.clientes$ = this.clientesService.getClientes();
  }
}
