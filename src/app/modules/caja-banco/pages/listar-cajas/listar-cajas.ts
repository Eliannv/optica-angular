import { Component, inject, OnInit } from '@angular/core';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { Router } from '@angular/router';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-listar-cajas',
  standalone: false,
  templateUrl: './listar-cajas.html',
  styleUrls: ['./listar-cajas.css']
})
export class ListarCajasComponent implements OnInit {
  private cajaBancoService = inject(CajaBancoService);
  private cajaChicaService = inject(CajaChicaService);
  private router = inject(Router);

  cajas: CajaBanco[] = [];
  cajasChicas: CajaChica[] = [];
  movimientosGlobales: MovimientoCajaBanco[] = [];
  cargando = false;

  ngOnInit(): void {
    this.cargarCajas();
    this.cargarCajasChicas();
    this.cargarMovimientosGlobales();
  }

  cargarCajas(): void {
    this.cargando = true;
    this.cajaBancoService.getCajasBanco().subscribe({
      next: (cajas) => {
        // Mostrar todas las cajas (ABIERTA y CERRADA)
        this.cajas = (cajas || []);
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar cajas:', error);
        this.cargando = false;
      }
    });
  }

  cargarCajasChicas(): void {
    this.cajaChicaService.getCajasChicas().subscribe({
      next: (cajas) => {
        this.cajasChicas = cajas || [];
      },
      error: (error) => {
        console.error('Error al cargar cajas chicas:', error);
      }
    });
  }

  cargarMovimientosGlobales(): void {
    this.cajaBancoService.getMovimientosCajaBanco().subscribe({
      next: (movimientos) => {
        this.movimientosGlobales = (movimientos || []).filter(m => !m.caja_banco_id);
      },
      error: (error) => {
        console.error('Error al cargar movimientos globales:', error);
      }
    });
  }

  verDetalles(cajaId: string): void {
    this.router.navigate(['/caja-banco/ver', cajaId]);
  }

  registrarMovimiento(): void {
    this.router.navigate(['/caja-banco/registrar-movimiento']);
  }

  // 🔹 Eliminar una caja chica y restar el dinero de la caja banco
  async eliminarCajaChica(cajaChica: CajaChica): Promise<void> {
    const resultado = await Swal.fire({
      title: '¿Eliminar Caja Chica?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaChica.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaChica.usuario_nombre || '-'}</p>
          <p><strong>Monto Inicial:</strong> ${this.formatoMoneda(cajaChica.monto_inicial || 0)}</p>
          <p><strong>Monto Actual:</strong> ${this.formatoMoneda(cajaChica.monto_actual || 0)}</p>
          <p style="color: red; margin-top: 1rem;"><strong>Se restará ${this.formatoMoneda(cajaChica.monto_actual || 0)} de la caja banco</strong></p>
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
        // Obtener la caja banco abierta del mismo día
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const cajaBancoHoy = this.cajas.find(c => {
          const fechaCaja = c.fecha instanceof Date 
            ? new Date(c.fecha) 
            : (c.fecha && typeof c.fecha === 'object' && 'toDate' in c.fecha)
              ? (c.fecha as any).toDate()
              : new Date(c.fecha || new Date());
          fechaCaja.setHours(0, 0, 0, 0);
          return fechaCaja.getTime() === hoy.getTime() && c.estado === 'ABIERTA';
        });

        if (cajaBancoHoy) {
          // Restar el monto de la caja chica del saldo de la caja banco
          const nuevoSaldo = (cajaBancoHoy.saldo_actual || 0) - (cajaChica.monto_actual || 0);
          
          await this.cajaBancoService.actualizarSaldoCajaBanco(cajaBancoHoy.id!, nuevoSaldo);
        }

        // Eliminar la caja chica
        await this.cajaChicaService.eliminarCajaChica(cajaChica.id!);
        
        // Recargar listas
        this.cargarCajas();
        this.cargarCajasChicas();

        Swal.fire({
          title: '✅ Eliminado',
          text: 'Caja chica eliminada y dinero restado de caja banco',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al eliminar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo eliminar la caja chica',
          icon: 'error'
        });
      }
    }
  }

  // 🔹 Eliminar una caja banco
  async eliminarCajaBanco(cajaBanco: CajaBanco): Promise<void> {
    // Solo permitir eliminar si está CERRADA
    if (cajaBanco.estado !== 'CERRADA') {
      Swal.fire({
        title: '❌ No permitido',
        text: 'Solo puedes eliminar cajas que estén CERRADAS',
        icon: 'error'
      });
      return;
    }

    const resultado = await Swal.fire({
      title: '¿Eliminar Caja Banco?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaBanco.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaBanco.usuario_nombre || '-'}</p>
          <p><strong>Saldo Inicial:</strong> ${this.formatoMoneda(cajaBanco.saldo_inicial || 0)}</p>
          <p><strong>Saldo Actual:</strong> ${this.formatoMoneda(cajaBanco.saldo_actual || 0)}</p>
          <p><strong>Estado:</strong> ${cajaBanco.estado}</p>
          <p style="color: red; margin-top: 1rem;"><strong>⚠️ Esta acción eliminará el registro completamente</strong></p>
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
        await this.cajaBancoService.eliminarCajaBanco(cajaBanco.id!);
        
        // Recargar listas
        this.cargarCajas();

        Swal.fire({
          title: '✅ Eliminado',
          text: 'Caja banco eliminada correctamente',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al eliminar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo eliminar la caja banco',
          icon: 'error'
        });
      }
    }
  }

  getTotalGanado(): number {
    // Total de cajas cerradas
    return this.cajas.reduce((acc, c) => acc + (c.saldo_actual || 0), 0);
  }

  getTotalTransferencias(): number {
    // Solo transferencias de clientes
    return this.movimientosGlobales
      .filter(m => m.categoria === 'TRANSFERENCIA_CLIENTE' && m.tipo === 'INGRESO')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
  }

  getTotalIngresos(): number {
    // Total Ingresos = Total Ganado Cajas + TODOS los ingresos globales
    const ingresosGlobales = this.movimientosGlobales
      .filter(m => m.tipo === 'INGRESO')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
    return this.getTotalGanado() + ingresosGlobales;
  }

  getTotalEgresos(): number {
    return this.movimientosGlobales
      .filter(m => m.tipo === 'EGRESO')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
  }

  getEstadoBadge(estado: string): string {
    if (estado === 'ABIERTA') return 'badge-success';
    if (estado === 'CERRADA') return 'badge-danger';
    return 'badge-secondary';
  }

  formatoFecha(fecha: any): string {
    if (!fecha) return '-';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }

  getColorTipo(tipo: string): string {
    return tipo === 'INGRESO' ? 'ingreso' : 'egreso';
  }
}
