import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { EgresoMercaderiaService } from '../../../../core/services/egreso.service';
import { ProductosService } from '../../../../core/services/productos';
import { AuthService } from '../../../../core/services/auth.service';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { Producto } from '../../../../core/models/producto.model';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { MotivoEgreso, MOTIVOS_EGRESO, DetalleProductoEgreso } from '../../../../core/models/egreso.model';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

interface ProductoEnLista {
  producto: Producto;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
}

@Component({
  selector: 'app-registrar-egreso',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-egreso.html',
  styleUrl: './registrar-egreso.css',
})
export class RegistrarEgreso implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private egresoService = inject(EgresoMercaderiaService);
  private productosService = inject(ProductosService);
  private proveedoresService = inject(ProveedoresService);
  private ingresosService = inject(IngresosService);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);

  formulario!: FormGroup;
  productos = signal<Producto[]>([]);
  todosLosProductos = signal<Producto[]>([]); // Todos los productos sin filtrar
  productosFiltrados = signal<Producto[]>([]); // Productos filtrados para búsqueda
  filtroProducto = signal<string>(''); // Texto de búsqueda de productos
  productoSeleccionadoIndex = signal<number>(-1); // Índice del producto seleccionado en la lista filtrada
  proveedores = signal<Proveedor[]>([]);
  proveedoresFiltrados = signal<Proveedor[]>([]);
  productoSeleccionado = signal<Producto | null>(null);
  productosEnLista = signal<ProductoEnLista[]>([]);
  ingresosProveedor = signal<any[]>([]); // Ingresos del proveedor seleccionado
  ingresosFiltrados = signal<any[]>([]); // Ingresos filtrados para autocompletado
  motivos = MOTIVOS_EGRESO;
  motivosKeys: MotivoEgreso[] = Object.keys(MOTIVOS_EGRESO) as MotivoEgreso[];
  guardando = signal(false);
  mostrarSugerenciasProveedor = signal(false);
  mostrarSugerenciasIngreso = signal(false);

  // Computed signals
  costoTotalGeneral = computed(() => {
    return this.productosEnLista().reduce((sum, item) => sum + item.costoTotal, 0);
  });

  cantidadTotalProductos = computed(() => {
    return this.productosEnLista().reduce((sum, item) => sum + item.cantidad, 0);
  });

  proveedorSeleccionado = computed(() => {
    const proveedorId = this.formulario?.get('proveedorId')?.value;
    if (!proveedorId) return null;
    return this.proveedores().find(p => p.id === proveedorId) || null;
  });

  saldoResultanteProveedor = computed(() => {
    const proveedor = this.proveedorSeleccionado();
    if (!proveedor) return 0;
    const saldoActual = proveedor.saldo || 0;
    const costoTotal = this.costoTotalGeneral();
    return saldoActual - costoTotal;
  });

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarProductos();
    this.cargarProveedores();
  }

  inicializarFormulario(): void {
    this.formulario = this.fb.group({
      // Búsqueda de proveedor
      proveedorBusqueda: ['', Validators.required],
      proveedorId: ['', Validators.required],
      proveedorNombre: ['', Validators.required],
      
      // Búsqueda de ingreso por ID
      ingresoIdBusqueda: [''],
      
      // Agregar producto
      productoId: [''],
      cantidad: [1, [Validators.min(1)]],
      
      // Detalles del egreso
      motivo: ['', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
      documentoReferencia: ['']
    });

    // Listener para cuando se selecciona un producto
    this.formulario.get('productoId')?.valueChanges.subscribe(productoId => {
      const producto = this.productos().find(p => p.id === productoId);
      this.productoSeleccionado.set(producto || null);
      
      // Resetear cantidad a 1 cuando cambia el producto
      if (producto) {
        this.formulario.patchValue({ cantidad: 1 });
      }
    });

    // Listener para búsqueda de proveedor
    this.formulario.get('proveedorBusqueda')?.valueChanges.subscribe(texto => {
      this.filtrarProveedores(texto || '');
      // Mostrar sugerencias si hay texto o si el campo tiene focus
      this.mostrarSugerenciasProveedor.set(true);
    });

    // Listener para búsqueda de ingreso
    this.formulario.get('ingresoIdBusqueda')?.valueChanges.subscribe(texto => {
      this.filtrarIngresos(texto || '');
      this.mostrarSugerenciasIngreso.set(true);
    });
  }

  cargarProductos(): void {
    this.productosService.getProductos().subscribe({
      next: (productos: Producto[]) => {
        // Guardar todos los productos
        const productosFiltrados = productos.filter((p: Producto) => p.activo !== false && (p.stock ?? 0) > 0);
        this.todosLosProductos.set(productosFiltrados);
        
        // Aplicar filtro por proveedor si ya hay uno seleccionado
        this.filtrarProductosPorProveedor();
      },
      error: (error: any) => {
        console.error('Error al cargar productos:', error);
        Swal.fire('Error', 'No se pudieron cargar los productos', 'error');
      }
    });
  }

  cargarProveedores(): void {
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores: Proveedor[]) => {
        this.proveedores.set(proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      },
      error: (error: any) => {
        console.error('Error al cargar proveedores:', error);
      }
    });
  }

  filtrarProveedores(texto: string): void {
    const busqueda = texto.toLowerCase().trim();
    
    // Si está vacío, mostrar todos los proveedores
    if (!busqueda) {
      this.proveedoresFiltrados.set(this.proveedores());
      return;
    }

    // Filtrar por nombre, RUC o código
    const filtrados = this.proveedores().filter(p => 
      p.nombre.toLowerCase().includes(busqueda) ||
      (p.ruc || '').includes(busqueda) ||
      (p.codigo || '').toLowerCase().includes(busqueda)
    );

    this.proveedoresFiltrados.set(filtrados);
  }

  filtrarProductosTexto(texto: string): void {
    this.filtroProducto.set(texto);
    const t = texto.trim().toLowerCase();
    const productosBase = this.productos();

    if (!t) {
      this.productosFiltrados.set(productosBase.slice(0, 20)); // Mostrar solo primeros 20
      this.productoSeleccionadoIndex.set(-1);
      return;
    }

    const filtrados = productosBase.filter(p => {
      const nombre = (p.nombre || '').toLowerCase();
      const modelo = (p.modelo || '').toLowerCase();
      const color = (p.color || '').toLowerCase();
      const codigo = (p.codigo || '').toLowerCase();
      return nombre.includes(t) || modelo.includes(t) || color.includes(t) || codigo.includes(t);
    });

    this.productosFiltrados.set(filtrados.slice(0, 20)); // Limitar a 20 resultados
    this.productoSeleccionadoIndex.set(-1);
  }

  seleccionarProductoDesdeLista(producto: Producto): void {
    this.productoSeleccionado.set(producto);
    this.formulario.patchValue({
      productoId: producto.id,
      cantidad: 1
    });
    this.filtroProducto.set('');
    this.productosFiltrados.set([]);
    this.productoSeleccionadoIndex.set(-1);
  }

  onProductoKeydown(event: KeyboardEvent): void {
    const filtrados = this.productosFiltrados();
    const index = this.productoSeleccionadoIndex();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (index < filtrados.length - 1) {
        this.productoSeleccionadoIndex.set(index + 1);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index > 0) {
        this.productoSeleccionadoIndex.set(index - 1);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (index >= 0 && index < filtrados.length) {
        this.seleccionarProductoDesdeLista(filtrados[index]);
      }
    } else if (event.key === 'Escape') {
      this.filtroProducto.set('');
      this.productosFiltrados.set([]);
      this.productoSeleccionadoIndex.set(-1);
    }
  }

  mostrarTodosProveedores(): void {
    this.proveedoresFiltrados.set(this.proveedores());
    this.mostrarSugerenciasProveedor.set(true);
  }

  ocultarSugerenciasProveedor(): void {
    // Delay para permitir que mousedown en sugerencias se ejecute primero
    setTimeout(() => {
      this.mostrarSugerenciasProveedor.set(false);
    }, 200);
  }

  seleccionarProveedor(proveedor: Proveedor): void {
    this.formulario.patchValue({
      proveedorBusqueda: proveedor.nombre,
      proveedorId: proveedor.id,
      proveedorNombre: proveedor.nombre
    });
    this.mostrarSugerenciasProveedor.set(false);
    
    // Filtrar productos del proveedor seleccionado
    this.filtrarProductosPorProveedor();
    
    // Cargar ingresos del proveedor seleccionado
    this.cargarIngresosProveedor(proveedor);
  }

  cargarIngresosProveedor(proveedor: Proveedor): void {
    console.log('🔍 Cargando ingresos para proveedor:', {
      nombre: proveedor.nombre,
      codigo: proveedor.codigo,
      id: proveedor.id
    });
    
    // Primero intentar buscar por código (más confiable), si existe
    if (proveedor.codigo) {
      console.log('📋 Buscando por código:', proveedor.codigo);
      this.ingresosService.getIngresosPorProveedorCodigo(proveedor.codigo).subscribe({
        next: (ingresos) => {
          console.log('✅ Ingresos recibidos (por código):', ingresos.length, ingresos);
          
          // Si no encuentra por código, intentar por nombre como fallback
          if (ingresos.length === 0) {
            console.log('⚠️ No se encontraron ingresos por código, intentando por nombre...');
            this.cargarIngresosPorNombre(proveedor);
          } else {
            this.procesarIngresos(ingresos, proveedor);
          }
        },
        error: (error) => {
          console.error('❌ Error al cargar ingresos por código:', error);
          // Si falla, intentar por nombre
          this.cargarIngresosPorNombre(proveedor);
        }
      });
    } else {
      // Si no hay código, buscar por nombre directamente
      console.log('📋 Proveedor sin código, buscando por nombre');
      this.cargarIngresosPorNombre(proveedor);
    }
  }

  private cargarIngresosPorNombre(proveedor: Proveedor): void {
    console.log('📋 Buscando por nombre:', proveedor.nombre);
    this.ingresosService.getIngresosPorProveedor(proveedor.nombre).subscribe({
      next: (ingresos) => {
        console.log('✅ Ingresos recibidos (por nombre):', ingresos.length, ingresos);
        this.procesarIngresos(ingresos, proveedor);
      },
      error: (error) => {
        console.error('❌ Error al cargar ingresos por nombre:', error);
        this.ingresosProveedor.set([]);
        this.ingresosFiltrados.set([]);
      }
    });
  }

  private procesarIngresos(ingresos: any[], proveedor: Proveedor): void {
    console.log('🔄 Procesando ingresos:', ingresos.length);
    
    // Mostrar todos los ingresos (no filtrar por estado FINALIZADO)
    // ya que algunos ingresos antiguos pueden no tener el campo estado
    const ingresosValidos = ingresos.filter(i => {
      const esValido = i.total && i.total > 0;
      if (!esValido) {
        console.log('⚠️ Ingreso inválido:', i);
      }
      return esValido;
    });
    
    console.log('✅ Ingresos válidos filtrados:', ingresosValidos.length, ingresosValidos);
    
    this.ingresosProveedor.set(ingresosValidos);
    this.ingresosFiltrados.set(ingresosValidos);
    
    if (ingresosValidos.length === 0) {
      console.warn(`⚠️ No se encontraron ingresos válidos para el proveedor "${proveedor.nombre}"`);
    } else {
      console.log(`✅ Se cargaron ${ingresosValidos.length} ingresos para "${proveedor.nombre}"`);
    }
  }

  filtrarIngresos(texto: string): void {
    const busqueda = texto.toLowerCase().trim();
    
    if (!busqueda) {
      this.ingresosFiltrados.set(this.ingresosProveedor());
      return;
    }

    const filtrados = this.ingresosProveedor().filter(i => 
      (i.idPersonalizado || '').includes(busqueda) ||
      (i.numeroFactura || '').toLowerCase().includes(busqueda)
    );

    this.ingresosFiltrados.set(filtrados);
  }

  mostrarTodosIngresos(): void {
    this.ingresosFiltrados.set(this.ingresosProveedor());
    this.mostrarSugerenciasIngreso.set(true);
  }

  ocultarSugerenciasIngreso(): void {
    // Delay para permitir que mousedown en sugerencias se ejecute primero
    setTimeout(() => {
      this.mostrarSugerenciasIngreso.set(false);
    }, 200);
  }

  seleccionarIngreso(ingreso: any): void {
    this.formulario.patchValue({
      ingresoIdBusqueda: `${ingreso.idPersonalizado} - ${ingreso.numeroFactura}`
    });
    this.mostrarSugerenciasIngreso.set(false);
    
    // No cargar productos automáticamente - solo al hacer clic en "Cargar Productos"
  }

  filtrarProductosPorProveedor(): void {
    const proveedorNombre = this.formulario.get('proveedorNombre')?.value;
    
    if (!proveedorNombre) {
      // Si no hay proveedor, mostrar todos
      this.productos.set(
        this.todosLosProductos().sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      return;
    }

    // Filtrar productos cuyo proveedor coincida
    const productosFiltrados = this.todosLosProductos().filter(p => 
      p.proveedor?.toLowerCase() === proveedorNombre.toLowerCase()
    );

    this.productos.set(
      productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre))
    );

    // Si no hay productos de este proveedor, mostrar mensaje
    if (productosFiltrados.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin productos',
        text: `No hay productos registrados del proveedor "${proveedorNombre}"`,
        confirmButtonText: 'Entendido'
      });
    }
  }

  async buscarProductosPorIngreso(): Promise<void> {
    const ingresoIdTexto = this.formulario.get('ingresoIdBusqueda')?.value?.trim();
    
    if (!ingresoIdTexto) {
      Swal.fire('Campo vacío', 'Seleccione un ingreso de la lista', 'warning');
      return;
    }

    // Extraer el ID del texto (puede venir como "0000000001 - F-001")
    const ingresoId = ingresoIdTexto.split(' - ')[0];
    
    await this.cargarProductosDeIngreso(ingresoId);
  }

  async cargarProductosDeIngreso(ingresoId: string): Promise<void> {
    try {
      // Buscar el ingreso
      const ingreso = await firstValueFrom(this.ingresosService.getIngresoById(ingresoId));
      
      if (!ingreso) {
        Swal.fire('No encontrado', `No se encontró un ingreso con ID "${ingresoId}"`, 'error');
        return;
      }

      // Obtener detalles del ingreso
      const detalles = await firstValueFrom(this.ingresosService.getDetallesIngreso(ingresoId));
      
      if (!detalles || detalles.length === 0) {
        Swal.fire('Sin productos', 'Este ingreso no tiene productos asociados', 'info');
        return;
      }

      console.log('📦 Detalles del ingreso:', detalles.length, detalles);

      // Limpiar lista actual
      this.productosEnLista.set([]);

      // Contadores para el reporte
      let productosAgregados = 0;
      let productosSinStock = 0;
      let productosNoEncontrados = 0;

      // Agregar productos del ingreso a la lista
      for (const detalle of detalles) {
        if (detalle.productoId) {
          const producto = this.todosLosProductos().find(p => p.id === detalle.productoId);
          
          if (!producto) {
            console.warn('❌ Producto no encontrado:', detalle.productoId, detalle);
            productosNoEncontrados++;
            continue;
          }

          const stockDisponible = producto.stock ?? 0;
          
          if (stockDisponible === 0) {
            console.warn('⚠️ Producto sin stock:', producto.nombre, detalle);
            productosSinStock++;
            continue;
          }

          const cantidad = Math.min(detalle.cantidad || 1, stockDisponible);
          const costoUnitario = producto.costo || 0;
          const costoTotal = cantidad * costoUnitario;

          this.productosEnLista.update(lista => [...lista, {
            producto,
            cantidad,
            costoUnitario,
            costoTotal
          }]);
          productosAgregados++;
        }
      }

      console.log('✅ Resumen carga:', {
        total: detalles.length,
        agregados: productosAgregados,
        sinStock: productosSinStock,
        noEncontrados: productosNoEncontrados
      });

      if (productosAgregados > 0) {
        let mensaje = `Se agregaron ${productosAgregados} productos del ingreso "${ingreso.numeroFactura}"`;
        
        if (productosSinStock > 0 || productosNoEncontrados > 0) {
          mensaje += `\n\n⚠️ No se agregaron:`;
          if (productosSinStock > 0) {
            mensaje += `\n• ${productosSinStock} sin stock`;
          }
          if (productosNoEncontrados > 0) {
            mensaje += `\n• ${productosNoEncontrados} no encontrados en inventario`;
          }
        }

        Swal.fire({
          icon: 'success',
          title: 'Productos cargados',
          text: mensaje,
          confirmButtonText: 'Aceptar'
        });
        
        // Limpiar campo de búsqueda
        this.formulario.patchValue({ ingresoIdBusqueda: '' });
        this.mostrarSugerenciasIngreso.set(false);
      } else {
        let mensajeError = 'No se pudo agregar ningún producto.';
        if (productosSinStock > 0) {
          mensajeError += `\n${productosSinStock} producto(s) sin stock disponible.`;
        }
        if (productosNoEncontrados > 0) {
          mensajeError += `\n${productosNoEncontrados} producto(s) no encontrado(s) en inventario.`;
        }
        
        Swal.fire('Sin productos disponibles', mensajeError, 'warning');
      }

    } catch (error) {
      console.error('Error al buscar ingreso:', error);
      Swal.fire('Error', 'No se pudo cargar el ingreso. Verifique el ID ingresado.', 'error');
    }
  }

  limpiarProveedor(): void {
    this.formulario.patchValue({
      proveedorBusqueda: '',
      proveedorId: '',
      proveedorNombre: ''
    });
    this.proveedoresFiltrados.set([]);
    this.mostrarSugerenciasProveedor.set(false);
  }

  agregarProductoALista(): void {
    const productoId = this.formulario.get('productoId')?.value;
    const cantidad = this.formulario.get('cantidad')?.value;

    if (!productoId || !cantidad || cantidad <= 0) {
      Swal.fire('Atención', 'Seleccione un producto y una cantidad válida', 'warning');
      return;
    }

    const producto = this.productos().find(p => p.id === productoId);
    if (!producto) return;

    // Validar que la cantidad no exceda el stock disponible
    if (cantidad > this.stockDisponible) {
      Swal.fire('Stock insuficiente', `Solo hay ${this.stockDisponible} unidades disponibles`, 'error');
      return;
    }

    // Verificar si el producto ya está en la lista
    const yaExiste = this.productosEnLista().find(p => p.producto.id === productoId);
    if (yaExiste) {
      Swal.fire('Producto duplicado', 'Este producto ya está en la lista', 'warning');
      return;
    }

    const costoUnitario = producto.costo || 0;
    const costoTotal = cantidad * costoUnitario;

    const nuevoProducto: ProductoEnLista = {
      producto,
      cantidad,
      costoUnitario,
      costoTotal
    };

    this.productosEnLista.update(lista => [...lista, nuevoProducto]);

    // Limpiar selección
    this.formulario.patchValue({
      productoId: '',
      cantidad: 1
    });
    this.productoSeleccionado.set(null);
  }

  eliminarProductoDeLista(index: number): void {
    this.productosEnLista.update(lista => lista.filter((_, i) => i !== index));
  }

  get stockDisponible(): number {
    const producto = this.productoSeleccionado();
    if (!producto) return 0;

    // Calcular cuánto ya se agregó a la lista
    const yaEnLista = this.productosEnLista().find(p => p.producto.id === producto.id);
    const cantidadEnLista = yaEnLista ? yaEnLista.cantidad : 0;

    return (producto.stock ?? 0) - cantidadEnLista;
  }

  get costoUnitario(): number {
    return this.productoSeleccionado()?.costo ?? 0;
  }

  get costoTotal(): number {
    const cantidad = this.formulario.get('cantidad')?.value || 0;
    return cantidad * this.costoUnitario;
  }

  async registrarEgreso(): Promise<void> {
    if (this.formulario.get('motivo')?.invalid || this.formulario.get('descripcion')?.invalid || this.formulario.get('proveedorId')?.invalid) {
      Swal.fire('Formulario incompleto', 'Por favor complete todos los campos requeridos (proveedor, motivo y descripción)', 'warning');
      return;
    }

    if (this.productosEnLista().length === 0) {
      Swal.fire('Sin productos', 'Debe agregar al menos un producto al egreso', 'warning');
      return;
    }

    const motivo = this.formulario.value.motivo;
    const proveedorId = this.formulario.value.proveedorId;

    // Confirmación simple
    const confirmar = await Swal.fire({
      title: '¿Seguro de realizar este egreso?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });

    if (!confirmar.isConfirmed) return;

    this.guardando.set(true);

    try {
      const usuario = this.authService.getCurrentUser();
      
      if (!usuario) {
        await Swal.fire('Error', 'No hay un usuario autenticado. Por favor, inicie sesión nuevamente.', 'error');
        this.guardando.set(false);
        return;
      }

      // Convertir productos en lista a DetalleProductoEgreso
      const productosEgresados: DetalleProductoEgreso[] = this.productosEnLista().map(item => ({
        productoId: item.producto.id!,
        productoIdInterno: item.producto.idInterno,
        productoNombre: item.producto.nombre || '',
        productoCodigo: item.producto.codigo || '',
        productoModelo: item.producto.modelo || '',
        productoColor: item.producto.color || '',
        productoGrupo: item.producto.grupo || '',
        cantidad: item.cantidad,
        costoUnitario: item.costoUnitario,
        costoTotal: item.costoTotal
      }));

      // Preparar datos del egreso
      const datosEgreso: any = {
        productosEgresados,
        motivo: this.formulario.value.motivo,
        descripcion: this.formulario.value.descripcion,
        fecha: new Date(),
        usuarioId: usuario.id || '',
        usuarioNombre: usuario.nombre || usuario.email || 'Usuario',
        costoTotal: this.costoTotalGeneral(),
        activo: true
      };

      // Agregar proveedor si existe
      if (proveedorId) {
        datosEgreso.proveedorId = proveedorId;
        datosEgreso.proveedorNombre = this.formulario.value.proveedorNombre;
      }

      // Agregar documento de referencia si existe
      if (this.formulario.value.documentoReferencia) {
        datosEgreso.documentoReferencia = this.formulario.value.documentoReferencia;
      }

      // 1. Registrar el egreso
      const egresoId = await this.egresoService.registrarEgreso(datosEgreso);

      // 2. Actualizar stock de cada producto
      for (const item of this.productosEnLista()) {
        const nuevoStock = (item.producto.stock ?? 0) - item.cantidad;
        const productoRef = doc(this.firestore, 'productos', item.producto.id!);
        await updateDoc(productoRef, { stock: nuevoStock });
      }

      await Swal.fire({
        title: 'Egreso registrado',
        html: `
          <div style="text-align: left;">
            <p>El egreso se registró exitosamente</p>
            <p><strong>ID:</strong> ${egresoId}</p>
            <p><strong>Productos egresados:</strong> ${this.cantidadTotalProductos()} unidades</p>
            <p><strong>Costo total:</strong> $${this.costoTotalGeneral().toFixed(2)}</p>
            ${proveedorId && motivo === 'DEVOLUCION_PROVEEDOR' ? 
              `<p style="color: #27ae60;">Saldo del proveedor actualizado</p>` : ''}
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });

      // Resetear formulario y listas
      this.formulario.reset({
        proveedorBusqueda: '',
        proveedorId: '',
        proveedorNombre: '',
        productoId: '',
        cantidad: 1,
        motivo: '',
        descripcion: '',
        documentoReferencia: ''
      });
      this.productoSeleccionado.set(null);
      this.productosEnLista.set([]);
      this.cargarProductos(); // Recargar para actualizar stocks

    } catch (error) {
      console.error('Error al registrar egreso:', error);
      Swal.fire('Error', 'No se pudo registrar el egreso. Intente nuevamente.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  volver(): void {
    this.router.navigate(['/egresos-mercaderia/listado']);
  }
}
