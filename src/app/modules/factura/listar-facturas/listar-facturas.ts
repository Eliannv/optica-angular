import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FacturasService } from '../../../core/services/facturas';


@Component({
  selector: 'app-listar-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listar-facturas.html',
  styleUrl: './listar-facturas.css'
})
export class ListarFacturasComponent {
  term = '';
  facturas: any[] = [];
  filtradas: any[] = [];

  constructor(private facturasSrv: FacturasService, private router: Router) {
    this.facturasSrv.getFacturas().subscribe((data: any[]) => {
      this.facturas = data || [];
      this.filtrar();
    });
  }

  filtrar() {
    const t = (this.term || '').trim().toLowerCase();
    if (!t) { this.filtradas = [...this.facturas]; return; }
    this.filtradas = this.facturas.filter(f =>
      (f.clienteNombre || '').toLowerCase().includes(t) ||
      (f.metodoPago || '').toLowerCase().includes(t) ||
      (f.id || '').toLowerCase().includes(t)
    );
  }

  ver(id: string) {
    this.router.navigate(['/facturas', id]);
  }

  nuevaVenta() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}
