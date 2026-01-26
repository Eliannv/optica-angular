import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Ingreso } from '../../../../core/models/ingreso.model';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Proveedor } from '../../../../core/models/proveedor.model';
import Swal from 'sweetalert2';

/**
 * Componente CrearIngresoComponent - Creación de nuevos ingresos con validaciones complejas.
 *
 * **Responsabilidades principales:**
 * - Formulario de creación de ingreso (factura, proveedor, fecha, etc)
 * - Gestión de lista de proveedores existentes
 * - Opción de crear nuevo proveedor inline (sin salir del flujo)
 * - Validaciones complejas: RUC ecuatoriano, teléfonos, códigos únicos
 * - Guardado temporal de ingreso para continuar a agregar productos
 *
 * **Características técnicas:**
 * - Componente standalone moderno
 * - Formulario reactivo (FormBuilder, FormGroup, Validators)
 * - Búsqueda de proveedores en tiempo real con input autocomplete
 * - Validaciones asincrónicas: RUC, nombre, código, número factura (Promise-based)
 * - Uso de Angular signals (guardando, error, mostrarFormNuevoProveedor)
 * - Objeto ingreso temporal stored en IngresosService durante flujo
 *
 * **Flujo de usuario:**
 * 1. Usuario ve formulario: Proveedor, Número Factura, Fecha, Tipo Compra, etc
 * 2. Busca proveedor existente (autocomplete)
 * 3. Si no existe, puede crear proveedor nuevo inline (modal/form collapse)
 * 4. Ingresa detalles: Factura, fecha, descuento, flete, IVA
 * 5. Hace clic "Continuar" → Valida todo → Guarda temporal
 * 6. Navega a /productos/ingreso/:id/agregar-productos
 * 7. Usuario agrega productos de ingreso
 * 8. Al guardar productos → Ingreso se finaliza en BD
 *
 * **Integración de servicios:**
 * - IngresosService: guardarIngresoTemporal(), numeroFacturaExists()
 * - ProveedoresService: CRUD de proveedores, validaciones (RUC, nombre, código)
 * - Router: Navegación a siguiente paso (agregar productos)
 *
 * **Validaciones implementadas:**
 * - RUC ecuatoriano (13 dígitos, formato específico)
 * - Teléfonos (celular 09XXXXXXXX, convencional 07XXXXX)
 * - Códigos de lugar (1-24, provincias Ecuador)
 * - Nombres y códigos únicos (no duplicados en BD)
 * - Número de factura único (solo una factura por número)
 * - Formato de datos (strings trimmed, numbers positivos)
 *
 * @component
 * @selector app-crear-ingreso
 * @standalone true
 * @imports [CommonModule, FormsModule, ReactiveFormsModule]
 *
 * @example
 * // En routing:
 * { path: 'nuevo', component: CrearIngresoComponent }
 */
@Component({
  selector: 'app-crear-ingreso',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './crear-ingreso.html',
  styleUrls: ['./crear-ingreso.css'],
})
export class CrearIngresoComponent implements OnInit {
  /**
   * Referencia inyectada a Angular Router para navegación SPA.
   * @type {Router}
   * @private
   */
  private router = inject(Router);

  /**
   * Referencia inyectada a FormBuilder para crear formularios reactivos.
   * @type {FormBuilder}
   * @private
   */
  private fb = inject(FormBuilder);

  /**
   * Referencia inyectada a IngresosService para operaciones de ingresos.
   * @type {IngresosService}
   * @private
   */
  private ingresosService = inject(IngresosService);

  /**
   * Referencia inyectada a ProveedoresService para operaciones de proveedores.
   * @type {ProveedoresService}
   * @private
   */
  private proveedoresService = inject(ProveedoresService);

  /**
   * Señal reactiva para estado de guardado.
   * true: Operación en progreso (deshabilitar botones)
   * false: Listo para interacción
   * @type {WritableSignal<boolean>}
   * @default false
   */
  guardando = signal(false);

  /**
   * Señal reactiva para mensajes de error.
   * null: Sin error
   * string: Mensaje de error a mostrar al usuario
   * @type {WritableSignal<string | null>}
   * @default null
   */
  error = signal<string | null>(null);

  /**
   * Señal reactiva para mostrar/ocultar formulario de nuevo proveedor.
   * true: Mostrar form para crear proveedor
   * false: Ocultar form (mostrar búsqueda de proveedores existentes)
   * @type {WritableSignal<boolean>}
   * @default false
   */
  mostrarFormNuevoProveedor = signal(false);

