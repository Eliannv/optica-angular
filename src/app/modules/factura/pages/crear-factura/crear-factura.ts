import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesService } from '../../../../core/services/clientes';
import { ProductosService } from '../../../../core/services/productos';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';

import { Factura } from '../../../../core/models/factura.model';
import { ItemVenta } from '../../../../core/models/item-venta.model';
import { FacturasService } from '../../../../core/services/facturas';

@Component({
  selector: 'app-crear-factura',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-factura.html',
  styleUrl: './crear-factura.css'
})
export class CrearFacturaComponent implements OnInit {

  clienteId = '';
  cliente: any = null;
  historial: any = null;

  productos: any[] = [];
  filtroProducto = '';
  productosFiltrados: any[] = [];

  items: ItemVenta[] = [];

  ivaPct = 0.15;
  subtotal = 0;
  iva = 0;
  total = 0;

  metodoPago = 'Efectivo';

  loading = true;
  guardando = false;

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
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';
    if (!this.clienteId) {
      this.router.navigate(['/clientes/historial-clinico']);
      return;
    }

    // cliente
    this.cliente = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));

    // historial (snapshot)
    const snap = await this.historialSrv.obtenerHistorial(this.clienteId);
    this.historial = snap.exists() ? snap.data() : null;

    // productos
    this.productosSrv.getProductos().subscribe((data: any[]) => {
      this.productos = data || [];
      this.aplicarFiltroProductos();
    });

    this.loading = false;
  }

  aplicarFiltroProductos() {
    const t = (this.filtroProducto || '').trim().toLowerCase();
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
    const precio = Number(p.precio || 0);

    const existing = this.items.find(i => i.productoId === id);
    if (existing) {
      existing.cantidad++;
      existing.total = existing.cantidad * existing.precioUnitario;
    } else {
      this.items.push({
        productoId: id,
        nombre: p.nombre,
        tipo: p.tipo || p.categoria,
        cantidad: 1,
        precioUnitario: precio,
        total: precio
      });
    }

    this.recalcular();
  }

  cambiarCantidad(it: ItemVenta, cantidad: number) {
    const c = Math.max(1, Number(cantidad || 1));
    it.cantidad = c;
    it.total = it.cantidad * it.precioUnitario;
    this.recalcular();
  }

  quitarItem(it: ItemVenta) {
    this.items = this.items.filter(x => x !== it);
    this.recalcular();
  }

  private recalcular() {
    this.subtotal = this.items.reduce((a, i) => a + i.total, 0);
    this.iva = +(this.subtotal * this.ivaPct).toFixed(2);
    this.total = +(this.subtotal + this.iva).toFixed(2);
  }

  async guardarYImprimir() {
    if (!this.items.length) return;

    this.guardando = true;

    const factura: Omit<Factura, 'id'> = {
      clienteId: this.clienteId,
      clienteNombre: `${this.cliente.nombres || ''} ${this.cliente.apellidos || ''}`.trim(),
      historialSnapshot: this.historial || null,
      items: this.items,
      subtotal: +this.subtotal.toFixed(2),
      iva: +this.iva.toFixed(2),
      total: +this.total.toFixed(2),
      metodoPago: this.metodoPago,
      fecha: new Date(), // se reemplaza en firestore por serverTimestamp
      usuarioId: 'admin' // pon aquí tu auth user id luego
    };

    const ref = await this.facturasSrv.crearFactura(factura);

    this.facturaParaImprimir = {
      id: ref.id,
      ...factura,
      fecha: new Date()
    };

    this.guardando = false;

    window.print();
  }

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}

