import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { ClientesService } from '../../../../core/services/clientes';
import { EmpleadosService } from '../../../../core/services/empleados.service';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-registrar-movimiento',
  standalone: false,
  templateUrl: './registrar-movimiento.html',
  styleUrls: ['./registrar-movimiento.css']
})
export class RegistrarMovimientoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cajaBancoService = inject(CajaBancoService);
  private clientesService = inject(ClientesService);
  private empleadosService = inject(EmpleadosService);
  private proveedoresService = inject(ProveedoresService);
  private authService = inject(AuthService);

  formulario!: FormGroup;
  guardando = false;
  mensaje = '';

  // Para búsqueda de clientes
  clientes: any[] = [];
  empleados: any[] = [];
  proveedores: any[] = [];
  personasBusqueda: any[] = []; // clientes, empleados o proveedores según el caso
  busquedaCliente = '';
  clienteSeleccionado: any = null;
  proveedorSeleccionado: any = null;
  deudaActual = 0;
  deudaRestante = 0;

  categorias_ingresos = ['CIERRE_CAJA_CHICA', 'TRANSFERENCIA_CLIENTE', 'OTRO_INGRESO'];
  categorias_egresos = ['PAGO_TRABAJADOR', 'PAGO_PROVEEDORES', 'OTRO_EGRESO'];
  categorias_actuales: string[] = this.categorias_ingresos;

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarClientes();
    this.cargarEmpleados();
    this.cargarProveedores();
  }

  inicializarFormulario(): void {
    this.formulario = this.fb.group({
      tipo: ['INGRESO', Validators.required],
      categoria: ['CIERRE_CAJA_CHICA', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      referencia: ['']
    });

    this.formulario.get('tipo')!.valueChanges.subscribe((tipo) => {
      this.onTipoChange(tipo);
    });

    this.formulario.get('categoria')!.valueChanges.subscribe((categoria) => {
      this.onCategoriaChange(categoria);
    });

    this.formulario.get('monto')!.valueChanges.subscribe((monto) => {
      this.actualizarDeudaRestante(monto);
    });
  }

  cargarClientes(): void {
    this.clientesService.getClientes().subscribe({
      next: (clientes) => {
        this.clientes = clientes;
        this.actualizarOpcionesBusqueda();
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
      }
    });
  }

  cargarEmpleados(): void {
    this.empleadosService.getEmpleados().subscribe({
      next: (empleados) => {
        this.empleados = empleados || [];
        this.actualizarOpcionesBusqueda();
      },
      error: (error) => {
        console.error('Error al cargar empleados:', error);
      }
    });
  }

  cargarProveedores(): void {
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedores = proveedores || [];
        this.actualizarOpcionesBusqueda();
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
      }
    });
  }

  buscarCliente(): void {
    const termino = (this.busquedaCliente || '').toLowerCase();
    const tipo = this.formulario.get('tipo')?.value;
    const categoria = this.formulario.get('categoria')?.value;
    
    const esEgresoPagoTrabajador = tipo === 'EGRESO' && categoria === 'PAGO_TRABAJADOR';
    const esEgresoPagoProveedor = tipo === 'EGRESO' && categoria === 'PAGO_PROVEEDORES';
    
    let fuente: any[] = [];
    if (esEgresoPagoTrabajador) {
      fuente = this.empleados;
    } else if (esEgresoPagoProveedor) {
      fuente = this.proveedores;
    } else {
      fuente = this.clientes;
    }

    if (!termino) {
      this.personasBusqueda = fuente;
      return;
    }

    this.personasBusqueda = (fuente || []).filter((p: any) => {
      const nombre = (p.nombres || p.nombre || '').toLowerCase();
      const apellido = (p.apellidos || p.apellido || '').toLowerCase();
      const representante = (p.representante || '').toLowerCase();
      const full = `${nombre} ${apellido}`.trim();
      const cedula = (p.cedula || '').toLowerCase();
      const ruc = (p.ruc || '').toLowerCase();
      const codigo = (p.codigo || '').toLowerCase();
      const id = (p.id ? String(p.id).toLowerCase() : '');
      
      return (
        (nombre && nombre.includes(termino)) ||
        (apellido && apellido.includes(termino)) ||
        (representante && representante.includes(termino)) ||
        (full && full.includes(termino)) ||
        (cedula && cedula.includes(termino)) ||
        (ruc && ruc.includes(termino)) ||
        (codigo && codigo.includes(termino)) ||
        (id && id.includes(termino))
      );
    });
  }

  seleccionarCliente(cliente: any): void {
    this.clienteSeleccionado = cliente;
    this.proveedorSeleccionado = null;
    
    // Para proveedores, guardar la deuda actual y mostrar código
    if (this.formulario.get('categoria')?.value === 'PAGO_PROVEEDORES') {
      this.proveedorSeleccionado = cliente;
      this.deudaActual = cliente.saldo || 0;
      this.actualizarDeudaRestante(this.formulario.get('monto')?.value || 0);
      // Mostrar código del proveedor en lugar del ID de Firebase
      this.busquedaCliente = cliente.codigo || cliente.ruc || cliente.nombre;
    } else {
      // Para trabajadores y clientes, mantener comportamiento original
      const nombre = (cliente.nombres || cliente.nombre || '').trim();
      const apellido = (cliente.apellidos || cliente.apellido || '').trim();
      const cedula = cliente.cedula || '';
      this.busquedaCliente = cedula || `${nombre} ${apellido}`.trim();
    }
    
    // Limpiar opciones de búsqueda
    this.actualizarOpcionesBusqueda();
  }

  onTipoChange(tipo: string): void {
    const categoriaControl = this.formulario.get('categoria');
    if (tipo === 'INGRESO') {
      this.categorias_actuales = this.categorias_ingresos;
      categoriaControl?.setValue('CIERRE_CAJA_CHICA');
    } else {
      this.categorias_actuales = this.categorias_egresos;
      categoriaControl?.setValue('PAGO_TRABAJADOR');
    }
    this.clienteSeleccionado = null;
    this.busquedaCliente = '';
    this.actualizarOpcionesBusqueda();
  }

  onCategoriaChange(categoria: string): void {
    this.clienteSeleccionado = null;
    this.proveedorSeleccionado = null;
    this.busquedaCliente = '';
    this.deudaActual = 0;
    this.deudaRestante = 0;
    this.actualizarOpcionesBusqueda();
  }

  mostrarBusquedaCliente(): boolean {
    const tipo = this.formulario.get('tipo')?.value;
    const categoria = this.formulario.get('categoria')?.value;
    return (tipo === 'INGRESO' && categoria === 'TRANSFERENCIA_CLIENTE') ||
           (tipo === 'EGRESO' && categoria === 'PAGO_TRABAJADOR') ||
           (tipo === 'EGRESO' && categoria === 'PAGO_PROVEEDORES');
  }

  actualizarDeudaRestante(monto: number): void {
    if (this.formulario.get('categoria')?.value === 'PAGO_PROVEEDORES' && this.proveedorSeleccionado) {
      this.deudaRestante = Math.max(0, this.deudaActual - (monto || 0));
    }
  }

  private actualizarOpcionesBusqueda(): void {
    const tipo = this.formulario?.get('tipo')?.value;
    const categoria = this.formulario?.get('categoria')?.value;
    
    if (tipo === 'EGRESO' && categoria === 'PAGO_TRABAJADOR') {
      this.personasBusqueda = this.empleados || [];
    } else if (tipo === 'EGRESO' && categoria === 'PAGO_PROVEEDORES') {
      this.personasBusqueda = this.proveedores || [];
    } else {
      this.personasBusqueda = this.clientes || [];
    }
  }

  // Al cambiar manualmente el valor del input con datalist, seleccionar la persona
  onBlurSeleccionPersona(): void {
    const valor = (this.busquedaCliente || '').trim();
    if (!valor) {
      this.clienteSeleccionado = null;
      this.proveedorSeleccionado = null;
      return;
    }
    
    const tipo = this.formulario.get('tipo')?.value;
    const categoria = this.formulario.get('categoria')?.value;
    
    let lista: any[] = [];
    if (tipo === 'EGRESO' && categoria === 'PAGO_TRABAJADOR') {
      lista = this.empleados;
    } else if (tipo === 'EGRESO' && categoria === 'PAGO_PROVEEDORES') {
      lista = this.proveedores;
    } else {
      lista = this.clientes;
    }
    
    const encontrada = (lista || []).find((p: any) => {
      const nombre = (p.nombres || p.nombre || '').trim();
      const apellido = (p.apellidos || p.apellido || '').trim();
      const full = `${nombre} ${apellido}`.trim();
      return p.cedula === valor || p.id === valor || p.ruc === valor || p.codigo === valor || full === valor;
    });
    if (encontrada) {
      this.seleccionarCliente(encontrada);
    }
  }

  async guardarMovimiento(): Promise<void> {
    if (!this.formulario.valid) {
      this.mensaje = 'Por favor completa todos los campos obligatorios';
      return;
    }

    // Validar si se requiere cliente/trabajador/proveedor y está seleccionado
    if (this.mostrarBusquedaCliente()) {
      if (this.formulario.get('categoria')?.value === 'PAGO_PROVEEDORES' && !this.proveedorSeleccionado) {
        Swal.fire({
          icon: 'error',
          title: 'Proveedor Requerido',
          text: 'Por favor selecciona un proveedor de la lista'
        });
        return;
      } else if (this.formulario.get('categoria')?.value === 'PAGO_TRABAJADOR' && !this.clienteSeleccionado) {
        Swal.fire({
          icon: 'error',
          title: 'Trabajador Requerido',
          text: 'Por favor selecciona un trabajador de la lista'
        });
        return;
      } else if (this.formulario.get('categoria')?.value === 'TRANSFERENCIA_CLIENTE' && !this.clienteSeleccionado) {
        Swal.fire({
          icon: 'error',
          title: 'Cliente Requerido',
          text: 'Por favor selecciona un cliente de la lista'
        });
        return;
      }
    }

    this.guardando = true;
    const usuario = this.authService.getCurrentUser();

    try {
      // Construir movimiento evitando campos undefined (Firestore no los acepta)
      const movimientoBase: any = {
        tipo: this.formulario.value.tipo,
        categoria: this.formulario.value.categoria,
        descripcion: this.formulario.value.descripcion,
        monto: this.formulario.value.monto,
        referencia: this.formulario.value.referencia || '',
        fecha: new Date(),
        usuario_id: usuario?.id || null,
        usuario_nombre: usuario?.nombre || null,
      };

      // Procesar según categoría
      const categoria = this.formulario.value.categoria;
      if (categoria === 'PAGO_PROVEEDORES' && this.proveedorSeleccionado) {
        movimientoBase.proveedor_id = this.proveedorSeleccionado.id;
        movimientoBase.proveedor_nombre = this.proveedorSeleccionado.nombre;
        movimientoBase.deuda_anterior = this.deudaActual;
        movimientoBase.deuda_nueva = this.deudaRestante;
      } else if ((categoria === 'TRANSFERENCIA_CLIENTE' || categoria === 'PAGO_TRABAJADOR') && this.clienteSeleccionado) {
        const nombre = (this.clienteSeleccionado.nombres || this.clienteSeleccionado.nombre || '').trim();
        const apellido = (this.clienteSeleccionado.apellidos || this.clienteSeleccionado.apellido || '').trim();
        const cedula = this.clienteSeleccionado.cedula || '';
        movimientoBase.persona_nombre = `${nombre}${apellido ? ' ' + apellido : ''}`;
        movimientoBase.persona_cedula = cedula || null;
      }

      // Limpiar claves con null para no enviar undefined
      Object.keys(movimientoBase).forEach(k => {
        if (movimientoBase[k] === undefined) delete movimientoBase[k];
      });

      // Guardar el movimiento
      await this.cajaBancoService.registrarMovimiento(movimientoBase);

      // Si es pago a proveedor, recalcular y actualizar el saldo del proveedor
      if (categoria === 'PAGO_PROVEEDORES' && this.proveedorSeleccionado) {
        await this.proveedoresService.actualizarSaldoProveedor(
          this.proveedorSeleccionado.nombre,
          this.proveedorSeleccionado.id
        );
      }

      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Movimiento registrado correctamente',
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        this.router.navigate(['/caja-banco']);
      });
    } catch (error) {
      console.error('Error al guardar movimiento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al guardar el movimiento'
      });
    } finally {
      this.guardando = false;
    }
  }

  volver(): void {
    this.router.navigate(['/caja-banco']);
  }
}