  /**
   * Término de búsqueda en campo autocomplete de proveedores.
   * Se usa para filtrar lista de proveedores disponibles en tiempo real.
   * @type {WritableSignal<string>}
   * @default ''
   */
  busquedaProveedor = signal('');

  /**
   * Objeto ingreso en construcción durante el flujo de creación.
   * Se completa progresivamente:
   * 1. En este paso: proveedor, numeroFactura, fecha, tipoCompra, descuento, flete, iva
   * 2. En siguiente paso: Se agregan items (productos) y detalles
   * 3. Al guardar: Se finalizará en BD con estado BORRADOR
   * @type {Ingreso}
   * @remarks Algunos campos son opcionales (IVA, descuento, flete pueden ser 0)
   */
  ingreso: Ingreso = {
    proveedor: '',
    numeroFactura: '',
    fecha: new Date(),
    tipoCompra: 'CONTADO',
    descuento: 0,
    flete: 0,
    iva: 0,
  };

  /**
   * Lista completa de proveedores cargados desde Firestore.
   * Se obtiene en ngOnInit y se mantiene como referencia.
   * @type {Proveedor[]}
   * @private Se refiere desde cargarProveedores() en constructor
   */
  proveedores: Proveedor[] = [];

  /**
   * Lista filtrada de proveedores para mostrar en dropdown autocomplete.
   * Se actualiza en buscarProveedor() cuando usuario escribe en búsqueda.
   * @type {Proveedor[]}
   * @private Inicialmente igual a this.proveedores, filtrada después
   */
  proveedoresFiltrados: Proveedor[] = [];

  /**
   * Proveedor actualmente seleccionado en dropdown.
   * null: Ninguno seleccionado (o usuario escribió texto libre)
   * Proveedor: Usuario seleccionó proveedor de la lista
   * @type {Proveedor | null}
   * @default null
   */
  proveedorSeleccionado: Proveedor | null = null;

  /**
   * Formulario reactivo para crear nuevo proveedor inline.
   * Se inicializa en initFormNuevoProveedor() con validadores.
   * @type {FormGroup}
   * @remarks Se llena con valores del usuario si elige "Crear proveedor"
   */
  formNuevoProveedor!: FormGroup;

  /**
   * Flag de validación asincrónica: Nombre en proceso de validación.
   * true: Esperando respuesta de ProveedoresService.nombreExists()
   * false: Validación completada o no iniciada
   * @type {boolean}
   * @default false
   * @remarks Se usa para deshabilitar botón "Guardar proveedor" mientras valida
   */
  validandoNombre = false;

  /**
   * Flag de validación asincrónica: RUC en proceso de validación.
   * true: Esperando respuesta de ProveedoresService.rucExists()
   * false: Validación completada o no iniciada
   * @type {boolean}
   * @default false
   */
  validandoRuc = false;

  /**
   * Objeto con estado de validaciones de todos los campos del proveedor.
   * Estructura: { campo: { valido: boolean, mensaje: string } }
   * Se usa para mostrar mensajes de validación al usuario (✓ o ✗)
   * @type {Object}
   * @remarks
   * - codigo: Formato A1234 (1+ letras, 4+ números)
   * - nombre: Nombre único en BD
   * - ruc: 13 dígitos, formato ecuatoriano válido, único en BD
   * - telefonoPrincipal: 09XXXXXXXX (celular) o 07XXXXX (convencional)
   * - telefonoSecundario: Mismo formato que principal
   * - codigoLugar: 01-24 (provincias Ecuador)
   * - numeroFactura: Número único de factura del ingreso actual
   */
  validaciones = {
    codigo: { valido: false, mensaje: '' },
    nombre: { valido: false, mensaje: '' },
    ruc: { valido: false, mensaje: '' },
    telefonoPrincipal: { valido: false, mensaje: '' },
    telefonoSecundario: { valido: false, mensaje: '' },
    codigoLugar: { valido: false, mensaje: '' },
    numeroFactura: { valido: false, mensaje: '' }
  };

  /**
   * Flag de validación asincrónica: Número factura en proceso.
   * true: Esperando respuesta de IngresosService.numeroFacturaExists()
   * false: Validación completada o no iniciada
   * @type {boolean}
   * @default false
   */
  validandoNumeroFactura = false;

  /**
   * Hook de inicialización del ciclo de vida Angular.
   *
   * **Responsabilidades:**
   * 1. Carga lista de proveedores desde Firestore
   * 2. Inicializa formulario reactivo para nuevo proveedor
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta automáticamente por Angular después de construcción
   * - Operaciones asincrónicas aquí disparan observables (sin await)
   * - El formulario se prepara para posible uso en modal/collapse
   */
  ngOnInit() {
    this.cargarProveedores();
    this.initFormNuevoProveedor();
  }

