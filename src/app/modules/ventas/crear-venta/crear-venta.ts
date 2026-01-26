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
  descuentoPorcentaje = 0; // Descuento por porcentaje
  descuentoMonto = 0; // Monto del descuento calculado
  subtotal = 0;
  iva = 0;
  total = 0;

  metodoPago = 'Efectivo';
  codigoTransferencia = ''; // Código de transferencia bancaria
  ultimosCuatroTarjeta = ''; // Últimos 4 dígitos de la tarjeta

  // ✅ CRÉDITO PERSONAL
  esCredito = false; // Checkbox para venta a crédito personal

  loading = true;
  guardando = false;

  // para ticket
  facturaParaImprimir: any = null;
  abono = 0;
  saldoPendiente = 0;
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
    // 🔒 VALIDACIÓN CRÍTICA: Verificar estado detallado de caja chica para hoy
    try {
      const validacion = await this.cajaChicaService.validarCajaChicaHoy();
      
      // ✅ Caja ABIERTA - Permitir entrada
      if (validacion.valida && validacion.tipo === 'ABIERTA') {
        // Continuamos con la carga normal
      } 
      // ❌ Caja CERRADA - Bloquear con mensaje específico
      else if (validacion.tipo === 'CERRADA') {
        let fechaDisplay = 'hoy';
        if (validacion.caja?.fecha) {
          try {
            const fecha = validacion.caja.fecha instanceof Date ? validacion.caja.fecha : (validacion.caja.fecha as any).toDate?.() || new Date(validacion.caja.fecha);
            if (!isNaN(fecha.getTime())) {
              fechaDisplay = fecha.toLocaleDateString('es-ES');
            }
          } catch (e) {
            fechaDisplay = 'hoy';
          }
        }
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica Cerrada',
          text: `La caja chica de ${fechaDisplay} ya fue cerrada. No se pueden crear ventas con una caja cerrada.`,
          confirmButtonText: 'Abrir Nueva Caja Chica',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/caja-chica']);
        });
        return;
      }
      // ❌ NO EXISTE caja para hoy - Bloquear con indicación de crear
      else {
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica No Encontrada',
          text: 'No hay una caja chica abierta para hoy. Debe crear una caja chica antes de poder registrar ventas.',
          confirmButtonText: 'Crear Caja Chica',
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
    const a = Math.max(0, Number(this.abono || 0));
    // no permitir que el abono supere el total
    this.abono = Math.min(a, this.total);
    this.saldoPendiente = +(this.total - this.abono).toFixed(2);
  }

  cambiarDescuento() {
    // Validar que el descuento no sea negativo ni mayor a 100
    this.descuentoPorcentaje = Math.max(0, Math.min(100, Number(this.descuentoPorcentaje || 0)));
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
  }

  quitar(it: any) {
    this.items = this.items.filter((x: any) => x !== it);
    this.recalcular();
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

    // ✅ CREAR FACTURA CON DATOS DE CRÉDITO
    const factura: any = {
      clienteId: this.clienteId,
      clienteNombre: `${this.cliente?.nombres || ''} ${this.cliente?.apellidos || ''}`.trim(),
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
      fecha: new Date(),
      usuarioId: 'admin',

      // ✅ NUEVO: DATOS DE CRÉDITO PERSONAL
      esCredito: this.esCredito,
      tipoVenta: this.esCredito ? 'CREDITO' : 'CONTADO',
      abonado: +abonado.toFixed(2),
      saldoPendiente,
      estadoPago: saldoPendiente > 0 ? 'PENDIENTE' : 'PAGADA',
      estadoCredito: this.esCredito && saldoPendiente > 0 ? 'ACTIVO' : 'CANCELADO'
    };

    const facturaLimpia = this.cleanUndefined(factura);
    const ref = await this.facturasSrv.crearFactura(facturaLimpia);

    // ✅ REGISTRAR AUTOMÁTICAMENTE EN CAJA CHICA O CAJA BANCO
    const usuario = this.authService.getCurrentUser();
    const facturaId = ref.id; // ID personalizado de 10 dígitos
    
    if (this.metodoPago === 'Efectivo' && abonado > 0) {
      // 💵 Venta en EFECTIVO → Registrar en Caja Chica (solo lo que se pagó)
      try {
        // Obtener de localStorage la caja abierta
        const cajaAbiertaId = localStorage.getItem('cajaChicaAbierta');
        if (cajaAbiertaId) {
          const movimiento: any = {
            caja_chica_id: cajaAbiertaId,
            fecha: new Date(),
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
          
          await this.cajaChicaService.registrarMovimiento(cajaAbiertaId, movimiento);
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
        await this.cajaBancoService.registrarTransferenciaCliente(
          this.total,
          this.codigoTransferencia,
          facturaId,
          usuario?.id || '',
          usuario?.nombre || 'Usuario'
        );
        console.log('✅ Transferencia registrada en Caja Banco');
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
        await this.cajaBancoService.registrarPagoTarjeta(
          this.total,
          this.ultimosCuatroTarjeta,
          facturaId,
          usuario?.id || '',
          usuario?.nombre || 'Usuario'
        );
        console.log('✅ Pago por tarjeta registrado en Caja Banco');
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
        console.error('Error descontando stock', err);
        Swal.fire({
          icon: 'error',
          title: 'Stock no actualizado',
          text: `Ocurrió un problema al actualizar el stock del producto "${it.nombre}". Por favor verifica manualmente.`,
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

    // Imprimir sin mostrar vista previa
    setTimeout(() => this.imprimirTicket(), 0);

    // ✅ Mostrar mensaje de éxito y redirigir
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

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  ngOnDestroy() {
    // Limpieza si es necesaria (el @HostListener se limpia automáticamente)
  }
}
