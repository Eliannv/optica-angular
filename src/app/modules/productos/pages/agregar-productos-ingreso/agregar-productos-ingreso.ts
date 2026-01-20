import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Ingreso, DetalleIngreso } from '../../../../core/models/ingreso.model';
import { Producto } from '../../../../core/models/producto.model';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProductosService } from '../../../../core/services/productos';
import Swal from 'sweetalert2';

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
  selectedIndex = signal<number>(-1); // Para navegación con flechas en búsqueda

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
      pvp1: [0, Validators.min(0)], // Nuevo: PVP1 para actualizar precio de venta
      observacion: [''],
    });

    // Formulario para crear producto nuevo con lógica reactiva
    this.formProductoNuevo = this.fb.group({
      nombre: ['', Validators.required],
      modelo: [''],
      color: [''],
      grupo: [''],
      stock: [1, [Validators.required, Validators.min(1)]],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      costoUnitario: [0, Validators.min(0)],
      pvp1: [0, Validators.min(0)],
      iva: [0, [Validators.min(0), Validators.max(100)]], // Agregar campo IVA
      observacion: [''],
    });

    // Lógica reactiva: sincronizar stock con cantidad
    this.formProductoNuevo.get('cantidad')?.valueChanges.subscribe((cantidad) => {
      this.formProductoNuevo.patchValue({ stock: cantidad }, { emitEvent: false });
    });

    this.formProductoNuevo.get('stock')?.valueChanges.subscribe((stock) => {
      this.formProductoNuevo.patchValue({ cantidad: stock }, { emitEvent: false });
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
    // Si es un ingreso temporal (creado hace poco), usar el almacenado en memoria
    if (id.startsWith('temp_')) {
      const ingresoTemporal = this.ingresosService.obtenerIngresoTemporal();
      if (ingresoTemporal) {
        this.ingreso.set(ingresoTemporal);
        return;
      }
    }
    
    // Si no es temporal, cargar desde BD
    this.ingresosService.getIngresoById(id).subscribe({
      next: (ingreso) => this.ingreso.set(ingreso),
      error: (err) => {
        console.error('Error al cargar ingreso:', err);
        this.error.set('Error al cargar el ingreso');
      },
    });
  }

  cargarProductos() {
    // 🔹 Cargar TODOS los productos (activos e inactivos)
    this.productosService.getProductosTodosInclusoInactivos().subscribe({
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
      this.selectedIndex.set(-1);
      return;
    }

    const filtrados = this.productos().filter(
      (p) =>
        p.nombre?.toLowerCase().includes(termino) ||
        p.modelo?.toLowerCase().includes(termino) ||
        p.codigo?.toLowerCase().includes(termino)
    );
    this.productosFiltrados.set(filtrados);
    this.selectedIndex.set(-1);
  }

  // Navegación con teclado en búsqueda
  onSearchKeydown(event: KeyboardEvent) {
    const filtrados = this.productosFiltrados();
    if (filtrados.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const newIndex = Math.min(this.selectedIndex() + 1, filtrados.length - 1);
      this.selectedIndex.set(newIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const newIndex = Math.max(this.selectedIndex() - 1, 0);
      this.selectedIndex.set(newIndex);
    } else if (event.key === 'Enter' && this.selectedIndex() >= 0) {
      event.preventDefault();
      this.seleccionarProductoExistente(filtrados[this.selectedIndex()]);
    }
  }

  // Navegar al siguiente campo con Enter
  focusNext(event: Event, nextId: string) {
    event.preventDefault();
    const nextElement = document.getElementById(nextId);
    if (nextElement) {
      nextElement.focus();
    }
  }

  // Manejar Enter en textareas (permitir saltos de línea, Ctrl+Enter para siguiente campo)
  onTextareaKeydown(event: KeyboardEvent, nextId: string) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      const nextElement = document.getElementById(nextId);
      if (nextElement) {
        nextElement.focus();
      }
    }
  }

  // Trigger para agregar con Enter desde el último campo
  submitOnEnter(event: Event, callback: () => void) {
    event.preventDefault();
    callback();
  }

  seleccionarProductoExistente(producto: Producto) {
    this.modoAgregar.set('EXISTENTE');
    this.productoSeleccionado.set(producto);
    this.formProductoExistente.patchValue({
      productoId: producto.id,
      costoUnitario: producto.costo || 0,
    });
    this.selectedIndex.set(-1);
    
    // Enfocar en el campo de cantidad
    setTimeout(() => {
      const cantidadInput = document.getElementById('existenteCantidad');
      if (cantidadInput) cantidadInput.focus();
    }, 100);
  }

  cancelarSeleccion() {
    this.productoSeleccionado.set(null);
    this.formProductoExistente.reset({ cantidad: 1, costoUnitario: 0, pvp1: 0 });
    this.busqueda.set('');
  }

  agregarProductoExistente() {
    if (this.formProductoExistente.invalid) return;

    const valores = this.formProductoExistente.value;
    const producto = this.productos().find((p) => p.id === valores.productoId);

    if (!producto) return;

    // 🔹 Detectar si el producto está desactivado
    const estaDesactivado = producto.activo === false;

    const detalle: DetalleIngreso = {
      id: Date.now().toString(),
      productoId: producto.id,
      tipo: 'EXISTENTE',
      nombre: producto.nombre,
      cantidad: valores.cantidad,
      costoUnitario: valores.costoUnitario,
      estaDesactivado: estaDesactivado, // 🔹 Pasar flag de desactivación
    };

    // Agregar campos opcionales solo si existen
    if (producto.modelo) detalle.modelo = producto.modelo;
    if (producto.color) detalle.color = producto.color;
    if (producto.grupo) detalle.grupo = producto.grupo;
    if (producto.codigo) detalle.codigo = producto.codigo;
    
    // NUEVO: Agregar PVP1 si se especifica para actualizar precio de venta
    if (valores.pvp1 && valores.pvp1 > 0) {
      detalle.pvp1 = valores.pvp1;
    }
    
    // 🔹 Si está desactivado, guardar stock anterior para suma posterior
    if (estaDesactivado) {
      detalle.stockActivoAnterior = producto.stock || 0;
    }
    
    // IMPORTANTE: Agregar observación SIEMPRE, incluso si está vacía
    detalle.observacion = valores.observacion || '';

    this.detalles.update((list) => [...list, detalle]);
    this.formProductoExistente.reset({ cantidad: 1, costoUnitario: 0, pvp1: 0, observacion: '' });
    this.productoSeleccionado.set(null);
    this.busqueda.set('');
    
    // Enfocar nuevamente en el buscador
    setTimeout(() => {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.focus();
    }, 100);
  }

  agregarProductoNuevo() {
    if (this.formProductoNuevo.invalid) return;

    const valores = this.formProductoNuevo.value;

    const detalle: DetalleIngreso = {
      id: Date.now().toString(),
      tipo: 'NUEVO',
      nombre: valores.nombre,
      cantidad: valores.stock || valores.cantidad,
      costoUnitario: valores.costoUnitario || 0,
      stockInicial: valores.stock || valores.cantidad,
    };

    // Agregar campos opcionales solo si existen
    if (valores.modelo) detalle.modelo = valores.modelo;
    if (valores.color) detalle.color = valores.color;
    if (valores.grupo) detalle.grupo = valores.grupo;
    if (valores.pvp1) detalle.pvp1 = valores.pvp1;
    if (valores.iva) detalle.iva = valores.iva; // Agregar IVA
    // IMPORTANTE: Agregar observación SIEMPRE, incluso si está vacía
    detalle.observacion = valores.observacion || '';

    this.detalles.update((list) => [...list, detalle]);
    this.formProductoNuevo.reset({ cantidad: 1, stock: 1, costoUnitario: 0, pvp1: 0, observacion: '' });
    this.modoAgregar.set(null);
    
    // Actualizar el próximo ID y enfocar en el primer campo
    this.cargarProximoId();
    setTimeout(() => {
      const firstInput = document.getElementById('nuevoNombre');
      if (firstInput) firstInput.focus();
    }, 100);
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
      let ingresoId = this.ingresoId();
      
      // Si es un ingreso temporal, crear en BD AHORA
      if (ingresoId.startsWith('temp_')) {
        const ingresoTemporal = this.ingreso();
        if (!ingresoTemporal) {
          throw new Error('No hay datos de ingreso');
        }
        // Crear el ingreso en BD
        ingresoId = await this.ingresosService.crearIngresoBorrador(ingresoTemporal);
        this.ingresoId.set(ingresoId);
        // Limpiar temporal
        this.ingresosService.limpiarIngresoTemporal();
      }

      console.log('📋 Detalles enviados a finalizar:', this.detalles());
      
      await this.ingresosService.finalizarIngreso(
        ingresoId,
        this.detalles()
      );
      
      Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: 'Ingreso finalizado exitosamente',
        showConfirmButton: false,
        timer: 1500
      }).then(() => {
        this.router.navigate(['/productos']);
      });
    } catch (err: any) {
      console.error('Error al finalizar ingreso:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al finalizar el ingreso. Intenta nuevamente.',
        confirmButtonColor: '#3085d6'
      });
      this.error.set('Error al finalizar el ingreso. Intenta nuevamente.');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() {
    Swal.fire({
      title: '¿Cancelar ingreso?',
      text: '¿Deseas cancelar? Se perderán los cambios no guardados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Continuar editando'
    }).then((result) => {
      if (result.isConfirmed) {
        // Limpiar ingreso temporal si existe
        this.ingresosService.limpiarIngresoTemporal();
        this.router.navigate(['/productos']);
      }
    });
  }
}
