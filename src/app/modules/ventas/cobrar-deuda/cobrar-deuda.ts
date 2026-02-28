import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ClientesService } from '../../../core/services/clientes';
import { FacturasService } from '../../../core/services/facturas';
import { ProductosService } from '../../../core/services/productos';
import { CajaChicaService } from '../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../core/services/caja-banco.service';
import { AuthService } from '../../../core/services/auth.service';
import { FacturasDeudaService } from '../../../core/services/facturas-deuda.service';
import { VentasTarjetaService } from '../../../core/services/ventas-tarjeta.service';
import { obtenerPeriodo } from '../../../core/utils/fecha-helpers';
import { FacturaDeuda } from '../../../core/models/factura-deuda.model';

@Component({
  selector: 'app-cobrar-deuda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobrar-deuda.html',
  styleUrls: ['./cobrar-deuda.css', './cobrar-deuda-compacto.css'], // diseño compacto del panel derecho
})
export class CobrarDeudaComponent implements OnInit, OnDestroy {
  loading = true;

  clienteId = '';
  clienteNombre = '';
  clienteTelefono = '';
  returnTo = '';

  // 🔎 BUSCAR CLIENTE CON DEUDA
  terminoBusquedaCliente = '';
  clientesBusqueda: any[] = [];
  clientesFiltrados: any[] = [];
  mostrarResultadosCliente = false;
  cargandoClientes = false;
  readonly MAX_RESULTADOS_CLIENTES = 10;

  pendientes: any[] = [];
  deudaTotal = 0;

  facturaSeleccionada: any = null;

  metodoPago = 'Efectivo';
  codigoTransferencia = ''; // Código de transferencia bancaria
  ultimosCuatroTarjeta = ''; // Últimos 4 dígitos de la tarjeta
  montoRecibido = 0; // 💵 Cuánto dinero entrega el cliente (solo visual)
  abono = 0;
  saldoNuevo = 0;

  // 🕐 FECHA Y HORA DE PAGO
  horaPago = ''; // Hora del pago (HH:mm)
  fechaPago = ''; // Fecha del pago (YYYY-MM-DD) - para todos los métodos
  fechaMinima = ''; // Fecha mínima permitida (inicio del periodo de caja)
  fechaMaxima = ''; // Fecha máxima permitida (fin del periodo de caja o hoy)
  periodoNombre = ''; // Nombre del periodo para mostrar (ej: "Diciembre 2025")
  fechaManual = false; // Indica si el admin modificó manualmente la fecha
  horaManual = false; // Indica si el admin modificó manualmente la hora

  // 🔒 CONTROL DE CAJA ABIERTA
  hayCajaAbierta = false; // Indica si existe una caja chica abierta (para habilitar/deshabilitar efectivo)
  hayCajaBancoAbierta = false; // Indica si existe una caja banco abierta (para habilitar/deshabilitar transferencia/tarjeta)

  // ✅ CONTROL DE CRÉDITO PERSONAL
  esCreditoPersonal = false; // Checkbox para marcar si es crédito personal

  pagando = false;
  sub?: Subscription;

  // ✅ ticket
  ticketPago: any = null;

  // ✅ FILTROS Y BÚSQUEDA
  filtroFactura = ''; // Búsqueda por número de factura

  /**
   * Calcula el vuelto automáticamente
   * Vuelto = Abono - Saldo Pendiente (solo si abono es mayor)
   */
  get vuelto(): number {
    if (this.metodoPago !== 'Efectivo') return 0;
    const abonoActual = Number(this.abono || 0);
    const saldoActual = this.facturaSeleccionada?.saldoPendiente || 0;
    return Math.max(0, abonoActual - saldoActual);
  }

  /**
   * Verifica si el usuario es administrador
   * Solo los administradores pueden modificar fecha y hora manualmente
   */
  get esAdmin(): boolean {
    return this.authService.isAdmin();
  }
  filtroFecha = ''; // Filtro por fecha (YYYY-MM-DD)
  filtroCredito: 'todos' | 'conCredito' | 'sinCredito' = 'todos'; // Filtro por tipo de crédito
  selectedIndex = -1; // Índice de factura seleccionada con teclado

  // Getters para facturas filtradas
  get facturasFiltradas(): any[] {
    return this.pendientes.filter(f => {
      // Filtro por número de factura
      if (this.filtroFactura.trim()) {
        const numero = f.id?.toString().toLowerCase() || '';
        if (!numero.includes(this.filtroFactura.toLowerCase())) {
          return false;
        }
      }

      // Filtro por fecha
      if (this.filtroFecha.trim()) {
        const fechaFactura = f.fecha?.toDate ? f.fecha.toDate() : new Date(f.fecha);
        // Convertir ambas fechas a YYYY-MM-DD para comparar sin timezone
        const facturaIso = fechaFactura.getFullYear().toString().padStart(4, '0') + '-' +
                          (fechaFactura.getMonth() + 1).toString().padStart(2, '0') + '-' +
                          fechaFactura.getDate().toString().padStart(2, '0');
        const filtroIso = this.filtroFecha.trim(); // Ya viene en formato YYYY-MM-DD
        if (facturaIso !== filtroIso) {
          return false;
        }
      }

      const esCreditoFactura = this.esFacturaCredito(f);

      // Filtro por crédito
      if (this.filtroCredito === 'conCredito' && !esCreditoFactura) {
        return false;
      }
      if (this.filtroCredito === 'sinCredito' && esCreditoFactura) {
        return false;
      }

      return true;
    });
  }

