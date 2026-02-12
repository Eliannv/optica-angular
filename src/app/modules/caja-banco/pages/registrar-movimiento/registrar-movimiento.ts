import { RolUsuario, Usuario } from '../../../../core/models/usuario.model';
/**
 * Componente para registrar movimientos financieros en cajas banco.
 *
 * Funcionalidad:
 * - Registro de ingresos: cierre de cajas chicas, transferencias de clientes, otros ingresos
 * - Registro de egresos: pagos a trabajadores, pagos a proveedores, otros egresos
 * - Búsqueda inteligente de clientes, empleados y proveedores
 * - Validación de montos y categorías
 * - Control de deuda de proveedores
 * - Asociación automática a caja banco específica
 *
 * El componente utiliza formularios reactivos con validación en tiempo real.
 *
 * @component RegistrarMovimientoComponent
 */

import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { ClientesService } from '../../../../core/services/clientes';
import { EmpleadosService } from '../../../../core/services/empleados.service';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { AuthService } from '../../../../core/services/auth.service';
import { normalizarFecha, obtenerPeriodo } from '../../../../core/utils/fecha-helpers';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-registrar-movimiento',
  standalone: false,
  templateUrl: './registrar-movimiento.html',
  styleUrls: ['./registrar-movimiento.css']
})
export class RegistrarMovimientoComponent implements OnInit {
  /** Caja banco actual (puede estar abierta o cerrada) */
  cajaBanco: any = null;

  /** Helper: retorna true si el usuario puede modificar la caja actual */
  puedeModificarCaja(): boolean {
    const usuario: Usuario | null = this.authService.getCurrentUser();
    if (!this.cajaBanco) return false;
    if (!usuario) return false;
    if (this.cajaBanco.estado === 'ABIERTA') return true;
    return usuario.rol === RolUsuario.ADMINISTRADOR;
  }
  /** Form builder para construcción reactiva de formularios */
  private fb = inject(FormBuilder);

  /** Router para navegación */
  private router = inject(Router);

  /** Servicio de cajas banco */
  private cajaBancoService = inject(CajaBancoService);

  /** Servicio de clientes */
  private clientesService = inject(ClientesService);

  /** Servicio de empleados */
  private empleadosService = inject(EmpleadosService);

  /** Servicio de proveedores */
  private proveedoresService = inject(ProveedoresService);

  /** Servicio de autenticación */
  private authService = inject(AuthService);

  /** Formulario reactivo para entrada de datos */
  formulario!: FormGroup;

  /** Estado de guardado de movimiento */
  guardando = false;

  /** Mensaje de feedback para el usuario */
  mensaje = '';

  /** ID de la caja banco a la que se asocia el movimiento */
  cajaId: string = '';

  /** Lista de clientes cargados del sistema */
  clientes: any[] = [];

  /** Lista de empleados cargados del sistema */
  empleados: any[] = [];

  /** Lista de proveedores cargados del sistema */
  proveedores: any[] = [];

  /**
   * Lista dinámicamente actualizada según tipo/categoría de movimiento.
   * Puede contener clientes, empleados o proveedores.
   */
  personasBusqueda: any[] = [];

  /** Término de búsqueda actual en el input */
  busquedaCliente = '';

  /** Persona seleccionada de la lista de búsqueda */
  clienteSeleccionado: any = null;

  /** Proveedor seleccionado (cuando categoría es PAGO_PROVEEDORES) */
  proveedorSeleccionado: any = null;

  /** Saldo actual del proveedor seleccionado */
  deudaActual = 0;

  /** Saldo restante del proveedor después de pago */
  deudaRestante = 0;
  
  // � Fecha y hora del movimiento
  fechaMovimiento = ''; // Fecha del movimiento (YYYY-MM-DD)
  horaMovimiento = ''; // Hora del movimiento (HH:mm:ss)
  
  // 🔒 Restricción de fecha según el periodo de la caja banco
  fechaMinima = ''; // Fecha mínima permitida (inicio del mes de la caja)
  fechaMaxima = ''; // Fecha máxima permitida (fin del mes de la caja)
  periodoNombre = ''; // Nombre del periodo para mostrar (ej: "Enero 2026")  
  // 🔐 Control de caja banco abierta para trabajadores
  cargandoCaja = true; // Estado de carga de caja banco
  cajaBancoAbierta: any = null; // Caja banco abierta disponible
  errorCaja = ''; // Mensaje de error si no hay caja abierta
  /** Categorías disponibles para ingresos */
  categorias_ingresos = ['CIERRE_CAJA_CHICA', 'TRANSFERENCIA_CLIENTE', 'OTRO_INGRESO'];

