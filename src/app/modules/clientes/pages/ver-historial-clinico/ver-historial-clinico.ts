import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { ClientesService } from '../../../../core/services/clientes';

@Component({
  selector: 'app-ver-historial-clinico',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ver-historial-clinico.html',
  styleUrl: './ver-historial-clinico.css'
})
export class VerHistorialClinicoComponent implements OnInit {

  clienteId!: string;

  loading = true;
  existeHistorial = false;

  clienteNombre = '';
  clienteCedula = '';
  clienteTelefono = '';

  historial: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private historialSrv: HistorialClinicoService,
    private clientesSrv: ClientesService
  ) {}

  async ngOnInit(): Promise<void> {
    // Soporta /ver/:clienteId o /ver/:id
    this.clienteId =
      this.route.snapshot.paramMap.get('clienteId') ||
      this.route.snapshot.paramMap.get('id') ||
      '';

    if (!this.clienteId) {
      this.loading = false;
      return;
    }

    // 1) Cargar datos del cliente (para header)
    try {
      const c: any = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));
      const nombres = `${c?.nombres ?? ''} ${c?.apellidos ?? ''}`.trim();
      this.clienteNombre = nombres || 'Cliente';
      this.clienteCedula = c?.cedula ?? '';
      this.clienteTelefono = c?.telefono ?? '';
    } catch {
      // si falla, solo no mostramos datos del cliente
    }

    // 2) Cargar historial
    const snap = await this.historialSrv.obtenerHistorial(this.clienteId);
    this.existeHistorial = snap.exists();
    this.historial = snap.exists() ? snap.data() : null;

    this.loading = false;
  }

  volver(): void {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  editar(): void {
    // manda al mismo form pero en modo edit
    this.router.navigate([`/clientes/${this.clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'edit' }
    });
  }

  crear(): void {
    // por si NO existe historial
    this.router.navigate([`/clientes/${this.clienteId}/crear-historial-clinico`], {
      queryParams: { mode: 'create' }
    });
  }
}
