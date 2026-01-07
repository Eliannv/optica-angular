import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { Cliente } from '../../../../core/models/cliente.model';
import { HistoriaClinica } from '../../../../core/models/historia-clinica.model';

@Component({
  standalone: true,
  selector: 'app-historial-print',
  imports: [CommonModule],
  templateUrl: './historial-print.html',
  styleUrl: './historial-print.css'
})
export class HistorialPrintComponent implements OnInit {

  clienteId!: string;

  cliente!: Cliente;
  historial!: HistoriaClinica;

  loading = true;

  constructor(
    private route: ActivatedRoute,
    private clientesSrv: ClientesService,
    private historialSrv: HistorialClinicoService
  ) {}

  async ngOnInit() {
    try {
      this.clienteId = this.route.snapshot.paramMap.get('id')!;

      // Cliente
      this.cliente = await firstValueFrom(
        this.clientesSrv.getClienteById(this.clienteId)
      );

      // Historial
      const snap = await this.historialSrv.obtenerHistorial(this.clienteId);

      if (!snap.exists()) {
        throw new Error('No existe historial clínico');
      }

      this.historial = snap.data() as HistoriaClinica;

      console.log('HISTORIAL CARGADO:', this.historial); // 🔥 CLAVE
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }

    // Auto imprimir
    setTimeout(() => window.print(), 300);
  }
}
