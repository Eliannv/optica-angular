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
import { Cuenta, TipoCuenta, EstadoCuenta, TipoCuentaPorPagar } from '../../../../core/models/cuenta.model';
import { CajaBanco } from '../../../../core/models/caja-banco.model';
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
  
  // � Filtro por período (Cuenta Banco)
  cajasBanco: CajaBanco[] = [];
  cuentaBancoSeleccionada: string | null = null; // null = "Todos los períodos"
  
  // �🔒 Restricción de fecha según el periodo de la caja banco
  fechaMinima = ''; // Fecha mínima permitida (inicio del mes de la caja banco)
  fechaMaximaPermitida = ''; // Fecha máxima permitida (fin del mes de la caja banco o hoy)
  periodoNombre = ''; // Nombre del periodo para mostrar (ej: "Enero 2026")
  
  // Estados
  EstadoCuenta = EstadoCuenta;
  TipoCuentaPorPagar = TipoCuentaPorPagar;

  constructor(
    private readonly cuentasService: CuentasService,
    private readonly cajaBancoService: CajaBancoService,
    private readonly fb: FormBuilder
  ) {
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.cargarCajasBanco(); // Esto cargará las cuentas automáticamente después de seleccionar la caja abierta
    this.cargarRestriccionesFechaCajaBanco();
  }

  /**
   * Carga todas las cuentas banco disponibles (para el selector de período).
   * Selecciona automáticamente la caja banco abierta.
   */
  async cargarCajasBanco(): Promise<void> {
    this.cajaBancoService.getCajasBanco().subscribe({
      next: async (cajas) => {
        // Ordenar por fecha descendente (más reciente primero)
        this.cajasBanco = cajas.sort((a, b) => {
          const fechaA = this.convertirFechaFirestore(a.fecha);
          const fechaB = this.convertirFechaFirestore(b.fecha);
          return fechaB.getTime() - fechaA.getTime();
        });

        // Seleccionar automáticamente la caja banco abierta
        try {
          const cajaAbierta = await this.cajaBancoService.getCajaBancoAbierta();
          if (cajaAbierta?.id) {
            this.cuentaBancoSeleccionada = cajaAbierta.id;
            this.cargarCuentas();
          } else if (this.cajasBanco.length > 0) {
            // Si no hay caja abierta, seleccionar la más reciente
            this.cuentaBancoSeleccionada = this.cajasBanco[0].id!;
            this.cargarCuentas();
          }
        } catch (error) {
          console.error('Error al obtener caja banco abierta:', error);
          // Si falla, seleccionar la primera disponible
          if (this.cajasBanco.length > 0) {
            this.cuentaBancoSeleccionada = this.cajasBanco[0].id!;
            this.cargarCuentas();
          }
        }
      },
      error: (error) => {
        console.error('Error al cargar cajas banco:', error);
      }
    });
  }

  /**
   * Convierte una fecha de Firestore a Date.
   */
  private convertirFechaFirestore(fecha: any): Date {
    if (fecha?.toDate) {
      return fecha.toDate();
    } else if (fecha instanceof Date) {
      return fecha;
    } else {
      return new Date(fecha);
    }
  }

  /**
   * Obtiene el nombre del período de una caja banco (ej: "Enero 2026").
   */
  obtenerNombrePeriodo(caja: CajaBanco): string {
    const fecha = this.convertirFechaFirestore(caja.fecha);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  /**
   * Inicializa el formulario de registro de cuentas.
   */
  private inicializarFormulario(): void {
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    
    this.formularioCuenta = this.fb.group({
      fecha: [new Date().toISOString().split('T')[0], Validators.required],
      hora: [horaActual, Validators.required],
      tipoCuentaPorPagar: [TipoCuentaPorPagar.DEUDA, Validators.required],
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
   * Siempre filtra por el período seleccionado (cuentaBancoId).
   */
  cargarCuentas(): void {
    if (!this.cuentaBancoSeleccionada) {
      return; // No cargar si no hay período seleccionado
    }

    this.cargando = true;
    this.cuentasService.getCuentasPorTipoYCajaBanco(TipoCuenta.PAGAR, this.cuentaBancoSeleccionada).subscribe({
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
   * Cambia el período de cuenta banco seleccionado y recarga las cuentas.
   */
  cambiarPeriodo(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.cuentaBancoSeleccionada = select.value;
    this.cargarCuentas();
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
      const ahora = new Date();
      const horaActual = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      this.formularioCuenta.reset({
        fecha: new Date().toISOString().split('T')[0],
        hora: horaActual,
        tipoCuentaPorPagar: TipoCuentaPorPagar.DEUDA,
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

    const formValue = this.formularioCuenta.value;
    const es_prestamo = formValue.tipoCuentaPorPagar === TipoCuentaPorPagar.PRESTAMO;
    const confirmacion = await Swal.fire({
      title: '¿Confirmar registro?',
      html: `
        <p>Se registrará una cuenta por pagar de <strong>$${formValue.montoTotal}</strong></p>
        <p class="text-muted">${es_prestamo 
          ? 'Este monto se <strong>SUMARÁ</strong> a caja/banco (ingreso por préstamo)' 
          : 'Este monto <strong>NO</strong> afectará caja/banco (deuda normal)'}</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      // Combinar fecha y hora en un solo Date
      const [hours, minutes, seconds] = formValue.hora.split(':').map(Number);
      const fechaCompleta = new Date(formValue.fecha + 'T00:00:00');
      fechaCompleta.setHours(hours, minutes, seconds || 0);
      
      const nuevaCuenta: Omit<Cuenta, 'id' | 'montoAbonado' | 'saldo' | 'estado' | 'abonos'> = {
        fecha: fechaCompleta,
        tipo: TipoCuenta.PAGAR,
        tipoCuentaPorPagar: formValue.tipoCuentaPorPagar,
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
        <div class="modern-modal-content">
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Cuenta:</span>
              <span class="info-value">${cuenta.observacion}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Saldo pendiente:</span>
              <span class="info-value highlight">$${cuenta.saldo.toFixed(2)}</span>
            </div>
            <div class="period-badge">
              <i class="bi bi-calendar-check"></i>
              Periodo permitido: <strong>${this.periodoNombre}</strong>
            </div>
          </div>
          
          <div class="form-group-modern">
            <label for="fecha-abono" class="form-label-modern">Fecha del pago</label>
            <input id="fecha-abono" class="form-input-modern" type="date" value="${this.formatearFecha(new Date())}" min="${this.fechaMinima}" max="${this.fechaMaximaPermitida}">
          </div>
          
          <div class="form-group-modern">
            <label for="hora-abono" class="form-label-modern">Hora del pago</label>
            <input id="hora-abono" class="form-input-modern" type="time" step="1" value="${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}">
          </div>
          
          <div class="form-group-modern">
            <label for="monto-abono" class="form-label-modern">Monto a pagar</label>
            <input id="monto-abono" class="form-input-modern" type="number" placeholder="0.00" step="0.01" min="0.01" max="${cuenta.saldo}">
          </div>
          
          <div class="form-group-modern">
            <label for="observacion-abono" class="form-label-modern">Observación (opcional)</label>
            <input id="observacion-abono" class="form-input-modern" type="text" placeholder="Información adicional sobre este pago">
          </div>
          
          <div class="alert-modern">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            Este monto se <strong>DESCONTARÁ</strong> de caja/banco
          </div>
        </div>
        
        <style>
          .modern-modal-content { text-align: left; padding: 0.5rem; }
          .info-section { background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; border: 1px solid #e9ecef; }
          .info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
          .info-row:last-child { margin-bottom: 0; }
          .info-label { font-weight: 500; color: #6c757d; font-size: 0.95rem; }
          .info-value { font-weight: 600; color: #2c3e50; font-size: 1rem; }
          .info-value.highlight { color: #3498db; font-size: 1.25rem; }
          .period-badge { background: rgba(52, 152, 219, 0.1); color: #3498db; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9rem; margin-top: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
          .form-group-modern { margin-bottom: 1.25rem; }
          .form-label-modern { display: block; font-weight: 600; font-size: 0.95rem; color: #2c3e50; margin-bottom: 0.5rem; }
          .form-input-modern { width: 100%; padding: 0.75rem 1rem; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; transition: all 0.2s; }
          .form-input-modern:focus { outline: none; border-color: #3498db; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1); }
          .alert-modern { background: rgba(231, 76, 60, 0.1); color: #e74c3c; padding: 0.875rem 1rem; border-radius: 8px; font-size: 0.9rem; display: flex; align-items: center; gap: 0.75rem; border: 1px solid rgba(231, 76, 60, 0.2); }
          .alert-modern svg { flex-shrink: 0; }
        </style>
      `,
      width: '550px',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-check-lg"></i> Registrar pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3498db',
      cancelButtonColor: '#6c757d',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-confirm-btn',
        cancelButton: 'modern-cancel-btn'
      },
      preConfirm: () => {
        const fechaInput = document.getElementById('fecha-abono') as HTMLInputElement;
        const horaInput = document.getElementById('hora-abono') as HTMLInputElement;
        const montoInput = document.getElementById('monto-abono') as HTMLInputElement;
        const observacionInput = document.getElementById('observacion-abono') as HTMLInputElement;
        const monto = parseFloat(montoInput.value);

        if (!fechaInput.value) {
          Swal.showValidationMessage('Selecciona una fecha válida');
          return null;
        }

        if (!horaInput.value) {
          Swal.showValidationMessage('Selecciona una hora válida');
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

        // Combinar fecha y hora
        const [hours, minutes, seconds] = horaInput.value.split(':').map(Number);
        const fechaCompleta = new Date(fechaInput.value + 'T00:00:00');
        fechaCompleta.setHours(hours, minutes, seconds || 0);

        return {
          fecha: fechaCompleta,
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
        <div class="historial-section">
          <div class="historial-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <h4>Historial de pagos</h4>
          </div>
          <div class="abonos-list">
            ${cuenta.abonos.map((abono, index) => `
              <div class="abono-card">
                <div class="abono-header">
                  <span class="abono-number">#${cuenta.abonos!.length - index}</span>
                  <span class="abono-date">${this.formatoFecha(abono.fecha)}</span>
                </div>
                <div class="abono-body">
                  <div class="abono-detail">
                    <span class="detail-label">Monto pagado:</span>
                    <span class="detail-value amount">$${abono.monto.toFixed(2)}</span>
                  </div>
                  ${abono.observacion ? `
                    <div class="abono-detail">
                      <span class="detail-label">Observación:</span>
                      <span class="detail-value">${abono.observacion}</span>
                    </div>
                  ` : ''}
                  <div class="abono-detail">
                    <span class="detail-label">Saldo restante:</span>
                    <span class="detail-value saldo">$${abono.saldoRestante.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '<div class="empty-state"><i class="bi bi-inbox"></i><p>No hay pagos registrados</p></div>';

    Swal.fire({
      title: 'Detalles de la cuenta',
      html: `
        <div class="modern-details-content">
          <div class="details-grid">
            <div class="detail-item">            
              <div class="detail-content">
                <span class="detail-label-sm">Fecha</span>
                <span class="detail-value-sm">${this.formatoFecha(cuenta.fecha)}</span>
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-content">
                <span class="detail-label-sm">Observación</span>
                <span class="detail-value-sm">${cuenta.observacion}</span>
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-content">
                <span class="detail-label-sm">Monto total</span>
                <span class="detail-value-sm amount-lg">$${cuenta.montoTotal.toFixed(2)}</span>
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-content">
                <span class="detail-label-sm">Monto pagado</span>
                <span class="detail-value-sm amount-success">$${cuenta.montoAbonado.toFixed(2)}</span>
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-content">
                <span class="detail-label-sm">Saldo pendiente</span>
                <span class="detail-value-sm amount-warning">$${cuenta.saldo.toFixed(2)}</span>
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-content">
                <span class="detail-label-sm">Estado</span>
                <span class="detail-value-sm badge-${cuenta.estado === EstadoCuenta.ACTIVA ? 'active' : 'inactive'}">${cuenta.estado}</span>
              </div>
            </div>
          </div>
          
          ${abonosHTML}
        </div>
        
        <style>
          .modern-details-content { text-align: left; padding: 0.5rem; }
          .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
          .detail-item { background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 1px solid #e9ecef; border-radius: 12px; padding: 1rem; display: flex; align-items: center; gap: 0.75rem; }
          .detail-icon { font-size: 1.75rem; }
          .detail-content { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
          .detail-label-sm { font-size: 0.8rem; color: #6c757d; font-weight: 500; }
          .detail-value-sm { font-size: 1rem; color: #2c3e50; font-weight: 600; }
          .amount-lg { color: #3498db; font-size: 1.15rem; }
          .amount-success { color: #27ae60; }
          .amount-warning { color: #e74c3c; }
          .badge-active { background: rgba(39, 174, 96, 0.15); color: #27ae60; padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
          .badge-inactive { background: rgba(149, 165, 166, 0.15); color: #7f8c8d; padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
          
          .historial-section { background: white; border-radius: 12px; padding: 1.25rem; border: 2px solid #e9ecef; }
          .historial-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: #3498db; }
          .historial-header h4 { margin: 0; font-size: 1.1rem; font-weight: 600; }
          .historial-header svg { flex-shrink: 0; }
          .abonos-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
          .abono-card { background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 1px solid #e9ecef; border-radius: 8px; padding: 1rem; }
          .abono-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e9ecef; }
          .abono-number { background: #3498db; color: white; padding: 0.25rem 0.65rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
          .abono-date { font-weight: 600; color: #2c3e50; font-size: 0.95rem; }
          .abono-body { display: flex; flex-direction: column; gap: 0.5rem; }
          .abono-detail { display: flex; justify-content: space-between; align-items: center; }
          .detail-label { font-size: 0.9rem; color: #6c757d; }
          .detail-value { font-weight: 600; color: #2c3e50; font-size: 0.95rem; }
          .detail-value.amount { color: #27ae60; font-size: 1.05rem; }
          .detail-value.saldo { color: #e74c3c; }
          
          .empty-state { text-align: center; padding: 2rem; color: #6c757d; }
          .empty-state i { font-size: 3rem; margin-bottom: 0.5rem; opacity: 0.3; }
          .empty-state p { margin: 0; font-size: 1rem; }
        </style>
      `,
      width: '700px',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#3498db',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-confirm-btn'
      }
    });
  }

  /**
   * Calcula el total de saldo pendiente de todas las cuentas activas del período.
   */
  getTotalPendiente(): number {
    return this.cuentas
      .filter(c => c.estado === EstadoCuenta.ACTIVA)
      .reduce((total, cuenta) => total + cuenta.saldo, 0);
  }

  /**
   * Calcula el total de cuentas activas del período.
   */
  getCantidadActivas(): number {
    return this.cuentas.filter(c => c.estado === EstadoCuenta.ACTIVA).length;
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
   * 5. Deuda del período seleccionado
   * Total de deudas (monto total) del período de cuenta banco seleccionado.
   */
  getDeudaPeriodo(): number {
    return this.cuentas.reduce((total, cuenta) => total + cuenta.montoTotal, 0);
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
