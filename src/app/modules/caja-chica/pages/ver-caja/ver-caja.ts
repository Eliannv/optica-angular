import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CajaChica, MovimientoCajaChica, ResumenCajaChica } from '../../../../core/models/caja-chica.model';
import Swal from 'sweetalert2';

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
  esAdmin = false;

  ngOnInit(): void {
    this.cajaId = this.route.snapshot.paramMap.get('id') || '';
    this.esAdmin = this.authService.isAdmin();
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
    const confirmar = await Swal.fire({
      icon: 'question',
      title: 'Cerrar Caja Chica',
      text: 'El saldo será sumado a Caja Banco. ¿Deseas continuar?',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmar.isConfirmed) return;

    try {
      const montoActual = this.caja?.monto_actual || 0;
      const usuario = this.authService.getCurrentUser();

      // Crear fecha normalizada a medianoche en zona horaria local
      const hoy = new Date();
      const fechaNormalizada = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);

      // Buscar si existe Caja Banco para el mismo día
      const cajasBanco = await firstValueFrom(this.cajaBancoService.getCajasBanco());
      const cajaBancoHoy = cajasBanco.find(c => {
        const fechaCaja = c.fecha instanceof Date 
          ? new Date(c.fecha) 
          : (c.fecha && typeof c.fecha === 'object' && 'toDate' in c.fecha)
            ? (c.fecha as any).toDate()
            : new Date(c.fecha || new Date());
        fechaCaja.setHours(0, 0, 0, 0);
        const hoyNormalizado = new Date(fechaNormalizada);
        return fechaCaja.getTime() === hoyNormalizado.getTime();
      });

      // Si existe Caja Banco, sumar el monto al saldo actual
      if (cajaBancoHoy?.id) {
        const nuevoSaldo = (cajaBancoHoy.saldo_actual || 0) + montoActual;
        await this.cajaBancoService.actualizarSaldoCajaBanco(cajaBancoHoy.id, nuevoSaldo);
      } else {
        // Si no existe, crearla
        await this.cajaBancoService.abrirCajaBanco({
          fecha: fechaNormalizada,
          saldo_inicial: 0,
          saldo_actual: montoActual,
          estado: 'ABIERTA',
          usuario_id: usuario?.id,
          usuario_nombre: usuario?.nombre,
          observacion: 'Caja Banco creada automáticamente'
        });
      }

      // Cerrar la Caja Chica
      await this.cajaChicaService.cerrarCajaChica(this.cajaId, montoActual);

      // 🗑️ Limpiar localStorage
      localStorage.removeItem('cajaChicaAbierta');

      // Preguntar si desea imprimir el reporte
      const imprimirResult = await Swal.fire({
        icon: 'success',
        title: 'Caja cerrada correctamente',
        text: 'Saldo sumado a Caja Banco exitosamente. ¿Deseas imprimir el reporte de cierre?',
        showCancelButton: true,
        confirmButtonText: 'Sí, imprimir',
        cancelButtonText: 'No, solo cerrar'
      });

      if (imprimirResult.isConfirmed) {
        await this.imprimirReporteCierre();
      }

      this.router.navigate(['/caja-chica']);
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al cerrar',
        text: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async eliminarMovimiento(movimientoId: string): Promise<void> {
    const confirmar = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar movimiento',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmar.isConfirmed) return;

    try {
      await this.cajaChicaService.eliminarMovimiento(this.cajaId, movimientoId);
      await Swal.fire({
        icon: 'success',
        title: 'Movimiento eliminado',
        timer: 1500,
        showConfirmButton: false
      });
      this.cargarDetalles();
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al eliminar el movimiento'
      });
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

  async imprimirReporteCierre(): Promise<void> {
    try {
      // Convertir Timestamps a Date para evitar errores NG02100
      const convertirTimestamp = (fecha: any): Date => {
        if (!fecha) return new Date();
        if (fecha instanceof Date) return fecha;
        if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
        return new Date(fecha);
      };

      // Preparar datos para el reporte con conversión de Timestamps
      const reporteData = {
        caja: {
          ...this.caja,
          fecha: convertirTimestamp(this.caja?.fecha),
          cerrado_en: this.caja?.cerrado_en ? convertirTimestamp(this.caja.cerrado_en) : null,
          createdAt: this.caja?.createdAt ? convertirTimestamp(this.caja.createdAt) : new Date()
        },
        movimientos: this.movimientos.map(m => ({
          ...m,
          fecha: convertirTimestamp(m.fecha),
          createdAt: m.createdAt ? convertirTimestamp(m.createdAt) : new Date()
        })),
        resumen: { ...this.resumen },
        fechaReporte: new Date(),
        usuarioCierre: this.authService.getCurrentUser()?.nombre || 'N/A'
      };

      console.log('📄 Datos del reporte preparados:', reporteData);

      // Navegar al componente de impresión con los datos
      this.router.navigate(['/caja-chica/imprimir'], {
        state: { reporteData }
      });
    } catch (error) {
      console.error('❌ Error al preparar reporte:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el reporte para impresión'
      });
    }
  }
}
