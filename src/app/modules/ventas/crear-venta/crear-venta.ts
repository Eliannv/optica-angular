import { Cliente } from './../../../core/models/cliente.model';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

export interface VentaItem {
  productoId: string;
  nombre: string;
  tipo: string;
  precio: number;
  cantidad: number;
  total: number;
}

export interface Venta {
  clienteId: string;
  clienteNombre: string;
  historialSnapshot: any;
  items: VentaItem[];
  subtotal: number;
  iva: number;
  total: number;
}



import { ClientesService } from '../../../core/services/clientes';
import { HistorialClinicoService } from '../../../core/services/historial-clinico.service';
import { ProductosService } from '../../../core/services/productos';
import { VentasService } from '../../../core/services/ventas.service';

@Component({
  selector: 'app-crear-venta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-venta.html',
  styleUrl: './crear-venta.css'
})
export class CrearVentaComponent implements OnInit {

  clienteId = '';
  cliente: any = null;
  historial: any = null;

  productos: any[] = [];
  filtroProducto = '';
  productosFiltrados: any[] = [];

  items: VentaItem[] = [];

  ivaPct = 0.15; // Ecuador 15% (ajústalo si toca)
  subtotal = 0;
  iva = 0;
  total = 0;

  loading = true;
  guardando = false;

  // ticket
  ventaGuardada: any = null; // guardamos para imprimir

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientesSrv: ClientesService,
    private historialSrv: HistorialClinicoService,
    private productosSrv: ProductosService,
    private ventasSrv: VentasService
  ) {}

  async ngOnInit() {
    // ✅ recibimos clienteId por query (?clienteId=xxx) o por param si prefieres
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';

    if (!this.clienteId) {
      // si no hay cliente, manda a pantalla donde eliges cliente
      this.router.navigate(['/clientes/historial-clinico']);
      return;
    }

    // cliente
    this.clientesSrv.getClienteById(this.clienteId).subscribe(c => {
      this.cliente = c;
    });

    // historial
    const snap = await this.historialSrv.obtenerHistorial(this.clienteId);
    this.historial = snap.exists() ? snap.data() : null;

    // productos (marcos + lunas están aquí)
    this.productosSrv.getProductos().subscribe((prods: any[]) => {
      this.productos = prods || [];
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
      const nombre = (p.nombre || '').toLowerCase();
      const tipo = (p.tipo || p.categoria || '').toLowerCase();
      return nombre.includes(t) || tipo.includes(t);
    });
  }

  agregarProducto(p: any) {
    const id = p.id;
    const precio = Number(p.precio || 0);

    const existing = this.items.find(i => i.productoId === id);
    if (existing) {
      existing.cantidad += 1;
      existing.total = existing.cantidad * existing.precio;
    } else {
      this.items.push({
        productoId: id,
        nombre: p.nombre,
        tipo: p.tipo || p.categoria, // como lo guardes
        precio,
        cantidad: 1,
        total: precio
      });
    }

    this.recalcular();
  }

  quitarItem(item: VentaItem) {
    this.items = this.items.filter(i => i !== item);
    this.recalcular();
  }

  cambiarCantidad(item: VentaItem, cantidad: number) {
    const c = Math.max(1, Number(cantidad || 1));
    item.cantidad = c;
    item.total = item.cantidad * item.precio;
    this.recalcular();
  }

  private recalcular() {
    this.subtotal = this.items.reduce((acc, i) => acc + i.total, 0);
    this.iva = +(this.subtotal * this.ivaPct).toFixed(2);
    this.total = +(this.subtotal + this.iva).toFixed(2);
  }

  async guardarVenta() {
    if (!this.cliente) return;
    if (!this.items.length) return;

    this.guardando = true;

    const venta: Venta = {
      clienteId: this.clienteId,
      clienteNombre: `${this.cliente.nombres || ''} ${this.cliente.apellidos || ''}`.trim(),
      historialSnapshot: this.historial || null,
      items: this.items,
      subtotal: +this.subtotal.toFixed(2),
      iva: +this.iva.toFixed(2),
      total: +this.total.toFixed(2)
    };

    const docRef = await this.ventasSrv.crearVenta(venta);

    // para imprimir
    this.ventaGuardada = {
      id: docRef.id,
      ...venta,
      fecha: new Date()
    };

    this.guardando = false;

    // opcional: imprimir al guardar
    this.imprimirTicket();
  }

  imprimirTicket() {
    // Esto imprime la página actual con CSS @media print
    window.print();
  }

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}
