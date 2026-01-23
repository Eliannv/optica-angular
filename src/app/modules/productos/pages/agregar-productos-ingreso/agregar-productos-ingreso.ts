import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Ingreso, DetalleIngreso } from '../../../../core/models/ingreso.model';
import { Producto } from '../../../../core/models/producto.model';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProductosService } from '../../../../core/services/productos';
import Swal from 'sweetalert2';

/**
 * Componente para agregar productos a un ingreso existente
 * 
 * @description
 * Permite agregar productos existentes del inventario o crear nuevos productos
 * durante el proceso de ingreso. Soporta navegación por teclado (Enter, flechas),
 * búsqueda en tiempo real, y manejo de productos desactivados.
 * 
 * @example
 * ```html
 * <app-agregar-productos-ingreso></app-agregar-productos-ingreso>
 * ```
 */
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
  selectedIndex = signal<number>(-1);

  formProductoExistente!: FormGroup;
  formProductoNuevo!: FormGroup;

  /**
   * Inicializa el componente y carga datos del ingreso
   * 
   * @description
   * Obtiene el ID del ingreso desde la URL, carga su información y los productos disponibles.
   * Inicializa los formularios reactivos y obtiene el próximo ID interno para nuevos productos.
   */
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ingresoId.set(id);
      this.cargarIngreso(id);
      this.cargarProductos();
    }

    this.initForms();
    this.cargarProximoId();
  }

  /**
   * Inicializa los formularios reactivos con validaciones
   * 
   * @private
   * @description
   * Crea formProductoExistente y formProductoNuevo con sus respectivas validaciones.
   * Sincroniza stock con cantidad en el formulario de producto nuevo.
   */
  initForms() {
    this.formProductoExistente = this.fb.group({
      productoId: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      costoUnitario: [0, Validators.min(0)],
      pvp1: [0, Validators.min(0)],
      observacion: [''],
    });

    this.formProductoNuevo = this.fb.group({
      nombre: ['', Validators.required],
      modelo: [''],
      color: [''],
      grupo: [''],
      stock: [1, [Validators.required, Validators.min(1)]],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      costoUnitario: [0, Validators.min(0)],
      pvp1: [0, Validators.min(0)],
      iva: [0, [Validators.min(0), Validators.max(100)]],
      observacion: [''],
    });

    this.formProductoNuevo.get('cantidad')?.valueChanges.subscribe((cantidad) => {
      this.formProductoNuevo.patchValue({ stock: cantidad }, { emitEvent: false });
    });

    this.formProductoNuevo.get('stock')?.valueChanges.subscribe((stock) => {
      this.formProductoNuevo.patchValue({ cantidad: stock }, { emitEvent: false });
    });
  }

  /**
   * Obtiene el próximo ID interno disponible para un nuevo producto
   * 
   * @private
   */
  async cargarProximoId(): Promise<void> {
    try {
      const counterDoc = await this.productosService.getCounterDoc();
      this.proximoIdInterno.set(counterDoc ? counterDoc + 1 : 1);
    } catch (error) {
      console.error('Error al cargar próximo ID:', error);
      this.proximoIdInterno.set(1);
    }
  }

  /**
   * Carga la información del ingreso desde Firestore o desde memoria temporal
   * 
   * @param id - ID del ingreso (puede ser temporal con prefijo 'temp_')
   * 
   * @private
   */
  async cargarIngreso(id: string) {
    if (id.startsWith('temp_')) {
      const ingresoTemporal = this.ingresosService.obtenerIngresoTemporal();
      if (ingresoTemporal) {
        this.ingreso.set(ingresoTemporal);
        return;
      }
    }
    
    this.ingresosService.getIngresoById(id).subscribe({
      next: (ingreso) => this.ingreso.set(ingreso),
      error: (err) => {
        console.error('Error al cargar ingreso:', err);
        this.error.set('Error al cargar el ingreso');
      },
    });
  }

  /**
   * Carga todos los productos (activos e inactivos) desde Firestore
   * 
   * @private
   */
  cargarProductos() {
    this.productosService.getProductosTodosInclusoInactivos().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.productosFiltrados.set(productos);
      },
      error: (err) => console.error('Error al cargar productos:', err),
    });
  }

  /**
   * Filtra productos en tiempo real según el término de búsqueda
   * 
   * @description
   * Busca coincidencias en nombre, modelo y código del producto.
   * Resetea el índice de selección al actualizar los resultados.
   */
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

  /**
   * Maneja la navegación por teclado en el campo de búsqueda
   * 
   * @param event - Evento de teclado
   * 
   * @description
   * Permite navegar entre resultados con flechas arriba/abajo y seleccionar con Enter.
   */
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

  /**
   * Enfoca el siguiente campo del formulario al presionar Enter
   * 
   * @param event - Evento de teclado
   * @param nextId - ID del siguiente elemento a enfocar
   */
  focusNext(event: Event, nextId: string) {
    event.preventDefault();
    const nextElement = document.getElementById(nextId);
    if (nextElement) {
      nextElement.focus();
    }
  }

  /**
   * Maneja Enter en textareas (Ctrl+Enter navega al siguiente campo)
   * 
   * @param event - Evento de teclado
   * @param nextId - ID del siguiente elemento
   */
  onTextareaKeydown(event: KeyboardEvent, nextId: string) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      const nextElement = document.getElementById(nextId);
      if (nextElement) {
        nextElement.focus();
      }
    }
  }

  /**
   * Ejecuta un callback al presionar Enter
   * 
   * @param event - Evento del formulario
   * @param callback - Función a ejecutar
   */
  submitOnEnter(event: Event, callback: () => void) {
    event.preventDefault();
    callback();
  }

  /**
   * Selecciona un producto existente para agregar al ingreso
   * 
   * @param producto - Producto seleccionado del inventario
   * 
   * @description
   * Cambia al modo EXISTENTE, llena el formulario con datos del producto
   * y enfoca automáticamente el campo de cantidad.
   */
  seleccionarProductoExistente(producto: Producto) {
    this.modoAgregar.set('EXISTENTE');
    this.productoSeleccionado.set(producto);
    this.formProductoExistente.patchValue({
      productoId: producto.id,
      costoUnitario: producto.costo || 0,
    });
    this.selectedIndex.set(-1);
    
    setTimeout(() => {
      const cantidadInput = document.getElementById('existenteCantidad');
      if (cantidadInput) cantidadInput.focus();
    }, 100);
  }

  /**
   * Cancela la selección de producto existente y limpia el formulario
   */
  cancelarSeleccion() {
    this.productoSeleccionado.set(null);
    this.formProductoExistente.reset({ cantidad: 1, costoUnitario: 0, pvp1: 0 });
    this.busqueda.set('');
  }

  /**
   * Agrega un producto existente al detalle del ingreso
   * 
   * @description
   * Valida el formulario, detecta si el producto está desactivado, crea un DetalleIngreso
   * y lo añade a la lista. Maneja actualización opcional de PVP1. Reinicia el formulario
   * y enfoca el buscador para continuar agregando productos.
   */
  agregarProductoExistente() {
    if (this.formProductoExistente.invalid) return;

    const valores = this.formProductoExistente.value;
    const producto = this.productos().find((p) => p.id === valores.productoId);

    if (!producto) return;

    const estaDesactivado = producto.activo === false;

    const detalle: DetalleIngreso = {
      id: Date.now().toString(),
      productoId: producto.id,
      tipo: 'EXISTENTE',
      nombre: producto.nombre,
      cantidad: valores.cantidad,
      costoUnitario: valores.costoUnitario,
      estaDesactivado: estaDesactivado,
    };

    if (producto.modelo) detalle.modelo = producto.modelo;
    if (producto.color) detalle.color = producto.color;
    if (producto.grupo) detalle.grupo = producto.grupo;
    if (producto.codigo) detalle.codigo = producto.codigo;
    
    if (valores.pvp1 && valores.pvp1 > 0) {
      detalle.pvp1 = valores.pvp1;
    }
    
    if (estaDesactivado) {
      detalle.stockActivoAnterior = producto.stock || 0;
    }
    
    detalle.observacion = valores.observacion || '';

    this.detalles.update((list) => [...list, detalle]);
    this.formProductoExistente.reset({ cantidad: 1, costoUnitario: 0, pvp1: 0, observacion: '' });
    this.productoSeleccionado.set(null);
    this.busqueda.set('');
    
    setTimeout(() => {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.focus();
    }, 100);
  }

  /**
   * Agrega un producto nuevo al detalle del ingreso
   * 
   * @description
   * Valida el formulario, crea un DetalleIngreso de tipo NUEVO con todos los datos
   * ingresados. Actualiza el próximo ID interno y enfoca el primer campo para
   * continuar creando productos.
   */
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

    if (valores.modelo) detalle.modelo = valores.modelo;
    if (valores.color) detalle.color = valores.color;
    if (valores.grupo) detalle.grupo = valores.grupo;
    if (valores.pvp1) detalle.pvp1 = valores.pvp1;
    if (valores.iva) detalle.iva = valores.iva;
    detalle.observacion = valores.observacion || '';

    this.detalles.update((list) => [...list, detalle]);
    this.formProductoNuevo.reset({ cantidad: 1, stock: 1, costoUnitario: 0, pvp1: 0, observacion: '' });
    this.modoAgregar.set(null);
    
    this.cargarProximoId();
    setTimeout(() => {
      const firstInput = document.getElementById('nuevoNombre');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  /**
   * Elimina un detalle de producto de la lista
   * 
   * @param id - ID del detalle a eliminar
   */
  eliminarDetalle(id: string) {
    this.detalles.update((list) => list.filter((d) => d.id !== id));
  }

  /**
   * Calcula el total del ingreso sumando todos los detalles
   * 
   * @returns Total en formato numérico
   */
  calcularTotal(): number {
    return this.detalles().reduce(
      (total, d) => total + (d.costoUnitario || 0) * d.cantidad,
      0
    );
  }

  /**
   * Finaliza el ingreso guardando todos los detalles en Firestore
   * 
   * @description
   * Valida que existan detalles, crea el ingreso en BD si es temporal,
   * actualiza stock de productos existentes y crea nuevos productos.
   * Muestra confirmación y redirige a la lista de productos.
   */
  async finalizar() {
    if (this.detalles().length === 0) {
      this.error.set('Debes agregar al menos un producto');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    try {
      let ingresoId = this.ingresoId();
      
      if (ingresoId.startsWith('temp_')) {
        const ingresoTemporal = this.ingreso();
        if (!ingresoTemporal) {
          throw new Error('No hay datos de ingreso');
        }
        ingresoId = await this.ingresosService.crearIngresoBorrador(ingresoTemporal);
        this.ingresoId.set(ingresoId);
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

  /**
   * Cancela la operación de ingreso tras confirmación del usuario
   * 
   * @description
   * Muestra un diálogo de confirmación. Si se confirma, limpia el ingreso temporal
   * y redirige a la lista de productos.
   */
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
        this.ingresosService.limpiarIngresoTemporal();
        this.router.navigate(['/productos']);
      }
    });
  }
}
