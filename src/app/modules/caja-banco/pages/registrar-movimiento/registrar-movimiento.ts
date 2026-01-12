import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { ClientesService } from '../../../../core/services/clientes';
import { EmpleadosService } from '../../../../core/services/empleados.service';
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
  private authService = inject(AuthService);

  formulario!: FormGroup;
  guardando = false;
  mensaje = '';

  // Para búsqueda de clientes
  clientes: any[] = [];
  empleados: any[] = [];
  personasBusqueda: any[] = []; // clientes o empleados según el caso
  busquedaCliente = '';
  clienteSeleccionado: any = null;

  categorias_ingresos = ['CIERRE_CAJA_CHICA', 'TRANSFERENCIA_CLIENTE', 'OTRO_INGRESO'];
  categorias_egresos = ['PAGO_TRABAJADOR', 'OTRO_EGRESO'];
  categorias_actuales: string[] = this.categorias_ingresos;

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarClientes();
    this.cargarEmpleados();
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

  buscarCliente(): void {
    const termino = (this.busquedaCliente || '').toLowerCase();
    const esEgresoPagoTrabajador = this.formulario.get('tipo')?.value === 'EGRESO' && this.formulario.get('categoria')?.value === 'PAGO_TRABAJADOR';
    const fuente = esEgresoPagoTrabajador ? this.empleados : this.clientes;

    if (!termino) {
      this.personasBusqueda = fuente;
      return;
    }

    this.personasBusqueda = (fuente || []).filter((p: any) => {
      const nombre = (p.nombres || p.nombre || '').toLowerCase();
      const apellido = (p.apellidos || p.apellido || '').toLowerCase();
      const full = `${nombre} ${apellido}`.trim();
      const cedula = (p.cedula || '').toLowerCase();
      const id = (p.id ? String(p.id).toLowerCase() : '');
      return (
        (nombre && nombre.includes(termino)) ||
        (apellido && apellido.includes(termino)) ||
        (full && full.includes(termino)) ||
        (cedula && cedula.includes(termino)) ||
        (id && id.includes(termino))
      );
    });
  }

  seleccionarCliente(cliente: any): void {
    this.clienteSeleccionado = cliente;
    const nombre = (cliente.nombres || cliente.nombre || '').trim();
    const apellido = (cliente.apellidos || cliente.apellido || '').trim();
    const cedula = cliente.cedula || cliente.id || '';
    // Mostrar en el input un valor estable (cedula si existe)
    this.busquedaCliente = cedula || `${nombre} ${apellido}`.trim();
    // No forzar referencia; permitir que el usuario escriba el código de transferencia
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
    this.busquedaCliente = '';
    this.actualizarOpcionesBusqueda();
  }

  mostrarBusquedaCliente(): boolean {
    const tipo = this.formulario.get('tipo')?.value;
    const categoria = this.formulario.get('categoria')?.value;
    return (tipo === 'INGRESO' && categoria === 'TRANSFERENCIA_CLIENTE') ||
           (tipo === 'EGRESO' && categoria === 'PAGO_TRABAJADOR');
  }

  private actualizarOpcionesBusqueda(): void {
    const esEgresoPagoTrabajador = this.formulario?.get('tipo')?.value === 'EGRESO' && this.formulario?.get('categoria')?.value === 'PAGO_TRABAJADOR';
    this.personasBusqueda = esEgresoPagoTrabajador ? (this.empleados || []) : (this.clientes || []);
  }

  // Al cambiar manualmente el valor del input con datalist, seleccionar la persona
  onBlurSeleccionPersona(): void {
    const valor = (this.busquedaCliente || '').trim();
    if (!valor) {
      this.clienteSeleccionado = null;
      return;
    }
    const lista = this.personasBusqueda && this.personasBusqueda.length ? this.personasBusqueda : (this.formulario.get('tipo')?.value === 'EGRESO' ? this.empleados : this.clientes);
    const encontrada = (lista || []).find((p: any) => {
      const nombre = (p.nombres || p.nombre || '').trim();
      const apellido = (p.apellidos || p.apellido || '').trim();
      const full = `${nombre} ${apellido}`.trim();
      return p.cedula === valor || p.id === valor || full === valor;
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

    // Validar si se requiere cliente y está seleccionado
    if (this.mostrarBusquedaCliente() && !this.clienteSeleccionado) {
      Swal.fire({
        icon: 'error',
        title: 'Cliente Requerido',
        text: 'Por favor selecciona un cliente de la lista'
      });
      return;
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

      // Solo agregar datos de persona si aplica y existe selección
      if (this.mostrarBusquedaCliente() && this.clienteSeleccionado) {
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

      await this.cajaBancoService.registrarMovimiento(movimientoBase);
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