  private esFacturaCredito(f: any): boolean {
    return Boolean(
      f?.esCredito ||
      (f?.tipoVenta && String(f.tipoVenta).toUpperCase() === 'CREDITO') ||
      (f?.estadoCredito && String(f.estadoCredito).toUpperCase() === 'ACTIVO')
    );
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientesSrv: ClientesService,
    private facturasSrv: FacturasService,
    private productosSrv: ProductosService,
    private cajaChicaService: CajaChicaService,
    private cajaBancoService: CajaBancoService,
    private authService: AuthService,
    private facturasDeudaService: FacturasDeudaService,
    private ventasTarjetaService: VentasTarjetaService
  ) {}

  /**
   * 🔎 Buscar clientes con deuda
   */
  async buscarClientesConDeuda(): Promise<void> {
    const termino = this.terminoBusquedaCliente.trim().toLowerCase();

    if (!termino) {
      this.clientesFiltrados = [];
      this.mostrarResultadosCliente = false;
      return;
    }

    if (termino.length < 2) {
      this.mostrarResultadosCliente = false;
      return;
    }

    this.mostrarResultadosCliente = true;
    this.cargandoClientes = true;

    try {
      // Cargar todos los clientes
      const todosClientes = await firstValueFrom(this.clientesSrv.getClientes());
      
      // Filtrar solo los que tienen deuda
      this.clientesBusqueda = todosClientes.filter(c => c.tieneDeuda === true);
      
      this.aplicarFiltroClientesDeuda(termino);
      this.cargandoClientes = false;
    } catch (error) {
      console.error('Error al buscar clientes con deuda:', error);
      this.clientesFiltrados = [];
      this.cargandoClientes = false;
    }
  }

  private aplicarFiltroClientesDeuda(termino: string): void {
    const terminoNormalizado = termino.trim().toLowerCase();

    this.clientesFiltrados = this.clientesBusqueda
      .filter(c => {
        const nombreCompleto = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.toLowerCase();
        const cedula = (c.cedula ?? '').toLowerCase();
        const telefono = (c.telefono ?? '').toLowerCase();

        return nombreCompleto.includes(terminoNormalizado) ||
               cedula.includes(terminoNormalizado) ||
               telefono.includes(terminoNormalizado);
      })
      .slice(0, this.MAX_RESULTADOS_CLIENTES);
  }

  limpiarBusquedaCliente(): void {
    this.terminoBusquedaCliente = '';
    this.clientesFiltrados = [];
    this.mostrarResultadosCliente = false;
    this.clienteId = '';
    this.clienteNombre = '';
    this.pendientes = [];
    this.deudaTotal = 0;
    this.facturaSeleccionada = null;
    this.abono = 0;
  }

  cerrarResultadosCliente(): void {
    this.mostrarResultadosCliente = false;
  }

  trackByClienteId(index: number, item: any): string {
    return item.id || `index-${index}`;
  }

