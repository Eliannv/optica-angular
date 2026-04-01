import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { firstValueFrom, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ClientesService } from '../../../core/services/clientes';
import { CONSUMIDOR_FINAL_ID } from '../../../core/services/clientes';
import { ProductosService } from '../../../core/services/productos';
import { HistorialClinicoService } from '../../../core/services/historial-clinico.service';
import { FacturasService } from '../../../core/services/facturas';
import { CajaBancoService } from '../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../core/services/caja-chica.service';
import { AuthService } from '../../../core/services/auth.service';
import { VentasTarjetaService } from '../../../core/services/ventas-tarjeta.service';
import { obtenerPeriodo } from '../../../core/utils/fecha-helpers';

import { ItemVenta } from '../../../core/models/item-venta.model';
import { Factura } from '../../../core/models/factura.model';
import { Cliente } from '../../../core/models/cliente.model';

@Component({
  selector: 'app-crear-venta',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './crear-venta.html',
  styleUrls: ['./crear-venta.css', './crear-venta-compacto.css', './crear-venta-loading.css', './crear-venta-overrides.css'],
})
export class CrearVentaComponent implements OnInit, OnDestroy {
    sinHistorial = false;
  // Listener para navegación con teclado global
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    this.onDocumentKeydown(event);
  }
  clienteId = '';
  historialId = ''; // ✅ NUEVO: ID del historial clínico seleccionado
  cliente: any = null;
  historial: any = null;

  // 🔎 BUSCAR CLIENTE EN CREAR-VENTA
  terminoBusquedaCliente = '';
  clientesBusqueda: Cliente[] = [];
  clientesFiltrados: Cliente[] = [];
  mostrarResultadosCliente = false;
  cargandoClientes = false;
  readonly MAX_RESULTADOS_CLIENTES = 10;
  selectedClienteIndex = -1; // Índice del cliente seleccionado con teclado

  // ➕ CREAR CLIENTE RÁPIDO en POS
  mostrarModalCrearCliente = false;
  clienteRapidoForm!: FormGroup;
  guardandoClienteRapido = false;
  validandoCedulaClienteRapido = false;
  validandoEmailClienteRapido = false;
  cedulaDuplicadaMsgClienteRapido = '';
  emailDuplicadoMsgClienteRapido = '';

  // 🔎 BUSCAR HISTORIAL CLÍNICO EN CREAR-VENTA
  terminoBusquedaHistorial = '';
  historialesBusqueda: any[] = [];
  historialesFiltrados: any[] = [];
  mostrarResultadosHistorial = false;
  cargandoHistoriales = false;
  readonly MAX_RESULTADOS_HISTORIALES = 8;
  selectedHistorialIndex = -1; // Índice del historial seleccionado con teclado

  productos: any[] = [];
  filtro = '';
  codigoEscaneado = '';
  productosFiltrados: any[] = [];
  selectedIndex = -1; // Para navegación con flechas
  productoSeleccionado: any = null; // Producto actualmente seleccionado
  ordenamientoProductos: string = 'codigo'; // 'reciente' o 'codigo' - Por defecto ordenar por idInterno (código)

  // 🚀 OPTIMIZACIÓN: Lazy loading y búsqueda
  private searchSubject$ = new Subject<string>();
  private searchSubscription?: Subscription;
  private clientesBusquedaSub?: Subscription;
  cargandoProductos = false;
  limitProductos = 10; // Límite inicial de productos
  hayMasProductos = true; // Indica si hay más productos por cargar
  private preservarLimite = false; // Flag para preservar límite al limpiar filtro

  // Filtros adicionales
  mostrarFiltros: boolean = false; // Panel de filtros colapsable
  mostrarRecientes: boolean = false; // Toggle para mostrar últimos vendidos
  grupoSeleccionado: string = '';
  proveedorSeleccionado: string = '';
  tipoStockSeleccionado: string = ''; // '', 'NORMAL', 'ILIMITADO'
  gruposDisponibles: string[] = [];
  proveedoresDisponibles: string[] = [];

  items: any[] = []; // (tu ItemVenta ya lo usas pero aquí guardas nombre/tipo/total también)

  // 🔧 SERVICIOS
  mostrarFormServicio: boolean = false; // Toggle para mostrar/ocultar formulario de servicio
  servicioNuevo = {
    nombre: '',
    cantidad: 1,
    precio: 0
  };

  permitirAgregarSinStock = false; // Control de stock activo: no permitir agregar con stock 0
  private codigoScannerTimeout: any = null;
  private codigoBusquedaEnProceso = false;
  private ultimoCodigoProcesado = '';
  private ultimoCodigoProcesadoTime = 0;

  mensajeEscaneo = '';
  mensajeEscaneoTipo: 'success' | 'warning' | 'error' | '' = '';

  ivaPct = 0.15;
  private _descuentoPorcentaje = 0;
  descuentoMonto = 0; // Monto del descuento calculado
  subtotalBruto = 0;
  subtotal = 0;
  iva = 0;
  total = 0;

  metodoPago = 'Efectivo';
  codigoTransferencia = ''; // Código de transferencia bancaria
  ultimosCuatroTarjeta = ''; // Últimos 4 dígitos de la tarjeta
  observacion = '';

  // � FECHA Y HORA DE PAGO
  horaPago = ''; // Hora del pago (HH:mm) - para todos los métodos
  fechaPago = ''; // Fecha del pago (YYYY-MM-DD) - solo para transferencia/tarjeta
  fechaMinima = ''; // Fecha mínima permitida (inicio del periodo de caja banco)
  fechaMaxima = ''; // Fecha máxima permitida (fin del periodo de caja banco o hoy)
  periodoNombre = ''; // Nombre del periodo para mostrar (ej: "Diciembre 2025")
  private fechaHoraIntervalId?: number;
  private fechaManual = false;
  private horaManual = false;

  // 🔒 CONTROL DE CAJA ABIERTA
  hayCajaAbierta = false; // Indica si existe una caja chica abierta (para habilitar/deshabilitar efectivo)

  // �💵 VUELTO (solo visual para efectivo)
  montoRecibido = 0; // Cuánto dinero entrega el cliente

  // ✅ CRÉDITO PERSONAL
  esCredito = false; // Checkbox para venta a crédito personal

  // 🛒 TIPO DE VENTA (CONSUMIDOR FINAL)
  tipoVentaSeleccionado: 'consumidor-final' | 'cliente-registrado' | null = null; // Tipo de venta elegido
  mostrarModalTipoVenta = false; // Controla si se muestra el modal de selección de tipo de venta

  loading = true;
  guardando = false;

  // para ticket
  facturaParaImprimir: any = null;
  private _abono = 0;
  saldoPendiente = 0;

  // ✅ MODO EDICIÓN
  modoEdicion = false; // Indica si estamos editando una factura existente
  facturaId = ''; // ID de la factura a editar
  facturaOriginal: any = null; // Copia de la factura original para comparar cambios
  itemsOriginales: any[] = []; // Items originales para revertir inventario
  cargandoFactura = false; // Indica si se está cargando la factura para edición
  private edicionTemporalStockActiva = false;
  private edicionTemporalFinalizada = false;

  // Getter y Setter para descuentoPorcentaje (limpia "0" inicial)
  get descuentoPorcentaje(): number {
    return this._descuentoPorcentaje;
  }
  set descuentoPorcentaje(value: any) {
    // Si es string que empieza con "0" pero tiene más dígitos, limpiar
    if (typeof value === 'string' && value.startsWith('0') && value.length > 1) {
      this._descuentoPorcentaje = Number(value);
    } else {
      this._descuentoPorcentaje = Number(value || 0);
    }
  }

  /**
   * Verifica si el usuario es administrador
   * Solo los administradores pueden modificar fecha y hora manualmente
   */
  get esAdmin(): boolean {
    return this.authService.isAdmin();
  }

  /**
   * Valida si se puede guardar la venta
   * Requiere: al menos un item (producto O servicio)
   * NO requiere cliente seleccionado (se elegirá tipo de venta al guardar)
   * En modo edición, también requiere que la factura original esté cargada
   */
  get puedeGuardar(): boolean {
    // No permitir guardar si está cargando la factura
    if (this.cargandoFactura) {
      return false;
    }
    // En modo edición, verificar que la factura original esté cargada y que haya cliente
    if (this.modoEdicion && !this.facturaOriginal) {
      return false;
    }
    if (this.modoEdicion && !this.clienteId) {
      return false;
    }
    // Para modo creación, solo se requieren items
    return this.items.length > 0;
  }

  /**
   * Verifica si el cliente actual es CONSUMIDOR FINAL
   */
  get esVentaConsumidorFinal(): boolean {
    return (
      this.clienteId === CONSUMIDOR_FINAL_ID ||
      this.tipoVentaSeleccionado === 'consumidor-final' ||
      this.cliente?.esConsumidorFinal === true
    );
  }

  /**
   * Calcula el vuelto automáticamente
   * Vuelto = Abono - Total (solo si el abono es mayor)
   */
  get vuelto(): number {
    if (this.metodoPago !== 'Efectivo') return 0;
    const abonoActual = Number(this.abono || 0);
    const totalAPagar = this.total;
    return Math.max(0, abonoActual - totalAPagar);
  }

  // Getter y Setter para abono (limpia "0" inicial)
  get abono(): number {
    return this._abono;
  }
  set abono(value: any) {
    // Si es string que empieza con "0" pero tiene más dígitos, limpiar
    if (typeof value === 'string' && value.startsWith('0') && value.length > 1) {
      this._abono = Number(value);
    } else {
      this._abono = Number(value || 0);
    }
  }
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientesSrv: ClientesService,
    private productosSrv: ProductosService,
    private historialSrv: HistorialClinicoService,
    private facturasSrv: FacturasService,
    private cajaBancoService: CajaBancoService,
    private cajaChicaService: CajaChicaService,
    private authService: AuthService,
    private ventasTarjetaService: VentasTarjetaService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder
  ) {}

  async ngOnInit() {
    // 📅 Inicializar fecha y hora por defecto
    this.inicializarFechaHora();

    // ➕ Inicializar formulario de crear cliente rápido
    this.inicializarFormularioClienteRapido();

    // ✅ DETECTAR MODO EDICIÓN: Verificar si hay facturaId en la ruta
    this.facturaId = this.route.snapshot.paramMap.get('facturaId') || '';
    this.modoEdicion = !!this.facturaId;

    // 🔒 Verificar si hay caja abierta (para controlar método de pago)
    await this.verificarCajaAbierta();

    // �🔒 VALIDACIÓN CRÍTICA: Verificar que exista alguna caja chica ABIERTA (solo en modo creación)
    if (!this.modoEdicion) {
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
            text: 'Debe tener una caja chica ABIERTA para realizar ventas.',
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
    }

    // ✅ MODO EDICIÓN: Cargar factura existente
    if (this.modoEdicion) {
      await this.cargarFacturaParaEditar();
    } else {
      // MODO CREACIÓN: puedes entrar con /ventas/crear?clienteId=xxx&historialId=yyy&sinHistorial=true
      this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';
      this.historialId = this.route.snapshot.queryParamMap.get('historialId') || '';
      this.sinHistorial = this.route.snapshot.queryParamMap.get('sinHistorial') === 'true';
    }

    if (!this.clienteId) {
      this.cliente = null;
      this.historial = null;
    }

    // 🔒 Solo cargar cliente e historial si NO están ya cargados (en modo edición ya se cargaron)
    if (this.clienteId && !this.cliente) {
      this.cliente = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));
    }

    if (this.cliente) {
      this.terminoBusquedaCliente = `${this.cliente.nombres ?? ''} ${this.cliente.apellidos ?? ''}`.trim();
      this.mostrarResultadosCliente = false;
    }

    if (this.clienteId) {
      // Si es venta sin historial, forzar historial a null y saltar carga de historial
      if (this.sinHistorial) {
        this.historial = null;
        this.historialId = '';
        this.terminoBusquedaHistorial = 'Sin historial clínico';
        this.mostrarResultadosHistorial = false;
      } else {
        // ✅ NUEVO: Si hay historialId, cargar ese historial específico
        if (this.historialId && !this.historial) {
          const snap = await this.historialSrv.obtenerHistorialPorId(this.clienteId, this.historialId);
          this.historial = snap.exists() ? { id: snap.id, ...snap.data() } : null;
          if (this.historial) {
            this.terminoBusquedaHistorial = this.formatearFechaHistorial(this.historial.fechaHoraChequeo, this.historial.createdAt);
          }
        }
        // Si no hay historialId, no cargar automáticamente - dejar que el usuario elija
        else if (!this.historialId && !this.historial) {
          this.historial = null;
          this.historialId = '';
        }
      }

      // Cargar lista de historiales para búsqueda
      if (!this.modoEdicion) {
        await this.cargarHistorialesCliente();
      }
    }

    // 🚀 OPTIMIZADO: Cargar solo productos limitados inicialmente
    await this.cargarProductosIniciales();

    // 🚀 OPTIMIZADO: Configurar búsqueda con debounce
    this.configurarBusquedaOptimizada();

    // ⚡ Enfocar campo de escaner para entrada rápida con lector de código de barras
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('#codigoEscaneadoInput');
      if (input) {
        input.focus();
      }
    }, 150);

    this.loading = false;
  }

  /**
   * Extrae grupos y proveedores únicos de los productos para los filtros
   */
  extraerGruposYProveedores() {
    const grupos = new Set<string>();
    const proveedores = new Set<string>();

    this.productos.forEach(p => {
      if (p.grupo) grupos.add(p.grupo);
      if (p.proveedor) proveedores.add(p.proveedor);
    });

    this.gruposDisponibles = Array.from(grupos).sort();
    this.proveedoresDisponibles = Array.from(proveedores).sort();
  }

  /**
   * 🚀 OPTIMIZADO: Cargar productos iniciales limitados
   */
  async cargarProductosIniciales() {
    try {
      this.cargandoProductos = true;
      console.log('🔄 Cargando productos...');

      // Cargar TODOS los productos una vez para extraer grupos/proveedores
      const todosProductos = await firstValueFrom(this.productosSrv.getProductos());
      this.productos = todosProductos || [];
      this.extraerGruposYProveedores();

      console.log(`✅ Productos cargados: ${this.productos.length} productos totales`);

      // Cargar solo productos limitados para mostrar
      const productosLimitados = await firstValueFrom(
        this.productosSrv.getProductosLimitados(this.limitProductos)
      );
      this.productosFiltrados = productosLimitados;
      this.hayMasProductos = productosLimitados.length >= this.limitProductos;

    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      this.cargandoProductos = false;
    }
  }

  /**
   * 🚀 OPTIMIZADO: Configurar búsqueda con debounce
   */
  configurarBusquedaOptimizada() {
    this.searchSubscription = this.searchSubject$.pipe(
      debounceTime(300), // Esperar 300ms después del último cambio
      distinctUntilChanged(), // Solo emitir si el valor cambió
      switchMap(searchTerm => {
        this.cargandoProductos = true;

        // 🔧 FIX: Si la búsqueda está vacía Y no hay filtros Y no está en modo recientes, resetear límite y cargar iniciales
        if (!searchTerm.trim() && !this.grupoSeleccionado && !this.proveedorSeleccionado && !this.tipoStockSeleccionado && !this.mostrarRecientes) {
          // Solo resetear límite si no se ha marcado la flag de preservar
          if (!this.preservarLimite) {
            this.limitProductos = 10; // Resetear límite a inicial
          }
          this.preservarLimite = false; // Resetear flag después de usar
          return this.productosSrv.getProductosLimitados(this.limitProductos, 'idInterno');
        }

        // 🔧 FIX: Si está en modo Recientes, usar límite de 10
        if (this.mostrarRecientes) {
          return this.productosSrv.buscarProductosConFiltros({
            searchTerm,
            grupo: this.grupoSeleccionado,
            proveedor: this.proveedorSeleccionado,
            tipoStock: this.tipoStockSeleccionado,
            limitCount: 10 // Solo 10 productos recientes
          });
        }

        // Si hay filtros activos (sin recientes), usar búsqueda con filtros
        if (this.grupoSeleccionado || this.proveedorSeleccionado || this.tipoStockSeleccionado) {
          return this.productosSrv.buscarProductosConFiltros({
            searchTerm,
            grupo: this.grupoSeleccionado,
            proveedor: this.proveedorSeleccionado,
            tipoStock: this.tipoStockSeleccionado,
            limitCount: 20
          });
        }

        // Búsqueda simple limitada
        return this.productosSrv.buscarProductosLimitado(searchTerm, 20);
      })
    ).subscribe({
      next: (productos) => {
        this.productosFiltrados = productos;
        // 🔧 FIX: Actualizar hayMasProductos según el contexto
        if (!this.filtro.trim() && !this.grupoSeleccionado && !this.proveedorSeleccionado && !this.tipoStockSeleccionado && !this.mostrarRecientes) {
          this.hayMasProductos = productos.length >= this.limitProductos;
        } else if (this.mostrarRecientes) {
          this.hayMasProductos = false; // No hay más productos en modo recientes
        } else {
          this.hayMasProductos = productos.length >= 20;
        }
        this.aplicarOrdenamiento();
        this.cargandoProductos = false;
      },
      error: (error) => {
        console.error('Error en búsqueda:', error);
        this.cargandoProductos = false;
      }
    });
  }

  /**
   * 🚀 OPTIMIZADO: Emitir búsqueda con debounce
   */
  filtrarProductos() {
    this.searchSubject$.next(this.filtro);
  }

  /**
   * 🔎 Buscar clientes dentro de crear-venta
   */
  async buscarClientesVenta(): Promise<void> {
    const termino = this.terminoBusquedaCliente.trim().toLowerCase();

    if (!termino) {
      this.clientesFiltrados = [];
      this.mostrarResultadosCliente = false;
      this.selectedClienteIndex = -1;
      return;
    }

    if (termino.length < 2) {
      this.mostrarResultadosCliente = false;
      this.selectedClienteIndex = -1;
      return;
    }

    this.mostrarResultadosCliente = true;

    if (!this.clientesBusquedaSub) {
      this.asegurarClientesBusqueda();
    }

    if (this.clientesBusqueda.length > 0) {
      this.aplicarFiltroClientesVenta(termino);
      this.selectedClienteIndex = -1; // Resetear selección al filtrar
      this.cargandoClientes = false;
    } else {
      this.cargandoClientes = true;
    }
  }

  async limpiarBusquedaCliente(): Promise<void> {
    // 🛒 Si hay un cliente seleccionado Y hay items en el carrito, pedir confirmación
    if (this.clienteId && this.items.length > 0) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Quitar cliente',
        text: '¿Desea quitar el cliente? Esto vaciará el carrito actual.',
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) {
        return;
      }

      this.resetVentaParaCambioCliente();
    }

    // 🧹 Limpiar búsqueda y cliente seleccionado
    this.terminoBusquedaCliente = '';
    this.clientesFiltrados = [];
    this.mostrarResultadosCliente = false;
    this.selectedClienteIndex = -1;

    // 🧹 Limpiar cliente e historial
    this.clienteId = '';
    this.cliente = null;
    this.historialId = '';
    this.historial = null;
    this.sinHistorial = false;

    // 🧹 Limpiar búsqueda de historial también
    this.terminoBusquedaHistorial = '';
    this.historialesFiltrados = [];
    this.mostrarResultadosHistorial = false;
    this.selectedHistorialIndex = -1;
  }

  cerrarResultadosCliente(): void {
    this.mostrarResultadosCliente = false;
    this.selectedClienteIndex = -1;
  }

  /**
   * 🎯 Navegar con teclado en resultados de búsqueda de clientes
   */
  onClienteKeyDown(event: KeyboardEvent): void {
    if (!this.mostrarResultadosCliente || this.clientesFiltrados.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedClienteIndex = Math.min(
          this.selectedClienteIndex + 1,
          this.clientesFiltrados.length - 1
        );
        this.scrollToSelectedCliente();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedClienteIndex = Math.max(this.selectedClienteIndex - 1, 0);
        this.scrollToSelectedCliente();
        break;

      case 'Enter':
        if (this.selectedClienteIndex >= 0 && this.selectedClienteIndex < this.clientesFiltrados.length) {
          event.preventDefault();
          const clienteSeleccionado = this.clientesFiltrados[this.selectedClienteIndex];
          this.seleccionarClienteVenta(clienteSeleccionado);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.cerrarResultadosCliente();
        break;
    }
  }

  /**
   * Desplazar el scroll para mostrar el cliente seleccionado
   */
  private scrollToSelectedCliente(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.resultado-item-selected-cliente');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  trackByClienteIdVenta(index: number, item: Cliente): string {
    return item.id || `index-${index}`;
  }

  private aplicarFiltroClientesVenta(termino: string): void {
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

  private asegurarClientesBusqueda(): void {
    if (this.clientesBusquedaSub) return;

    this.cargandoClientes = true;
    this.clientesBusquedaSub = this.clientesSrv.getClientes().subscribe({
      next: (data) => {
        this.clientesBusqueda = data as Cliente[];

        if (this.terminoBusquedaCliente.trim().length >= 2) {
          this.aplicarFiltroClientesVenta(this.terminoBusquedaCliente);
          this.mostrarResultadosCliente = true;
        }

        this.cargandoClientes = false;
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
        this.clientesFiltrados = [];
        this.cargandoClientes = false;
      }
    });
  }

  private async cargarHistorialReciente(clienteId: string): Promise<{ historial: any | null; historialId: string }> {
    try {
      const resultado = await this.historialSrv.getHistorialesPaginadosOnce(clienteId, 1);
      const historial = resultado.items[0] || null;
      return {
        historial,
        historialId: historial?.id || ''
      };
    } catch (error) {
      console.error('Error al cargar historial reciente:', error);
      return { historial: null, historialId: '' };
    }
  }

  private resetVentaParaCambioCliente(): void {
    this.items = [];
    this.productoSeleccionado = null;
    this.selectedIndex = -1;
    this.subtotalBruto = 0;
    this.subtotal = 0;
    this.iva = 0;
    this.total = 0;
    this.descuentoPorcentaje = 0;
    this.descuentoMonto = 0;
    this._abono = 0;
    this.saldoPendiente = 0;
  }

  /**
   * 🔄 Resetear completamente el formulario de venta (después de finalizar una venta)
   */
  private resetearVentaCompleta(): void {
    // 🧹 Cliente e historial
    this.clienteId = '';
    this.cliente = null;
    this.historialId = '';
    this.historial = null;
    this.sinHistorial = false;

    // 🧹 Búsquedas
    this.terminoBusquedaCliente = '';
    this.clientesFiltrados = [];
    this.mostrarResultadosCliente = false;
    this.selectedClienteIndex = -1;
    this.terminoBusquedaHistorial = '';
    this.historialesFiltrados = [];
    this.mostrarResultadosHistorial = false;
    this.selectedHistorialIndex = -1;

    // 🧹 Carrito y productos
    this.items = [];
    this.productoSeleccionado = null;
    this.selectedIndex = -1;
    this.filtro = '';
    this.productosFiltrados = [];

    // 🧹 Totales
    this.subtotalBruto = 0;
    this.subtotal = 0;
    this.iva = 0;
    this.total = 0;
    this.descuentoPorcentaje = 0;
    this.descuentoMonto = 0;
    this._abono = 0;
    this.saldoPendiente = 0;

    // 🧹 Pago
    this.metodoPago = 'Efectivo';
    this.codigoTransferencia = '';
    this.ultimosCuatroTarjeta = '';
    this.observacion = '';
    this.montoRecibido = 0;
    this.esCredito = false;

    // 🧹 Tipo de venta
    this.tipoVentaSeleccionado = null;
    this.mostrarModalTipoVenta = false;

    // 🧹 Servicios
    this.mostrarFormServicio = false;
    this.servicioNuevo = {
      nombre: '',
      cantidad: 1,
      precio: 0
    };

    // 🧹 Filtros de productos
    this.grupoSeleccionado = '';
    this.proveedorSeleccionado = '';
    this.tipoStockSeleccionado = '';
    this.mostrarFiltros = false;
    this.mostrarRecientes = false;

    // 🧹 Ticket
    this.facturaParaImprimir = null;

    // 🔄 Recargar productos
    this.recargarProductos(true);

    console.log('✅ Formulario de venta reseteado completamente');
  }

  async seleccionarClienteVenta(cliente: Cliente): Promise<void> {
    if (!cliente.id) return;

    // 🛒 Solo mostrar confirmación si YA HAY un cliente seleccionado y hay items en el carrito
    // Si no hay cliente previo, es la primera selección -> no pedir confirmación
    if (this.clienteId && this.items.length > 0) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Cambiar cliente',
        text: 'Cambiar de cliente vaciara el carrito actual. Desea continuar?',
        showCancelButton: true,
        confirmButtonText: 'Si, cambiar',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) {
        return;
      }

      this.resetVentaParaCambioCliente();
    }

    this.clienteId = cliente.id;
    this.cliente = cliente;
    this.historialId = '';
    this.historial = null;
    // ✅ Por defecto: vender sin historial hasta que el usuario elija uno
    this.sinHistorial = true;

    this.terminoBusquedaCliente = `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
    this.mostrarResultadosCliente = false;

    // Limpiar y recargar historiales del nuevo cliente
    this.terminoBusquedaHistorial = 'Sin historial clínico';
    this.historialesBusqueda = [];
    this.historialesFiltrados = [];
    this.mostrarResultadosHistorial = false;

    // Cargar historiales del cliente seleccionado
    await this.cargarHistorialesCliente();
  }

  // ============================================
  // ➕ CREAR CLIENTE RÁPIDO EN POS
  // ============================================

  /**
   * Inicializa el formulario reactivo de crear cliente rápido
   */
  inicializarFormularioClienteRapido(): void {
    this.clienteRapidoForm = this.fb.group({
      cedula: [''],
      nombres: [''],
      apellidos: [''],
      telefono: [''],
      email: ['']
    });

    // Configurar validación reactiva de cédula
    this.clienteRapidoForm.get('cedula')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(async (cedula: string) => {
        this.cedulaDuplicadaMsgClienteRapido = '';
        this.validandoCedulaClienteRapido = false;

        if (!cedula || cedula.trim() === '') return;

        this.validandoCedulaClienteRapido = true;
        this.cdr.markForCheck();

        try {
          const existe = await this.clientesSrv.existeCedula(cedula);
          if (existe) {
            this.cedulaDuplicadaMsgClienteRapido = 'Esta cédula ya existe en el sistema';
          }
        } catch (error) {
          console.error('Error validando cédula:', error);
        } finally {
          this.validandoCedulaClienteRapido = false;
          this.cdr.markForCheck();
        }
      });

    // Configurar validación reactiva de email
    this.clienteRapidoForm.get('email')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(async (email: string) => {
        this.emailDuplicadoMsgClienteRapido = '';
        this.validandoEmailClienteRapido = false;

        if (!email || email.trim() === '' || email.trim().toUpperCase() === 'N/A') return;

        this.validandoEmailClienteRapido = true;
        this.cdr.markForCheck();

        try {
          const existe = await this.clientesSrv.existeEmail(email);
          if (existe) {
            this.emailDuplicadoMsgClienteRapido = 'Este email ya existe en el sistema';
          }
        } catch (error) {
          console.error('Error validando email:', error);
        } finally {
          this.validandoEmailClienteRapido = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Abre el modal de crear cliente rápido
   */
  abrirModalCrearCliente(): void {
    this.mostrarModalCrearCliente = true;
    this.clienteRapidoForm.reset({
      cedula: '',
      nombres: '',
      apellidos: '',
      telefono: '',
      email: ''
    });
    this.cedulaDuplicadaMsgClienteRapido = '';
    this.emailDuplicadoMsgClienteRapido = '';

    // Enfocar el primer campo después de un pequeño delay
    setTimeout(() => {
      const primerInput = document.querySelector('.modal-crear-cliente input') as HTMLInputElement;
      if (primerInput) primerInput.focus();
    }, 100);
  }

  /**
   * Cierra el modal de crear cliente rápido
   */
  cerrarModalCrearCliente(): void {
    this.mostrarModalCrearCliente = false;
    this.clienteRapidoForm.reset();
    this.cedulaDuplicadaMsgClienteRapido = '';
    this.emailDuplicadoMsgClienteRapido = '';
  }

  /**
   * Valida si el formulario de cliente rápido puede guardarse
   */
  get puedeGuardarClienteRapido(): boolean {
    const cedula = this.clienteRapidoForm.get('cedula')?.value;

    // Bloquear si cédula está vacía
    if (!cedula || cedula.trim() === '') return false;

    // Bloquear si hay duplicados
    if (this.cedulaDuplicadaMsgClienteRapido || this.emailDuplicadoMsgClienteRapido) return false;

    // Bloquear si se está validando
    if (this.validandoCedulaClienteRapido || this.validandoEmailClienteRapido) return false;

    return true;
  }

  /**
   * Navegar entre campos con Enter (dentro del modal de cliente rápido)
   */
  onEnterClienteRapido(event: KeyboardEvent, campoActual: string): void {
    event.preventDefault();

    const camposOrden = ['cedula', 'nombres', 'apellidos', 'telefono', 'email'];
    const indexActual = camposOrden.indexOf(campoActual);

    if (indexActual < camposOrden.length - 1) {
      // Ir al siguiente campo
      const siguienteCampo = camposOrden[indexActual + 1];
      const elemento = document.querySelector(`input[formControlName="${siguienteCampo}"]`) as HTMLInputElement;
      if (elemento) elemento.focus();
    } else {
      // Último campo - intentar guardar si es válido
      if (this.puedeGuardarClienteRapido) {
        this.guardarClienteRapido();
      }
    }
  }

  /**
   * Guarda el cliente rápido y lo asigna automáticamente a la venta
   */
  async guardarClienteRapido(): Promise<void> {
    const cedula = this.clienteRapidoForm.get('cedula')?.value || '';
    const email = this.clienteRapidoForm.get('email')?.value || '';

    // Validar cédula (siempre obligatoria)
    if (!cedula || cedula.trim() === '') {
      await Swal.fire({
        icon: 'error',
        title: 'Cédula requerida',
        text: 'La cédula es un campo obligatorio',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      return;
    }

    // Validar cédula única
    const cedulaExiste = await this.clientesSrv.existeCedula(cedula);
    if (cedulaExiste) {
      await Swal.fire({
        icon: 'error',
        title: 'Cédula duplicada',
        text: 'Esta cédula ya existe en el sistema',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      return;
    }

    // Validar email único (si se proporciona)
    if (email && email.trim() !== '' && email.trim().toUpperCase() !== 'N/A') {
      const emailExiste = await this.clientesSrv.existeEmail(email);
      if (emailExiste) {
        await Swal.fire({
          icon: 'error',
          title: 'Email duplicado',
          text: 'Este email ya existe en el sistema',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
        return;
      }
    }

    this.guardandoClienteRapido = true;

    try {
      const nuevoCliente: Cliente = {
        ...this.clienteRapidoForm.value,
        pais: 'Ecuador',
        provincia: '',
        ciudad: '',
        direccion: '',
        fechaNacimiento: ''
      };

      const docRef = await this.clientesSrv.createCliente(nuevoCliente);
      const clienteId = docRef.id; // ✅ Extraer ID del DocumentReference

      // ✅ Cargar el cliente recién creado
      const clienteCreado = await firstValueFrom(this.clientesSrv.getClienteById(clienteId));

      if (clienteCreado) {
        // 🎯 Asignar automáticamente el cliente a la venta
        this.clienteId = clienteId;
        this.cliente = clienteCreado;
        this.historialId = '';
        this.historial = null;
        this.sinHistorial = true;

        this.terminoBusquedaCliente = `${clienteCreado.nombres ?? ''} ${clienteCreado.apellidos ?? ''}`.trim();
        this.terminoBusquedaHistorial = 'Sin historial clínico';

        // Cerrar modal
        this.cerrarModalCrearCliente();

        // Notificación de éxito
        await Swal.fire({
          icon: 'success',
          title: 'Cliente creado',
          text: `${clienteCreado.nombres} ${clienteCreado.apellidos} se agregó correctamente`,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        });

        // Enfocar el buscador de productos
        setTimeout(() => {
          const inputProducto = document.querySelector('input[placeholder*="Buscar producto"]') as HTMLInputElement;
          if (inputProducto) inputProducto.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error al crear cliente:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear el cliente. Intente nuevamente.'
      });
    } finally {
      this.guardandoClienteRapido = false;
    }
  }

  // ============================================
  // 🔎 FIN CREAR CLIENTE RÁPIDO
  // ============================================

  /**
   * 🔎 Buscar historiales clínicos del cliente actual
   */
  async buscarHistorialesVenta(): Promise<void> {
    if (!this.clienteId) {
      this.historialesFiltrados = [];
      this.mostrarResultadosHistorial = false;
      this.selectedHistorialIndex = -1;
      return;
    }

    const termino = this.terminoBusquedaHistorial.trim().toLowerCase();

    if (!termino) {
      this.historialesFiltrados = this.historialesBusqueda.slice(0, this.MAX_RESULTADOS_HISTORIALES);
      this.mostrarResultadosHistorial = this.historialesBusqueda.length > 0;
      this.selectedHistorialIndex = -1;
      return;
    }

    this.mostrarResultadosHistorial = true;

    this.historialesFiltrados = this.historialesBusqueda
      .filter(h => {
        const fecha = this.formatearFechaHistorial(h.fechaHoraChequeo, h.createdAt);
        return fecha.toLowerCase().includes(termino);
      })
      .slice(0, this.MAX_RESULTADOS_HISTORIALES);

    this.selectedHistorialIndex = -1; // Resetear selección al filtrar
  }

  /**
   * Carga todos los historiales del cliente actual
   */
  async cargarHistorialesCliente(): Promise<void> {
    if (!this.clienteId) return;

    try {
      this.cargandoHistoriales = true;
      const resultado = await this.historialSrv.getHistorialesPaginadosOnce(this.clienteId, 20);
      this.historialesBusqueda = resultado.items;
      this.historialesFiltrados = this.historialesBusqueda.slice(0, this.MAX_RESULTADOS_HISTORIALES);
      this.cargandoHistoriales = false;
    } catch (error) {
      console.error('Error al cargar historiales:', error);
      this.historialesBusqueda = [];
      this.historialesFiltrados = [];
      this.cargandoHistoriales = false;
    }
  }

  limpiarBusquedaHistorial(): void {
    this.terminoBusquedaHistorial = '';
    this.sinHistorial = false;
    this.historialesFiltrados = this.historialesBusqueda.slice(0, this.MAX_RESULTADOS_HISTORIALES);
    this.selectedHistorialIndex = -1;
  }

  cerrarResultadosHistorial(): void {
    this.mostrarResultadosHistorial = false;
    this.selectedHistorialIndex = -1;
  }

  /**
   * 🎯 Navegar con teclado en resultados de búsqueda de historiales
   * Incluye la opción "Vender sin historial" en el índice -1 (primer elemento)
   */
  onHistorialKeyDown(event: KeyboardEvent): void {
    if (!this.mostrarResultadosHistorial || this.sinHistorial) {
      return;
    }

    // Total de opciones: "Vender sin historial" + historiales filtrados
    const totalOpciones = this.historialesFiltrados.length + 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        // Empezar desde -1 para incluir la opción "Sin historial"
        this.selectedHistorialIndex = Math.min(
          this.selectedHistorialIndex + 1,
          totalOpciones - 1
        );
        this.scrollToSelectedHistorial();
        break;

      case 'ArrowUp':
        event.preventDefault();
        // -1 representa la opción "Vender sin historial"
        this.selectedHistorialIndex = Math.max(this.selectedHistorialIndex - 1, -1);
        this.scrollToSelectedHistorial();
        break;

      case 'Enter':
        event.preventDefault();
        // -1 = "Vender sin historial", 0+ = historiales
        if (this.selectedHistorialIndex === -1) {
          this.venderSinHistorial();
        } else if (
          this.selectedHistorialIndex >= 0 &&
          this.selectedHistorialIndex < this.historialesFiltrados.length
        ) {
          const historialSeleccionado = this.historialesFiltrados[this.selectedHistorialIndex];
          this.seleccionarHistorialVenta(historialSeleccionado);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.cerrarResultadosHistorial();
        break;
    }
  }

  /**
   * Desplazar el scroll para mostrar el historial seleccionado
   */
  private scrollToSelectedHistorial(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.resultado-item-selected-historial');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  async seleccionarHistorialVenta(historial: any): Promise<void> {
    if (!historial || !historial.id) return;

    this.historial = historial;
    this.historialId = historial.id;
    this.sinHistorial = false;
    this.mostrarResultadosHistorial = false;
    this.terminoBusquedaHistorial = this.formatearFechaHistorial(historial.fechaHoraChequeo, historial.createdAt);
  }

  /**
   * Muestra el detalle completo del historial clínico en un modal
   */
  async verDetalleHistorial(historial: any): Promise<void> {
    if (!historial) return;

    const formatearValor = (valor: any): string => {
      if (valor === null || valor === undefined || valor === '') return '-';
      return valor.toString();
    };

    const htmlDetalle = `
      <div class="modal-historial-detalle">
        <!-- Cabecera con fecha y doctor -->
        <div class="header-info-detalle">
          <div class="header-item-detalle">
            <span class="header-label-detalle">Fecha del chequeo:</span>
            <span class="header-value-detalle">${this.formatearFechaHistorial(historial.fechaHoraChequeo, historial.createdAt)}</span>
          </div>
          <div class="header-item-detalle">
            <span class="header-label-detalle">Doctor/Optometrista:</span>
            <span class="header-value-detalle">${formatearValor(historial.doctor)}</span>
          </div>
        </div>

        <!-- Datos Clínicos -->
        <div class="form-section-detalle">
          <h3 class="section-title-detalle">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2"/>
              <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2"/>
              <circle cx="12" cy="12" r="1"/>
              <path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/>
            </svg>
            Datos Clínicos
          </h3>

          <div class="clinico-grid-detalle">
            <!-- OD -->
            <div class="ojo-card-detalle">
              <h4>Ojo Derecho (OD)</h4>
              <div class="ojo-inputs-detalle">
                <div class="form-field-detalle">
                  <label class="field-label-detalle">Esfera</label>
                  <div class="field-value-detalle">${formatearValor(historial.odEsfera)}</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">Cilindro</label>
                  <div class="field-value-detalle">${formatearValor(historial.odCilindro)}</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">Eje</label>
                  <div class="field-value-detalle">${formatearValor(historial.odEje)}°</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">AVSC</label>
                  <div class="field-value-detalle">${formatearValor(historial.odAVSC)}</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">AVCC</label>
                  <div class="field-value-detalle">${formatearValor(historial.odAVCC)}</div>
                </div>
              </div>
            </div>

            <!-- OI -->
            <div class="ojo-card-detalle">
              <h4>Ojo Izquierdo (OI)</h4>
              <div class="ojo-inputs-detalle">
                <div class="form-field-detalle">
                  <label class="field-label-detalle">Esfera</label>
                  <div class="field-value-detalle">${formatearValor(historial.oiEsfera)}</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">Cilindro</label>
                  <div class="field-value-detalle">${formatearValor(historial.oiCilindro)}</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">Eje</label>
                  <div class="field-value-detalle">${formatearValor(historial.oiEje)}°</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">AVSC</label>
                  <div class="field-value-detalle">${formatearValor(historial.oiAVSC)}</div>
                </div>
                <div class="form-field-detalle">
                  <label class="field-label-detalle">AVCC</label>
                  <div class="field-value-detalle">${formatearValor(historial.oiAVCC)}</div>
                </div>
              </div>
            </div>

            <!-- Medidas (ADD, DP, Altura) al lado de OI -->
            <div class="medidas-verticales-detalle">
              <div class="form-field-detalle">
                <label class="field-label-detalle">ADD</label>
                <div class="field-value-detalle">${formatearValor(historial.add)}</div>
              </div>
              <div class="form-field-detalle">
                <label class="field-label-detalle">DP</label>
                <div class="field-value-detalle">${formatearValor(historial.dp)}</div>
              </div>
              <div class="form-field-detalle">
                <label class="field-label-detalle">Altura</label>
                <div class="field-value-detalle">${formatearValor(historial.altura)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Medidas del Armazón -->
        <div class="form-section-detalle">
          <h3 class="section-title-detalle">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="6" cy="15" r="4"/>
              <circle cx="18" cy="15" r="4"/>
              <path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/>
              <path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/>
              <path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>
            </svg>
            Medidas del Armazón
          </h3>

          <div class="armazon-grid-2-detalle">
            <div class="armazon-medidas-detalle">
              <div class="form-field-detalle">
                <label class="field-label-detalle">H (Ancho del Aro)</label>
                <div class="field-value-detalle">${formatearValor(historial.armazonH)}</div>
              </div>
              <div class="form-field-detalle">
                <label class="field-label-detalle">V (Alto del Aro)</label>
                <div class="field-value-detalle">${formatearValor(historial.armazonV)}</div>
              </div>
              <div class="form-field-detalle">
                <label class="field-label-detalle">DM (Diagonal Mayor)</label>
                <div class="field-value-detalle">${formatearValor(historial.armazonDM)}</div>
              </div>
              <div class="form-field-detalle">
                <label class="field-label-detalle">P (Puente)</label>
                <div class="field-value-detalle">${formatearValor(historial.armazonP)}</div>
              </div>
            </div>
            <div class="armazon-extra-detalle">
              <div class="form-field-detalle">
                <label class="field-label-detalle">Tipo de Armazón</label>
                <div class="field-value-detalle">${formatearValor(historial.armazonTipo)}</div>
              </div>
              <div class="form-field-detalle">
                <label class="field-label-detalle">De</label>
                <div class="field-value-detalle">${formatearValor(historial.de)}</div>
              </div>
              <div class="form-field-detalle">
                <label class="field-label-detalle">Color</label>
                <div class="field-value-detalle">${formatearValor(historial.color)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Observaciones -->
        <div class="observaciones-detalle">
          <label class="obs-label-detalle">Observacion</label>
          <div class="obs-value-detalle">${formatearValor(historial.observacion)}</div>
        </div>
      </div>

      <style>
        .modal-historial-detalle { text-align: left; padding: 1rem; }

        /* Header */
        .header-info-detalle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding: 1rem 1.25rem;
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }
        .header-item-detalle { display: flex; align-items: center; gap: 0.5rem; }
        .header-label-detalle { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
        .header-value-detalle { font-size: 0.95rem; color: var(--primary-color); font-weight: 600; }

        /* Secciones */
        .form-section-detalle { margin-bottom: 2rem; }
        .section-title-detalle {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .section-title-detalle svg { color: var(--primary-color); width: 20px; height: 20px; }

        /* Grid de ojos */
        .clinico-grid-detalle {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }

        /* Cards de ojos */
        .ojo-card-detalle {
          background: var(--bg-secondary);
          padding: 1rem 1.25rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }
        .ojo-card-detalle h4 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
          text-align: center;
        }
        .ojo-inputs-detalle {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        /* Medidas verticales al lado de OI */
        .medidas-verticales-detalle {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 180px;
        }

        /* Medidas inline (ya no se usa, pero se deja por compatibilidad) */
        .clinico-medidas-inline-detalle {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }

        /* Grid armazón */
        .armazon-grid-2-detalle {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        .armazon-medidas-detalle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .armazon-extra-detalle {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* Form fields */
        .form-field-detalle {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .field-label-detalle {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .field-value-detalle {
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-input);
          color: var(--text-primary);
          font-size: 0.95rem;
        }

        /* Observaciones */
        .observaciones-detalle {
          margin-top: 1.5rem;
        }
        .obs-label-detalle {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          display: block;
          margin-bottom: 0.5rem;
        }
        .obs-value-detalle {
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-input);
          color: var(--text-primary);
          font-size: 0.95rem;
          line-height: 1.6;
          white-space: pre-line;
          min-height: 80px;
        }

        /* Responsive */
        @media (max-width: 920px) {
          .header-info-detalle { grid-template-columns: 1fr; }
          .clinico-grid-detalle { grid-template-columns: 1fr; }
          .armazon-grid-2-detalle { grid-template-columns: 1fr; }
          .armazon-medidas-detalle { grid-template-columns: 1fr; }
          .ojo-inputs-detalle { grid-template-columns: 1fr; }
          .medidas-verticales-detalle { min-width: auto; }
        }
      </style>
    `;

    const result = await Swal.fire({
      title: 'Detalle del Historial Clínico',
      html: htmlDetalle,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-check-lg"></i> Usar este historial',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#3498db',
      cancelButtonColor: '#6c757d',
      width: '950px',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-confirm-btn',
        cancelButton: 'modern-cancel-btn'
      }
    });

    if (result.isConfirmed) {
      await this.seleccionarHistorialVenta(historial);
    }
  }

  venderSinHistorial(): void {
    this.historial = null;
    this.historialId = '';
    this.sinHistorial = true;
    this.mostrarResultadosHistorial = false;
    this.terminoBusquedaHistorial = 'Sin historial clínico';
  }

  trackByHistorialIdVenta(index: number, item: any): string {
    return item.id || `index-${index}`;
  }

  formatearFechaHistorial(fechaChequeo: any, fechaCreacion?: any): string {
    // Si no hay fechaHoraChequeo, usar createdAt
    const fecha = fechaChequeo || fechaCreacion;
    if (!fecha) return 'Sin fecha';

    let fechaObj: Date;
    if (fecha.toDate) {
      fechaObj = fecha.toDate();
    } else if (fecha instanceof Date) {
      fechaObj = fecha;
    } else {
      fechaObj = new Date(fecha);
    }

    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const año = fechaObj.getFullYear();
    const horas = fechaObj.getHours().toString().padStart(2, '0');
    const minutos = fechaObj.getMinutes().toString().padStart(2, '0');

    return `${dia}/${mes}/${año} ${horas}:${minutos}`;
  }

  /**
   * 🔧 FIX: Forzar recarga de productos (para cuando se limpian filtros)
   */
  async recargarProductos(resetLimit: boolean = true) {
    try {
      this.cargandoProductos = true;

      // Si no hay filtros ni búsqueda ni recientes, cargar productos iniciales
      if (!this.filtro.trim() && !this.grupoSeleccionado && !this.proveedorSeleccionado && !this.tipoStockSeleccionado && !this.mostrarRecientes) {
        if (resetLimit) {
          this.limitProductos = 10;
        }
        const productos = await firstValueFrom(
          this.productosSrv.getProductosLimitados(this.limitProductos, 'idInterno')
        );
        this.productosFiltrados = productos;
        this.hayMasProductos = productos.length >= this.limitProductos;
      }
      // 🔧 FIX: Si está en modo Recientes, solo 10 productos ordenados por updatedAt
      else if (this.mostrarRecientes) {
        const productos = await firstValueFrom(
          this.productosSrv.buscarProductosConFiltros({
            searchTerm: this.filtro,
            grupo: this.grupoSeleccionado,
            proveedor: this.proveedorSeleccionado,
            tipoStock: this.tipoStockSeleccionado,
            limitCount: 10 // Solo 10 productos recientes
          })
        );
        this.productosFiltrados = productos;
        this.hayMasProductos = false; // No hay más para cargar en modo recientes
      }
      // Si hay filtros activos (sin recientes)
      else if (this.grupoSeleccionado || this.proveedorSeleccionado || this.tipoStockSeleccionado) {
        const productos = await firstValueFrom(
          this.productosSrv.buscarProductosConFiltros({
            searchTerm: this.filtro,
            grupo: this.grupoSeleccionado,
            proveedor: this.proveedorSeleccionado,
            tipoStock: this.tipoStockSeleccionado,
            limitCount: 20
          })
        );
        this.productosFiltrados = productos;
        this.hayMasProductos = productos.length >= 20;
      }
      // Si solo hay búsqueda de texto
      else {
        const productos = await firstValueFrom(
          this.productosSrv.buscarProductosLimitado(this.filtro, 20)
        );
        this.productosFiltrados = productos;
        this.hayMasProductos = productos.length >= 20;
      }

      this.aplicarOrdenamiento();
    } catch (error) {
      console.error('Error al recargar productos:', error);
    } finally {
      this.cargandoProductos = false;
    }
  }

  /**
   * 🚀 NUEVO: Cargar más productos (paginación)
   */
  async cargarMasProductos() {
    if (this.cargandoProductos || !this.hayMasProductos) return;

    try {
      this.cargandoProductos = true;
      this.limitProductos += 10;

      const productosAdicionales = await firstValueFrom(
        this.productosSrv.buscarProductosLimitado(this.filtro, this.limitProductos)
      );

      this.productosFiltrados = productosAdicionales;
      this.hayMasProductos = productosAdicionales.length >= this.limitProductos;
      this.aplicarOrdenamiento();

    } catch (error) {
      console.error('Error al cargar más productos:', error);
    } finally {
      this.cargandoProductos = false;
    }
  }

  aplicarOrdenamiento() {
    if (this.ordenamientoProductos === 'codigo') {
      this.productosFiltrados.sort((a, b) => {
        const codigoA = (a.idInterno || 0) as number;
        const codigoB = (b.idInterno || 0) as number;
        return codigoA - codigoB;
      });
    } else if (this.ordenamientoProductos === 'reciente') {
      this.productosFiltrados.sort((a, b) => {
        // Usar updatedAt para mostrar productos recientemente modificados
        const fechaA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const fechaB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return fechaB - fechaA; // Descendente (más reciente primero)
      });
    }
  }

  cambiarOrdenamientoProductos(nuevoOrdenamiento: string) {
    this.ordenamientoProductos = nuevoOrdenamiento;
    this.filtrarProductos();
  }

  /**
   * Toggle para mostrar/ocultar panel de filtros
   */
  toggleFiltros() {
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  /**
   * Toggle para mostrar productos recientes (últimos 20 agregados/modificados)
   * Cambia automáticamente el ordenamiento a 'reciente' y limita a 20 resultados
   */
  toggleRecientes() {
    this.mostrarRecientes = !this.mostrarRecientes;

    // Si activa Recientes, cambiar ordenamiento a 'reciente'
    if (this.mostrarRecientes) {
      this.ordenamientoProductos = 'reciente';
    } else {
      // Al desactivar, volver a ordenamiento por código
      this.ordenamientoProductos = 'codigo';
      this.limitProductos = 10; // Resetear límite
    }

    // 🔧 FIX: Usar recargarProductos para forzar recarga inmediata
    this.recargarProductos(false);
  }

  /**
   * Limpia el filtro de grupo y recarga productos
   */
  limpiarFiltroGrupo() {
    this.grupoSeleccionado = '';
    this.recargarProductos(false);
  }

  /**
   * Limpia el filtro de proveedor y recarga productos
   */
  limpiarFiltroProveedor() {
    this.proveedorSeleccionado = '';
    this.recargarProductos(false);
  }

  /**
   * Limpia el filtro de tipo de stock y recarga productos
   */
  limpiarFiltroStock() {
    this.tipoStockSeleccionado = '';
    this.recargarProductos();
  }

  /**
   * Limpia todos los filtros
   */
  limpiarTodosFiltros() {
    this.grupoSeleccionado = '';
    this.proveedorSeleccionado = '';
    this.tipoStockSeleccionado = '';
    this.filtro = '';
    this.mostrarRecientes = false;
    this.ordenamientoProductos = 'codigo'; // Resetear a ordenamiento por código
    this.limitProductos = 10; // Resetear límite
    this.recargarProductos();
  }


  /**
   * Maneja el clic en un producto: establece selección y agrega al carrito
   * Mantiene el índice para permitir navegación con flechas desde ese punto
   */
  onProductoClick(producto: any, index: number) {
    // Establecer el índice del producto clickeado
    this.selectedIndex = index;
    // Agregar el producto al carrito
    this.agregarProducto(producto);
    // Marcar flag para preservar límite al limpiar filtro
    this.preservarLimite = true;
    // Limpiar el filtro de búsqueda (el observable se encargará de recargar con límite preservado)
    this.filtro = '';
    // NO resetear selectedIndex para permitir navegación con flechas desde este producto
  }

  /**
   * 🔎 Buscar producto por código escaneado/ingresado y agregarlo al carrito
   */
  async buscarProductoPorCodigo() {
    let codigo = (this.codigoEscaneado || '').replace(/\r|\n/g, '');
    // Quitar caracteres no imprimibles que algunos scanners agregan, como tab, ctrl, etc.
    codigo = codigo.replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (!codigo) {
      return;
    }

    if (this.codigoBusquedaEnProceso) {
      console.log('[POS] búsqueda en proceso, evitando doble ejecución:', codigo);
      return;
    }

    const ahora = Date.now();
    if (codigo === this.ultimoCodigoProcesado && ahora - this.ultimoCodigoProcesadoTime < 1000) {
      console.log('[POS] código duplicado detectado en intervalo corto, ignorando', codigo);
      return;
    }

    this.codigoBusquedaEnProceso = true;

    // Normalización básica: quitar espacios, mayúsculas
    const codigoOriginal = codigo;
    codigo = codigo.replace(/\s+/g, '').toUpperCase();

    // Quitar prefijo opcional (p.ej. PROD00123)
    if (codigo.startsWith('PROD')) {
      codigo = codigo.slice(4);
    }

    // Quitar ceros a la izquierda para búsqueda idInterno
    const codigoSinCeros = codigo.replace(/^0+/, '');

    const codigoAlfa = codigoSinCeros.replace(/[^0-9A-Z]/g, '');
    console.log('[POS] buscarProductoPorCodigo (normalizado)', { codigoOriginal, codigo, codigoSinCeros, codigoAlfa });

    // Usar ahora el valor limpio para búsqueda principal
    const codigoBusqueda = codigoSinCeros || '0';

    try {
      this.cargandoProductos = true;

      let productos = await firstValueFrom(this.productosSrv.getProductoPorCodigo(codigoBusqueda));
      console.log('[POS] resultados Firestore exacto', productos);

      // Fallback 1: preferir idInterno numérico (para productos con idInterno)
      if (!isNaN(Number(codigoBusqueda))) {
        const idInterno = Number(codigoBusqueda);

        // Primero buscar localmente por idInterno para evitar falsos positivos de código numérico
        let directMatch = (this.productos || []).filter(p => Number(p.idInterno) === idInterno && p.activo !== false);
        if (directMatch.length > 0) {
          productos = directMatch;
          console.log('[POS] lookup por idInterno local', { idInterno, productos });
        }

        // Si sigue vacío, intentar desde servicio en Firestore (por si no se cargó localmente aún)
        if ((!productos || productos.length === 0) && this.productosSrv) {
          try {
            const firestoreMatches = await firstValueFrom(this.productosSrv.getProductoPorCodigo(idInterno.toString()));
            if (firestoreMatches && firestoreMatches.length > 0) {
              productos = firestoreMatches;
              console.log('[POS] lookup por idInterno firestore', { idInterno, productos });
            }
          } catch (err) {
            console.warn('[POS] idInterno firestore fallback error', err);
          }
        }
      }

      // Fallback 2: buscar en la lista completa si no hay resultados exactos (insensible a mayúsculas/espacios)
      if (!productos || productos.length === 0) {
        const listaLocal = this.productos || [];
        productos = listaLocal.filter(p => {
          const codigoProd = ((p.codigo || p.idInterno?.toString() || p.modelo || '') + '')
            .replace(/\s+/g, '').toUpperCase();
          const codigoProdAlfa = codigoProd.replace(/[^0-9A-Z]/g, '');
          return codigoProd === codigoBusqueda || codigoProd === codigoSinCeros || codigoProdAlfa === codigoAlfa;
        });
        console.log('[POS] fallback local exacto (sin espacios/modelo, normalizado alfa)', productos);
      }

      // Fallback 3: búsqueda parcial en local
      if (!productos || productos.length === 0) {
        const listaLocal = this.productos || [];
        productos = listaLocal.filter(p => {
          const codigoProd = ((p.codigo || p.idInterno?.toString() || p.modelo || '') + '')
            .replace(/\s+/g, '').toUpperCase();
          const codigoProdAlfa = codigoProd.replace(/[^0-9A-Z]/g, '');
          return codigoProd.includes(codigoBusqueda) || codigoProdAlfa.includes(codigoAlfa);
        });
        console.log('[POS] fallback local parcial (contiene, incluye modelo, normalizado alfa)', productos);
      }

      // Fallback 4: comparación alfanumérica estricto, para modelos con guiones/puntos
      if (!productos || productos.length === 0) {
        const listaLocal = this.productos || [];
        const codigoOnlyAlfa = codigoBusqueda.replace(/[^0-9A-Z]/g, '');
        if (codigoOnlyAlfa) {
          productos = listaLocal.filter(p => {
            const codigoProd = ((p.codigo || p.idInterno?.toString() || p.modelo || '') + '')
              .replace(/[^0-9A-Z]/g, '').toUpperCase();
            return codigoProd === codigoOnlyAlfa || codigoProd.includes(codigoOnlyAlfa);
          });
          console.log('[POS] fallback local alfanumérico', { codigoOnlyAlfa, productos });
        }
      }

      // Fallback 5: idInterno exacto para escáner numérico puro sobre valor limpio
      if ((!productos || productos.length === 0) && /^\d+$/.test(codigoBusqueda)) {
        const idInterno = Number(codigoBusqueda);
        productos = (this.productos || []).filter(p => Number(p.idInterno) === idInterno && p.activo !== false);
        console.log('[POS] fallback idInterno direct', { idInterno, productos });

        if ((!productos || productos.length === 0) && !isNaN(idInterno)) {
          try {
            const byId = await firstValueFrom(this.productosSrv.getProductoPorCodigo(idInterno.toString()));
            if (byId && byId.length > 0) {
              productos = byId;
              console.log('[POS] fallback idInterno firestore', { idInterno, productos });
            }
          } catch (e) {
            console.warn('[POS] fallback idInterno firestore error', e);
          }
        }
      }

      if (!productos || productos.length === 0) {
        this.setMensajeEscaneo(`No se encontró producto con código '${this.codigoEscaneado}'.`, 'warning');
        await Swal.fire({
          icon: 'warning',
          title: 'Producto no encontrado',
          text: `No se encontró ningún producto con el código '${this.codigoEscaneado}'.`,
          confirmButtonText: 'Entendido',
        });
        return;
      }

      const producto = productos[0];
      console.log('[POS] producto encontrado a agregar', producto);
      const agregado = this.agregarProducto(producto);

      // No mostrar mensaje de éxito al agregar si hay stock. solo mantén el input listo.
      if (!agregado) {
        // El mensaje de error ya fue manejado en agregarProducto (stock 0/agotado)
      }

      // Mantener foco en el input de escáner para operaciones rápidas
      this.codigoEscaneado = '';
      this.filtro = '';
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('#codigoEscaneadoInput');
        if (input) input.focus();
      }, 0);
    } catch (error) {
      console.error('Error buscando producto por código:', error);
      this.setMensajeEscaneo('Error buscando producto. Revisa conexión y código.', 'error');
      await Swal.fire({
        icon: 'error',
        title: 'Error de búsqueda',
        text: 'Ocurrió un problema al buscar el producto. Intenta nuevamente.',
        confirmButtonText: 'Listo',
      });
    } finally {
      this.codigoBusquedaEnProceso = false;
      this.ultimoCodigoProcesado = codigo;
      this.ultimoCodigoProcesadoTime = ahora;
      this.cargandoProductos = false;
    }
  }

  onBarcodeInput() {
    if (this.codigoScannerTimeout) {
      clearTimeout(this.codigoScannerTimeout);
    }
    this.codigoScannerTimeout = setTimeout(() => {
      if (!this.codigoEscaneado) {
        return;
      }
      // Si el scanner incluye ENTER automático, busca en keydown; si no, auto busca acá.
      console.log('[POS] onBarcodeInput deteccion automática', { codigoEscaneado: this.codigoEscaneado });
      this.buscarProductoPorCodigo();
    }, 250);
  }

  onBarcodeEnter() {
    if (this.codigoScannerTimeout) {
      clearTimeout(this.codigoScannerTimeout);
      this.codigoScannerTimeout = null;
    }
    this.buscarProductoPorCodigo();
  }

  setMensajeEscaneo(mensaje: string, tipo: 'success' | 'warning' | 'error' | '') {
    this.mensajeEscaneo = mensaje;
    this.mensajeEscaneoTipo = tipo;

    if (this.codigoScannerTimeout) {
      clearTimeout(this.codigoScannerTimeout);
    }

    this.codigoScannerTimeout = setTimeout(() => {
      this.mensajeEscaneo = '';
      this.mensajeEscaneoTipo = '';
    }, 2500);
  }

  // Navegación con teclado en búsqueda
  onSearchKeydown(event: KeyboardEvent) {
    const filtrados = this.productosFiltrados;
    if (filtrados.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, filtrados.length - 1);
      this.scrollToSelectedProduct();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.scrollToSelectedProduct();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Si no hay elemento seleccionado aún, seleccionar el primero
      if (this.selectedIndex < 0) this.selectedIndex = 0;
      // Agregar directamente al carrito SIN perder la selección
      const p = filtrados[this.selectedIndex];
      if (p) this.agregarProducto(p);
      // Mantener el índice para que presionar Enter repetidas veces
      // agregue más cantidad del mismo producto
    }
  }

  /**
   * Hace scroll automático al producto seleccionado en la lista
   */
  scrollToSelectedProduct() {
    // Esperar al siguiente ciclo de Angular para que el DOM se actualice
    setTimeout(() => {
      const selectedElement = document.querySelector('.producto-item.producto-selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }, 0);
  }

  // Capturador de escáner de código de barras (teclado rápido)
  private scannerCodeBuffer = '';
  private scannerLastKeyTime = 0;
  private scannerTimer: any = null;

  /**
   * Navegación global con teclado (incluso sin usar el input de búsqueda)
   *  - Pilas: flechas + Enter para seleccionar producto
   *  - Scanner: acumula posibles códigos y procesa al Enter
   */
  onDocumentKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toUpperCase();

    // Si estamos tipeando en un campo de formulario, solo manejamos scanner rápido en Texto no manual.
    const inFormField = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON' || target.contentEditable === 'true';

    const now = Date.now();

    // (1) Modo scanner: captura fast-key sequences + Enter
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // Si hay intervalo largo, resetear buffer
      if (now - this.scannerLastKeyTime > 120) {
        this.scannerCodeBuffer = '';
      }

      this.scannerCodeBuffer += event.key;
      this.scannerLastKeyTime = now;

      if (this.scannerTimer) {
        clearTimeout(this.scannerTimer);
      }
      this.scannerTimer = setTimeout(() => {
        this.scannerCodeBuffer = '';
      }, 600);

      // Si estamos en campo input normal no interrumpimos la escritura
      if (inFormField) {
        return;
      }
    }

    if (event.key === 'Enter') {
      if (this.scannerCodeBuffer.length >= 2) {
        event.preventDefault();

        // Ejecutar solo si no estamos en un control de formulario manual
        if (!inFormField) {
          this.codigoEscaneado = this.scannerCodeBuffer;
          this.buscarProductoPorCodigo();
          this.scannerCodeBuffer = '';
          if (this.scannerTimer) {
            clearTimeout(this.scannerTimer);
            this.scannerTimer = null;
          }
          return;
        }
      }

      // Si no era entrada de scanner, usamos la navegación existente
      if (this.selectedIndex >= 0 && !inFormField) {
        event.preventDefault();
        const filtrados = this.productosFiltrados;
        const p = filtrados[this.selectedIndex];
        if (p) {
          this.agregarProducto(p);
        }
        return;
      }
    }

    // (2) Navegación con flechas si no estamos en campos de formulario
    if (!inFormField) {
      const filtrados = this.productosFiltrados;
      if (filtrados.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (this.selectedIndex < 0) this.selectedIndex = 0;
        else this.selectedIndex = Math.min(this.selectedIndex + 1, filtrados.length - 1);
        this.scrollToSelectedProduct();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (this.selectedIndex < 0) this.selectedIndex = 0;
        else this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollToSelectedProduct();
      }
    }
  }

  recalcularAbono() {
    // El setter ya limpia el "0" inicial automáticamente
    const a = Math.max(0, this._abono);

    // ✅ CAMBIO: Permitir que el abono sea mayor al total (para calcular vuelto)
    // Solo limitar si NO es crédito Y NO es efectivo (evitar errores en transferencia/tarjeta)
    if (!this.esCredito && this.metodoPago !== 'Efectivo') {
      this._abono = Math.min(a, this.total);
    } else {
      this._abono = a; // Permitir cualquier valor para efectivo
    }

    // ✅ Saldo pendiente nunca debe ser negativo (si abono > total, saldo = 0)
    this.saldoPendiente = Math.max(0, +(this.total - this._abono).toFixed(2));
  }

  /**
   * 💳 Manejar cambio en el checkbox de crédito
   */
  onCreditoChange() {
    if (!this.esCredito) {
      // Si se desactiva el crédito, resetear abono pero mantener el cálculo de saldo
      this.abono = 0;
      this.recalcularAbono();
    } else {
      // Si se activa el crédito, calcular saldo pendiente
      this.recalcularAbono();
    }
  }

  // ✅ Navegación por Enter entre inputs
  onInputEnter(event: Event, inputType: string, itemIndex?: number) {
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();

    if (inputType === 'cantidad') {
      // Si es cantidad de un item, ir al siguiente item o al descuento
      if (itemIndex !== undefined && itemIndex < this.items.length - 1) {
        // Enfoca el siguiente item - usa querySelectorAll para obtener todos los inputs de cantidad
        setTimeout(() => {
          const cantidadInputs = document.querySelectorAll('.item-cantidad input');
          const nextInput = cantidadInputs[itemIndex + 1] as HTMLInputElement;
          if (nextInput) nextInput.focus();
        }, 0);
      } else {
        // Ir al descuento (último producto o único)
        setTimeout(() => {
          const descuentoInput = document.querySelector('.input-inline') as HTMLInputElement;
          if (descuentoInput) descuentoInput.focus();
        }, 0);
      }
    } else if (inputType === 'descuento') {
      // Del descuento al método de pago
      setTimeout(() => {
        const metodoPagoSelect = document.querySelector('.select-compacto') as HTMLSelectElement;
        if (metodoPagoSelect) metodoPagoSelect.focus();
      }, 0);
    } else if (inputType === 'metodo') {
      // Del método de pago: flujo según tipo de pago
      setTimeout(() => {
        if (this.metodoPago === 'Transferencia' || this.metodoPago === 'Tarjeta') {
          if (this.esAdmin) {
            // Si es admin: ir a fecha de pago
            const fechaPagoInput = document.querySelectorAll('input[type="date"]')[0] as HTMLInputElement;
            if (fechaPagoInput) {
              fechaPagoInput.focus();
              return;
            }
          }
          // Si no es admin o no hay campo de fecha: ir a código transferencia/tarjeta
          if (this.metodoPago === 'Transferencia') {
            const transferInput = document.querySelector('input[placeholder*="TRF"]') as HTMLInputElement;
            if (transferInput) {
              transferInput.focus();
              return;
            }
          } else if (this.metodoPago === 'Tarjeta') {
            const tarjetaInput = document.querySelector('input[maxlength="4"]') as HTMLInputElement;
            if (tarjetaInput) {
              tarjetaInput.focus();
              return;
            }
          }
        }
        // Si es Efectivo: ir directo a Abono
        const abonoInput = document.querySelector('.input-abono') as HTMLInputElement;
        if (abonoInput) abonoInput.focus();
      }, 0);
    } else if (inputType === 'fechaPago') {
      // De fecha de pago a hora de pago
      setTimeout(() => {
        const horaPagoInput = document.querySelectorAll('input[type="time"]')[0] as HTMLInputElement;
        if (horaPagoInput) horaPagoInput.focus();
      }, 0);
    } else if (inputType === 'horaPago') {
      // De hora de pago a código transferencia/tarjeta (si aplica) o directo a abono
      setTimeout(() => {
        if (this.metodoPago === 'Transferencia') {
          const transferInput = document.querySelector('input[placeholder*="TRF"]') as HTMLInputElement;
          if (transferInput) {
            transferInput.focus();
            return;
          }
        } else if (this.metodoPago === 'Tarjeta') {
          const tarjetaInput = document.querySelector('input[maxlength="4"]') as HTMLInputElement;
          if (tarjetaInput) {
            tarjetaInput.focus();
            return;
          }
        }
        // Si no hay código de transferencia/tarjeta: ir a abono
        const abonoInput = document.querySelector('.input-abono') as HTMLInputElement;
        if (abonoInput) abonoInput.focus();
      }, 0);
    } else if (inputType === 'transferencia' || inputType === 'tarjeta') {
      // De transferencia o tarjeta → Abono
      setTimeout(() => {
        const abonoInput = document.querySelector('.input-abono') as HTMLInputElement;
        if (abonoInput) abonoInput.focus();
      }, 0);
    } else if (inputType === 'abono') {
      // Del abono al botón guardar
      setTimeout(() => {
        const btnGuardar = document.querySelector('.btn-primary') as HTMLButtonElement;
        if (btnGuardar && !btnGuardar.disabled) btnGuardar.focus();
      }, 0);
    }
  }

  cambiarDescuento() {
    // El setter ya limpia el "0" inicial automáticamente
    // Validar que el descuento no sea negativo ni mayor a 100
    this._descuentoPorcentaje = Math.max(0, Math.min(100, this._descuentoPorcentaje));
    this.recalcular();
    this.recalcularAbono(); // Recalcular saldo pendiente con el nuevo total
  }
agregarProducto(p: any) {
  // 🛒 NUEVO: Permitir agregar productos sin cliente (para consumidor final)
  // Solo validar historial si hay un cliente registrado (no consumidor final)
  if (!this.modoEdicion && this.clienteId && !this.esVentaConsumidorFinal && !this.sinHistorial && !this.historialId) {
    Swal.fire({
      icon: 'warning',
      title: 'Selecciona una opción de historial',
      text: 'Debes elegir un historial clínico o seleccionar "Vender sin historial" antes de agregar productos.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  const id = p.id;

  // ✅ CALCULAR PRECIO CON Y SIN IVA
  let precioSinIva: number;
  let precioConIva: number;
  let porcentajeIva: number = 0;

  if (p.precioConIVA && Number(p.precioConIVA) > 0) {
    // Si existe precioConIVA, usar ese
    precioConIva = Number(p.precioConIVA);
    if (p.iva && Number(p.iva) > 0) {
      porcentajeIva = Number(p.iva);
      precioSinIva = precioConIva / (1 + porcentajeIva / 100);
    } else {
      precioSinIva = precioConIva;
    }
  } else if (p.pvp1 && p.iva && Number(p.iva) > 0) {
    // Si existe PVP1 e IVA, calcular con IVA
    porcentajeIva = Number(p.iva);
    precioSinIva = Number(p.pvp1);
    precioConIva = precioSinIva * (1 + porcentajeIva / 100);
  } else {
    // Sin IVA
    precioSinIva = Number(p.pvp1 || p.costo || 0);
    precioConIva = precioSinIva;
  }

  // Determinar tipo de control de stock (NORMAL o ILIMITADO)
  const tipoControl = (p as any).tipo_control_stock || 'NORMAL';
  const esStockIlimitado = tipoControl === 'ILIMITADO';
  const stockDisponible = esStockIlimitado ? Number.POSITIVE_INFINITY : Number(p.stock || 0);

  // Solo validar stock si el producto NO es ILIMITADO
  const stockEnCarrito = (this.items.find(i => i.productoId === id)?.cantidad) || 0;
  const stockRestante = esStockIlimitado ? Number.POSITIVE_INFINITY : (stockDisponible - stockEnCarrito);

  if (!esStockIlimitado) {
    if (stockDisponible <= 0) {
      this.setMensajeEscaneo(`El producto "${p.nombre}" está en stock 0.`, 'warning');
      Swal.fire({
        icon: 'warning',
        title: 'Sin stock',
        text: `El producto "${p.nombre}" no tiene stock disponible.`,
      });
      return false;
    }

    if (stockRestante <= 0) {
      this.setMensajeEscaneo(`No quedan unidades disponibles de "${p.nombre}".`, 'warning');
      Swal.fire({
        icon: 'warning',
        title: 'Stock agotado',
        text: `No quedan unidades disponibles de "${p.nombre}".`,
      });
      return false;
    }
  }

  const existing = this.items.find(i => i.productoId === id);
  if (existing) {
    // El check del stock total ya se realizó con stockRestante antes.
    existing.cantidad++;
    existing.total = existing.cantidad * existing.precioUnitario;
    existing.totalSinIva = existing.cantidad * existing.precioUnitarioSinIva;
  } else {
    this.items.push({
      codigo: p.codigo || '',
      idInterno: p.idInterno || '',
      productoId: id,
      nombre: p.nombre,
      tipo: p.tipo || p.categoria || p.grupo,
      cantidad: 1,
      precioUnitarioSinIva: precioSinIva,
      precioUnitario: precioConIva,
      total: precioConIva,
      totalSinIva: precioSinIva,
      porcentajeIva,
      stockDisponible,
    });
  }

  this.recalcular();
  this.recalcularAbono(); // Actualizar saldo pendiente cuando se agrega producto
  return true;
}
private toNumber(v: any): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v ?? '')
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}




  /**
   * Retorna clase CSS para indicador de stock según disponibilidad
   * Verde: stock > 10, Amarillo: stock 1-10, Rojo: stock 0, Azul: ILIMITADO
   */
  getStockBadgeClass(p: any): string {
    const tipoControl = (p as any).tipo_control_stock || 'NORMAL';

    if (tipoControl === 'ILIMITADO') {
      return 'badge-info'; // Azul para stock ilimitado
    }

    const stock = Number(p.stock || 0);
    if (stock > 10) return 'badge-success'; // Verde
    if (stock > 0) return 'badge-warning';  // Amarillo
    return 'badge-danger';                   // Rojo
  }

  /**
   * Retorna texto descriptivo del stock
   */
  getStockText(p: any): string {
    const tipoControl = (p as any).tipo_control_stock || 'NORMAL';

    if (tipoControl === 'ILIMITADO') {
      return '∞'; // Símbolo infinito para stock ilimitado
    }

    return String(p.stock || 0);
  }

  /**
   * Inicializa los campos de fecha y hora con valores actuales
   * Si es operador, actualiza continuamente la hora cada segundo
   */
  inicializarFechaHora(): void {
    this.actualizarFechaHoraActual();

    // Actualizar fecha/hora continuamente hasta que el usuario edite manualmente
    this.fechaHoraIntervalId = window.setInterval(() => {
      this.actualizarFechaHoraActual();
    }, 1000);

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
   * Actualiza fecha y hora con valores actuales
   */
  private actualizarFechaHoraActual(): void {
    const ahora = new Date();

    // Formato HH:mm:ss para hora
    const horas = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    if (!this.horaManual) {
      this.horaPago = `${horas}:${minutos}:${segundos}`;
    }

    // Formato YYYY-MM-DD para fecha
    const año = ahora.getFullYear();
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dia = ahora.getDate().toString().padStart(2, '0');
    if (!this.fechaManual) {
      this.fechaPago = `${año}-${mes}-${dia}`;
    }
    this.fechaMaxima = `${año}-${mes}-${dia}`; // Límite máximo: hoy
  }

  marcarFechaManual(): void {
    this.fechaManual = true;
  }

  marcarHoraManual(): void {
    this.horaManual = true;
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
      this.fechaMaxima = this.formatearFecha(fechaMax);

      // Nombre del periodo para mostrar
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      this.periodoNombre = `${meses[month]} ${year}`;

      console.log(`📅 Restricciones de fecha establecidas: ${this.fechaMinima} a ${this.fechaMaxima} (${this.periodoNombre})`);
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

  cambiarCantidad(it: any, cantidad: number) {
    const max = Number(it?.stockDisponible ?? Number.POSITIVE_INFINITY);
    let c = Math.max(1, Number(cantidad || 1));
    if (isFinite(max)) {
      const limitado = Math.min(c, max);
      if (limitado < c) {
        Swal.fire({
          icon: 'info',
          title: 'Cantidad límite',
          text: `No puedes vender más de ${max} unidad(es) de "${it?.nombre}".`,
        });
      }
      c = limitado;
    }
    it.cantidad = c;
    it.total = it.cantidad * it.precioUnitario;
    it.totalSinIva = it.cantidad * it.precioUnitarioSinIva;
    this.recalcular();
    this.recalcularAbono(); // Actualizar saldo pendiente
  }

  quitar(it: any) {
    this.items = this.items.filter((x: any) => x !== it);
    this.recalcular();
    this.recalcularAbono(); // Actualizar saldo pendiente
  }

  /**
   * Agrega un servicio al detalle de la venta
   * Los servicios NO descuentan stock y tienen precio manual
   */
  agregarServicio() {
    const nombre = (this.servicioNuevo.nombre || '').trim();
    const cantidad = Math.max(1, Number(this.servicioNuevo.cantidad || 1));
    const precio = Math.max(0, Number(this.servicioNuevo.precio || 0));

    // Validar que el nombre no esté vacío
    if (!nombre) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'Ingresa el nombre del servicio.',
      });
      return;
    }

    // Validar que el precio sea mayor a 0
    if (precio <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Precio requerido',
        text: 'Ingresa un precio mayor a 0 para el servicio.',
      });
      return;
    }

    // Buscar si ya existe este servicio (por nombre exacto)
    const existing = this.items.find((i: any) => i.esServicio && (i.nombre || '').toLowerCase() === nombre.toLowerCase());

    if (existing) {
      // Si ya existe, solo incrementar cantidad
      existing.cantidad++;
      existing.total = existing.cantidad * existing.precioUnitario;
      existing.totalSinIva = existing.total; // Servicios sin IVA desglosado
    } else {
      // Agregar nuevo servicio
      this.items.push({
        esServicio: true, // 🔧 Identificador de servicio
        nombre: nombre,
        tipo: 'SERVICIO',
        cantidad: cantidad,
        precioUnitarioSinIva: precio,
        precioUnitario: precio,
        total: cantidad * precio,
        totalSinIva: cantidad * precio,
        porcentajeIva: 0,
        stockDisponible: Number.POSITIVE_INFINITY, // Servicios sin stock
        codigo: '',
        idInterno: ''
      });
    }

    // Limpiar formulario
    this.servicioNuevo = {
      nombre: '',
      cantidad: 1,
      precio: 0
    };
    this.mostrarFormServicio = false;

    this.recalcular();
    this.recalcularAbono();
  }

  /**
   * Toggle para mostrar/ocultar formulario de servicio
   */
  toggleFormServicio() {
    this.mostrarFormServicio = !this.mostrarFormServicio;
    if (this.mostrarFormServicio) {
      // Resetear el formulario al abrir
      this.servicioNuevo = {
        nombre: '',
        cantidad: 1,
        precio: 0
      };
      // Enfocar el input después de que se renderice
      setTimeout(() => {
        const input = document.querySelector('.form-servicio input[type="text"]') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    }
  }

  recalcular() {
    // Calcular subtotal SIN IVA y el IVA desglosado
    const subtotalBruto = this.items.reduce((a: number, i: any) => a + (Number(i.totalSinIva) || 0), 0);
    this.subtotalBruto = +subtotalBruto.toFixed(2);
    this.descuentoMonto = +(subtotalBruto * (this.descuentoPorcentaje / 100)).toFixed(2);
    this.subtotal = +(subtotalBruto - this.descuentoMonto).toFixed(2);
    this.iva = this.items.reduce((a: number, i: any) => (Number(i.total) || 0) - (Number(i.totalSinIva) || 0) + a, 0);
    this.total = +(this.subtotal + this.iva).toFixed(2);
  }

async guardarEImprimir() {
  if (!this.items.length || this.guardando) return;

  // 🛒 NUEVA VALIDACIÓN: Si no hay cliente seleccionado (modo creación), abrir modal para elegir tipo de venta
  if (!this.modoEdicion && !this.clienteId) {
    this.mostrarModalTipoVenta = true;
    return; // Esperamos que el usuario elija en el modal
  }

  // Continuar con el proceso normal de guardado
  await this.procesarGuardadoVenta();
}

/**
 * 🛒 Procesar elección de tipo de venta desde el modal
 */
async elegirTipoVenta(tipo: 'consumidor-final' | 'cliente-registrado') {
  this.tipoVentaSeleccionado = tipo;
  this.mostrarModalTipoVenta = false;

  if (tipo === 'consumidor-final') {
    // ✅ Validar que NO esté activo el crédito
    if (this.esCredito) {
      await Swal.fire({
        icon: 'warning',
        title: 'Crédito activo',
        text: 'No se puede realizar una venta a consumidor final con crédito activo. Por favor, desactive el crédito primero.',
        confirmButtonText: 'Entendido'
      });
      this.tipoVentaSeleccionado = null;
      this.mostrarModalTipoVenta = true; // Volver a mostrar el modal
      return;
    }

    // ✅ Validar que el monto recibido cubra el total (para consumidor final debe pagar completo)
    if (this.abono < this.total) {
      await Swal.fire({
        icon: 'warning',
        title: 'Pago incompleto',
        html: `Para una venta a consumidor final, el monto recibido debe ser igual o mayor al total de la venta.<br><br>
               <strong>Total a pagar:</strong> $${this.total.toFixed(2)}<br>
               <strong>Monto recibido:</strong> $${this.abono.toFixed(2)}<br><br>
               Por favor, ingrese el monto completo antes de continuar.`,
        confirmButtonText: 'Entendido'
      });
      this.tipoVentaSeleccionado = null;
      this.mostrarModalTipoVenta = true; // Volver a mostrar el modal
      return;
    }

    // Asignar automáticamente el cliente CONSUMIDOR FINAL
    try {
      const consumidorFinal = await this.clientesSrv.getConsumidorFinal();

      if (!consumidorFinal) {
        await Swal.fire({
          icon: 'error',
          title: 'Cliente no encontrado',
          text: 'No se pudo encontrar el cliente CONSUMIDOR FINAL. Por favor contacte al administrador.',
          confirmButtonText: 'Entendido'
        });
        this.tipoVentaSeleccionado = null;
        return;
      }

      this.clienteId = consumidorFinal.id!;
      this.cliente = consumidorFinal;
      this.historialId = '';
      this.historial = null;
      this.sinHistorial = true;
      this.esCredito = false; // No permitir crédito para consumidor final

      // Continuar con el guardado
      await this.procesarGuardadoVenta();
    } catch (error) {
      console.error('❌ Error al obtener cliente CONSUMIDOR FINAL:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al configurar la venta a consumidor final.',
        confirmButtonText: 'Entendido'
      });
      this.tipoVentaSeleccionado = null;
    }
  } else {
    // Cliente registrado: solicitar que seleccione un cliente
    await Swal.fire({
      icon: 'info',
      title: 'Seleccionar cliente',
      text: 'Por favor, seleccione un cliente registrado para continuar con la venta.',
      confirmButtonText: 'Entendido'
    });
    this.tipoVentaSeleccionado = null;
  }
}

/**
 * 🛒 Cancelar selección de tipo de venta
 */
cancelarModalTipoVenta() {
  this.mostrarModalTipoVenta = false;
  this.tipoVentaSeleccionado = null;
}

/**
 * 🛒 PROCESO PRINCIPAL DE GUARDADO (extraído de guardarEImprimir)
 */
async procesarGuardadoVenta() {
  if (!this.items.length || this.guardando) return;

  // ✅ VALIDACIÓN: Verificar que se haya seleccionado opción de historial
  if (!this.modoEdicion && this.clienteId && !this.sinHistorial && !this.historialId) {
    Swal.fire({
      icon: 'warning',
      title: 'Selecciona una opción de historial',
      text: 'Debes elegir un historial clínico o seleccionar "Vender sin historial" antes de guardar la venta.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  // ✅ VALIDACIÓN: La venta es válida si tiene items (productos O servicios)
  // No requerimos que sean solo productos

  // ✅ Permitir ventas con abono 0 (con o sin crédito personal)

  // 🔒 Protección adicional en modo edición
  if (this.modoEdicion && !this.facturaOriginal) {
    console.error('❌ Intento de guardar en modo edición sin factura original cargada');
    Swal.fire({
      icon: 'error',
      title: 'Error de carga',
      text: 'La factura aún no se ha cargado completamente. Por favor, espere un momento e intente nuevamente.'
    });
    return;
  }

  console.log(`🔄 Iniciando guardado - Modo: ${this.modoEdicion ? 'EDICIÓN' : 'CREACIÓN'}`);
  this.guardando = true;

  try {
    // ✅ Verificar stock en tiempo real antes de guardar (solo para PRODUCTOS, no servicios)
    for (const it of this.items) {
      // ✅ Saltar verificación si es servicio
      if (it.esServicio) {
        continue;
      }

      const prodActual: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));

      // Determinar el tipo de control de stock (compatible con datos legacy)
      const tipoControl = prodActual?.tipo_control_stock || 'NORMAL';

      // Solo validar stock si es NORMAL (no ilimitado)
      if (tipoControl === 'NORMAL') {
        const disponible = Number(prodActual?.stock || 0);
        if (disponible < it.cantidad) {
          Swal.fire({
            icon: 'error',
            title: 'Stock insuficiente',
            text: `"${it.nombre}" ➜ disponible: ${disponible}, requerido: ${it.cantidad}.`,
          });
          this.guardando = false;
          return;
        }
      }
    }

    // ✅ CALCULAR ABONO Y SALDO PENDIENTE
    const abonado = this.esCredito ? Math.max(0, Number(this.abono || 0)) : Math.min(Math.max(0, Number(this.abono || 0)), this.total);
    const saldoPendiente = +(this.total - abonado).toFixed(2);

    // 🕐 CONSTRUIR FECHA FINAL CON HORA
    let fechaFinal: Date;

    // ✅ En modo edición, conservar SIEMPRE la fecha original de la factura
    if (this.modoEdicion && this.facturaOriginal?.fecha) {
      const fechaOriginal = this.facturaOriginal.fecha;
      fechaFinal = fechaOriginal.toDate ? fechaOriginal.toDate() : new Date(fechaOriginal);
      console.log('🛡️ Modo edición: se conserva fecha original de factura:', fechaFinal);
    } else {

    console.log('🔍 DEBUG - Método de pago:', this.metodoPago);
    console.log('🔍 DEBUG - horaPago:', this.horaPago);
    console.log('🔍 DEBUG - fechaPago:', this.fechaPago);

    if (this.metodoPago === 'Efectivo') {
      // Para efectivo: usar fecha de caja chica + hora seleccionada
      try {
        const cajaAbierta = await this.cajaChicaService.getCajaAbierta();
        console.log('📅 Caja abierta obtenida:', cajaAbierta);

        if (cajaAbierta?.fecha) {
          // Convertir correctamente Timestamp de Firestore a Date
          let fechaCaja: Date;
          if ((cajaAbierta.fecha as any).toDate) {
            // Es un Timestamp de Firestore
            fechaCaja = (cajaAbierta.fecha as any).toDate();
          } else if (cajaAbierta.fecha instanceof Date) {
            fechaCaja = cajaAbierta.fecha;
          } else {
            fechaCaja = new Date(cajaAbierta.fecha);
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
    } else if (this.metodoPago === 'Transferencia') {
      // Para transferencia: validar fecha seleccionada y caja banco abierta
      console.log('🏦 Usando fecha contable de caja chica para transferencia');

      // ✅ VALIDAR QUE LA FECHA ESTÉ DENTRO DEL PERIODO DE LA CAJA BANCO
      if (this.fechaMinima && this.fechaMaxima) {
        if (this.fechaPago < this.fechaMinima || this.fechaPago > this.fechaMaxima) {
          Swal.fire({
            icon: 'error',
            title: 'Fecha Inválida',
            text: `La fecha debe estar dentro del periodo de la caja banco: ${this.periodoNombre}. Seleccione una fecha entre ${this.fechaMinima} y ${this.fechaMaxima}.`,
            confirmButtonText: 'Entendido'
          });
          this.guardando = false;
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
        this.guardando = false;
        return;
      }

      // ✅ Usar FECHA DE CAJA CHICA como fecha contable oficial
      try {
        const cajaAbierta = await this.cajaChicaService.getCajaAbierta();
        console.log('📅 Caja chica abierta obtenida (transferencia):', cajaAbierta);

        if (cajaAbierta?.fecha) {
          let fechaCaja: Date;
          if ((cajaAbierta.fecha as any).toDate) {
            fechaCaja = (cajaAbierta.fecha as any).toDate();
          } else if (cajaAbierta.fecha instanceof Date) {
            fechaCaja = cajaAbierta.fecha;
          } else {
            fechaCaja = new Date(cajaAbierta.fecha);
          }

          console.log('📅 Fecha de caja chica convertida (transferencia):', fechaCaja);
          fechaFinal = this.combinarFechaHora(fechaCaja, this.horaPago);
          console.log('✅ Fecha final TRANSFERENCIA (caja chica):', fechaFinal);
        } else {
          console.warn('⚠️ No hay fecha en caja chica, usando fecha actual');
          fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
        }
      } catch (err) {
        console.error('❌ Error obteniendo fecha de caja chica (transferencia):', err);
        fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
      }
    } else {
      // Para tarjeta: NO validar caja banco (ingreso diferido)
      console.log('💳 Venta con tarjeta (sin ingreso inmediato a caja banco)');

      try {
        const cajaAbierta = await this.cajaChicaService.getCajaAbierta();
        console.log('📅 Caja chica abierta obtenida (tarjeta):', cajaAbierta);

        if (cajaAbierta?.fecha) {
          let fechaCaja: Date;
          if ((cajaAbierta.fecha as any).toDate) {
            fechaCaja = (cajaAbierta.fecha as any).toDate();
          } else if (cajaAbierta.fecha instanceof Date) {
            fechaCaja = cajaAbierta.fecha;
          } else {
            fechaCaja = new Date(cajaAbierta.fecha);
          }

          console.log('📅 Fecha de caja chica convertida (tarjeta):', fechaCaja);
          fechaFinal = this.combinarFechaHora(fechaCaja, this.horaPago);
          console.log('✅ Fecha final TARJETA (caja chica):', fechaFinal);
        } else {
          console.warn('⚠️ No hay fecha en caja chica, usando fecha actual');
          fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
        }
      } catch (err) {
        console.error('❌ Error obteniendo fecha de caja chica (tarjeta):', err);
        fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
      }
    }
    }

    console.log('🎯 FECHA FINAL QUE SE GUARDARÁ:', fechaFinal);

    // Validar que fechaFinal sea válida
    if (!fechaFinal || !(fechaFinal instanceof Date) || isNaN(fechaFinal.getTime())) {
      console.error('❌ ERROR: fechaFinal no es válida:', fechaFinal);
      Swal.fire({
        icon: 'error',
        title: 'Error de fecha',
        text: 'La fecha de la venta no es válida. Por favor intenta de nuevo.'
      });
      this.guardando = false;
      return;
    }

    console.log('✅ Fecha validada (Date):', fechaFinal);

    // ✅ OBTENER USUARIO ACTUAL LOGEADO
    const usuario = this.authService.getCurrentUser();
    const usuarioId = usuario?.id || 'admin'; // Fallback a 'admin' si no hay usuario
    const usuarioNombre = usuario?.nombre || 'Usuario';

    console.log('👤 Usuario actual:', { id: usuarioId, nombre: usuarioNombre });

    // ✅ CREAR FACTURA CON DATOS DE CRÉDITO
    const observacionLimpia = (this.observacion || '').trim();
    const factura: any = {
      clienteId: this.clienteId,
      historialClinicoId: this.sinHistorial ? null : (this.historialId || undefined),
      clienteNombre: `${this.cliente?.nombres || ''} ${this.cliente?.apellidos || ''}`.trim(),
      clienteTelefono: this.cliente?.telefono || '',
      historialSnapshot: undefined,

      items: this.items.map((i: any) => ({
        esServicio: i.esServicio || false, // ✅ Incluir flag de servicio
        productoId: i.productoId || undefined,
        nombre: i.nombre,
        tipo: i.tipo,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        total: i.total,
        codigo: i.codigo,
        idInterno: i.idInterno
      })),

      subtotal: +this.subtotalBruto.toFixed(2),
      subtotalBruto: +this.subtotalBruto.toFixed(2),
      descuentoPorcentaje: this.descuentoPorcentaje,
      descuentoMonto: +this.descuentoMonto.toFixed(2),
      iva: +this.iva.toFixed(2),
      total: +this.total.toFixed(2),

      metodoPago: this.metodoPago,
      codigoTransferencia: this.metodoPago === 'Transferencia' ? this.codigoTransferencia : undefined,
      observacion: observacionLimpia || undefined,
      fecha: fechaFinal,  // Firestore convertirá Date a Timestamp automáticamente
      usuarioId: usuarioId, // ✅ Usuario actual logeado

      // ✅ NUEVO: DATOS DE CRÉDITO PERSONAL
      esCredito: this.esCredito,
      tipoVenta: this.esCredito ? 'CREDITO' : 'CONTADO',
      abonado: +abonado.toFixed(2),
      saldoPendiente,
      estadoPago: saldoPendiente > 0 ? 'PENDIENTE' : 'PAGADA',
      estadoCredito: this.esCredito && saldoPendiente > 0 ? 'ACTIVO' : 'CANCELADO',

      // ✅ NUEVO: TIPO DE FACTURA (Normal = venta convencional, NO cobro de deuda)
      tipoFactura: this.sinHistorial ? 'SIN_HISTORIAL' : 'NORMAL'
    };

    console.log('📄 FACTURA A GUARDAR:', factura);
    console.log('📄 Fecha en factura:', factura.fecha);
    console.log('📄 Tipo de fecha:', typeof factura.fecha, factura.fecha instanceof Date);

    const facturaLimpia = this.cleanUndefined(factura);
    console.log('📄 FACTURA LIMPIA:', facturaLimpia);
    console.log('📄 Fecha en factura limpia:', facturaLimpia.fecha);
    console.log('📄 Tipo de fecha limpia:', typeof facturaLimpia.fecha);

    // ✅ GUARDAR O ACTUALIZAR SEGÚN MODO
    let facturaId: string;
    if (this.modoEdicion && this.facturaId) {
      // MODO EDICIÓN: Actualizar factura existente
      await this.facturasSrv.actualizarFactura(this.facturaId, facturaLimpia);
      facturaId = this.facturaId;
      this.edicionTemporalFinalizada = true;
      this.edicionTemporalStockActiva = false;
      console.log('✅ Factura actualizada:', facturaId);
    } else {
      // MODO CREACIÓN: Crear nueva factura
      const ref = await this.facturasSrv.crearFactura(facturaLimpia);
      facturaId = ref.id;
      console.log('✅ Factura creada:', facturaId);
    }

    // 💳💰 ACTUALIZAR CAMPOS DE DEUDA/CRÉDITO EN CLIENTE
    // Después de crear/editar factura, actualizar los campos denormalizados
    try {
      await this.clientesSrv.actualizarCamposDeudaCredito(this.clienteId);
      console.log('✅ Campos de deuda/crédito actualizados en cliente');
    } catch (err) {
      console.warn('⚠️ No se pudieron actualizar campos de deuda/crédito:', err);
      // No bloquear el flujo, solo advertir
    }

    // ✅ Registrar venta con tarjeta como cuenta por cobrar al banco
    if (this.metodoPago === 'Tarjeta' && !this.esCredito) {
      try {
        await this.ventasTarjetaService.crearVentaTarjeta({
          facturaId,
          facturaIdPersonalizado: facturaId,
          clienteId: this.clienteId,
          clienteNombre: `${this.cliente?.nombres || ''} ${this.cliente?.apellidos || ''}`.trim(),
          fechaVenta: fechaFinal,
          montoTotal: +this.total.toFixed(2),
          ultimosCuatroTarjeta: this.ultimosCuatroTarjeta || undefined
        });
        console.log('✅ Venta con tarjeta registrada en módulo ventas_tarjeta');
      } catch (err) {
        console.error('❌ Error registrando venta con tarjeta:', err);
        // Mostrar advertencia al usuario para que sepa que debe revisar
        await Swal.fire({
          icon: 'warning',
          title: 'Advertencia',
          text: `La venta se guardó correctamente pero no se registró en el módulo de Cobros con Tarjeta. Error: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          confirmButtonText: 'Entendido'
        });
      }
    }

    // ✅ REGISTRAR AUTOMÁTICAMENTE EN CAJA CHICA O CAJA BANCO
    // (usuario ya obtenido antes de crear factura)

    // Variable para controlar si ya se registró el movimiento (evitar duplicados)
    let movimientoYaRegistrado = false;

    // ✅ EN MODO EDICIÓN: Actualizar o eliminar/crear movimientos según cambios
    if (this.modoEdicion && this.facturaOriginal) {
      const cambioMetodoPago = this.facturaOriginal.metodoPago !== this.metodoPago;
      const cambioMonto = this.facturaOriginal.abonado !== abonado;

      // CASO 1: Cambió de método de pago → Eliminar movimiento anterior y crear nuevo
      if (cambioMetodoPago) {
        console.log('🔄 Cambió método de pago. Eliminando movimiento antiguo y creando nuevo...');

        // Eliminar movimiento anterior de caja chica si existía
        if (this.facturaOriginal.metodoPago === 'Efectivo') {
          try {
            const caja = await this.cajaChicaService.getCajaAbierta();
            if (caja?.id) {
              await this.cajaChicaService.eliminarMovimientoPorFactura(caja.id, facturaId);
              console.log('✅ Movimiento anterior eliminado de Caja Chica');
            }
          } catch (err) {
            console.error('Error eliminando movimiento de Caja Chica:', err);
          }
        }

        // Eliminar movimiento anterior de caja banco si existía
        if (this.facturaOriginal.metodoPago === 'Transferencia' || this.facturaOriginal.metodoPago === 'Tarjeta') {
          try {
            await this.cajaBancoService.eliminarMovimientoPorFactura(facturaId);
            console.log('✅ Movimiento anterior eliminado de Caja Banco');
          } catch (err) {
            console.error('Error eliminando movimiento de Caja Banco:', err);
          }
        }
        // NO marcar como registrado aquí - se creará nuevo movimiento abajo
      }
      // CASO 2: Mismo método pero cambió el monto → Actualizar movimiento existente
      else if (cambioMonto) {
        console.log('🔄 Cambió monto pero no método de pago. Actualizando movimiento existente...');

        // Actualizar movimiento en caja chica si es efectivo
        if (this.metodoPago === 'Efectivo') {
          try {
            const caja = await this.cajaChicaService.getCajaAbierta();
            if (caja?.id) {
              await this.cajaChicaService.actualizarMovimientoPorFactura(
                caja.id,
                facturaId,
                abonado,
                fechaFinal,
                `Venta #${facturaId} - ${this.cliente?.nombres || 'Cliente'}`
              );
              console.log('✅ Movimiento actualizado en Caja Chica. Nuevo monto:', abonado);
              movimientoYaRegistrado = true; // Marcar como ya registrado
            }
          } catch (err) {
            // Si no existe el movimiento (error NO_ENCONTRADO), continuar para crear uno nuevo
            if (err instanceof Error && err.message !== 'NO_ENCONTRADO') {
              console.error('Error actualizando movimiento de Caja Chica:', err);
            } else {
              console.log('⚠️ Movimiento no encontrado, se creará uno nuevo');
            }
          }
        }

        // Actualizar movimiento en caja banco si es transferencia/tarjeta
        // TODO: Implementar actualizarMovimientoPorFactura en CajaBancoService si es necesario
      }
      // CASO 3: No cambió ni método ni monto → No tocar el movimiento
      else {
        console.log('✅ No hubo cambios en método de pago ni monto. Movimiento sin modificar.');
        movimientoYaRegistrado = true; // Marcar como ya registrado para no crear duplicado
      }
    }

    // ✅ REGISTRAR NUEVO MOVIMIENTO (solo si NO se actualizó uno existente y NO es modo edición sin cambios)
    if (!movimientoYaRegistrado && this.metodoPago === 'Efectivo' && abonado > 0) {
      // 💵 Venta en EFECTIVO → Registrar en Caja Chica (solo lo que se pagó)
      try {
        // Buscar cualquier caja ABIERTA (histórica o actual)
        const caja = await this.cajaChicaService.getCajaAbierta();
        if (caja?.id) {
          const movimiento: any = {
            caja_chica_id: caja.id,
            fecha: fechaFinal,
            tipo: 'INGRESO' as const,
            descripcion: `Venta #${facturaId} - ${this.cliente?.nombres || 'Cliente'}`,
            monto: abonado,
            comprobante: facturaId || ''
          };
          // Si hay usuario, agrega los datos
          if (usuario?.id) {
            movimiento.usuario_id = usuario.id;
            movimiento.usuario_nombre = usuario.nombre || 'Usuario';
          }

          await this.cajaChicaService.registrarMovimiento(caja.id, movimiento);
          console.log('✅ Venta registrada en Caja Chica:', abonado);
        } else {
          console.warn('⚠️ No hay Caja Chica abierta. Abre una caja primero.');
        }
      } catch (err) {
        console.error('Error registrando venta en Caja Chica:', err);
      }
    } else if (this.metodoPago === 'Transferencia' && this.codigoTransferencia.trim()) {
      // 🏦 Venta por TRANSFERENCIA → Registrar en Caja Banco
      try {
        // Registrar el monto realmente pagado (abono), no el total de la venta
        const montoPagado = this._abono > 0 ? this._abono : this.total;
        await this.cajaBancoService.registrarTransferenciaCliente(
          montoPagado,
          this.codigoTransferencia,
          facturaId,
          usuario?.id || '',
          usuario?.nombre || 'Usuario',
          fechaFinal  // Pasar la fecha seleccionada por el usuario
        );
        console.log(`✅ Transferencia registrada en Caja Banco: ${montoPagado} USD con fecha`, fechaFinal);
      } catch (err) {
        console.error('❌ Error registrando transferencia en Caja Banco:', err);
        Swal.fire({
          icon: 'warning',
          title: 'Advertencia',
          text: `La venta se registró pero hubo un error al registrar la transferencia en caja banco: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          confirmButtonText: 'Aceptar'
        });
      }
    }

    // Convertir Timestamps a Date para evitar errores NG02100
    const convertirTimestamp = (fecha: any): Date => {
      if (!fecha) return new Date();
      if (fecha instanceof Date) return fecha;
      if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
      return new Date(fecha);
    };

    // Setear datos de la factura y enviar directo a impresión
    this.facturaParaImprimir = {
      idPersonalizado: facturaId,
      id: facturaId,
      ...factura,
      fecha: convertirTimestamp(factura.fecha)
    };

    console.log('✅ facturaParaImprimir seteada:', this.facturaParaImprimir);

    // Forzar detección de cambios para renderizar el ticket
    this.cdr.detectChanges();

    // Función auxiliar para intentar imprimir con reintentos
    const intentarImprimir = (intentos: number = 0) => {
      console.log(`🖨️ Intento de impresión #${intentos + 1}...`);
      const ticketElement = document.getElementById('ticket');

      if (ticketElement) {
        console.log('📄 ✅ Elemento ticket encontrado');
        this.imprimirTicket();
      } else {
        console.warn('📄 ⚠️ Elemento ticket NO encontrado');

        // Reintentar hasta 3 veces con intervalos crecientes
        if (intentos < 3) {
          const delay = 200 * (intentos + 1); // 200ms, 400ms, 600ms
          console.log(`⏳ Reintentando en ${delay}ms...`);
          setTimeout(() => {
            this.cdr.detectChanges(); // Forzar detección de nuevo
            intentarImprimir(intentos + 1);
          }, delay);
        } else {
          console.error('❌ No se pudo renderizar el ticket después de 3 intentos');
          Swal.fire({
            icon: 'error',
            title: 'Error de impresión',
            text: 'No se pudo generar el ticket. La venta se guardó correctamente, pero no se pudo imprimir.',
            confirmButtonText: 'Entendido'
          });
        }
      }
    };

    // Usar requestAnimationFrame para intentar imprimir lo antes posible (minimizar delay)
    requestAnimationFrame(() => {
      this.cdr.detectChanges(); // Forzar detección una vez más
      intentarImprimir();
    });

    // ✅ Mostrar mensaje de éxito y redirigir (después de dar tiempo a la impresión y reintentos)
    setTimeout(() => {
      const tituloMensaje = this.modoEdicion ? '¡Venta Actualizada!' : '¡Venta Realizada!';
      const textoMensaje = this.modoEdicion
        ? `La venta #${facturaId} se ha actualizado correctamente.`
        : `La venta #${facturaId} se ha registrado correctamente.`;

      Swal.fire({
        icon: 'success',
        title: tituloMensaje,
        text: textoMensaje,
        showDenyButton: true,
        confirmButtonText: 'Finalizar',
        //Cambiar color de confirmación button de color verde
        confirmButtonColor: '#28a745',
        denyButtonText: 'Reimprimir Ticket',
        denyButtonColor: '#3085d6',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then((result) => {
        if (result.isDenied) {
          // Usuario quiere reimprimir
          this.imprimirTicket();
          // Mostrar nuevamente el modal
          Swal.fire({
            icon: 'success',
            title: tituloMensaje,
            text: textoMensaje,
            showDenyButton: true,
            confirmButtonText: 'Finalizar',
            confirmButtonColor: '#28a745',
            denyButtonText: 'Reimprimir Ticket',
            denyButtonColor: '#3085d6',
            allowOutsideClick: false,
            allowEscapeKey: false
          }).then((result2) => {
            if (result2.isDenied) {
              this.imprimirTicket();
            }
            // ✅ En lugar de navegar, resetear el formulario para una nueva venta
            this.resetearVentaCompleta();
          });
        } else {
          // ✅ En lugar de navegar, resetear el formulario para una nueva venta
          this.resetearVentaCompleta();
        }
      });
    }, 1500); // Ajustado a 1500ms (200 + 400 + 600 = 1200 + margen)

  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'Error al guardar o imprimir la factura', 'error');
  } finally {
    this.guardando = false;
  }
}

  imprimirAhora() {
    // Método legado: ya no se usa, pero mantenemos compatibilidad
    this.imprimirTicket();
  }
private cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;

  // No procesar Date - devolverlo tal cual
  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map(v => this.cleanUndefined(v));
  }

  if (typeof obj === 'object') {
    const out: any = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v === undefined) return; // 🔥 quita undefined
      out[k] = this.cleanUndefined(v);
    });
    return out;
  }

  return obj;
}


  imprimirTicket() {
    console.log('🖨️ imprimirTicket() llamado');
    const ticket = document.getElementById('ticket');
    if (!ticket) {
      console.error('❌ Elemento #ticket no encontrado en el DOM');
      Swal.fire({
        icon: 'error',
        title: 'Error de impresión',
        text: 'No se pudo generar el ticket para imprimir. Por favor, intente nuevamente.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    console.log('✅ Elemento #ticket encontrado, abriendo ventana de impresión...');

    // Abrir ventana aislada solo con el ticket para evitar que se oculte por estilos de la app
    const w = window.open('', 'PRINT', 'height=600,width=380');
    if (!w) {

      return;
    }

    console.log('✅ Ventana de impresión abierta, generando contenido...');

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
      /* columnas compactas: total 70mm + gaps 8mm = 78mm dentro de 80mm con padding */
      .t-table-head, .t-table-row { display: grid; grid-template-columns: 8mm 30mm 8mm 12mm 12mm; column-gap: 2mm; row-gap: 0; align-items: center; }
      .t-table-head { font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 4px; }
      .t-table-row { margin: 0 0 2px 0; }
      .t-cell { display: block; }
      .t-cut { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .t-small { font-size: 11px; }
      @media print {
        @page { size: 80mm auto; margin: 0; }
        html, body { width: 80mm; margin: 0; padding: 0; }
        .ticket { width: 80mm; }
      }
    `;

    w.document.write(`
      <html>
        <head>
          <title>Ticket</title>
          <style>${styles}</style>
        </head>
        <body>
          ${ticket.outerHTML}
        </body>
      </html>
    `);

    w.document.close();

    // Esperar a que cargue el nuevo documento antes de imprimir.
    const triggerPrint = () => {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        w.close();
      };

      try {
        w.focus();
        w.addEventListener('afterprint', safeClose, { once: true });
        w.print();
        // Fallback: cerrar si afterprint no se dispara (algunos drivers PDF)
        setTimeout(safeClose, 2000);
      } catch (err) {
        // Si algo falla, no dejamos la ventana abierta indefinidamente
        safeClose();
      }
    };

    if (w.document.readyState === 'complete') {
      setTimeout(triggerPrint, 150);
    } else {
      w.onload = () => setTimeout(triggerPrint, 150);
    }
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

  async volver() {
    // ✅ Si estamos en modo edición, volver a facturas; si no, resetear para nueva venta
    if (this.modoEdicion) {
      if (this.facturaId && this.edicionTemporalStockActiva && !this.edicionTemporalFinalizada) {
        try {
          await this.facturasSrv.cancelarEdicionFacturaTemporal(this.facturaId);
          this.edicionTemporalStockActiva = false;
        } catch (error) {
          console.error('Error al restaurar stock original al cancelar edición:', error);
        }
      }
      this.router.navigate(['/facturas']);
    } else {
      this.resetearVentaCompleta();
    }
  }

  /**
   * Carga una factura existente para edición
   * Pre-llena todos los campos del formulario con los datos de la factura
   */
  async cargarFacturaParaEditar(): Promise<void> {
    this.cargandoFactura = true;
    try {
      console.log('🔄 Cargando factura para editar:', this.facturaId);

      // Cargar factura desde Firestore
      const factura: any = await firstValueFrom(this.facturasSrv.getFacturaById(this.facturaId));

      if (!factura) {
        console.error('❌ Factura no encontrada:', this.facturaId);
        await Swal.fire({
          icon: 'error',
          title: 'Factura no encontrada',
          text: 'No se pudo cargar la factura para editar.',
          confirmButtonText: 'Volver'
        });
        this.router.navigate(['/facturas']);
        return;
      }

      console.log('✅ Factura obtenida:', factura);

      // Guardar copia de la factura original INMEDIATAMENTE
      this.facturaOriginal = { ...factura };
      this.itemsOriginales = factura.items ? JSON.parse(JSON.stringify(factura.items)) : [];

      // Restaurar temporalmente el stock original para la edición
      await this.facturasSrv.iniciarEdicionFacturaTemporal(this.facturaId);
      this.edicionTemporalStockActiva = true;
      this.edicionTemporalFinalizada = false;

      // Pre-llenar datos del cliente
      this.clienteId = factura.clienteId || '';
      if (this.clienteId) {
        console.log('🔄 Cargando datos del cliente:', this.clienteId);
        this.cliente = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));
        this.historialId = factura.historialClinicoId || '';

        if (this.historialId) {
          const snap = await this.historialSrv.obtenerHistorialPorId(this.clienteId, this.historialId);
          this.historial = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } else if (factura.historialSnapshot) {
          this.historial = factura.historialSnapshot;
        } else {
          const historialReciente = await this.cargarHistorialReciente(this.clienteId);
          this.historial = historialReciente.historial;
          this.historialId = historialReciente.historialId;
        }
        console.log('✅ Cliente e historial cargados');
      }

      // Pre-llenar items (productos y servicios)
      this.items = (factura.items || []).map((item: any) => ({
        ...item,
        // Asegurar que los servicios tengan stockDisponible infinito
        stockDisponible: item.esServicio ? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY // En edición permitimos cualquier cantidad
      }));

      // Pre-llenar totales
      this.descuentoPorcentaje = factura.descuentoPorcentaje || 0;
      if (factura.subtotalBruto !== undefined && factura.subtotalBruto !== null) {
        this.subtotalBruto = factura.subtotalBruto;
        this.subtotal = +(this.subtotalBruto - (factura.descuentoMonto || 0)).toFixed(2);
      } else {
        this.subtotal = factura.subtotal || 0;
        this.subtotalBruto = +(this.subtotal + (factura.descuentoMonto || 0)).toFixed(2);
      }
      this.iva = factura.iva || 0;
      this.total = factura.total || 0;
      this.descuentoMonto = factura.descuentoMonto || 0;

      // Pre-llenar método de pago
      this.metodoPago = factura.metodoPago || 'Efectivo';
      this.codigoTransferencia = factura.codigoTransferencia || '';

      // Pre-llenar datos de crédito
      this.esCredito = factura.esCredito || false;
      this.abono = factura.abonado || 0;
      this.saldoPendiente = factura.saldoPendiente || 0;

      // Pre-llenar fecha y hora
      if (factura.fecha) {
        const fechaFactura = factura.fecha.toDate ? factura.fecha.toDate() : new Date(factura.fecha);
        const año = fechaFactura.getFullYear();
        const mes = (fechaFactura.getMonth() + 1).toString().padStart(2, '0');
        const dia = fechaFactura.getDate().toString().padStart(2, '0');
        this.fechaPago = `${año}-${mes}-${dia}`;

        const horas = fechaFactura.getHours().toString().padStart(2, '0');
        const minutos = fechaFactura.getMinutes().toString().padStart(2, '0');
        const segundos = fechaFactura.getSeconds().toString().padStart(2, '0');
        this.horaPago = `${horas}:${minutos}:${segundos}`;
      }

      this.observacion = factura.observacion || '';

      console.log('✅ Factura cargada para edición:', factura);

      // Pequeño delay para asegurar que todo esté sincronizado
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error('Error cargando factura:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al cargar la factura para editar.',
        confirmButtonText: 'Volver'
      });
      this.router.navigate(['/facturas']);
    } finally {
      this.cargandoFactura = false;
      console.log('✅ Factura completamente lista para editar');
    }
  }

  ngOnDestroy() {
    if (this.modoEdicion && this.facturaId && this.edicionTemporalStockActiva && !this.edicionTemporalFinalizada) {
      this.facturasSrv.cancelarEdicionFacturaTemporal(this.facturaId).catch((error) => {
        console.error('Error al revertir edición temporal al salir de la pantalla:', error);
      });
    }

    // 🚀 OPTIMIZADO: Limpiar suscripción de búsqueda
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    if (this.clientesBusquedaSub) {
      this.clientesBusquedaSub.unsubscribe();
    }
    if (this.fechaHoraIntervalId) {
      window.clearInterval(this.fechaHoraIntervalId);
    }
  }

  /**
   * Selecciona todo el texto del input cuando recibe focus
   * Útil para reemplazar rápidamente valores numéricos
   */
  selectAll(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      // Usar setTimeout para asegurar que la selección ocurra después del focus
      setTimeout(() => {
        input.select();
      }, 0);
    }
  }

  /**
   * Valida que el descuento no quede vacío (mínimo 0)
   */
  validarDescuento(): void {
    if (this.descuentoPorcentaje === null || this.descuentoPorcentaje === undefined || isNaN(this.descuentoPorcentaje)) {
      this.descuentoPorcentaje = 0;
    }
  }

  /**
   * Valida que el abono no quede vacío (mínimo 0)
   */
  validarAbono(): void {
    if (this.abono === null || this.abono === undefined || isNaN(this.abono)) {
      this.abono = 0;
    }
  }
}
