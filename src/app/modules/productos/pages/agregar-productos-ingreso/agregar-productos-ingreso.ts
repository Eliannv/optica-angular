import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Ingreso, DetalleIngreso } from '../../../../core/models/ingreso.model';
import { Producto } from '../../../../core/models/producto.model';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProductosService } from '../../../../core/services/productos';

@Component({
  selector: 'app-agregar-productos-ingreso',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './agregar-productos-ingreso.html',
  styleUrls: ['./agregar-productos-ingreso.css'],
})
export class AgregarProductosIngresoComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private ingresosService = inject(IngresosService);
  private productosService = inject(ProductosService);

  // Señales
  ingresoId = signal<string>('');
  ingreso = signal<Ingreso | null>(null);
  detalles = signal<DetalleIngreso[]>([]);
  productos = signal<Producto[]>([]);
  productosFiltrados = signal<Producto[]>([]);
  modoAgregar = signal<'EXISTENTE' | 'NUEVO' | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);
  busqueda = signal('');
  proximoIdInterno = signal<number | null>(null);
  productoSeleccionado = signal<Producto | null>(null);

  // Formularios
  formProductoExistente!: FormGroup;
  formProductoNuevo!: FormGroup;

  ngOnInit() {
    // Obtener ID del ingreso de la ruta
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ingresoId.set(id);
      this.cargarIngreso(id);
      this.cargarProductos();
    }

    // Inicializar formularios
    this.initForms();
    
    // Cargar próximo ID interno
    this.cargarProximoId();
  }

  initForms() {
    // Formulario para agregar producto existente
    this.formProductoExistente = this.fb.group({
      productoId: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      costoUnitario: [0, Validators.min(0)],
      observacion: [''],
    });

    // Formulario para crear producto nuevo
    this.formProductoNuevo = this.fb.group({
      nombre: ['', Validators.required],
      modelo: [''],
      color: [''],
      grupo: [''],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      costoUnitario: [0, Validators.min(0)],
      pvp1: [0, Validators.min(0)],
      observacion: [''],
    });
  }

  async cargarProximoId(): Promise<void> {
    try {
      const counterDoc = await this.productosService.getCounterDoc();
      this.proximoIdInterno.set(counterDoc ? counterDoc + 1 : 1);
    } catch (error) {
      console.error('Error al cargar próximo ID:', error);
      this.proximoIdInterno.set(1);
    }
  }

  async cargarIngreso(id: string) {
    this.ingresosService.getIngresoById(id).subscribe({
      next: (ingreso) => this.ingreso.set(ingreso),
      error: (err) => {
        console.error('Error al cargar ingreso:', err);
        this.error.set('Error al cargar el ingreso');
      },
    });
  }

  cargarProductos() {
    this.productosService.getProductos().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.productosFiltrados.set(productos);
      },
      error: (err) => console.error('Error al cargar productos:', err),
    });
  }

  buscarProducto() {
    const termino = this.busqueda().toLowerCase();
    if (!termino) {
      this.productosFiltrados.set(this.productos());
      return;
    }

    const filtrados = this.productos().filter(
      (p) =>
        p.nombre?.toLowerCase().includes(termino) ||
        p.modelo?.toLowerCase().includes(termino) ||
        p.codigo?.toLowerCase().includes(termino)
    );
    this.productosFiltrados.set(filtrados);
  }

  seleccionarProductoExistente(producto: Producto) {
    this.modoAgregar.set('EXISTENTE');
    this.productoSeleccionado.set(producto);
    this.formProductoExistente.patchValue({
      productoId: producto.id,
      costoUnitario: producto.costo || 0,
    });
  }

  cancelarSeleccion() {
    this.productoSeleccionado.set(null);
    this.formProductoExistente.reset({ cantidad: 1, costoUnitario: 0 });
    this.busqueda.set('');
  }

  agregarProductoExistente() {
    if (this.formProductoExistente.invalid) return;

    const valores = this.formProductoExistente.value;
    const producto = this.productos().find((p) => p.id === valores.productoId);

    if (!producto) return;

    const detalle: DetalleIngreso = {
      id: Date.now().toString(),
      productoId: producto.id,
      tipo: 'EXISTENTE',
      nombre: producto.nombre,
      modelo: producto.modelo,
      color: producto.color,
      grupo: producto.grupo,
      codigo: producto.codigo,
      cantidad: valores.cantidad,
      costoUnitario: valores.costoUnitario,
      observacion: valores.observacion,
    };

    this.detalles.update((list) => [...list, detalle]);
    this.formProductoExistente.reset({ cantidad: 1, costoUnitario: 0 });
    this.productoSeleccionado.set(null);
    this.modoAgregar.set(null);
    this.busqueda.set('');
  }

  agregarProductoNuevo() {
    if (this.formProductoNuevo.invalid) return;

    const valores = this.formProductoNuevo.value;

    const detalle: DetalleIngreso = {
      id: Date.now().toString(),
      tipo: 'NUEVO',
      nombre: valores.nombre,
      modelo: valores.modelo,
      color: valores.color,
      grupo: valores.grupo,
      cantidad: valores.cantidad,
      costoUnitario: valores.costoUnitario,
      pvp1: valores.pvp1,
      observacion: valores.observacion,
      stockInicial: valores.cantidad, // El stock inicial es la cantidad ingresada
    };

    this.detalles.update((list) => [...list, detalle]);
    this.formProductoNuevo.reset({ cantidad: 1, costoUnitario: 0, pvp1: 0 });
    this.modoAgregar.set(null);
    
    // Actualizar el próximo ID
    this.cargarProximoId();
  }

  eliminarDetalle(id: string) {
    this.detalles.update((list) => list.filter((d) => d.id !== id));
  }

  calcularTotal(): number {
    return this.detalles().reduce(
      (total, d) => total + (d.costoUnitario || 0) * d.cantidad,
      0
    );
  }

  async finalizar() {
    if (this.detalles().length === 0) {
      this.error.set('Debes agregar al menos un producto');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    try {
      await this.ingresosService.finalizarIngreso(
        this.ingresoId(),
        this.detalles()
      );
      
      alert('¡Ingreso finalizado exitosamente!');
      this.router.navigate(['/productos']);
    } catch (err: any) {
      console.error('Error al finalizar ingreso:', err);
      this.error.set('Error al finalizar el ingreso. Intenta nuevamente.');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() {
    if (confirm('¿Deseas cancelar? Se perderán los cambios no guardados.')) {
      this.router.navigate(['/productos']);
    }
  }
}
