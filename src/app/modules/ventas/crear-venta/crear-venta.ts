import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
      return;
    }
    this.productosFiltrados = this.productos.filter(p => {
      const n = (p.nombre || '').toLowerCase();
      const tipo = (p.tipo || p.categoria || '').toLowerCase();
      return n.includes(t) || tipo.includes(t);
    });
  }

agregarProducto(p: any) {
  const id = p.id;

  // ✅ PRECIO REAL DESDE FIRESTORE
  const raw =
    p?.precios?.pvp1 ??
    p?.precios?.unidad ??
    p?.precios?.caja ??
    0;

  const precio = this.toNumber(raw);

  console.log('PRECIO USADO =>', precio, p);

  const existing = this.items.find(i => i.productoId === id);
  if (existing) {
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
    const c = Math.max(1, Number(cantidad || 1));
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
    };

    const facturaLimpia = this.cleanUndefined(factura);
const ref = await this.facturasSrv.crearFactura(facturaLimpia);


    // 🔥 CLAVE: primero setear el ticket
    this.facturaParaImprimir = {
      id: ref.id,
      ...factura,
    };

    // 🔥 CLAVE: esperar a que Angular pinte el DOM
    setTimeout(() => {
      window.print();
    }, 300);

  } catch (e) {
    console.error(e);
    alert('Error al guardar o imprimir la factura');
  } finally {
    this.guardando = false;

// ✅ imprime SOLO el ticket
document.body.classList.add('print-ticket');

// espera 1 “tick” para que Angular pinte la facturaParaImprimir
setTimeout(() => {
  window.print();
  // al terminar, quita la clase
  setTimeout(() => document.body.classList.remove('print-ticket'), 500);
}, 0);

  }
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
