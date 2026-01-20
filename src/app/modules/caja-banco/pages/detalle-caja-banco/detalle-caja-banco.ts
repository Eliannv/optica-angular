import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-detalle-caja-banco',
  standalone: false,
  templateUrl: './detalle-caja-banco.html',
  styleUrls: ['./detalle-caja-banco.css']
})
export class DetalleCajaBancoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cajaBancoService = inject(CajaBancoService);
  private cajaChicaService = inject(CajaChicaService);

  caja: CajaBanco | null = null;
  cajasChicas: CajaChica[] = [];
  movimientos: MovimientoCajaBanco[] = [];
  cajaId = '';
  cargando = false;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.cajaId = params['id'];
      if (!this.cajaId) return;
      this.cargarDatos();
    });
  }

  cargarDatos(): void {
    this.cargando = true;
    this.cajaBancoService.getCajaBancoById(this.cajaId).subscribe(c => this.caja = c);
    this.cajaBancoService.getMovimientosCajaBanco(this.cajaId).subscribe(m => {
      this.movimientos = m || [];
      this.cargando = false;
    });
    // Cargar cajas chicas del mismo día
    if (this.caja?.fecha) {
      const fecha = this.caja.fecha instanceof Date ? this.caja.fecha : (this.caja.fecha as any).toDate?.() || new Date(this.caja.fecha);
      const inicio = new Date(fecha);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
      this.cajaChicaService.getCajasChicas().subscribe(todas => {
        this.cajasChicas = (todas || []).filter(cc => {
          const ccFecha = cc.fecha instanceof Date ? cc.fecha : (cc.fecha as any).toDate?.() || new Date(cc.fecha);
          ccFecha.setHours(0, 0, 0, 0);
          return ccFecha.getTime() === inicio.getTime();
        });
      });
    }
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  imprimirCaja(): void {
    this.router.navigate(['/caja-banco/imprimir', this.cajaId]);
  }

  volver(): void {
    this.router.navigate(['/caja-banco']);
  }

  async eliminarCajaChica(cajaChica: CajaChica): Promise<void> {
    const resultado = await Swal.fire({
      title: '¿Eliminar Caja Chica?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaChica.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaChica.usuario_nombre || '-'}</p>
          <p><strong>Monto Actual:</strong> ${this.formatoMoneda(cajaChica.monto_actual || 0)}</p>
          <p style="color: red;"><strong>Se restará ${this.formatoMoneda(cajaChica.monto_actual || 0)} de la caja banco</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        if (this.caja?.id) {
          const nuevoSaldo = (this.caja.saldo_actual || 0) - (cajaChica.monto_actual || 0);
          await this.cajaBancoService.actualizarSaldoCajaBanco(this.caja.id, nuevoSaldo);
        }
        await this.cajaChicaService.eliminarCajaChica(cajaChica.id!);
        this.cargarDatos();
        Swal.fire({ title: '✅ Eliminado', text: 'Caja chica eliminada', icon: 'success', timer: 2000 });
      } catch (error) {
        Swal.fire({ title: '❌ Error', text: 'No se pudo eliminar', icon: 'error' });
      }
    }
  }
}