  async seleccionarCliente(cliente: any): Promise<void> {
    if (!cliente.id) return;

    this.clienteId = cliente.id;
    this.clienteNombre = `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
    this.clienteTelefono = cliente.telefono || '';
    this.terminoBusquedaCliente = this.clienteNombre;
    this.mostrarResultadosCliente = false;

    // Cargar deudas del cliente
    await this.cargarDeudasCliente();
  }

  async ngOnInit() {
    // � Inicializar fecha y hora por defecto
    this.inicializarFechaHora();

    // 🔒 VALIDACIÓN CRÍTICA: Verificar que exista alguna caja chica ABIERTA
    try {
      const validacion = await this.cajaChicaService.validarCajaAbierta();
      
      // ✅ Caja ABIERTA - Permitir entrada
      if (validacion.valida) {
        // Continuamos con la carga normal
      } 
      // ❌ NO existe caja ABIERTA
      else {
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica Requerida',
          text: 'Debe tener una caja chica ABIERTA para cobrar deudas.',
          confirmButtonText: 'Ir a Caja Chica',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/caja-chica']);
        });
        return;
      }
    } catch (error) {
      console.error('Error al validar caja chica:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al verificar la caja chica. Intente nuevamente.',
        confirmButtonText: 'Volver'
      }).then(() => {
        this.router.navigate(['/caja-chica']);
      });
      return;
    }

    // 🔒 Verificar si hay caja abierta (para controlar método de pago)
    await this.verificarCajaAbierta();    
    // 🏦 Verificar si hay caja banco abierta (para transferencia/tarjeta)
    await this.verificarCajaBancoAbierta();
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '';
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';
    
    if (!this.clienteId) {
      // No hay cliente pre-seleccionado - modo búsqueda
      this.loading = false;
      return;
    }

    // Cliente viene pre-seleccionado desde otra página
    await this.cargarDeudasCliente();
  }

  async cargarDeudasCliente(): Promise<void> {
    if (!this.clienteId) {
      return;
    }

    this.loading = true;

    try {
      const cli = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));
      this.clienteNombre = `${cli?.nombres || ''} ${cli?.apellidos || ''}`.trim();
      this.terminoBusquedaCliente = this.clienteNombre;
      this.clienteTelefono = cli?.telefono || '';

      this.sub = this.facturasSrv.getPendientesPorCliente(this.clienteId).subscribe(list => {
        this.pendientes = list || [];
        this.deudaTotal = +this.pendientes.reduce((acc, f) => acc + Number(f?.saldoPendiente || 0), 0).toFixed(2);

        // si la seleccionada ya no existe (pagada), limpiar
        if (this.facturaSeleccionada) {
          const still = this.pendientes.find(x => x.id === this.facturaSeleccionada.id);
          if (!still) {
            this.facturaSeleccionada = null;
            this.abono = 0;
            this.saldoNuevo = 0;
          } else {
            // refrescar datos en pantalla
            this.facturaSeleccionada = still;
            this.recalcularSaldoNuevo();
          }
        }
      });
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // ✅ BÚSQUEDA Y FILTROS
  limpiarFiltros() {
    this.filtroFactura = '';
    this.filtroFecha = '';
    this.filtroCredito = 'todos';
    this.selectedIndex = -1;
    this.facturaSeleccionada = null;
  }

  // ✅ NAVEGACIÓN CON TECLADO (como en crear-venta)
  onSearchKeydown(event: KeyboardEvent) {
    const filtradas = this.facturasFiltradas;
    if (filtradas.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, filtradas.length - 1);
      this.scrollToSelectedFactura();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.scrollToSelectedFactura();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Si no hay selección, seleccionar la primera
      if (this.selectedIndex < 0 && filtradas.length > 0) {
        this.selectedIndex = 0;
      }
      // Seleccionar la factura en el índice actual
      if (this.selectedIndex >= 0 && this.selectedIndex < filtradas.length) {
        const f = filtradas[this.selectedIndex];
        if (f) {
          this.facturaSeleccionada = f;
          this.abono = 0;
          this.metodoPago = 'Efectivo';
          this.codigoTransferencia = '';
          this.ultimosCuatroTarjeta = '';
          this.esCreditoPersonal = this.esFacturaCredito(f);
          this.recalcularSaldoNuevo();
        }
      }
    }
  }

  // ✅ NAVEGACIÓN GLOBAL CON TECLADO
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    // Solo si el usuario está en el componente
    const filtradas = this.facturasFiltradas;
    if (!filtradas || filtradas.length === 0) return;

    // ArrowDown y ArrowUp funcionan en cualquier parte
    if (event.key === 'ArrowDown' && (event.target as HTMLElement)?.tagName !== 'TEXTAREA') {
      if ((event.target as HTMLElement)?.tagName !== 'INPUT' || (event.target as any)?.type === 'date' || (event.target as any)?.type === 'select-one') {
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, filtradas.length - 1);
        this.scrollToSelectedFactura();
      }
    } else if (event.key === 'ArrowUp' && (event.target as HTMLElement)?.tagName !== 'TEXTAREA') {
      if ((event.target as HTMLElement)?.tagName !== 'INPUT' || (event.target as any)?.type === 'date' || (event.target as any)?.type === 'select-one') {
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollToSelectedFactura();
      }
    }
  }

  // ✅ AUTO-SCROLL A LA FACTURA SELECCIONADA
  private scrollToSelectedFactura() {
    setTimeout(() => {
      const elementos = document.querySelectorAll('.producto-item');
      if (this.selectedIndex >= 0 && this.selectedIndex < elementos.length) {
        const elemento = elementos[this.selectedIndex] as HTMLElement;
        elemento.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 0);
  }

  seleccionarFactura(f: any, desdeKeyboard = false) {
    this.facturaSeleccionada = f;
    this.abono = 0;
    this.metodoPago = 'Efectivo';
    this.codigoTransferencia = '';
    this.ultimosCuatroTarjeta = '';
    // ✅ Cargar estado de crédito personal si aplica
    this.esCreditoPersonal = this.esFacturaCredito(f);
    this.recalcularSaldoNuevo();
    // Solo recalcular índice si se hizo click (no desde keyboard)
    if (!desdeKeyboard) {
      this.selectedIndex = this.facturasFiltradas.findIndex(x => x.id === f.id);
    }
  }

  onChangeAbono(value: any) {
    const n = Math.max(0, Number(value || 0));
    this.abono = n; // Permitir cualquier cantidad en todos los métodos de pago
    this.recalcularSaldoNuevo();
  }

  /**
   * Maneja el cambio de método de pago
   * Ajusta restricciones de fecha según el método seleccionado
   */
  async onMetodoPagoChange() {
    if (this.metodoPago !== 'Efectivo') {
      // Para transferencia/tarjeta: cargar restricciones de caja banco
      await this.cargarRestriccionesFechaCajaBanco();
    } else {
      // Para efectivo: cargar restricciones de caja chica
      await this.cargarRestriccionesFechaCajaAbierta();
    }
  }

  private recalcularSaldoNuevo() {
    const saldo = Number(this.facturaSeleccionada?.saldoPendiente || 0);
    // ✅ Saldo nuevo nunca debe ser negativo (si abono > saldo, saldo nuevo = 0)
    this.saldoNuevo = Math.max(0, +(saldo - this.abono).toFixed(2));
  }

  async registrarAbono() {
    if (!this.facturaSeleccionada || this.abono <= 0 || this.pagando) return;

    // ✅ Validar que haya caja banco abierta para transferencias/tarjetas
    if ((this.metodoPago === 'Transferencia' || this.metodoPago === 'Tarjeta') && !this.hayCajaBancoAbierta) {
      await Swal.fire({
        icon: 'error',
        title: 'Caja Banco Cerrada',
        html: 'No hay ninguna caja banco abierta.<br><br>Para registrar pagos con <b>Transferencia</b> o <b>Tarjeta</b>, primero debes abrir una caja banco desde el módulo de <b>Caja Banco</b>.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    this.pagando = true;

    try {
      const f = this.facturaSeleccionada;

      const total = Number(f?.total || 0);
      const saldoAnterior = Math.max(0, Number(f?.saldoPendiente ?? total));
      const abonadoAnterior = +(total - saldoAnterior).toFixed(2);

      const abonoReal = Math.min(this.abono, saldoAnterior);

      const abonadoNuevo = +(abonadoAnterior + abonoReal).toFixed(2);
      const saldoNuevo = +(total - abonadoNuevo).toFixed(2);
      const estadoPago = saldoNuevo <= 0 ? 'PAGADA' : 'PENDIENTE';
      const esCreditoFactura = this.esFacturaCredito(f);
      const marcarCredito = this.esCreditoPersonal || esCreditoFactura;

      // 🕐 OBTENER CAJA CHICA ABIERTA (necesaria para ambas ramas)
      let cajaChicaAbierta: any = null;
      try {
        cajaChicaAbierta = await this.cajaChicaService.getCajaAbierta();
      } catch (err) {
        console.warn('⚠️ No se pudo obtener caja abierta:', err);
      }

      // 🕐 CONSTRUIR FECHA FINAL CON HORA
      let fechaFinal: Date;
      if (this.metodoPago === 'Efectivo') {
        // Para efectivo: usar fecha de caja chica + hora seleccionada
        try {
          console.log('📅 Caja abierta obtenida:', cajaChicaAbierta);
          
          if (cajaChicaAbierta?.fecha) {
            // Convertir correctamente Timestamp de Firestore a Date
            let fechaCaja: Date;
            if ((cajaChicaAbierta.fecha as any).toDate) {
              // Es un Timestamp de Firestore
              fechaCaja = (cajaChicaAbierta.fecha as any).toDate();
            } else if (cajaChicaAbierta.fecha instanceof Date) {
              fechaCaja = cajaChicaAbierta.fecha;
            } else {
              fechaCaja = new Date(cajaChicaAbierta.fecha);
            }
            
            console.log('📅 Fecha de caja convertida:', fechaCaja);
            console.log('🕐 Hora de pago seleccionada:', this.horaPago);
            
            fechaFinal = this.combinarFechaHora(fechaCaja, this.horaPago);
            console.log('✅ Fecha final EFECTIVO combinada:', fechaFinal);
          } else {
            console.warn('⚠️ No hay fecha en caja, usando fecha actual');
            fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
          }
        } catch (err) {
          console.error('❌ Error obteniendo fecha de caja chica:', err);
          fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
        }
      } else {
        // Para transferencia/tarjeta: validar fecha seleccionada pero usar fecha contable de caja chica
        console.log('💳 Usando fecha contable de caja chica para caja banco');
        
        // ✅ VALIDAR QUE LA FECHA ESTÉ DENTRO DEL PERIODO DE LA CAJA BANCO
        if (this.fechaMinima && this.fechaMaxima) {
          if (this.fechaPago < this.fechaMinima || this.fechaPago > this.fechaMaxima) {
            Swal.fire({
              icon: 'error',
              title: 'Fecha Inválida',
              text: `La fecha debe estar dentro del periodo de la caja banco: ${this.periodoNombre}. Seleccione una fecha entre ${this.fechaMinima} y ${this.fechaMaxima}.`,
              confirmButtonText: 'Entendido'
            });
            this.pagando = false;
            return;
          }
        }
        
        // ✅ VALIDAR QUE LA CAJA BANCO DEL PERÍODO ESTÉ ABIERTA
        const cajaAbierta = await this.cajaBancoService.verificarCajaAbiertaPorFecha(this.fechaPago);
        if (!cajaAbierta) {
          const fechaObj = new Date(this.fechaPago);
          const mesNombre = fechaObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          Swal.fire({
            icon: 'error',
            title: 'Caja Banco Cerrada',
            text: `La caja banco del período ${mesNombre} está cerrada. No se pueden registrar movimientos en ese período.`,
            confirmButtonText: 'Entendido'
          });
          this.pagando = false;
          return;
        }
        
        // ✅ Para transferencia/tarjeta: usar fecha seleccionada por el usuario
        try {
          console.log('📅 Fecha seleccionada por usuario (no efectivo):', this.fechaPago);
          console.log('🕐 Hora de pago seleccionada:', this.horaPago);
          
          fechaFinal = this.combinarFechaHora(this.fechaPago, this.horaPago);
          console.log('✅ Fecha final TRANSFERENCIA/TARJETA:', fechaFinal);
        } catch (err) {
          console.error('❌ Error combinando fecha y hora (no efectivo):', err);
          fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
        }
      }

      console.log('🎯 FECHA FINAL QUE SE GUARDARÁ EN COBRO DE DEUDA:', fechaFinal);

      // ✅ CREAR REGISTRO DE PAGO EN NUEVA COLECCIÓN facturas_deudas
      // En lugar de modificar la factura original, creamos un documento separado
      const usuario = this.authService.getCurrentUser();
      
      // Determinar origen de caja según método de pago
      const origenCaja = this.metodoPago === 'Efectivo' ? 'CAJA_CHICA' : 'CAJA_BANCO';
      
      // Construir objeto deuda SIN campos undefined (Firestore no los permite)
      const deuda: FacturaDeuda = {
        facturaId: f.id,
        facturaIdPersonalizado: f.idPersonalizado || '',
        clienteId: this.clienteId,
        clienteNombre: this.clienteNombre,
        clienteTelefono: this.clienteTelefono,
        fechaPago: fechaFinal,
        montoPagado: abonoReal,
        totalFactura: total,
        saldoRestante: Math.max(0, saldoNuevo),
        metodoPago: this.metodoPago,
        estadoPago,
        tipoMovimiento: 'PAGO_DEUDA',
        origenCaja: origenCaja,
        esCredito: marcarCredito,
        cajaChicaId: cajaChicaAbierta?.id,
        usuarioId: usuario?.id,
        usuarioNombre: usuario?.nombre || 'Desconocido',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Agregar campos opcionales solo si tienen valor
      if (this.codigoTransferencia) {
        deuda.codigoTransferencia = this.codigoTransferencia;
      }
      if (this.ultimosCuatroTarjeta) {
        deuda.ultimosCuatroTarjeta = this.ultimosCuatroTarjeta;
      }

      // Guardar en la nueva colección (factura original no se modifica)
      await this.facturasDeudaService.crearPagoDeuda(deuda);

      // ✅ Si la deuda quedó saldada, marcar SOLO el estado de la factura original y sus cobros
      if (estadoPago === 'PAGADA') {
        await this.facturasSrv.marcarFacturaComoPagada(f.id);
        await this.facturasDeudaService.actualizarEstadoPagosDeuda(f.id, 'PAGADA');
      }

      // ✅ Si se marcó crédito personal, actualizar estado de crédito en la factura original
      if (marcarCredito) {
        try {
          await this.facturasSrv.actualizarFactura(f.id, {
            esCredito: true,
            tipoVenta: 'CREDITO',
            estadoCredito: saldoNuevo > 0 ? 'ACTIVO' : 'CANCELADO'
          });
        } catch (err) {
          console.warn('⚠️ No se pudo actualizar estado de crédito en factura:', err);
        }
      }

      // 💳💰 ACTUALIZAR CAMPOS DE DEUDA/CRÉDITO EN CLIENTE
      // Después de registrar pago, actualizar los campos denormalizados
      try {
        await this.clientesSrv.actualizarCamposDeudaCredito(this.clienteId);
        console.log('✅ Campos de deuda/crédito actualizados en cliente');
      } catch (err) {
        console.warn('⚠️ No se pudieron actualizar campos de deuda/crédito:', err);
        // No bloquear el flujo, solo advertir
      }

      // ✅ enriquecer ítems con código real si falta
      const items = Array.isArray(f.items) ? [...f.items] : [];
      for (const it of items) {
        if (!it.codigo && it.productoId) {
          try {
            const prod: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));
            it.codigo = prod?.codigo || it.productoId;
          } catch (err) {
            it.codigo = it.productoId;
          }
        }
      }

      // ✅ ticket con tu estilo + ítems
      this.ticketPago = {
        facturaId: f.id,
        fecha: fechaFinal,  // Date - Firestore lo convertirá automáticamente
        clienteNombre: this.clienteNombre,
        clienteTelefono: this.clienteTelefono,
        metodoPago: this.metodoPago,
        totalFactura: total,
        abonadoAnterior,
        abonoRealizado: abonoReal,
        abonadoNuevo,
        saldoNuevo: Math.max(0, saldoNuevo),
        esCreditoPersonal: this.esCreditoPersonal, // ✅ Usar lo que el usuario seleccionó
        items,
      };

      // ✅ Imprimir con ventana dedicada (mismo patrón que factura/pos)
      setTimeout(() => {
        const ticketEl = document.querySelector('.ticket') as HTMLElement | null;
        if (!ticketEl) return;

        const w = window.open('', 'PRINT', 'height=600,width=380');
        if (!w) return;

        const styles = `
          html, body { margin: 0; padding: 0; width: 80mm; background: #fff; font-family: monospace; }
          .ticket { padding: 6px 4px; font-size: 12px; line-height: 1.2; width: 80mm; box-sizing: border-box; }
          .t-center { text-align: center; }
          .t-right { text-align: right; }
          .t-bold { font-weight: 700; }
          .t-hr { border-top: 1px dashed #000; margin: 6px 0; }
          .t-kv { display: flex; justify-content: space-between; gap: 4px; }
          .t-kv span:first-child { width: 32mm; }
          .t-kv span:last-child { flex: 1; text-align: right; }
          .t-table-head, .t-table-row { display: grid; grid-template-columns: 8mm 30mm 8mm 12mm 12mm; column-gap: 2mm; row-gap: 0; align-items: center; }
          .t-table-head { font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 4px; }
          .t-table-row { margin: 0 0 2px 0; }
          .t-cell { display: block; }
          .t-cut { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .t-small { font-size: 11px; }
          @media print { @page { size: 80mm auto; margin: 0; } html, body { width: 80mm; margin: 0; padding: 0; } .ticket { width: 80mm; } }
        `;

        w.document.write(`
          <html>
            <head>
              <title>Comprobante de Abono</title>
              <style>${styles}</style>
            </head>
            <body>
              ${ticketEl.outerHTML}
            </body>
          </html>
        `);
        w.document.close();

        const triggerPrint = () => {
          let closed = false;
          const safeClose = () => { if (closed) return; closed = true; w.close(); };
          try {
            w.focus();
            w.addEventListener('afterprint', safeClose, { once: true });
            w.print();
            setTimeout(safeClose, 2000);
          } catch {
            safeClose();
          }
        };

        if (w.document.readyState === 'complete') {
          setTimeout(triggerPrint, 150);
        } else {
          w.onload = () => setTimeout(triggerPrint, 150);
        }
      }, 0);

      // limpiar campos
      this.abono = 0;
      this.saldoNuevo = 0;

      // 💰 Registrar en Caja Chica ABIERTA automáticamente (solo efectivo)
      if (this.metodoPago === 'Efectivo' && cajaChicaAbierta?.id && abonoReal > 0) {
        try {
          const usuario = this.authService.getCurrentUser();
          const movimiento = {
            caja_chica_id: cajaChicaAbierta.id,
            fecha: fechaFinal,  // Mantener como Date para el servicio de caja chica
            tipo: 'INGRESO' as const,
            descripcion: `Pago de deuda - ${this.clienteNombre} - Factura #${f.id}`,
            monto: abonoReal,
            comprobante: f.id,
          };
          if (usuario?.id) {
            (movimiento as any).usuario_id = usuario.id;
            (movimiento as any).usuario_nombre = usuario.nombre || 'Usuario';
          }
          await this.cajaChicaService.registrarMovimiento(cajaChicaAbierta.id, movimiento);
          console.log('✅ Pago de deuda registrado en Caja Chica:', cajaChicaAbierta.id, abonoReal);
        } catch (err) {
          console.warn('No se pudo registrar el pago en Caja Chica:', err);
          // Mostrar advertencia pero no fallar la operación
          await Swal.fire({
            icon: 'warning',
            title: 'Advertencia',
            text: `El cobro se registró correctamente pero no se pudo agregar a caja chica: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            confirmButtonText: 'Aceptar'
          });
        }
      } else if (this.metodoPago === 'Transferencia' && abonoReal > 0) {
        // 🏦 Pago por TRANSFERENCIA → Registrar en Caja Banco
        // ✅ IMPORTANTE: Permitir registrar INCLUSO si el código de transferencia está vacío
        // (igual a como funciona en facturas normales)
        try {
          const usuario = this.authService.getCurrentUser();
          await this.cajaBancoService.registrarTransferenciaCliente(
            abonoReal,
            this.codigoTransferencia || '', // Permitir código vacío
            f.id,
            usuario?.id || '',
            usuario?.nombre || 'Usuario',
            fechaFinal,  // Pasar la fecha seleccionada por el usuario
            'Cobro de deuda'  // Especificar que es cobro de deuda, no venta
          );
          console.log('✅ Pago de deuda registrado en Caja Banco con fecha', fechaFinal);
        } catch (err) {
          console.error('❌ Error registrando transferencia en Caja Banco:', err);
          // Mostrar advertencia pero no fallar la operación
          Swal.fire({
            icon: 'warning',
            title: 'Advertencia',
            text: `El pago se registró pero hubo un error al registrar la transferencia en caja banco: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            confirmButtonText: 'Aceptar'
          });
        }
      } else if (this.metodoPago === 'Tarjeta' && abonoReal > 0) {
        // 💳 Pago por TARJETA → Registrar en módulo Ventas con Tarjeta (cuenta por cobrar al banco)
        // ✅ IMPORTANTE: Los cobros de deuda con tarjeta deben aparecer en el módulo "Cobros de Ventas con Tarjeta"
        try {
          // 1️⃣ Registrar en ventas_tarjeta (para control de cobros diferidos del banco)
          await this.ventasTarjetaService.crearVentaTarjeta({
            facturaId: f.id,
            facturaIdPersonalizado: f.idPersonalizado || f.id,
            clienteId: this.clienteId,
            clienteNombre: this.clienteNombre,
            fechaVenta: fechaFinal,
            montoTotal: abonoReal, // Solo el monto que se está pagando ahora
            ultimosCuatroTarjeta: this.ultimosCuatroTarjeta || undefined
          }, true); // ✅ Pasar true para indicar que es cobro de deuda (actualizar si existe)
          console.log('✅ Cobro de deuda con tarjeta registrado en módulo ventas_tarjeta');
        } catch (err) {
          console.error('❌ Error registrando cobro en ventas_tarjeta:', err);
          // Mostrar advertencia pero no fallar la operación
          await Swal.fire({
            icon: 'warning',
            title: 'Advertencia',
            text: `El pago se registró pero no apareció en el módulo de Cobros con Tarjeta. Error: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            confirmButtonText: 'Aceptar'
          });
        }
      }

      // ✅ MOSTRAR SWAL DE ÉXITO Y REGRESAR A HISTORIAL
      await Swal.fire({
        icon: 'success',
        title: 'Validado',
        text: `Se registró el abono de $${abonoReal.toFixed(2)} al cliente ${this.clienteNombre} correctamente.`,
        toast: true,
        position: 'top-end',
        showConfirmButton: true,
        confirmButtonColor: '#28a745',
        timer: 3000,
      });

      if (this.returnTo) {
        this.router.navigateByUrl(this.returnTo);
        return;
      }

    } catch (e: any) {
      console.error(e);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el abono',
        confirmButtonText: 'Entendido'
      });
    } finally {
      this.pagando = false;
    }
  }

  /**
   * Inicializa los campos de fecha y hora con valores actuales
   * Si es operador, actualiza continuamente la hora cada segundo
   */
  inicializarFechaHora(): void {
    this.actualizarFechaHoraActual();
    
    // Si es operador, actualizar fecha/hora cada segundo
    if (!this.esAdmin) {
      setInterval(() => {
        this.actualizarFechaHoraActual();
      }, 1000);
    }
    
    // Cargar restricciones de fecha según caja banco abierta (solo para admin)
    if (this.esAdmin) {
      this.cargarRestriccionesFechaCajaBanco();
    }
  }

  /**
   * Verifica si hay una caja chica abierta
   * Actualiza la propiedad hayCajaAbierta y ajusta el método de pago si es necesario
   */
  async verificarCajaAbierta(): Promise<void> {
    try {
      const caja = await this.cajaChicaService.getCajaAbierta();
      this.hayCajaAbierta = !!caja;
      
      // Si no hay caja abierta y el método de pago es Efectivo, cambiar a Transferencia
      if (!this.hayCajaAbierta && this.metodoPago === 'Efectivo') {
        this.metodoPago = 'Transferencia';
        console.log('⚠️ No hay caja abierta. Método de pago cambiado a Transferencia');
      }
    } catch (error) {
      console.error('Error al verificar caja abierta:', error);
      this.hayCajaAbierta = false;
    }
  }

  /**
   * Verifica si hay una caja banco abierta para transferencias/tarjetas
   */
  async verificarCajaBancoAbierta(): Promise<void> {
    try {
      const caja = await this.cajaBancoService.getCajaBancoAbierta();
      this.hayCajaBancoAbierta = !!caja;
      
      if (!this.hayCajaBancoAbierta) {
        console.log('⚠️ No hay caja banco abierta. Transferencia/Tarjeta no disponibles');
        
        // Si el método de pago actual es Transferencia o Tarjeta y no hay caja banco, cambiar a Efectivo
        if ((this.metodoPago === 'Transferencia' || this.metodoPago === 'Tarjeta') && this.hayCajaAbierta) {
          this.metodoPago = 'Efectivo';
          console.log('⚠️ Método de pago cambiado a Efectivo');
        }
      } else {
        // Si hay caja banco abierta, cargar restricciones de fecha
        await this.cargarRestriccionesFechaCajaBanco();
      }
    } catch (error) {
      console.error('Error al verificar caja banco abierta:', error);
      this.hayCajaBancoAbierta = false;
    }
  }

  /**
   * Actualiza fecha y hora con valores actuales
   */
  private actualizarFechaHoraActual(): void {
    const ahora = new Date();
    
    // Formato HH:mm:ss para hora
    const horas = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    this.horaPago = `${horas}:${minutos}:${segundos}`;
    
    // Formato YYYY-MM-DD para fecha
    const año = ahora.getFullYear();
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dia = ahora.getDate().toString().padStart(2, '0');
    this.fechaPago = `${año}-${mes}-${dia}`;
    this.fechaMaxima = `${año}-${mes}-${dia}`; // Límite máximo: hoy
  }
  
  /**
   * Carga las restricciones de fecha min/max basadas en la caja chica abierta.
   * Limita la selección de fecha al día de la caja chica activa.
   */
  async cargarRestriccionesFechaCajaAbierta(): Promise<void> {
    try {
      const cajaChica = await this.cajaChicaService.getCajaAbierta();
      
      if (!cajaChica?.fecha) {
        console.warn('⚠️ No hay caja chica abierta, usando fecha actual');
        const hoy = new Date();
        this.fechaMinima = this.formatearFecha(hoy);
        this.fechaMaxima = this.formatearFecha(hoy);
        this.fechaPago = this.formatearFecha(hoy);
        return;
      }

      // Convertir fecha de Firestore a Date
      let fechaCaja: Date;
      if ((cajaChica.fecha as any)?.toDate) {
        fechaCaja = (cajaChica.fecha as any).toDate();
      } else if (cajaChica.fecha instanceof Date) {
        fechaCaja = cajaChica.fecha;
      } else {
        fechaCaja = new Date(cajaChica.fecha);
      }

      // Para efectivo: usar fecha de caja chica (puede ser mes actual o anterior)
      this.fechaMinima = this.formatearFecha(fechaCaja);
      this.fechaMaxima = this.formatearFecha(fechaCaja);
      this.fechaPago = this.formatearFecha(fechaCaja);
      
      // Nombre del periodo para mostrar
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mes = fechaCaja.getMonth();
      const año = fechaCaja.getFullYear();
      this.periodoNombre = `${fechaCaja.getDate()} de ${meses[mes]} ${año}`;

      console.log(`📅 Fecha de pago establecida: ${this.fechaPago} (Caja chica: ${this.periodoNombre})`);
    } catch (error) {
      console.error('❌ Error cargando restricciones de fecha:', error);
      // Fallback a fecha actual
      const hoy = new Date();
      this.fechaMinima = this.formatearFecha(hoy);
      this.fechaMaxima = this.formatearFecha(hoy);
      this.fechaPago = this.formatearFecha(hoy);
    }
  }

  /**
   * Carga las restricciones de fecha min/max basadas en el periodo de la caja banco abierta.
   * Limita la selección de fecha al mes de la caja banco activa.
   * Se usa cuando el usuario cambia a Transferencia o Tarjeta.
   */
  async cargarRestriccionesFechaCajaBanco(): Promise<void> {
    try {
      const caja = await this.cajaBancoService.getCajaBancoAbierta();
      
      if (!caja?.fecha) {
        console.warn('⚠️ No hay caja banco abierta');
        this.hayCajaBancoAbierta = false;
        return;
      }

      // ✅ Hay caja banco abierta
      this.hayCajaBancoAbierta = true;

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
      this.fechaMaxima = this.formatearFecha(fechaMax);
      
      // Nombre del periodo para mostrar
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      this.periodoNombre = `${meses[month]} ${year}`;

      console.log(`📅 Restricciones de fecha establecidas: ${this.fechaMinima} a ${this.fechaMaxima} (${this.periodoNombre})`);
    } catch (error) {
      console.error('❌ Error cargando restricciones de fecha:', error);
      this.hayCajaBancoAbierta = false;
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
   * Combina una fecha con una hora para crear un Date válido
   * @param fecha - Fecha como string (YYYY-MM-DD) o Date
   * @param hora - Hora como string (HH:mm:ss)
   * @returns Date con fecha y hora combinadas
   */
  combinarFechaHora(fecha: string | Date, hora: string): Date {
    let fechaBase: Date;
    
    if (typeof fecha === 'string') {
      // Parsear string YYYY-MM-DD y crear Date con hora 00:00:00 local
      const partes = fecha.split('-');
      const año = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1; // Meses 0-indexed en Date
      const dia = parseInt(partes[2]);
      fechaBase = new Date(año, mes, dia, 0, 0, 0, 0);
    } else {
      // Clonar Date y resetear hora a 00:00:00
      fechaBase = new Date(fecha);
      fechaBase.setHours(0, 0, 0, 0);
    }
    
    // Parsear hora HH:mm:ss
    const partesHora = hora.split(':');
    const horas = parseInt(partesHora[0] || '0');
    const minutos = parseInt(partesHora[1] || '0');
    const segundos = parseInt(partesHora[2] || '0');
    
    // Establecer la hora específica (esto NO causa conversión de zona horaria)
    fechaBase.setHours(horas, minutos, segundos, 0);
    
    console.log(`🔧 combinarFechaHora entrada: fecha=${fecha}, hora=${hora}`);
    console.log(`🔧 combinarFechaHora resultado: ${fechaBase.toLocaleString()} (${fechaBase.toISOString()})`);
    
    return fechaBase;
  }

  /**
   * Marca que el admin modificó manualmente la fecha
   */
  marcarFechaManual(): void {
    this.fechaManual = true;
  }

  /**
   * Marca que el admin modificó manualmente la hora
   */
  marcarHoraManual(): void {
    this.horaManual = true;
  }

  volver() {
    if (this.returnTo) {
      this.router.navigateByUrl(this.returnTo);
      return;
    }
  }
}
