import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../core/services/clientes';
import { ProductosService } from '../../../core/services/productos';
import { HistorialClinicoService } from '../../../core/services/historial-clinico.service';
import { FacturasService } from '../../../core/services/facturas';
import { CajaBancoService } from '../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../core/services/caja-chica.service';
import { AuthService } from '../../../core/services/auth.service';

import { ItemVenta } from '../../../core/models/item-venta.model';
import { Factura } from '../../../core/models/factura.model';

@Component({
  selector: 'app-crear-venta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-venta.html',
  styleUrls: ['./crear-venta.css'],
})
export class CrearVentaComponent implements OnInit, OnDestroy {
  // Listener para navegación con teclado global
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    this.onDocumentKeydown(event);
  }
  clienteId = '';
  cliente: any = null;
  historial: any = null;

  productos: any[] = [];
  filtro = '';
  productosFiltrados: any[] = [];
  selectedIndex = -1; // Para navegación con flechas
  productoSeleccionado: any = null; // Producto actualmente seleccionado
  ordenamientoProductos: string = 'codigo'; // 'reciente' o 'codigo' - Por defecto ordenar por idInterno (código)
  
  // Filtros adicionales
  mostrarFiltros: boolean = false; // Panel de filtros colapsable
  mostrarRecientes: boolean = false; // Toggle para mostrar últimos vendidos
  grupoSeleccionado: string = '';
  proveedorSeleccionado: string = '';
  tipoStockSeleccionado: string = ''; // '', 'NORMAL', 'ILIMITADO'
  gruposDisponibles: string[] = [];
  proveedoresDisponibles: string[] = [];

  items: any[] = []; // (tu ItemVenta ya lo usas pero aquí guardas nombre/tipo/total también)

  ivaPct = 0.15;
  private _descuentoPorcentaje = 0;
  descuentoMonto = 0; // Monto del descuento calculado
  subtotal = 0;
  iva = 0;
  total = 0;

  metodoPago = 'Efectivo';
  codigoTransferencia = ''; // Código de transferencia bancaria
  ultimosCuatroTarjeta = ''; // Últimos 4 dígitos de la tarjeta
  
  // � FECHA Y HORA DE PAGO
  horaPago = ''; // Hora del pago (HH:mm) - para todos los métodos
  fechaPago = ''; // Fecha del pago (YYYY-MM-DD) - solo para transferencia/tarjeta
  
  // �💵 VUELTO (solo visual para efectivo)
  montoRecibido = 0; // Cuánto dinero entrega el cliente

  // ✅ CRÉDITO PERSONAL
  esCredito = false; // Checkbox para venta a crédito personal

  loading = true;
  guardando = false;

  // para ticket
  facturaParaImprimir: any = null;
  private _abono = 0;
  saldoPendiente = 0;
  
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
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // � Inicializar fecha y hora por defecto
    this.inicializarFechaHora();
    
    // �🔒 VALIDACIÓN CRÍTICA: Verificar que exista alguna caja chica ABIERTA
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
          text: 'Debe tener al menos una caja chica ABIERTA para crear ventas (puede ser de cualquier fecha).',
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

    // ✅ puedes entrar con /ventas/crear?clienteId=xxx
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';

    if (!this.clienteId) {
      this.router.navigate(['/clientes/historial-clinico']);
      return;
    }

    this.cliente = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));

    const snap = await this.historialSrv.obtenerHistorial(this.clienteId);
    this.historial = snap.exists() ? snap.data() : null;

    this.productosSrv.getProductos().subscribe((data: any[]) => {
      this.productos = data || [];
      this.extraerGruposYProveedores();
      this.filtrarProductos();
    });

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

  filtrarProductos() {
    const t = (this.filtro || '').trim().toLowerCase();
    let filtrados = [...this.productos];
    
    // Filtro por grupo
    if (this.grupoSeleccionado) {
      filtrados = filtrados.filter(p => 
        (p.grupo || '').toUpperCase() === this.grupoSeleccionado.toUpperCase()
      );
    }
    
    // Filtro por proveedor
    if (this.proveedorSeleccionado) {
      filtrados = filtrados.filter(p => 
        (p.proveedor || '').toUpperCase() === this.proveedorSeleccionado.toUpperCase()
      );
    }
    
    // Filtro por tipo de stock
    if (this.tipoStockSeleccionado) {
      filtrados = filtrados.filter(p => {
        const tipoControl = (p as any).tipo_control_stock || 'NORMAL';
        return tipoControl === this.tipoStockSeleccionado;
      });
    }
    
    // Filtro por término de búsqueda
    if (t) {
      filtrados = filtrados.filter(p => {
        const n = (p.nombre || '').toLowerCase();
        const tipo = (p.tipo || p.categoria || '').toLowerCase();
        const modelo = (p.modelo || '').toLowerCase();
        const color = (p.color || '').toLowerCase();
        const codigo = (p.codigo || '').toLowerCase();
        const idInterno = (p.idInterno || '').toString().toLowerCase();
        return n.includes(t) || tipo.includes(t) || modelo.includes(t) || color.includes(t) || codigo.includes(t) || idInterno.includes(t);
      });
    }
    
    this.productosFiltrados = filtrados;
    this.selectedIndex = -1;
    
    // Aplicar ordenamiento
    this.aplicarOrdenamiento();
    
    // Si "Recientes" está activo, limitar a los primeros 20 después de ordenar
    if (this.mostrarRecientes) {
      this.productosFiltrados = this.productosFiltrados.slice(0, 20);
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
    }
    
    this.filtrarProductos();
  }

  /**
   * Limpia el filtro de grupo y recarga productos
   */
  limpiarFiltroGrupo() {
    this.grupoSeleccionado = '';
    this.filtrarProductos();
  }

  /**
   * Limpia el filtro de proveedor y recarga productos
   */
  limpiarFiltroProveedor() {
    this.proveedorSeleccionado = '';
    this.filtrarProductos();
  }

  /**
   * Limpia el filtro de tipo de stock y recarga productos
   */
  limpiarFiltroStock() {
    this.tipoStockSeleccionado = '';
    this.filtrarProductos();
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
    this.filtrarProductos();
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
    // Limpiar el filtro de búsqueda
    this.filtro = '';
    // NO resetear selectedIndex para permitir navegación con flechas desde este producto
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

  /**
   * Navegación global con teclado (incluso sin usar el input de búsqueda)
   * Se activa con flechas arriba/abajo y Enter desde cualquier parte
   */
  onDocumentKeydown(event: KeyboardEvent) {
    // Solo actuar si NO estamos en un input, textarea o select
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    const filtrados = this.productosFiltrados;
    if (filtrados.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      // Si no hay selección, empezar desde el primero
      if (this.selectedIndex < 0) this.selectedIndex = 0;
      else this.selectedIndex = Math.min(this.selectedIndex + 1, filtrados.length - 1);
      this.scrollToSelectedProduct();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      // Si no hay selección, empezar desde el primero
      if (this.selectedIndex < 0) this.selectedIndex = 0;
      else this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.scrollToSelectedProduct();
    } else if (event.key === 'Enter' && this.selectedIndex >= 0) {
      event.preventDefault();
      const p = filtrados[this.selectedIndex];
      if (p) this.agregarProducto(p);
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
          const descuentoInput = document.querySelector('input[min="0"][max="100"][placeholder="0"]') as HTMLInputElement;
          if (descuentoInput) descuentoInput.focus();
        }, 0);
      }
    } else if (inputType === 'descuento') {
      // Del descuento al método de pago
      setTimeout(() => {
        const metodoPagoSelect = document.querySelector('.select-pago') as HTMLSelectElement;
        if (metodoPagoSelect) metodoPagoSelect.focus();
      }, 0);
    } else if (inputType === 'metodo') {
      // Del método de pago: chequear qué opción está seleccionada
      setTimeout(() => {
        if (this.metodoPago === 'Transferencia') {
          // Ir al input de transferencia
          const transferInput = document.querySelector('input[placeholder*="TRF"]') as HTMLInputElement;
          if (transferInput) transferInput.focus();
        } else if (this.metodoPago === 'Tarjeta') {
          // Ir al input de tarjeta
          const tarjetaInput = document.querySelector('input[maxlength="4"]') as HTMLInputElement;
          if (tarjetaInput) tarjetaInput.focus();
        } else {
          // Si es Efectivo, ir directo a Abono
          const abonoInput = document.querySelector('input[type="number"][placeholder="0.00"]') as HTMLInputElement;
          if (abonoInput) abonoInput.focus();
        }
      }, 0);
    } else if (inputType === 'transferencia' || inputType === 'tarjeta') {
      // De transferencia o tarjeta → Abono
      setTimeout(() => {
        const abonoInput = document.querySelector('input[type="number"][placeholder="0.00"]') as HTMLInputElement;
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

  // Solo validar stock si el producto NO es ILIMITADO (ej: no es LUNAS)
  if (!esStockIlimitado) {
    // Si no hay stock disponible, no permitir agregar
    if (!isFinite(stockDisponible) || stockDisponible <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin stock',
        text: `El producto "${p.nombre}" no tiene stock disponible.`,
      });
      return;
    }
  }

  const existing = this.items.find(i => i.productoId === id);
  if (existing) {
    // Solo validar stock máximo si NO es ilimitado
    if (!esStockIlimitado && existing.cantidad >= stockDisponible) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock insuficiente',
        text: `Máximo disponible: ${stockDisponible}.`,
      });
      return;
    }
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
   */
  inicializarFechaHora(): void {
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

  recalcular() {
    // Calcular subtotal SIN IVA y el IVA desglosado
    const subtotalBruto = this.items.reduce((a: number, i: any) => a + (Number(i.totalSinIva) || 0), 0);
    this.descuentoMonto = +(subtotalBruto * (this.descuentoPorcentaje / 100)).toFixed(2);
    this.subtotal = +(subtotalBruto - this.descuentoMonto).toFixed(2);
    this.iva = this.items.reduce((a: number, i: any) => (Number(i.total) || 0) - (Number(i.totalSinIva) || 0) + a, 0);
    this.total = +(this.subtotal + this.iva).toFixed(2);
  }

async guardarEImprimir() {
  if (!this.items.length || this.guardando) return;

  // ✅ VALIDACIÓN: Si NO es crédito personal, requiere abono > 0
  if (!this.esCredito && this.abono <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Abono requerido',
      text: 'Debe ingresar un abono mayor a 0. Si desea vender a crédito personal, active esa opción.'
    });
    return;
  }

  this.guardando = true;

  try {
    // ✅ Verificar stock en tiempo real antes de guardar (solo productos con stock NORMAL)
    for (const it of this.items) {
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
    } else {
      // Para transferencia/tarjeta: usar fecha y hora seleccionadas
      console.log('💳 Usando fecha/hora seleccionadas manualmente');
      fechaFinal = this.combinarFechaHora(this.fechaPago, this.horaPago);
      console.log('✅ Fecha final TRANSFERENCIA/TARJETA combinada:', fechaFinal);
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

    // ✅ CREAR FACTURA CON DATOS DE CRÉDITO
    const factura: any = {
      clienteId: this.clienteId,
      clienteNombre: `${this.cliente?.nombres || ''} ${this.cliente?.apellidos || ''}`.trim(),
      clienteTelefono: this.cliente?.telefono || '',
      historialSnapshot: this.historial || null,

      items: this.items.map((i: any) => ({
        productoId: i.productoId,
        nombre: i.nombre,
        tipo: i.tipo,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        total: i.total,
        codigo: i.codigo,
        idInterno: i.idInterno
      })),

      subtotal: +this.subtotal.toFixed(2),
      descuentoPorcentaje: this.descuentoPorcentaje,
      descuentoMonto: +this.descuentoMonto.toFixed(2),
      iva: +this.iva.toFixed(2),
      total: +this.total.toFixed(2),

      metodoPago: this.metodoPago,
      codigoTransferencia: this.metodoPago === 'Transferencia' ? this.codigoTransferencia : undefined,
      fecha: fechaFinal,  // Firestore convertirá Date a Timestamp automáticamente
      usuarioId: 'admin',

      // ✅ NUEVO: DATOS DE CRÉDITO PERSONAL
      esCredito: this.esCredito,
      tipoVenta: this.esCredito ? 'CREDITO' : 'CONTADO',
      abonado: +abonado.toFixed(2),
      saldoPendiente,
      estadoPago: saldoPendiente > 0 ? 'PENDIENTE' : 'PAGADA',
      estadoCredito: this.esCredito && saldoPendiente > 0 ? 'ACTIVO' : 'CANCELADO'
    };

    console.log('📄 FACTURA A GUARDAR:', factura);
    console.log('📄 Fecha en factura:', factura.fecha);
    console.log('📄 Tipo de fecha:', typeof factura.fecha, factura.fecha instanceof Date);
    
    const facturaLimpia = this.cleanUndefined(factura);
    console.log('📄 FACTURA LIMPIA:', facturaLimpia);
    console.log('📄 Fecha en factura limpia:', facturaLimpia.fecha);
    console.log('📄 Tipo de fecha limpia:', typeof facturaLimpia.fecha);
    
    const ref = await this.facturasSrv.crearFactura(facturaLimpia);

    // ✅ REGISTRAR AUTOMÁTICAMENTE EN CAJA CHICA O CAJA BANCO
    const usuario = this.authService.getCurrentUser();
    const facturaId = ref.id; // ID personalizado de 10 dígitos
    
    if (this.metodoPago === 'Efectivo' && abonado > 0) {
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
    } else if (this.metodoPago === 'Tarjeta' && this.ultimosCuatroTarjeta.trim()) {
      // 💳 Venta por TARJETA → Registrar en Caja Banco
      try {
        // Registrar el monto realmente pagado (abono), no el total de la venta
        const montoPagado = this._abono > 0 ? this._abono : this.total;
        await this.cajaBancoService.registrarPagoTarjeta(
          montoPagado,
          this.ultimosCuatroTarjeta,
          facturaId,
          usuario?.id || '',
          usuario?.nombre || 'Usuario',
          fechaFinal  // Pasar la fecha seleccionada por el usuario
        );
        console.log(`✅ Pago por tarjeta registrado en Caja Banco: ${montoPagado} USD con fecha`, fechaFinal);
      } catch (err) {
        console.error('❌ Error registrando pago por tarjeta en Caja Banco:', err);
        Swal.fire({
          icon: 'warning',
          title: 'Advertencia',
          text: `La venta se registró pero hubo un error al registrar el pago por tarjeta en caja banco: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          confirmButtonText: 'Aceptar'
        });
      }
    }

    // ✅ Descontar stock de cada producto de manera segura
    for (const it of this.items) {
      try {
        await this.productosSrv.descontarStock(it.productoId, it.cantidad);
      } catch (err) {
        // Solo mostrar error si NO es un producto con stock ilimitado
        const prodActual: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));
        const tipoControl = prodActual?.tipo_control_stock || 'NORMAL';
        
        if (tipoControl !== 'ILIMITADO') {
          console.error('Error descontando stock', err);
          Swal.fire({
            icon: 'error',
            title: 'Stock no actualizado',
            text: `Ocurrió un problema al actualizar el stock del producto "${it.nombre}". Por favor verifica manualmente.`,
          });
        }
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

    // Esperar a que Angular renderice el DOM del ticket antes de imprimir
    setTimeout(() => {
      this.imprimirTicket();
    }, 200);

    // ✅ Mostrar mensaje de éxito y redirigir (después de dar tiempo a la impresión)
    setTimeout(() => {
      Swal.fire({
        icon: 'success',
        title: '¡Venta Realizada!',
        text: `La venta #${facturaId} se ha registrado correctamente.`,
        confirmButtonText: 'Continuar',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        this.router.navigate(['/clientes/historial-clinico']);
      });
    }, 1000);

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
    const ticket = document.getElementById('ticket');
    if (!ticket) {
      return;
    }

    // Abrir ventana aislada solo con el ticket para evitar que se oculte por estilos de la app
    const w = window.open('', 'PRINT', 'height=600,width=380');
    if (!w) {
      return;
    }

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

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  ngOnDestroy() {
    // Limpieza si es necesaria (el @HostListener se limpia automáticamente)
  }
}
