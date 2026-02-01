/**
 * Componente para gestión de Cuentas por Cobrar.
 *
 * Funcionalidades:
 * - Listar todas las cuentas por cobrar (filtradas por estado)
 * - Registrar nuevas cuentas por cobrar
 * - Realizar cobros parciales a las cuentas
 * - Ver detalles e historial de cobros
 *
 * FLUJO FINANCIERO:
 * - Al registrar: DESCUENTA el monto de caja/banco (prestamos dinero)
 * - Al cobrar: SUMA el monto a caja/banco (nos devuelven dinero)
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { Cuenta, TipoCuenta, EstadoCuenta } from '../../../../core/models/cuenta.model';

@Component({
  selector: 'app-cuentas-por-cobrar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cuentas-por-cobrar.html',
  styleUrls: ['./cuentas-por-cobrar.css']
})
export class CuentasPorCobrarComponent implements OnInit {
  cuentas: Cuenta[] = [];
  cuentasFiltradas: Cuenta[] = [];
  cargando = true;
  mostrandoFormulario = false;
  
  formularioCuenta!: FormGroup;
  
  // Filtros
  filtroEstado: 'TODAS' | EstadoCuenta = 'TODAS';
  
  // Estados
  EstadoCuenta = EstadoCuenta;

  constructor(
    private readonly cuentasService: CuentasService,
    private readonly fb: FormBuilder
  ) {
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.cargarCuentas();
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
   * Carga todas las cuentas por cobrar desde Firestore.
   */
  cargarCuentas(): void {
    this.cargando = true;
    this.cuentasService.getCuentasPorTipo(TipoCuenta.COBRAR).subscribe({
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
   * Registra una nueva cuenta por cobrar.
   */
  async registrarCuenta(): Promise<void> {
    if (this.formularioCuenta.invalid) {
      Swal.fire('Formulario incompleto', 'Por favor, completa todos los campos requeridos', 'warning');
      return;
    }

    const confirmacion = await Swal.fire({
      title: '¿Confirmar registro?',
      html: `
        <p>Se registrará una cuenta por cobrar de <strong>$${this.formularioCuenta.value.montoTotal}</strong></p>
        <p class="text-muted">Este monto se <strong>DESCONTARÁ</strong> de caja/banco</p>
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
        tipo: TipoCuenta.COBRAR,
        montoTotal: formValue.montoTotal,
        observacion: formValue.observacion
      };

      await this.cuentasService.registrarCuenta(nuevaCuenta);
      
      Swal.fire('¡Éxito!', 'Cuenta por cobrar registrada correctamente', 'success');
      this.toggleFormulario();
      // No recargar, la subscripción se actualiza automáticamente
    } catch (error: any) {
      console.error('Error al registrar cuenta:', error);
      Swal.fire('Error', error.message || 'No se pudo registrar la cuenta', 'error');
    }
  }

  /**
   * Muestra un formulario para registrar un cobro a una cuenta.
   */
  async realizarCobro(cuenta: Cuenta): Promise<void> {
    const { value: formValues } = await Swal.fire({
      title: `Cobrar cuenta`,
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <p><strong>Cuenta:</strong> ${cuenta.observacion}</p>
          <p><strong>Saldo pendiente:</strong> $${cuenta.saldo.toFixed(2)}</p>
        </div>
        <input id="monto-abono" class="swal2-input" type="number" placeholder="Monto a cobrar" step="0.01" min="0.01" max="${cuenta.saldo}">
        <input id="observacion-abono" class="swal2-input" type="text" placeholder="Observación (opcional)">
        <p class="text-muted" style="font-size: 0.9em; margin-top: 10px;">Este monto se <strong>SUMARÁ</strong> a caja/banco</p>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Registrar cobro',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const montoInput = document.getElementById('monto-abono') as HTMLInputElement;
        const observacionInput = document.getElementById('observacion-abono') as HTMLInputElement;
        const monto = parseFloat(montoInput.value);

        if (!monto || monto <= 0) {
          Swal.showValidationMessage('Ingresa un monto válido');
          return null;
        }

        if (monto > cuenta.saldo) {
          Swal.showValidationMessage(`El monto no puede ser mayor al saldo ($${cuenta.saldo.toFixed(2)})`);
          return null;
        }

        return {
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
        formValues.observacion || undefined
      );

      Swal.fire('¡Éxito!', 'Cobro registrado correctamente', 'success');
    } catch (error: any) {
      console.error('Error al registrar abono:', error);
      Swal.fire('Error', error.message || 'No se pudo registrar el cobro', 'error');
    }
  }

  /**
   * Muestra los detalles completos de una cuenta, incluyendo historial de cobros.
   */
  verDetalles(cuenta: Cuenta): void {
    const cobrosHTML = cuenta.abonos && cuenta.abonos.length > 0
      ? `
        <div style="margin-top: 20px;">
          <h4 style="text-align: left; margin-bottom: 10px;">Historial de cobros</h4>
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
      : '<p style="margin-top: 20px;">No hay cobros registrados</p>';

    Swal.fire({
      title: 'Detalles de la cuenta',
      html: `
        <div style="text-align: left;">
          <p><strong>Fecha:</strong> ${this.formatoFecha(cuenta.fecha)}</p>
          <p><strong>Observación:</strong> ${cuenta.observacion}</p>
          <p><strong>Monto total:</strong> $${cuenta.montoTotal.toFixed(2)}</p>
          <p><strong>Monto cobrado:</strong> $${cuenta.montoAbonado.toFixed(2)}</p>
          <p><strong>Saldo pendiente:</strong> $${cuenta.saldo.toFixed(2)}</p>
          <p><strong>Estado:</strong> ${cuenta.estado}</p>
          ${cobrosHTML}
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
}