  /**
   * Getter que valida si el formulario de nuevo proveedor es válido para guardar.
   *
   * **Criterios de validación:**
   * 1. FormGroup es válido (Validators básicos: required, minLength, etc)
   * 2. No hay validaciones asincrónicas pendientes (validandoNombre, validandoRuc, etc)
   * 3. Si nombre tiene mensaje de validación: debe ser válido (no duplicado)
   * 4. Si código está completo: debe ser válido (no duplicado)
   * 5. Si RUC tiene mensaje de validación: debe ser válido (no duplicado)
   *
   * **Flujo lógico:**
   * - Si algún criterio falla → Retorna false (botón deshabilitado)
   * - Solo si TODOS pasan → Retorna true (botón habilitado)
   *
   * @returns {boolean} true si formulario es válido y listo para guardar
   *
   * @remarks
   * - Usado en template: [disabled]="!puedeGuardarProveedor"
   * - Previene guardado de datos inválidos
   * - Las validaciones asincrónicas son obligatorias antes de guardar
   */
  get puedeGuardarProveedor(): boolean {
    if (this.formNuevoProveedor.invalid) {
      return false;
    }

    if (this.validandoNombre || this.validandoRuc || this.validandoNumeroFactura) {
      return false;
    }

    // Validar nombre (si tiene mensaje, debe ser válido)
    if (this.validaciones.nombre.mensaje && !this.validaciones.nombre.valido) {
      return false;
    }

    // Validar código (si hay código ingresado, debe ser válido)
    const codigoValue = this.formNuevoProveedor.get('codigo')?.value;
    if (codigoValue && this.validaciones.codigo.mensaje && !this.validaciones.codigo.valido) {
      return false;
    }

    // Validar RUC (si tiene mensaje, debe ser válido)
    if (this.validaciones.ruc.mensaje && !this.validaciones.ruc.valido) {
      return false;
    }

    return true;
  }

  /**
   * Inicializa el formulario reactivo para crear nuevo proveedor.
   *
   * **Campos del formulario:**
   * - codigo (optional): A1234, 1+ letras + 4+ números
   * - nombre (required): Nombre único del proveedor
   * - ruc (required): 13 dígitos, ecuatoriano válido
   * - representante (optional): Nombre del representante legal
   * - telefonoPrincipal (optional): 09XXXXXXXX o 07XXXXX
   * - telefonoSecundario (optional): 09XXXXXXXX o 07XXXXX
   * - codigoLugar (optional): 01-24 (provincia)
   * - direccion (optional): Dirección física
   * - saldo (optional): Deuda inicial (default 0)
   *
   * **Validadores:**
   * - nombre: Requerido (validator)
   * - ruc: Requerido, minLength 13, maxLength 13
   * - saldo: Mínimo 0
   * - Resto: Sin validadores (validaciones custom en métodos)
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta en ngOnInit
   * - Los validadores son básicos; validaciones async ocurren después (blur)
   * - FormBuilder crea FormGroup con FormControls tipados
   */
  initFormNuevoProveedor() {
    this.formNuevoProveedor = this.fb.group({
      codigo: [''],
      nombre: ['', Validators.required],
      ruc: ['', [Validators.required, Validators.minLength(13), Validators.maxLength(13)]],
      representante: [''],
      telefonoPrincipal: [''],
      telefonoSecundario: [''],
      codigoLugar: [''],
      direccion: [''],
      saldo: [0, Validators.min(0)]
    });
  }

