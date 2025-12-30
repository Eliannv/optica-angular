import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../core/services/clientes';
import { ProductosService } from '../../../core/services/productos';
import { HistorialClinicoService } from '../../../core/services/historial-clinico.service';

import { ItemVenta } from '../../../core/models/item-venta.model';
import { Factura } from '../../../core/models/factura.model';
import { FacturasService } from '../../../core/services/facturas';

@Component({
  selector: 'app-crear-venta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-venta.html',
  styleUrls: ['./crear-venta.css'],
})
export class CrearVentaComponent implements OnInit {
  clienteId = '';
  cliente: any = null;
  historial: any = null;

  productos: any[] = [];
  filtro = '';
  productosFiltrados: any[] = [];
  selectedIndex = -1; // Para navegación con flechas
  productoSeleccionado: any = null; // Producto actualmente seleccionado

  items: any[] = []; // (tu ItemVenta ya lo usas pero aquí guardas nombre/tipo/total también)

  ivaPct = 0.15;
  subtotal = 0;
  iva = 0;
  total = 0;

  metodoPago = 'Efectivo';

  loading = true;
  guardando = false;

  // para ticket
  facturaParaImprimir: any = null;
  mostrandoVistaPrevia = false;
  abono = 0;
  saldoPendiente = 0;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientesSrv: ClientesService,
    private productosSrv: ProductosService,
    private historialSrv: HistorialClinicoService,
    private facturasSrv: FacturasService
  ) {}

  async ngOnInit() {
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
      this.filtrarProductos();
    });

    this.loading = false;
  }

  filtrarProductos() {
    const t = (this.filtro || '').trim().toLowerCase();
    if (!t) {
      this.productosFiltrados = [...this.productos];
      this.selectedIndex = -1;
      return;
    }
    this.productosFiltrados = this.productos.filter(p => {
      const n = (p.nombre || '').toLowerCase();
      const tipo = (p.tipo || p.categoria || '').toLowerCase();
      const modelo = (p.modelo || '').toLowerCase();
      const color = (p.color || '').toLowerCase();
      const codigo = (p.codigo || '').toLowerCase();
      return n.includes(t) || tipo.includes(t) || modelo.includes(t) || color.includes(t) || codigo.includes(t);
    });
    this.selectedIndex = -1;
  }


  // Navegación con teclado en búsqueda
  onSearchKeydown(event: KeyboardEvent) {
    const filtrados = this.productosFiltrados;
    if (filtrados.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, filtrados.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
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

  recalcularAbono() {
    const a = Math.max(0, Number(this.abono || 0));
    // no permitir que el abono supere el total
    this.abono = Math.min(a, this.total);
    this.saldoPendiente = +(this.total - this.abono).toFixed(2);
  }
agregarProducto(p: any) {
  const id = p.id;

  // ✅ PRECIO REAL DESDE FIRESTORE (pvp1 o costo)
  const precio = Number(p.pvp1 || p.costo || 0);
  const stockDisponible = Number(p.stock || 0);

  // Si no hay stock, no permitir agregar
  if (!isFinite(stockDisponible) || stockDisponible <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Sin stock',
      text: `El producto "${p.nombre}" no tiene stock disponible.`,
    });
    return;
  }

  const existing = this.items.find(i => i.productoId === id);
  if (existing) {
    if (existing.cantidad >= stockDisponible) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock insuficiente',
        text: `Máximo disponible: ${stockDisponible}.`,
      });
      return;
    }
    existing.cantidad++;
    existing.total = existing.cantidad * existing.precioUnitario;
  } else {
    this.items.push({
      productoId: id,
      nombre: p.nombre,
      tipo: p.tipo || p.categoria || p.grupo,
      cantidad: 1,
      precioUnitario: precio,
      total: precio,
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
    this.recalcular();
  }

  quitar(it: any) {
    this.items = this.items.filter((x: any) => x !== it);
    this.recalcular();
  }

  recalcular() {
    this.subtotal = this.items.reduce((a: number, i: any) => a + (Number(i.total) || 0), 0);
    this.iva = +(this.subtotal * this.ivaPct).toFixed(2);
    this.total = +(this.subtotal + this.iva).toFixed(2);
  }

async guardarEImprimir() {
  if (!this.items.length || this.guardando) return;

  this.guardando = true;

  try {
    // ✅ Verificar stock en tiempo real antes de guardar
    for (const it of this.items) {
      const prodActual: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));
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

    const abonado = Math.min(Math.max(0, Number(this.abono || 0)), this.total);
const saldoPendiente = +(this.total - abonado).toFixed(2);

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
  })),

  subtotal: +this.subtotal.toFixed(2),
  iva: +this.iva.toFixed(2),
  total: +this.total.toFixed(2),

  metodoPago: this.metodoPago,
  fecha: new Date(),
  usuarioId: 'admin',

  // ✅ NUEVO
  tipoVenta: saldoPendiente > 0 ? 'CREDITO' : 'CONTADO',
  abonado: +abonado.toFixed(2),
  saldoPendiente,
  estadoPago: saldoPendiente > 0 ? 'PENDIENTE' : 'PAGADA',
};

    const facturaLimpia = this.cleanUndefined(factura);
const ref = await this.facturasSrv.crearFactura(facturaLimpia);

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

    // Setear datos de la factura para vista previa
    this.facturaParaImprimir = {
      id: ref.id,
      ...factura,
    };

    // Mostrar vista previa en lugar de imprimir directamente
    this.mostrandoVistaPrevia = true;

  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'Error al guardar o imprimir la factura', 'error');
  } finally {
    this.guardando = false;
  }
}

  imprimirAhora() {
    window.print();
    this.cerrarVistaPrevia();
  }

  cerrarVistaPrevia() {
    this.mostrandoVistaPrevia = false;
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
      window.print();
      return;
    }

    // ✅ abrimos ventana solo con el ticket para imprimir (lo más confiable)
    const w = window.open('', 'PRINT', 'height=600,width=380');
    if (!w) {
      window.print();
      return;
    }

    w.document.write(`
      <html>
        <head>
          <title>Ticket</title>
          <style>
            body { margin: 0; padding: 0; font-family: monospace; }
            .ticket { padding: 10px; font-size: 12px; }
            .t-center { text-align: center; }
            .t-right { text-align: right; }
            .t-bold { font-weight: 700; }
            .t-line { border-top: 1px dashed #000; margin: 8px 0; }
            .t-row { display: flex; justify-content: space-between; gap: 8px; }
            .t-cut { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .t-space { height: 10px; }
            @media print {
              @page { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${ticket.outerHTML}
        </body>
      </html>
    `);

    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}
