/**
 * Componente para gestión de Cuentas por Pagar.
 *
 * Funcionalidades:
 * - Listar todas las cuentas por pagar (filtradas por estado)
 * - Registrar nuevas cuentas por pagar
 * - Realizar abonos parciales a las cuentas
 * - Ver detalles e historial de abonos
 *
 * FLUJO FINANCIERO:
 * - Al registrar: SUMA el monto a caja/banco (recibimos dinero prestado)
 * - Al pagar: DESCUENTA el monto de caja/banco (devolvemos dinero)
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { Cuenta, TipoCuenta, EstadoCuenta } from '../../../../core/models/cuenta.model';
import { obtenerPeriodo } from '../../../../core/utils/fecha-helpers';

@Component({
  selector: 'app-cuentas-por-pagar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cuentas-por-pagar.html',
  styleUrls: ['./cuentas-por-pagar.css']
})
export class CuentasPorPagarComponent implements OnInit {
  cuentas: Cuenta[] = [];
  cuentasFiltradas: Cuenta[] = [];
  cargando = true;
  mostrandoFormulario = false;
  
  formularioCuenta!: FormGroup;
  
  // Filtros
  filtroEstado: 'TODAS' | EstadoCuenta = 'TODAS';
  
  // 🔒 Restricción de fecha según el periodo de la caja banco
  fechaMinima = ''; // Fecha mínima permitida (inicio del mes de la caja banco)
  fechaMaximaPermitida = ''; // Fecha máxima permitida (fin del mes de la caja banco o hoy)
  periodoNombre = ''; // Nombre del periodo para mostrar (ej: "Enero 2026")
  
  // Estados
  EstadoCuenta = EstadoCuenta;

  constructor(
    private readonly cuentasService: CuentasService,
    private readonly cajaBancoService: CajaBancoService,
    private readonly fb: FormBuilder
  ) {
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.cargarCuentas();
    this.cargarRestriccionesFechaCajaBanco();
  }

  /**
   * Inicializa el formulario de registro de cuentas.
   */
  private inicializarFormulario(): void {
    this.formularioCuenta = this.fb.group({
      fecha: [new Date().toISOString().split('T')[0], Validators.required],
      montoTotal: [0, [Validators.required, Validators.min(0.01)]],
      observacion: ['', Validators.required]
    });
  }

  /**
   * Carga las restricciones de fecha min/max basadas en el periodo de la caja banco abierta.
   * Limita la selección de fecha al mes de la caja banco activa.
   */
  async cargarRestriccionesFechaCajaBanco(): Promise<void> {
    try {
      const caja = await this.cajaBancoService.getCajaBancoAbierta();
      
      if (!caja?.fecha) {
        console.warn('⚠️ No hay caja banco abierta');
        return;
      }

      // Convertir fecha de Firestore a Date
      let fechaCaja: Date;
      if ((caja.fecha as any)?.toDate) {
        fechaCaja = (caja.fecha as any).toDate();
      } else if (caja.fecha instanceof Date) {
        fechaCaja = caja.fecha;
      } else {
        fechaCaja = new Date(caja.fecha);
      }

      // Obtener periodo de la caja
      const periodo = obtenerPeriodo(fechaCaja);
      const year = periodo.year;
      const month = periodo.monthIndex0; // Base 0

      // Calcular primer y último día del mes
      const primerDia = new Date(year, month, 1);
      const ultimoDia = new Date(year, month + 1, 0); // Día 0 del mes siguiente = último día del mes actual
      const hoy = new Date();

      // Formatear para input[type="date"] (YYYY-MM-DD)
      this.fechaMinima = this.formatearFecha(primerDia);
      // La fecha máxima es el menor entre el último día del mes y hoy
      const fechaMax = ultimoDia < hoy ? ultimoDia : hoy;
      this.fechaMaximaPermitida = this.formatearFecha(fechaMax);
      
      // Nombre del periodo para mostrar
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      this.periodoNombre = `${meses[month]} ${year}`;

      console.log(`📅 Restricciones de fecha establecidas: ${this.fechaMinima} a ${this.fechaMaximaPermitida} (${this.periodoNombre})`);
    } catch (error) {
      console.error('❌ Error cargando restricciones de fecha:', error);
    }
  }

  /**
   * Formatea una fecha a string YYYY-MM-DD para input[type="date"]
   */
  private formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Carga todas las cuentas por pagar desde Firestore.
   */
  cargarCuentas(): void {
    this.cargando = true;
    this.cuentasService.getCuentasPorTipo(TipoCuenta.PAGAR).subscribe({
      next: (cuentas) => {
        this.cuentas = cuentas;
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
        Swal.fire('Error', 'No se pudieron cargar las cuentas', 'error');
        this.cargando = false;
      }
    });
  }

  /**
   * Aplica los filtros seleccionados al listado de cuentas.
   */
  aplicarFiltros(): void {
    if (this.filtroEstado === 'TODAS') {
      this.cuentasFiltradas = [...this.cuentas];
    } else {
      this.cuentasFiltradas = this.cuentas.filter(c => c.estado === this.filtroEstado);
    }
  }

  /**
   * Cambia el filtro de estado y recarga la lista.
   */
  cambiarFiltroEstado(estado: 'TODAS' | EstadoCuenta): void {
    this.filtroEstado = estado;
    this.aplicarFiltros();
  }

  /**
   * Muestra/oculta el formulario de registro.
   */
  toggleFormulario(): void {
    this.mostrandoFormulario = !this.mostrandoFormulario;
    if (!this.mostrandoFormulario) {
      this.formularioCuenta.reset({
        fecha: new Date().toISOString().split('T')[0],
        montoTotal: 0,
        observacion: ''
      });
    }
  }

  /**
   * Registra una nueva cuenta por pagar.
   */
  async registrarCuenta(): Promise<void> {
    if (this.formularioCuenta.invalid) {
      Swal.fire('Formulario incompleto', 'Por favor, completa todos los campos requeridos', 'warning');
      return;
    }

    const confirmacion = await Swal.fire({
      title: '¿Confirmar registro?',
      html: `
        <p>Se registrará una cuenta por pagar de <strong>$${this.formularioCuenta.value.montoTotal}</strong></p>
        <p class="text-muted">Este monto se <strong>SUMARÁ</strong> a caja/banco</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const formValue = this.formularioCuenta.value;
      const nuevaCuenta: Omit<Cuenta, 'id' | 'montoAbonado' | 'saldo' | 'estado' | 'abonos'> = {
        fecha: new Date(formValue.fecha + 'T00:00:00'),
        tipo: TipoCuenta.PAGAR,
        montoTotal: formValue.montoTotal,
        observacion: formValue.observacion
      };

      await this.cuentasService.registrarCuenta(nuevaCuenta);
      
      Swal.fire('¡Éxito!', 'Cuenta por pagar registrada correctamente', 'success');
      this.toggleFormulario();
      // No recargar, la subscripción se actualiza automáticamente
    } catch (error: any) {
      console.error('Error al registrar cuenta:', error);
      Swal.fire('Error', error.message || 'No se pudo registrar la cuenta', 'error');
    }
  }

  /**
   * Muestra un formulario para registrar un abono a una cuenta.
   */
  async realizarAbono(cuenta: Cuenta): Promise<void> {
    // Validar que haya caja banco disponible
    if (!this.fechaMinima || !this.fechaMaximaPermitida) {
      Swal.fire({
        icon: 'error',
        title: 'Sin caja banco',
        text: 'No hay una caja banco abierta. Debe abrir una caja banco primero para registrar abonos.'
      });
      return;
    }

    const { value: formValues } = await Swal.fire({
      title: `Pagar cuenta`,
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <p><strong>Cuenta:</strong> ${cuenta.observacion}</p>
          <p><strong>Saldo pendiente:</strong> $${cuenta.saldo.toFixed(2)}</p>
          <p style="font-size: 0.9em; color: #666;">Periodo permitido: <strong>${this.periodoNombre}</strong></p>
        </div>
        <div style="margin-bottom: 10px;">
          <label for="fecha-abono" style="display: block; text-align: left; margin-bottom: 5px; font-weight: 500;">Fecha del pago</label>
          <input id="fecha-abono" class="swal2-input" type="date" value="${this.formatearFecha(new Date())}" min="${this.fechaMinima}" max="${this.fechaMaximaPermitida}" style="width: 90%;">
        </div>
        <input id="monto-abono" class="swal2-input" type="number" placeholder="Monto a pagar" step="0.01" min="0.01" max="${cuenta.saldo}">
        <input id="observacion-abono" class="swal2-input" type="text" placeholder="Observación (opcional)">
        <p class="text-muted" style="font-size: 0.9em; margin-top: 10px;">Este monto se <strong>DESCONTARÁ</strong> de caja/banco</p>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Registrar pago',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const fechaInput = document.getElementById('fecha-abono') as HTMLInputElement;
        const montoInput = document.getElementById('monto-abono') as HTMLInputElement;
        const observacionInput = document.getElementById('observacion-abono') as HTMLInputElement;
        const monto = parseFloat(montoInput.value);

        if (!fechaInput.value) {
          Swal.showValidationMessage('Selecciona una fecha válida');
          return null;
        }

        if (!monto || monto <= 0) {
          Swal.showValidationMessage('Ingresa un monto válido');
          return null;
        }

        if (monto > cuenta.saldo) {
          Swal.showValidationMessage(`El monto no puede ser mayor al saldo ($${cuenta.saldo.toFixed(2)})`);
          return null;
        }

        return {
          fecha: new Date(fechaInput.value + 'T00:00:00'),
          monto: monto,
          observacion: observacionInput.value
        };
      }
    });

    if (!formValues) return;

    try {
      await this.cuentasService.registrarAbono(
        cuenta.id!,
        formValues.monto,
        formValues.fecha,
        formValues.observacion || undefined
      );

      Swal.fire('¡Éxito!', 'Pago registrado correctamente', 'success');
    } catch (error: any) {
      console.error('Error al registrar abono:', error);
      Swal.fire('Error', error.message || 'No se pudo registrar el pago', 'error');
    }
  }

  /**
   * Muestra los detalles completos de una cuenta, incluyendo historial de abonos.
   */
  verDetalles(cuenta: Cuenta): void {
    const abonosHTML = cuenta.abonos && cuenta.abonos.length > 0
      ? `
        <div style="margin-top: 20px;">
          <h4 style="text-align: left; margin-bottom: 10px;">Historial de pagos</h4>
          <div style="max-height: 200px; overflow-y: auto;">
            ${cuenta.abonos.map(abono => `
              <div style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">
                <div><strong>${this.formatoFecha(abono.fecha)}</strong></div>
                <div>Monto: $${abono.monto.toFixed(2)}</div>
                ${abono.observacion ? `<div style="font-size: 0.9em; color: #666;">${abono.observacion}</div>` : ''}
                <div style="font-size: 0.9em; color: #666;">Saldo restante: $${abono.saldoRestante.toFixed(2)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '<p style="margin-top: 20px;">No hay pagos registrados</p>';

    Swal.fire({
      title: 'Detalles de la cuenta',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cuenta.fecha)}</p>
          <p><strong>Observación:</strong> ${cuenta.observacion}</p>
          <p><strong>Monto total:</strong> $${cuenta.montoTotal.toFixed(2)}</p>
          <p><strong>Monto pagado:</strong> $${cuenta.montoAbonado.toFixed(2)}</p>
          <p><strong>Saldo pendiente:</strong> $${cuenta.saldo.toFixed(2)}</p>
          <p><strong>Estado:</strong> ${cuenta.estado}</p>
          ${abonosHTML}
        </div>
      `,
      width: '600px',
      confirmButtonText: 'Cerrar'
    });
  }

  /**
   * Calcula el total de saldo pendiente de todas las cuentas activas.
   */
  getTotalPendiente(): number {
    return this.cuentasFiltradas
      .filter(c => c.estado === EstadoCuenta.ACTIVA)
      .reduce((total, cuenta) => total + cuenta.saldo, 0);
  }

  /**
   * Calcula el total de cuentas activas.
   */
  getCantidadActivas(): number {
    return this.cuentasFiltradas.filter(c => c.estado === EstadoCuenta.ACTIVA).length;
  }

  /**
   * Formatea una fecha a string legible.
   */
  formatoFecha(fecha: Date | string): string {
    const f = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return f.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  }

  /**
   * Formatea un número como moneda.
   */
  formatoMoneda(valor: number): string {
    return `$${valor.toFixed(2)}`;
  }

  // ========== NUEVAS ESTADÍSTICAS ==========

  /**
   * 1. Total Pagado (acumulado)
   * Suma de todos los montos abonados en todas las cuentas.
   */
  getTotalPagado(): number {
    return this.cuentas.reduce((total, cuenta) => total + cuenta.montoAbonado, 0);
  }

  /**
   * 2. Promedio por cuenta
   * Promedio del monto total de todas las cuentas.
   */
  getPromedioPorCuenta(): number {
    if (this.cuentas.length === 0) return 0;
    const totalMonto = this.cuentas.reduce((total, cuenta) => total + cuenta.montoTotal, 0);
    return totalMonto / this.cuentas.length;
  }

  /**
   * 3. Cuentas vencidas
   * Como no hay campo de fecha de vencimiento, retornamos 0.
   * Podría implementarse en el futuro agregando un campo fechaVencimiento.
   */
  getCuentasVencidas(): number {
    // No hay campo de vencimiento en el modelo actual
    return 0;
  }

  /**
   * 4. Porcentaje de deuda pagada
   * Calcula qué porcentaje del total se ha pagado.
   */
  getPorcentajePagado(): number {
    const totalGeneral = this.cuentas.reduce((total, cuenta) => total + cuenta.montoTotal, 0);
    if (totalGeneral === 0) return 0;
    const totalPagado = this.getTotalPagado();
    return (totalPagado / totalGeneral) * 100;
  }

  /**
   * Porcentaje pendiente de pago.
   */
  getPorcentajePendiente(): number {
    return 100 - this.getPorcentajePagado();
  }

  /**
   * 5. Deuda del mes actual
   * Total de deudas creadas en el mes y año actual.
   */
  getDeudaMesActual(): number {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    return this.cuentas
      .filter(cuenta => {
        const fechaCuenta = new Date(cuenta.fecha);
        return fechaCuenta.getMonth() === mesActual && 
               fechaCuenta.getFullYear() === añoActual;
      })
      .reduce((total, cuenta) => total + cuenta.montoTotal, 0);
  }

  /**
   * 6. Último pago realizado
   * Encuentra el abono más reciente de todas las cuentas.
   */
  getUltimoPago(): { monto: number; fecha: Date } | null {
    let ultimoPago: { monto: number; fecha: Date } | null = null;
    let fechaMasReciente: Date | null = null;

    this.cuentas.forEach(cuenta => {
      if (cuenta.abonos && cuenta.abonos.length > 0) {
        cuenta.abonos.forEach(abono => {
          const fechaAbono = new Date(abono.fecha);
          if (!fechaMasReciente || fechaAbono > fechaMasReciente) {
            fechaMasReciente = fechaAbono;
            ultimoPago = { monto: abono.monto, fecha: fechaAbono };
          }
        });
      }
    });

    return ultimoPago;
  }

  /**
   * Obtiene el monto del último pago.
   */
  getMontoUltimoPago(): number {
    const ultimoPago = this.getUltimoPago();
    return ultimoPago ? ultimoPago.monto : 0;
  }

  /**
   * Obtiene la fecha del último pago formateada.
   */
  getFechaUltimoPago(): string {
    const ultimoPago = this.getUltimoPago();
    return ultimoPago ? this.formatoFecha(ultimoPago.fecha) : 'Sin pagos';
  }
}
