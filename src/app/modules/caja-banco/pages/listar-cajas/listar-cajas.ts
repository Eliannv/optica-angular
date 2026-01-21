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
    // 🔹 Cargar TODAS las cajas banco (activas e inactivas) para cálculos correctos
    this.cajaBancoService.getCajasBancoTodas().subscribe({
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
    // 🔹 Cargar TODAS las cajas chicas (activas e inactivas)
    this.cajaChicaService.getCajasChicasTodas().subscribe({
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
    this.router.navigate(['/caja-banco', cajaId, 'detalle']);
  }

  registrarMovimiento(): void {
    this.router.navigate(['/caja-banco/registrar-movimiento']);
  }

  imprimirMensualActual(): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    this.router.navigate(['/caja-banco/imprimir-mensual', String(year), String(month)]);
  }

  // 🔹 Cerrar mes y abrir nuevo periodo
  async cerrarMes(): Promise<void> {
    const ahora = new Date();
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const yearAnterior = mesAnterior.getFullYear();
    const monthAnterior = mesAnterior.getMonth() + 1;

    const resultado = await Swal.fire({
      title: '📅 Cerrar Mes',
      html: `
        <div style="text-align: left;">
          <p>Vas a cerrar el mes de <strong>${this.getNombreMes(monthAnterior - 1)} ${yearAnterior}</strong></p>
          <p style="margin-top: 1rem;">Esto hará:</p>
          <ul style="text-align: left; padding-left: 1.5rem;">
            <li>Cerrar todas las cajas banco del mes</li>
            <li>Generar resumen mensual</li>
            <li>Abrir nueva caja banco para el mes actual</li>
          </ul>
          <p style="color: #e67e22; margin-top: 1rem;"><strong>⚠️ Esta acción no se puede deshacer</strong></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cerrar mes',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        // Mostrar loading
        Swal.fire({
          title: 'Cerrando mes...',
          text: 'Por favor espera',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Cerrar todas las cajas del mes anterior
        await this.cajaBancoService.cerrarMesCompleto(yearAnterior, monthAnterior - 1);

        Swal.fire({
          title: '✅ Mes Cerrado',
          html: `
            <div style="text-align: left;">
              <p>Se ha cerrado el mes de <strong>${this.getNombreMes(monthAnterior - 1)} ${yearAnterior}</strong></p>
              <p style="margin-top: 1rem;">✅ Cajas banco cerradas</p>
              <p>✅ Nueva caja banco abierta para el mes actual</p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Ver Reporte Mensual'
        }).then((res) => {
          if (res.isConfirmed) {
            this.router.navigate(['/caja-banco/imprimir-mensual', String(yearAnterior), String(monthAnterior)]);
          }
        });

        // Recargar datos
        this.cargarCajas();
      } catch (error) {
        console.error('Error al cerrar mes:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo cerrar el mes. Intenta nuevamente.',
          icon: 'error'
        });
      }
    }
  }

  getNombreMes(index: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[index] || '';
  }

  // 🔹 Eliminar una caja chica y restar el dinero de la caja banco
  async eliminarCajaChica(cajaChica: CajaChica): Promise<void> {
    const resultado = await Swal.fire({
      title: '¿Desactivar Caja Chica?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaChica.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaChica.usuario_nombre || '-'}</p>
          <p><strong>Monto Inicial:</strong> ${this.formatoMoneda(cajaChica.monto_inicial || 0)}</p>
          <p><strong>Monto Actual:</strong> ${this.formatoMoneda(cajaChica.monto_actual || 0)}</p>
          <p style="color: orange; margin-top: 1rem;"><strong>ℹ️ La caja se desactivará pero podrá ser reactivada</strong></p>
          <p style="color: red;"><strong>Se restará ${this.formatoMoneda(cajaChica.monto_actual || 0)} de la caja banco</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, desactivar',
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

        // Desactivar la caja chica (soft delete)
        await this.cajaChicaService.eliminarCajaChica(cajaChica.id!);
        
        // Recargar listas
        this.cargarCajas();
        this.cargarCajasChicas();

        Swal.fire({
          title: '✅ Desactivada',
          text: 'Caja chica desactivada y dinero restado de caja banco',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al desactivar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo desactivar la caja chica',
          icon: 'error'
        });
      }
    }
  }

  // 🔹 Reactivar una caja chica desactivada
  async reactivarCajaChica(cajaChica: CajaChica): Promise<void> {
    if (cajaChica.activo !== false) {
      Swal.fire({
        title: '⚠️ Aviso',
        text: 'Esta caja chica ya está activa',
        icon: 'info'
      });
      return;
    }

    const resultado = await Swal.fire({
      title: '¿Reactivar Caja Chica?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaChica.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaChica.usuario_nombre || '-'}</p>
          <p><strong>Monto Inicial:</strong> ${this.formatoMoneda(cajaChica.monto_inicial || 0)}</p>
          <p><strong>Monto Actual:</strong> ${this.formatoMoneda(cajaChica.monto_actual || 0)}</p>
          <p style="color: green; margin-top: 1rem;"><strong>✓ Se sumará ${this.formatoMoneda(cajaChica.monto_actual || 0)} a la caja banco</strong></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, reactivar',
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
          // 🔹 Sumar el monto de la caja chica al saldo de la caja banco (se restó cuando se desactivó)
          const nuevoSaldo = (cajaBancoHoy.saldo_actual || 0) + (cajaChica.monto_actual || 0);
          
          await this.cajaBancoService.actualizarSaldoCajaBanco(cajaBancoHoy.id!, nuevoSaldo);
        }

        // Reactivar la caja chica
        await this.cajaChicaService.activarCajaChica(cajaChica.id!);
        
        // Recargar listas
        this.cargarCajas();
        this.cargarCajasChicas();

        Swal.fire({
          title: '✅ Reactivada',
          text: 'Caja chica reactivada y dinero sumado a caja banco',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al reactivar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo reactivar la caja chica',
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
        text: 'Solo puedes desactivar cajas que estén CERRADAS',
        icon: 'error'
      });
      return;
    }

    const resultado = await Swal.fire({
      title: '¿Desactivar Caja Banco?',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cajaBanco.fecha)}</p>
          <p><strong>Usuario:</strong> ${cajaBanco.usuario_nombre || '-'}</p>
          <p><strong>Saldo Inicial:</strong> ${this.formatoMoneda(cajaBanco.saldo_inicial || 0)}</p>
          <p><strong>Saldo Actual:</strong> ${this.formatoMoneda(cajaBanco.saldo_actual || 0)}</p>
          <p><strong>Estado:</strong> ${cajaBanco.estado}</p>
          <p style="color: orange; margin-top: 1rem;"><strong>ℹ️ La caja se desactivará pero podrá ser reactivada</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        await this.cajaBancoService.eliminarCajaBanco(cajaBanco.id!);
        
        // Recargar listas
        this.cargarCajas();

        Swal.fire({
          title: '✅ Desactivada',
          text: 'Caja banco desactivada correctamente',
          icon: 'success',
          timer: 2000
        });
      } catch (error) {
        console.error('Error al desactivar:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo desactivar la caja banco',
          icon: 'error'
        });
      }
    }
  }

  getTotalGanado(): number {
    // Total de cajas chicas cerradas (solo las activas)
    // Esto suma el saldo_actual de cada caja chica
    return this.cajasChicas
      .filter(c => c.activo !== false) // 🔹 Filtrar solo cajas activas
      .reduce((acc, c) => acc + (c.monto_actual || 0), 0);
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