  /**
   * Carga lista de todos los proveedores desde Firestore.
   *
   * **Flujo:**
   * 1. Suscribe a ProveedoresService.getProveedores() Observable
   * 2. Asigna resultado a this.proveedores
   * 3. Copia a this.proveedoresFiltrados (para búsqueda/dropdown)
   *
   * **Manejo de errores:**
   * - Log de error en consola
   * - Asigna mensaje de error a signal (mostrado en template)
   * - No interrumpe flujo (error silencioso para algunos usuarios)
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta en ngOnInit
   * - La suscripción persiste durante vida del componente
   * - Actualiza lista visible cuando usuario abre form de nuevo proveedor
   */
  cargarProveedores(): void {
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedores = proveedores;
        this.proveedoresFiltrados = proveedores;
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
        this.error.set('Error al cargar los proveedores');
      }
    });
  }

  /**
   * Busca proveedores por término (nombre, código, RUC) en tiempo real.
   *
   * **Algoritmo:**
   * 1. Obtiene término de this.busquedaProveedor() signal
   * 2. Normaliza: trim() + toLowerCase() (case-insensitive, sin espacios)
   * 3. Si término vacío: Muestra todos (this.proveedoresFiltrados = this.proveedores)
   * 4. Si término tiene contenido: Filtra por:
   *    - Nombre contiene término
   *    - Código contiene término
   *    - RUC contiene término
   *    - Operador OR: Si coincide CUALQUIERA, incluir
   * 5. Asigna resultado a this.proveedoresFiltrados
   *
   * **Casos especiales:**
   * - Búsqueda vacía: Muestra todos
   * - Sin coincidencias: proveedoresFiltrados = [] (dropdown vacío)
   * - Búsqueda parcial: Ejemplo "prov" coincide "Proveedor A"
   *
   * **Performance:**
   * - O(n) donde n = cantidad de proveedores
   * - Se ejecuta en tiempo real (on input change)
   * - Rápido incluso con cientos de proveedores
   *
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta cuando usuario escribe en campo de búsqueda
   * - (ngModelChange)="buscarProveedor()" en template
   * - No es método async (búsqueda local es instantánea)
   */
  buscarProveedor() {
    const termino = this.busquedaProveedor().toLowerCase();
    if (!termino) {
      this.proveedoresFiltrados = this.proveedores;
      return;
    }

    this.proveedoresFiltrados = this.proveedores.filter(p =>
      p.nombre?.toLowerCase().includes(termino) ||
      p.codigo?.toLowerCase().includes(termino) ||
      p.ruc?.includes(termino)
    );
  }

  /**
   * Selecciona un proveedor de la lista y asigna sus datos al ingreso.
   *
   * **Algoritmo:**
   * 1. Busca proveedor por código, ID, o nombre (múltiples modos)
   * 2. Si encuentra: Asigna proveedor a this.proveedorSeleccionado
   * 3. Asigna nombre del proveedor a this.ingreso.proveedor (visible)
   * 4. Opcionalmente guarda proveedorId para vincular (comentado)
   * 5. Limpia campo de búsqueda (cierra dropdown)
   *
   * **Parámetro:**
   * - codigo: Puede ser código actual, ID Firestore, o nombre
   * - Intenta buscar en múltiples campos para robustez
   *
   * **Casos especiales:**
   * - Proveedor no encontrado: Asigna null a proveedorSeleccionado
   * - Campo de búsqueda se vacía (oculta dropdown)
   *
   * @param {string} codigo - Identificador de proveedor (código, ID, o nombre)
   * @returns {void}
   *
   * @remarks
   * - Se ejecuta cuando usuario hace clic en proveedor de dropdown
   * - (ngClick)="seleccionarProveedor(proveedor.codigo)" en template
   * - El nombre seleccionado se muestra en campo de entrada
   * - No usa proveedorId explícitamente (solo nombre en ingreso.proveedor)
   */
  seleccionarProveedor(codigo: string) {
    const prov = this.proveedores.find(p =>
      p.codigo?.toLowerCase() === codigo.toLowerCase() ||
      p.id === codigo ||
      p.nombre?.toLowerCase() === codigo.toLowerCase()
    );

    this.proveedorSeleccionado = prov || null;
    // Guardar nombre y código del proveedor
    this.ingreso.proveedor = prov?.nombre || codigo;
    this.ingreso.proveedorCodigo = prov?.codigo; // Guardar código para futuras búsquedas
    (this.ingreso as any).proveedorId = prov?.id || prov?.codigo || undefined;
    this.busquedaProveedor.set('');
  }

  /**
   * Valida que un código de proveedor tenga el formato correcto.
   *
   * **Formato requerido:** Mínimo 1 letra + 4 números
   * - Ejemplos válidos: A1234, ABC5678, PROV0001
   * - Ejemplos inválidos: 12345 (sin letras), ABC (sin números)
   *
   * @param {string} codigo - Código a validar
   * @returns {boolean} true si formato es válido
   */
  validarFormatoCodigo(codigo: string): boolean {
    if (!codigo) return false;
    const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
    const numeros = (codigo.match(/[0-9]/g) || []).length;
    return letras >= 1 && numeros >= 4;
  }

  /**
   * Valida que código de proveedor sea único (sin duplicados en BD).
   *
   * **Flujo:**
   * 1. Si vacío: Limpia validación
   * 2. Si formato inválido: Setea mensaje de error
   * 3. Si formato válido: Busca en BD si existe
   * 4. Asigna valido y mensaje según resultado
   *
   * @returns {Promise<void>} Operación async
   */
  async validarCodigo(): Promise<void> {
    const codigo = this.formNuevoProveedor.get('codigo')?.value;
    if (!codigo || codigo.trim() === '') {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = '';
      return;
    }

    if (!this.validarFormatoCodigo(codigo)) {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = 'Debe contener al menos 1 letra y 4 números';
      return;
    }

    try {
      const existe = await this.proveedoresService.codigoExists(codigo);
      if (existe) {
        this.validaciones.codigo.valido = false;
        this.validaciones.codigo.mensaje = 'Este código ya está registrado';
      } else {
        this.validaciones.codigo.valido = true;
        this.validaciones.codigo.mensaje = 'Código disponible';
      }
    } catch (error) {
      console.error('Error al validar código:', error);
    }
  }

  /**
   * Valida que nombre de proveedor sea único (sin duplicados en BD).
   *
   * **Flujo:**
   * 1. Si vacío: Limpia validación
   * 2. Setea validandoNombre=true (deshabilita botón)
   * 3. Busca en BD si nombre existe
   * 4. Asigna valido y mensaje
   * 5. En finally: Setea validandoNombre=false
   *
   * @returns {Promise<void>} Operación async
   */
  async validarNombre(): Promise<void> {
    const nombre = this.formNuevoProveedor.get('nombre')?.value;
    if (!nombre || nombre.trim() === '') {
      this.validaciones.nombre.valido = false;
      this.validaciones.nombre.mensaje = '';
      return;
    }

    this.validandoNombre = true;
    try {
      const existe = await this.proveedoresService.nombreExists(nombre);
      if (existe) {
        this.validaciones.nombre.valido = false;
        this.validaciones.nombre.mensaje = 'Ya existe un proveedor con este nombre';
      } else {
        this.validaciones.nombre.valido = true;
        this.validaciones.nombre.mensaje = 'Nombre disponible';
      }
    } catch (error) {
      console.error('Error al validar nombre:', error);
    } finally {
      this.validandoNombre = false;
    }
  }

  /**
   * Valida que RUC sea único y formato correcto (ecuatoriano).
   *
   * **Validaciones de formato:**
   * 1. Exactamente 13 dígitos
   * 2. Primeros 2 dígitos: Código provincia (01-24)
   * 3. Tercer dígito: Tipo de contribuyente (0-5, 6, ó 9)
   *
   * **Flujo:**
   * 1. Valida formato
   * 2. Setea validandoRuc=true
   * 3. Busca en BD si existe
   * 4. Asigna valido y mensaje
   * 5. En finally: Setea validandoRuc=false
   *
   * @returns {Promise<void>} Operación async
   */
  async validarRUC(): Promise<void> {
    const ruc = this.formNuevoProveedor.get('ruc')?.value;
    
    if (!ruc || ruc.trim() === '') {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = '';
      return;
    }

    if (!/^\d{13}$/.test(ruc)) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'El RUC debe tener exactamente 13 dígitos';
      return;
    }

    const provincia = parseInt(ruc.substring(0, 2));
    if (provincia < 1 || provincia > 24) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'Código de provincia inválido (primeros 2 dígitos)';
      return;
    }

    const tercerDigito = parseInt(ruc.charAt(2));
    if (!(tercerDigito === 9 || tercerDigito === 6 || (tercerDigito >= 0 && tercerDigito <= 5))) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'Tercer dígito de RUC inválido';
      return;
    }

    this.validandoRuc = true;
    try {
      const existe = await this.proveedoresService.rucExists(ruc);
      if (existe) {
        this.validaciones.ruc.valido = false;
        this.validaciones.ruc.mensaje = 'Este RUC ya está registrado';
        return;
      }

      this.validaciones.ruc.valido = true;
      this.validaciones.ruc.mensaje = 'RUC válido';
    } catch (error) {
      console.error('Error al validar RUC:', error);
    } finally {
      this.validandoRuc = false;
    }
  }

  /**
   * Valida que número de factura sea único (sin duplicados en BD).
   *
   * **Flujo:**
   * 1. Setea validandoNumeroFactura=true
   * 2. Busca en BD si número existe
   * 3. Asigna valido y mensaje
   * 4. En finally: Setea validandoNumeroFactura=false
   *
   * @returns {Promise<void>} Operación async
   */
  async validarNumeroFactura(): Promise<void> {
    const num = this.ingreso.numeroFactura;
    if (!num || num.trim() === '') {
      this.validaciones.numeroFactura.valido = false;
      this.validaciones.numeroFactura.mensaje = '';
      return;
    }

    this.validandoNumeroFactura = true;
    try {
      const existe = await this.ingresosService.numeroFacturaExists(num);
      if (existe) {
        this.validaciones.numeroFactura.valido = false;
        this.validaciones.numeroFactura.mensaje = 'Este número de factura ya existe';
      } else {
        this.validaciones.numeroFactura.valido = true;
        this.validaciones.numeroFactura.mensaje = 'Número de factura disponible';
      }
    } catch (error) {
      console.error('Error al validar número de factura:', error);
    } finally {
      this.validandoNumeroFactura = false;
    }
  }

  /**
   * Valida que teléfono sea en formato correcto para Ecuador.
   *
   * **Formatos aceptados:**
   * - Celular: 09XXXXXXXX (10 dígitos)
   * - Convencional: 07XXXXXX o 07XXXXXXX (8-9 dígitos, El Oro)
   *
   * @param {('principal'|'secundario')} tipo - Tipo de teléfono a validar
   * @returns {void}
   */
  validarTelefono(tipo: 'principal' | 'secundario'): void {
    const campo = tipo === 'principal' ? 'telefonoPrincipal' : 'telefonoSecundario';
    const telefono = this.formNuevoProveedor.get(tipo === 'principal' ? 'telefonoPrincipal' : 'telefonoSecundario')?.value;
    
    if (!telefono || telefono.trim() === '') {
      this.validaciones[campo].valido = false;
      this.validaciones[campo].mensaje = '';
      return;
    }

    const esCelular = /^09\d{8}$/.test(telefono);
    const esConvencional = /^07\d{6,7}$/.test(telefono);

    if (esCelular) {
      this.validaciones[campo].valido = true;
      this.validaciones[campo].mensaje = 'Teléfono celular válido';
    } else if (esConvencional) {
      this.validaciones[campo].valido = true;
      this.validaciones[campo].mensaje = 'Teléfono convencional válido (El Oro)';
    } else {
      this.validaciones[campo].valido = false;
      this.validaciones[campo].mensaje = 'Debe ser celular (09XXXXXXXX) o convencional de El Oro (07XXXXXXX)';
    }
  }

  /**
   * Valida que código de lugar sea válido (01-24, provincias Ecuador).
   *
   * **Rango válido: 1-24** (24 provincias Ecuador)
   *
   * @returns {void}
   */
  validarCodigoLugar(): void {
    const codigoLugar = this.formNuevoProveedor.get('codigoLugar')?.value;
    
    if (!codigoLugar || codigoLugar.trim() === '') {
      this.validaciones.codigoLugar.valido = false;
      this.validaciones.codigoLugar.mensaje = '';
      return;
    }

    const codigo = parseInt(codigoLugar);
    if (codigo >= 1 && codigo <= 24) {
      this.validaciones.codigoLugar.valido = true;
      this.validaciones.codigoLugar.mensaje = 'Código válido';
    } else {
      this.validaciones.codigoLugar.valido = false;
      this.validaciones.codigoLugar.mensaje = 'Debe estar entre 01 y 24';
    }
  }

  /**
   * Crea un objeto Proveedor vacío con estructura correcta.
   *
   * @returns {Proveedor} Objeto Proveedor con todos los campos inicializados
   */
  getProveedorVacio(): Proveedor {
    return {
      codigo: '',
      nombre: '',
      representante: '',
      ruc: '',
      telefonos: {
        principal: '',
        secundario: ''
      },
      direccion: {
        codigoLugar: '',
        direccion: ''
      },
      saldo: 0
    };
  }

  /**
   * Muestra/oculta formulario para crear nuevo proveedor inline.
   *
   * **Comportamiento:**
   * 1. Toggle mostrarFormNuevoProveedor signal
   * 2. Si muestra: Reset form + reset validaciones + focus en primer campo
   * 3. Si oculta: Form desaparece del DOM
   *
   * @returns {void}
   */
  toggleFormNuevoProveedor(): void {
    this.mostrarFormNuevoProveedor.set(!this.mostrarFormNuevoProveedor());
    if (this.mostrarFormNuevoProveedor()) {
      this.formNuevoProveedor.reset({
        codigo: '',
        nombre: '',
        ruc: '',
        representante: '',
        telefonoPrincipal: '',
        telefonoSecundario: '',
        codigoLugar: '',
        direccion: ''
      });
      // Resetear validaciones
      Object.keys(this.validaciones).forEach(key => {
        this.validaciones[key as keyof typeof this.validaciones] = { valido: false, mensaje: '' };
      });
      
      // Enfocar en el primer campo
      setTimeout(() => {
        const firstInput = document.getElementById('proveedorCodigo');
        if (firstInput) firstInput.focus();
      }, 100);
    }
  }

  /**
   * Guarda un nuevo proveedor en Firestore tras validaciones complejas.
   *
   * **Validaciones previas al guardado:**
   * 1. FormGroup validación básica (required fields)
   * 2. Nombre no duplicado en BD (validarNombre async)
   * 3. RUC formato ecuatoriano válido (validarRUC async)
   * 4. Si código presente: no duplicado en BD (validarCodigo async)
   *
   * **Flujo de guardado:**
   * 1. Valida todos los criterios (retorna si falla alguno)
   * 2. Setea guardando=true
   * 3. Crea objeto Proveedor tipado con estructura correcta
   * 4. Llama a ProveedoresService.createProveedor (async)
   * 5. Si éxito: Muestra SweetAlert2, asigna nombre a ingreso, recarga lista
   * 6. Si error: Muestra SweetAlert2 con mensaje de error
   * 7. Finalmente: Setea guardando=false, cierra form, resetea validaciones
   *
   * **Manejo de errores:**
   * - Captura excepciones de createProveedor
   * - Muestra mensaje amigable en SweetAlert2
   * - Setea signal error para mostrar en template
   *
   * @returns {Promise<void>} Operación async
   *
   * @remarks
   * - Método critical: Crea datos en BD
   * - Sin await explícito en llamador (async fire-and-forget)
   * - Al cerrar form, usuario puede proceder al siguiente paso
   */
  async guardarNuevoProveedor(): Promise<void> {
    if (this.formNuevoProveedor.invalid) {
      this.error.set('Complete los campos obligatorios del proveedor (Nombre y RUC)');
      return;
    }

    // Validar que RUC y nombre estén completos
    const valores = this.formNuevoProveedor.value;
    if (!valores.nombre || !valores.ruc) {
      this.error.set('Complete los campos obligatorios del proveedor (Nombre y RUC)');
      return;
    }

    // Validar nombre duplicado
    await this.validarNombre();
    if (!this.validaciones.nombre.valido && this.validaciones.nombre.mensaje) {
      return;
    }

    // Validar RUC
    await this.validarRUC();
    if (!this.validaciones.ruc.valido && this.validaciones.ruc.mensaje) {
      return;
    }

    // Validar código si está presente
    if (valores.codigo) {
      await this.validarCodigo();
      if (!this.validaciones.codigo.valido) {
        return;
      }
    }

    this.guardando.set(true);
    try {
      const nuevoProveedor: Proveedor = {
        codigo: valores.codigo || '',
        nombre: valores.nombre,
        ruc: valores.ruc,
        representante: valores.representante || '',
        telefonos: {
          principal: valores.telefonoPrincipal || '',
          secundario: valores.telefonoSecundario || ''
        },
        direccion: {
          codigoLugar: valores.codigoLugar || '',
          direccion: valores.direccion || ''
        }
      };

      const docRef = await this.proveedoresService.createProveedor(nuevoProveedor);

      // Aviso de éxito
      if ((window as any).Swal) {
        await Swal.fire({ icon: 'success', title: 'Proveedor creado', timer: 1500, showConfirmButton: false });
      }
      
      // Asignar el nombre y código del nuevo proveedor al ingreso
      this.ingreso.proveedor = nuevoProveedor.nombre;
      this.ingreso.proveedorCodigo = nuevoProveedor.codigo; // Guardar código para futuras búsquedas
      
      // Recargar proveedores
      this.cargarProveedores();
      
      // Cerrar formulario
      this.mostrarFormNuevoProveedor.set(false);
      this.formNuevoProveedor.reset({
        codigo: '',
        nombre: '',
        ruc: '',
        representante: '',
        telefonoPrincipal: '',
        telefonoSecundario: '',
        codigoLugar: '',
        direccion: '',
        saldo: 0
      });
      
      this.error.set(null);
    } catch (err: any) {
      console.error('Error al crear proveedor:', err);
      const msg = err?.message || 'Error al crear el proveedor';
      this.error.set(msg);
      if ((window as any).Swal) {
        await Swal.fire({ icon: 'error', title: 'No se pudo crear', text: msg });
      }
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Cancela creación de nuevo proveedor y resetea formulario.
   *
   * **Acciones:**
   * 1. Oculta form de nuevo proveedor (mostrarFormNuevoProveedor=false)
   * 2. Resetea formulario a valores vacíos
   *
   * @returns {void}
   *
   * @remarks
   * - Botón "Cancelar" en form de nuevo proveedor
   * - No navega (usuario sigue en página creación ingreso)
   * - Limpia datos parcialmente ingresados
   */
  cancelarNuevoProveedor(): void {
    this.mostrarFormNuevoProveedor.set(false);
    this.formNuevoProveedor.reset({
      codigo: '',
      nombre: '',
      ruc: '',
      representante: '',
      telefonoPrincipal: '',
      telefonoSecundario: '',
      codigoLugar: '',
      direccion: ''
    });
  }

  /**
   * Valida ingreso actual y navega a siguiente paso (agregar productos).
   *
   * **Validaciones:**
   * 1. Proveedor seleccionado (no vacío)
   * 2. Número factura ingresado (no vacío)
   * 3. Número factura único en BD (validarNumeroFactura async)
   *
   * **Flujo:**
   * 1. Si faltan campos obligatorios: Setea error y retorna
   * 2. Valida número factura en BD
   * 3. Si factura existe: Retorna con error
   * 4. Asegura que ingreso.proveedor sea nombre (no código)
   * 5. Guarda ingreso TEMPORALMENTE (sin persista en BD)
   * 6. Navega a /productos/ingreso/:id/agregar-productos
   * 7. Usuario continúa en siguiente paso añadiendo items
   *
   * **Almacenamiento temporal:**
   * - Usa IngresosService.guardarIngresoTemporal()
   * - Ingreso NO está en BD todavía (solo en memoria/local)
   * - Cuando usuario termina de agregar productos, se finaliza en BD
   *
   * **Manejo de errores:**
   * - Si error en guardado temporal: Muestra mensaje amigable
   * - Setea signal guardando mientras procesa
   *
   * @returns {Promise<void>} Operación async
   * @remarks
   * - Botón \"Continuar\" en formulario principal
   * - Este paso es CRÍTICO: Prepara ingreso para siguientes pasos
   * - El ID temporal se usa para asociar productos después
   */
  async continuar() {
    // Validaciones
    if (!this.ingreso.proveedor || !this.ingreso.numeroFactura) {
      this.error.set('Por favor completa los campos obligatorios');
      return;
    }

    await this.validarNumeroFactura();
    if (this.validaciones.numeroFactura.mensaje && !this.validaciones.numeroFactura.valido) {
      return;
    }

    // Asegurar que se guarde el nombre del proveedor (no solo el código)
    const prov = this.proveedores.find(p =>
      p.codigo?.toLowerCase() === this.ingreso.proveedor.toLowerCase() ||
      p.nombre?.toLowerCase() === this.ingreso.proveedor.toLowerCase() ||
      p.id === this.ingreso.proveedor
    );
    if (prov) {
      this.ingreso.proveedor = prov.nombre;
      this.ingreso.proveedorCodigo = prov.codigo; // Guardar código para futuras búsquedas
      // NO guardar proveedorId para evitar confusión - usar solo el nombre en proveedor
    }

    this.guardando.set(true);
    this.error.set(null);

    try {
      // Guardar ingreso TEMPORALMENTE (sin crear en BD aún)
      const ingresoId = this.ingresosService.guardarIngresoTemporal(
        this.ingreso
      );

      // Navegar al paso 2 (agregar productos)
      this.router.navigate(['/productos/ingreso', ingresoId, 'agregar-productos']);
    } catch (err: any) {
      console.error('Error al guardar ingreso temporal:', err);
      this.error.set('Error al crear el ingreso. Intenta nuevamente.');
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Cancela creación de ingreso y navega atrás.
   *
   * **Acción:**
   * 1. Navigate a /ingresos (listar ingresos)
   * 2. Descarta todos los datos temporales del ingreso actual
   *
   * @returns {void}
   *
   * @remarks
   * - Botón "Cancelar" en formulario principal
   * - Usuario vuelve a la lista de ingresos
   * - Datos ingresados NO se guardan
   */
  cancelar() {
    this.router.navigate(['/ingresos']);
  }

  /**
   * Navega al siguiente campo cuando usuario presiona Enter.
   * @param {Event} event - Evento de teclado
   * @param {string} nextId - ID HTML del próximo elemento a enfocar
   * @returns {void}
   *
   * @remarks
   * - Mejora UX: Usuario no necesita mouse
   * - Se usa (keyup.enter)="focusNext($event, 'campo-siguiente')"
   */
  focusNext(event: Event, nextId: string) {
    event.preventDefault();
    const nextElement = document.getElementById(nextId);
    if (nextElement) {
      nextElement.focus();
    }
  }

  /**
   * Maneja Enter en textareas.
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
}