  /** Categorías disponibles para egresos */
  categorias_egresos = ['PAGO_TRABAJADOR', 'PAGO_PROVEEDORES', 'OTRO_EGRESO'];

  /** Categorías actualmente válidas según el tipo de movimiento seleccionado */
  categorias_actuales: string[] = this.categorias_ingresos;

  /**
   * Hook de inicialización de Angular.
   *
   * Realiza:
   * 1. Intenta obtener cajaId del estado del router
   * 2. Si no lo obtiene, busca en sessionStorage
   * 3. Si tampoco existe, obtiene automáticamente la última caja abierta
   * 4. Valida que exista una caja abierta antes de permitir operaciones
   * 5. Inicializa formulario reactivo
   * 6. Carga listas de clientes, empleados y proveedores
   */
  async ngOnInit(): Promise<void> {
    // 🕐 Inicializar fecha y hora por defecto
    this.inicializarFechaHora();
    
    // Capturar el cajaId del estado del router - usar sessionStorage como fallback
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state?.['cajaId']) {
      this.cajaId = navigation.extras.state['cajaId'];
      // Guardar en sessionStorage como fallback
      sessionStorage.setItem('cajaBancoIdActual', this.cajaId);
    } else {
      // Si no viene en navigation, intentar recuperar de sessionStorage
      const stored = sessionStorage.getItem('cajaBancoIdActual');
      if (stored) {
        this.cajaId = stored;
      }
    }

    // 🔐 Si no hay cajaId, obtener automáticamente la última caja abierta
    if (!this.cajaId) {
      await this.obtenerCajaAbiertalAutomaticamente();
      this.cajaBanco = this.cajaBancoAbierta;
    } else {
      // Si ya tiene cajaId, obtener la caja (puede estar cerrada)
      this.cajaBanco = await firstValueFrom(this.cajaBancoService.getCajaBancoById(this.cajaId));
    }

    console.log('🔍 CajaId final en registrar-movimiento:', this.cajaId);

    this.inicializarFormulario();
    this.cargarClientes();
    this.cargarEmpleados();
    this.cargarProveedores();
    // 🔒 Cargar restricciones de fecha según el periodo de la caja
    this.cargarRestriccionesFecha();

