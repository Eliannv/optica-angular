import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CajaChica, MovimientoCajaChica, ResumenCajaChica } from '../../../../core/models/caja-chica.model';

@Component({
  selector: 'app-ver-caja',
  standalone: false,
  templateUrl: './ver-caja.html',
  styleUrls: ['./ver-caja.css']
})
export class VerCajaComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  cajaId: string = '';
  caja: CajaChica | null = null;
  movimientos: MovimientoCajaChica[] = [];
  resumen: ResumenCajaChica | null = null;
  cargando = false;
  error = '';

  ngOnInit(): void {
    this.cajaId = this.route.snapshot.paramMap.get('id') || '';
    this.cargarDetalles();
  }

  cargarDetalles(): void {
    if (!this.cajaId) return;

    this.cargando = true;
    this.error = '';

    // Cargar caja
    this.cajaChicaService.getCajaChicaById(this.cajaId).subscribe({
      next: (caja) => {
        this.caja = caja;
      },
      error: (error) => {
        console.error('Error al cargar caja:', error);
        this.error = 'Error al cargar la caja chica';
      }
    });

    // Cargar movimientos
    this.cajaChicaService.getMovimientosCajaChica(this.cajaId).subscribe({
      next: (movimientos) => {
        this.movimientos = movimientos;
      },
      error: (error) => {
        console.error('Error al cargar movimientos:', error);
      }
    });

    // Cargar resumen
    this.cajaChicaService.getResumenCajaChica(this.cajaId).then(
      (resumen) => {
        this.resumen = resumen;
        this.cargando = false;
      },
      (error) => {
        console.error('Error al cargar resumen:', error);
        this.cargando = false;
      }
    );
  }

  registrarMovimiento(): void {
    this.router.navigate(['/caja-chica/registrar', this.cajaId]);
  }

  async cerrarCaja(): Promise<void> {
    if (!confirm('¿Está seguro de que desea cerrar esta caja?\n\nEl saldo será transferido a Caja Banco.')) {
      return;
    }

    try {
      const monto = this.caja?.monto_actual || 0;
      const usuario = this.authService.getCurrentUser();

      // Paso 1: Crear caja banco y registrar el cierre
      const cajaBancoId = await this.cajaBancoService.abrirCajaBanco({
        fecha: new Date(),
        saldo_inicial: monto,
        saldo_actual: monto,
        estado: 'ABIERTA',
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre,
        observacion: `Cierre de Caja Chica - ${new Date().toLocaleDateString('es-ES')}`
      });

      // Paso 2: Registrar el movimiento en Caja Banco
      await this.cajaBancoService.registrarCierreCajaChica(
        cajaBancoId,
        this.cajaId,
        monto,
        usuario?.id,
        usuario?.nombre
      );

      // Paso 3: Cerrar Caja Chica
      await this.cajaChicaService.cerrarCajaChica(this.cajaId, monto);

      // 🗑️ Limpiar localStorage
      localStorage.removeItem('cajaChicaAbierta');

      alert('✓ Caja cerrada y transferida a Caja Banco exitosamente');
      this.router.navigate(['/caja-chica']);
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      alert('Error al cerrar la caja: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  }

  async eliminarMovimiento(movimientoId: string): Promise<void> {
    if (!confirm('¿Está seguro de que desea eliminar este movimiento?')) {
      return;
    }

    try {
      await this.cajaChicaService.eliminarMovimiento(this.cajaId, movimientoId);
      alert('Movimiento eliminado exitosamente');
      this.cargarDetalles();
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      alert('Error al eliminar el movimiento');
    }
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  formatoHora(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatoMoneda(monto: number | undefined): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  getTipoBadgeClass(tipo: string): string {
    return tipo === 'INGRESO' ? 'badge-success' : 'badge-warning';
  }

  volver(): void {
    this.router.navigate(['/caja-chica']);
  }
}