    // Bloquear formulario si no puede modificar la caja
    if (!this.puedeModificarCaja()) {
      this.formulario.disable();
      if (this.cajaBanco && this.cajaBanco.estado === 'CERRADA') {
        this.mensaje = 'No se puede registrar movimientos. La caja banco está cerrada.';
      } else {
        this.mensaje = 'No tiene permisos para modificar esta caja.';
      }
    } else {
      this.formulario.enable();
      this.mensaje = '';
    }
  }

  /**
   * Inicializa el formulario reactivo con validadores y cambios de listeners.
   *
   * Campos:
   * - tipo: INGRESO|EGRESO (obligatorio)
   * - categoria: categoría del movimiento (obligatorio)
   * - descripcion: detalle del movimiento (min 5 caracteres, obligatorio)
   * - monto: cantidad en USD (mín 0.01, obligatorio)
   * - referencia: número de comprobante o referencia (opcional)
   *
   * Listeners activos:
   * - Cambio de tipo: actualiza categorías disponibles
   * - Cambio de categoría: limpia búsqueda y selecciones
   * - Cambio de monto: recalcula deuda restante (si aplica)
   */
  inicializarFormulario(): void {
    const ahora = new Date();
    
    // Formato HH:mm:ss para hora
    const horas = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    const horaActual = `${horas}:${minutos}:${segundos}`;
    
    // Formato YYYY-MM-DD para fecha
    const año = ahora.getFullYear();
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dia = ahora.getDate().toString().padStart(2, '0');
    const fechaActual = `${año}-${mes}-${dia}`;

    this.formulario = this.fb.group({
      tipo: ['INGRESO', Validators.required],
      categoria: ['CIERRE_CAJA_CHICA', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      referencia: [''],
      fechaMovimiento: [fechaActual, Validators.required],
      horaMovimiento: [horaActual, Validators.required]
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

  /**
   * Carga las restricciones de fecha min/max basadas en el periodo de la caja banco.
   * Limita la selección de fecha al mes correspondiente de la caja.
   */
  async cargarRestriccionesFecha(): Promise<void> {
    if (!this.cajaId) {
      console.warn('⚠️ No hay cajaId para cargar restricciones de fecha');
      return;
    }

    try {
      const caja = await firstValueFrom(this.cajaBancoService.getCajaBancoById(this.cajaId));
      
      if (!caja?.fecha) {
        console.warn('⚠️ Caja sin fecha, no se pueden establecer restricciones');
        return;
      }

      // Convertir fecha de Firestore a Date
      let fechaCaja: Date;
      if ((caja.fecha as any)?.toDate) {
        fechaCaja = (caja.fecha as any).toDate();
      } else if (caja.fecha instanceof Date) {
        fechaCaja = caja.fecha;
      } else {
        fechaCaja = new Date(caja.fecha);
      }

      // Obtener periodo de la caja
      const periodo = obtenerPeriodo(fechaCaja);
      const year = periodo.year;
      const month = periodo.monthIndex0; // Base 0

      // Calcular primer y último día del mes
      const primerDia = new Date(year, month, 1);
      const ultimoDia = new Date(year, month + 1, 0); // Día 0 del mes siguiente = último día del mes actual

      // Formatear para input[type="date"] (YYYY-MM-DD)
      this.fechaMinima = this.formatearFecha(primerDia);
      this.fechaMaxima = this.formatearFecha(ultimoDia);
      
      // Nombre del periodo para mostrar
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      this.periodoNombre = `${meses[month]} ${year}`;

      console.log(`📅 Restricciones de fecha establecidas: ${this.fechaMinima} a ${this.fechaMaxima} (${this.periodoNombre})`);
    } catch (error) {
      console.error('❌ Error cargando restricciones de fecha:', error);
    }
  }

  /**
   * Formatea una fecha a string YYYY-MM-DD para input[type="date"]
   */
  private formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Carga la lista de clientes desde el servicio.
   * Los clientes se utilizan para movimientos de TRANSFERENCIA_CLIENTE.
   */
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

  /**
   * Carga la lista de empleados desde el servicio.
   * Los empleados se utilizan para movimientos de PAGO_TRABAJADOR.
   */
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

  /**
   * Carga la lista de proveedores desde el servicio.
   * Los proveedores se utilizan para movimientos de PAGO_PROVEEDORES.
   */
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

  /**
   * Ejecuta búsqueda de clientes/empleados/proveedores según el término ingresado.
   *
   * Busca coincidencias en:
   * - Nombres y apellidos
   * - Cédula/RUC
   * - Código (para proveedores)
   * - ID de Firebase
   * - Representante legal (para empresas)
   *
   * La fuente de búsqueda depende del tipo y categoría seleccionados.
   */
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

  /**
   * Selecciona una persona de la lista de búsqueda.
   *
   * Para proveedores:
   * - Guarda la deuda actual
   * - Muestra el código del proveedor en el campo de búsqueda
   * - Recalcula deuda restante
   *
   * Para otros:
   * - Muestra cédula o nombre completo
   *
   * @param cliente - Objeto seleccionado de clientes/empleados/proveedores
   */
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

  /**
   * Manejador para cambio de tipo de movimiento (INGRESO/EGRESO).
   *
   * Actualiza:
   * - Categorías disponibles
   * - Valor de categoría (por defecto la primera de su tipo)
   * - Limpia selecciones previas
   *
   * @param tipo - Tipo de movimiento seleccionado
   */
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

  /**
   * Manejador para cambio de categoría.
   *
   * Limpia todas las selecciones de personas y búsqueda.
   * Actualiza las opciones disponibles según la nueva categoría.
   *
   * @param categoria - Categoría seleccionada
   */
  onCategoriaChange(categoria: string): void {
    this.clienteSeleccionado = null;
    this.proveedorSeleccionado = null;
    this.busquedaCliente = '';
    this.deudaActual = 0;
    this.deudaRestante = 0;
    this.actualizarOpcionesBusqueda();
  }

  /**
   * Determina si el formulario debe mostrar campo de búsqueda de persona.
   *
   * Retorna true para:
   * - INGRESO + TRANSFERENCIA_CLIENTE
   * - EGRESO + PAGO_TRABAJADOR
   * - EGRESO + PAGO_PROVEEDORES
   *
   * @returns {boolean} Indica si debe mostrarse el campo de búsqueda
   */
  mostrarBusquedaCliente(): boolean {
    const tipo = this.formulario.get('tipo')?.value;
    const categoria = this.formulario.get('categoria')?.value;
    return (tipo === 'INGRESO' && categoria === 'TRANSFERENCIA_CLIENTE') ||
           (tipo === 'EGRESO' && categoria === 'PAGO_TRABAJADOR') ||
           (tipo === 'EGRESO' && categoria === 'PAGO_PROVEEDORES');
  }

  /**
   * Actualiza la deuda restante del proveedor tras un pago.
   *
   * Solo aplica para categoría PAGO_PROVEEDORES.
   * deudaRestante = max(0, deudaActual - montoIngresado)
   *
   * @param monto - Monto del pago
   */
  actualizarDeudaRestante(monto: number): void {
    if (this.formulario.get('categoria')?.value === 'PAGO_PROVEEDORES' && this.proveedorSeleccionado) {
      this.deudaRestante = Math.max(0, this.deudaActual - (monto || 0));
    }
  }

  /**
   * Actualiza la lista de opciones de búsqueda según tipo/categoría actual.
   *
   * La fuente puede ser:
   * - Empleados (si PAGO_TRABAJADOR)
   * - Proveedores (si PAGO_PROVEEDORES)
   * - Clientes (en cualquier otro caso)
   *
   * @private
   */
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

  /**
   * Valida la selección de persona cuando se pierde el foco del input.
   *
   * Si el texto ingresado coincide con alguna persona en la lista actual,
   * la selecciona automáticamente. De lo contrario, limpia la selección.
   *
   * Compara contra:
   * - Cédula/RUC
   * - ID de Firebase
   * - Código (proveedores)
   * - Nombre completo
   */
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

  /**
   * Valida y guarda un nuevo movimiento en la base de datos.
   *
   * Proceso:
   * 1. Valida el formulario
   * 2. Si requiere persona, verifica que esté seleccionada
   * 3. Construye el objeto de movimiento con campos específicos según categoría
   * 4. Para PAGO_PROVEEDORES: actualiza saldo del proveedor en Firestore
   * 5. Redirige según origen (caja específica o listado general)
   *
   * @returns {Promise<void>}
   */
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
      // Obtener fecha y hora del formulario
      const fechaSeleccionada = this.formulario.get('fechaMovimiento')?.value || this.fechaMovimiento;
      const horaSeleccionada = this.formulario.get('horaMovimiento')?.value || this.horaMovimiento;
      
      // ✅ VALIDAR QUE LA FECHA ESTÉ DENTRO DEL PERIODO DE LA CAJA BANCO
      if (this.fechaMinima && this.fechaMaxima) {
        if (fechaSeleccionada < this.fechaMinima || fechaSeleccionada > this.fechaMaxima) {
          Swal.fire({
            icon: 'error',
            title: 'Fecha Inválida',
            text: `La fecha debe estar dentro del periodo ${this.periodoNombre}. Seleccione una fecha entre ${this.fechaMinima} y ${this.fechaMaxima}.`,
            confirmButtonText: 'Entendido'
          });
          this.guardando = false;
          return;
        }
      }
      
      // Combinar fecha y hora seleccionadas por el usuario
      const fechaFinal = this.combinarFechaHora(fechaSeleccionada, horaSeleccionada);
      
      console.log('📅 Fecha movimiento:', fechaSeleccionada);
      console.log('🕐 Hora movimiento:', horaSeleccionada);
      console.log('✅ Fecha final:', fechaFinal);

      // Construir movimiento evitando campos undefined (Firestore no los acepta)
      const movimientoBase: any = {
        tipo: this.formulario.value.tipo,
        categoria: this.formulario.value.categoria,
        descripcion: this.formulario.value.descripcion,
        monto: this.formulario.value.monto,
        referencia: this.formulario.value.referencia || '',
        fecha: fechaFinal,
        usuario_id: usuario?.id || null,
        usuario_nombre: usuario?.nombre || null,
      };

      // Asociar el movimiento a la caja banco específica
      if (this.cajaId) {
        movimientoBase.caja_banco_id = this.cajaId;
      }

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

      console.log('📝 Movimiento a registrar:', {
        cajaId: this.cajaId,
        caja_banco_id: movimientoBase.caja_banco_id,
        tipo: movimientoBase.tipo,
        categoria: movimientoBase.categoria,
        monto: movimientoBase.monto
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
        // Volver a la caja específica si viene de ver-caja, sino ir a listar
        if (this.cajaId) {
          this.router.navigate(['/caja-banco', this.cajaId, 'ver']);
        } else {
          this.router.navigate(['/caja-banco']);
        }
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

  /**
   * Inicializa fecha y hora con valores actuales por defecto
   */
  inicializarFechaHora(): void {
    const ahora = new Date();
    
    // Formato HH:mm:ss para hora
    const horas = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    this.horaMovimiento = `${horas}:${minutos}:${segundos}`;
    
    // Formato YYYY-MM-DD para fecha
    const año = ahora.getFullYear();
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dia = ahora.getDate().toString().padStart(2, '0');
    this.fechaMovimiento = `${año}-${mes}-${dia}`;
  }

  /**
   * Obtiene automáticamente la última caja banco ABIERTA del sistema.
   * Este método se ejecuta cuando no se proporciona un cajaId específico.
   * Ideal para trabajadores que solo necesitan registrar movimientos.
   */
  async obtenerCajaAbiertalAutomaticamente(): Promise<void> {
    try {
      this.cargandoCaja = true;
      this.errorCaja = '';
      
      const caja = await this.cajaBancoService.getCajaBancoAbierta();
      
      if (caja && caja.id) {
        this.cajaBancoAbierta = caja;
        this.cajaId = caja.id;
        sessionStorage.setItem('cajaBancoIdActual', this.cajaId);
        console.log('✅ Caja banco abierta obtenida automáticamente:', caja);
      } else {
        this.errorCaja = 'No hay ninguna caja banco abierta. Por favor, contacta al administrador para que abra una caja banco.';
        console.warn('⚠️ No se encontró ninguna caja banco abierta');
      }
    } catch (error) {
      this.errorCaja = 'Error al verificar cajas banco. Por favor, recarga la página.';
      console.error('❌ Error obteniendo caja banco abierta:', error);
    } finally {
      this.cargandoCaja = false;
    }
  }

  /**
   * Valida que la caja banco especificada esté en estado ABIERTA.
   * Previene registro de movimientos en cajas cerradas.
   */
  async validarCajaAbierta(): Promise<void> {
    try {
      this.cargandoCaja = true;
      this.errorCaja = '';
      
      const caja = await firstValueFrom(this.cajaBancoService.getCajaBancoById(this.cajaId));
      
      if (!caja) {
        this.errorCaja = 'La caja banco especificada no existe.';
        this.cajaId = '';
      } else if (caja.estado !== 'ABIERTA') {
        this.errorCaja = 'La caja banco está cerrada. No se pueden registrar movimientos en cajas cerradas.';
        this.cajaId = '';
      } else {
        this.cajaBancoAbierta = caja;
        console.log('✅ Caja banco validada como abierta:', caja);
      }
    } catch (error) {
      this.errorCaja = 'Error al validar la caja banco. Por favor, verifica que exista y esté abierta.';
      console.error('❌ Error validando caja banco:', error);
      this.cajaId = '';
    } finally {
      this.cargandoCaja = false;
    }
  }

  /**
   * Determina si el formulario debe estar bloqueado.
   * El formulario se bloquea si:
   * - Está cargando la caja
   * - No hay caja disponible
   * - Hay error de caja
   */
  get formularioBloqueado(): boolean {
    return this.cargandoCaja || !this.cajaId || !!this.errorCaja;
  }

  /**
   * Obtener nombre de la caja para mostrar en la UI
   */
  get nombreCaja(): string {
    if (!this.cajaBancoAbierta) return '';
    const fecha = this.cajaBancoAbierta.fecha;
    if (fecha?.toDate) {
      return fecha.toDate().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    return '';
  }

  /**
   * Combina una fecha con una hora para crear un Date válido
   * @param fecha - Fecha como string (YYYY-MM-DD)
   * @param hora - Hora como string (HH:mm:ss)
   * @returns Date con fecha y hora combinadas
   */
  combinarFechaHora(fecha: string, hora: string): Date {
    // Parsear string YYYY-MM-DD y crear Date con hora 00:00:00 local
    const partes = fecha.split('-');
    const año = parseInt(partes[0]);
    const mes = parseInt(partes[1]) - 1; // Meses 0-indexed en Date
    const dia = parseInt(partes[2]);
    const fechaBase = new Date(año, mes, dia, 0, 0, 0, 0);
    
    // Parsear hora HH:mm:ss
    const partesHora = hora.split(':');
    const horas = parseInt(partesHora[0] || '0');
    const minutos = parseInt(partesHora[1] || '0');
    const segundos = parseInt(partesHora[2] || '0');
    
    // Establecer la hora específica (esto NO causa conversión de zona horaria)
    fechaBase.setHours(horas, minutos, segundos, 0);
    
    console.log(`🔧 combinarFechaHora entrada: fecha=${fecha}, hora=${hora}`);
    console.log(`🔧 combinarFechaHora resultado: ${fechaBase.toLocaleString()} (${fechaBase.toISOString()})`);
    
    return fechaBase;
  }

  /**
   * Navega de vuelta a la lista de cajas banco.
   */
  volver(): void {
    this.router.navigate(['/caja-banco']);
  }
}
