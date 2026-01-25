import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { 
  ExcelService, 
  DatosExcelImportacion, 
  ProductoExcelPreview 
} from '../../../../core/services/excel.service';
import { ProductosService } from '../../../../core/services/productos';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Ingreso, DetalleIngreso } from '../../../../core/models/ingreso.model';
import { Proveedor } from '../../../../core/models/proveedor.model';
import Swal from 'sweetalert2';

/**
 * Componente para importar productos desde un archivo Excel
 * 
 * @description
 * Permite importar masivamente productos desde Excel con validaciones de proveedor,
 * detección de productos existentes/nuevos, verificación de factura única,
 * y generación automática de ingreso. Soporta 3 pasos: Subir archivo, Preview, Procesando.
 * 
 * @example
 * ```html
 * <app-importar-productos></app-importar-productos>
 * ```
 */
@Component({
  selector: 'app-importar-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './importar-productos.html',
  styleUrls: ['./importar-productos.css']
})
export class ImportarProductosComponent {
  private excelService = inject(ExcelService);
  private productosService = inject(ProductosService);
  private ingresosService = inject(IngresosService);
  private proveedoresService = inject(ProveedoresService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  paso = signal<1 | 2 | 3>(1);
  archivoSeleccionado = signal<File | null>(null);
  datosImportacion = signal<DatosExcelImportacion | null>(null);
  mensajeError = signal<string>('');
  procesando = signal<boolean>(false);
  
  proveedorExiste = signal<boolean>(false);
  proveedorExistente = signal<Proveedor | null>(null);
  mostrarFormProveedor = signal<boolean>(false);
  proveedorForm!: FormGroup;
  validandoNombre = false;
  validandoRuc = false;
  
  validaciones = {
    codigo: { valido: false, mensaje: '' },
    nombre: { valido: false, mensaje: '' },
    ruc: { valido: false, mensaje: '' },
    telefonoPrincipal: { valido: false, mensaje: '' },
    telefonoSecundario: { valido: false, mensaje: '' },
    codigoLugar: { valido: false, mensaje: '' }
  };

  validacionFactura = { valido: true, mensaje: '' };
  validandoNumeroFactura = false;
  
  gruposDisponibles = [
    'ARMAZONES',
    'LENTES DE CONTACTO',
    'LIQUIDO DE LENTES DE CONTACTO',
    'LIQUIDO DESEMPAÑANTE',
    'GAFAS',
    'LUNAS',
    'SERVICIOS',
    'VARIOS'
  ];

  constructor() {
    this.inicializarFormularioProveedor();
  }

  /**
   * Valida si se puede confirmar la importación
   * 
   * @returns true si existen datos de importación, proveedor válido y sin errores de factura
   */
  get puedeConfirmarImportacion(): boolean {
    if (!this.datosImportacion()) return false;
    if (!this.proveedorExiste()) return false;
    if (this.validandoNumeroFactura) return false;
    if (this.validacionFactura.mensaje && !this.validacionFactura.valido) return false;
    return !this.procesando();
  }

  /**
   * Verifica si el formulario de proveedor es válido para guardado
   * 
   * @returns true si el formulario es válido y no hay validaciones pendientes
   */
  get puedeGuardarProveedor(): boolean {
    if (this.proveedorForm.invalid) {
      return false;
    }

    if (this.validandoNombre || this.validandoRuc || this.validandoNumeroFactura) {
      return false;
    }

    if (this.validaciones.nombre.mensaje && !this.validaciones.nombre.valido) {
      return false;
    }

    const codigoValue = this.proveedorForm.get('codigo')?.value;
    if (codigoValue && this.validaciones.codigo.mensaje && !this.validaciones.codigo.valido) {
      return false;
    }

    if (this.validaciones.ruc.mensaje && !this.validaciones.ruc.valido) {
      return false;
    }

    return true;
  }

  /**
   * Inicializa el formulario reactivo para crear un nuevo proveedor
   * 
   * @private
   */
  private inicializarFormularioProveedor(): void {
    this.proveedorForm = this.fb.group({
      codigo: [''],
      nombre: ['', Validators.required],
      ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      representante: [''],
      telefonoPrincipal: ['', Validators.pattern(/^(09\d{8}|07\d{6,7})$/)],
      telefonoSecundario: ['', Validators.pattern(/^(09\d{8}|07\d{6,7})$/)],
      codigoLugar: ['07', Validators.pattern(/^\d{2}$/)],
      direccion: [''],
      saldo: [0]
    });
  }

  /**
   * Maneja la selección de archivo Excel
   * 
   * @param event - Evento de selección de archivo
   * 
   * @description
   * Valida que la extensión sea .xlsx o .xls antes de aceptar el archivo.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const archivo = input.files[0];
      
      if (!archivo.name.match(/\.(xlsx|xls)$/i)) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo no válido',
          text: 'Por favor selecciona un archivo de Excel (.xlsx o .xls)',
          confirmButtonText: 'Entendido'
        });
        return;
      }
      
      this.archivoSeleccionado.set(archivo);
      this.mensajeError.set('');
    }
  }

  /**
   * Descarga la plantilla Excel de ejemplo para importación
   */
  async descargarPlantilla(): Promise<void> {
    try {
      await this.excelService.exportarPlantilla();
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      Swal.fire('Error', 'No se pudo descargar la plantilla. Verifica que el archivo existe.', 'error');
    }
  }

  /**
   * Procesa el archivo Excel seleccionado
   * 
   * @description
   * Lee el Excel, verifica proveedor, valida número de factura único,
   * detecta productos existentes y muestra el preview antes de confirmar.
   */
  async procesarArchivo(): Promise<void> {
    const archivo = this.archivoSeleccionado();
    if (!archivo) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin archivo',
        text: 'Por favor selecciona un archivo de Excel',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    this.procesando.set(true);
    this.mensajeError.set('');

    try {
      const datos = await this.excelService.importarProductos(archivo);
      
      await this.verificarProveedor(datos.proveedor);
      
      await this.validarNumeroFactura(datos.numeroFactura);
      
      await this.verificarProductosExistentes(datos.productos);
      
      this.datosImportacion.set(datos);
      this.paso.set(2);
      
    } catch (error: any) {
      this.mensajeError.set(error.message || 'Error al procesar el archivo');
    } finally {
      this.procesando.set(false);
    }
  }

  /**
   * Verifica si el proveedor existe en el sistema
   * 
   * @param nombreProveedor - Nombre del proveedor leído del Excel
   * 
   * @private
   * @description
   * Busca el proveedor por nombre (case-insensitive). Si no existe,
   * pre-carga el nombre en el formulario para creación.
   */
  private async verificarProveedor(nombreProveedor: string): Promise<void> {
    try {
      const proveedores = await firstValueFrom(this.proveedoresService.getProveedores());
      const proveedorEncontrado = proveedores.find(
        p => p.nombre.toLowerCase().trim() === nombreProveedor.toLowerCase().trim()
      );

      if (proveedorEncontrado) {
        this.proveedorExiste.set(true);
        this.proveedorExistente.set(proveedorEncontrado);
        this.mostrarFormProveedor.set(false);
      } else {
        this.proveedorExiste.set(false);
        this.proveedorExistente.set(null);
        this.mostrarFormProveedor.set(false);
        this.proveedorForm.patchValue({ nombre: nombreProveedor });
      }
    } catch (error) {
      console.error('Error al verificar proveedor:', error);
      this.proveedorExiste.set(false);
    }
  }

  /**
   * Verifica qué productos ya existen en la base de datos
   * 
   * @param productos - Array de productos desde Excel
   * 
   * @private
   * @description
   * Busca productos por código (prioridad) o por nombre+modelo+color.
   * Marca como EXISTENTE o NUEVO y detecta productos desactivados.
   * Carga TODOS los productos (activos e inactivos).
   */
  private async verificarProductosExistentes(productos: ProductoExcelPreview[]): Promise<void> {
    try {
      const productosSnapshot = await firstValueFrom(this.productosService.getProductosTodosInclusoInactivos());

      for (const prod of productos) {
        let productoExistente: any = null;

        if (prod.codigo && prod.codigo.trim()) {
          productoExistente = (productosSnapshot || []).find(p => 
            p.codigo?.toLowerCase().trim() === prod.codigo?.toLowerCase().trim()
          );
        }

        if (!productoExistente) {
          productoExistente = (productosSnapshot || []).find(p => 
            p.nombre?.toLowerCase().trim() === prod.nombre?.toLowerCase().trim() &&
            (p.modelo?.toLowerCase().trim() === prod.modelo?.toLowerCase().trim() || (!p.modelo && !prod.modelo)) &&
            (p.color?.toLowerCase().trim() === prod.color?.toLowerCase().trim() || (!p.color && !prod.color))
          );
        }

        if (productoExistente && productoExistente.id) {
          prod.estado = 'EXISTENTE';
          prod.productoId = productoExistente.id;
          
          prod.estaDesactivado = productoExistente.activo === false;
          
          const stockExistente = productoExistente.stock || 0;
          const cantidadAAgregar = prod.cantidad || 0;
          prod.stockAnterior = stockExistente;
          prod.stockActivoAnterior = stockExistente;
          
          // 🔹 IMPORTANTE: Mantener costo del Excel si es diferente al existente
          // Solo usar costo existente si el Excel no tiene costo
          if (!prod.costo || prod.costo <= 0) {
            prod.costo = productoExistente.costo || 0;
          }
          // Si el Excel tiene costo, se mantiene (para poder reemplazar el costo existente)
          
          prod.grupo = productoExistente.grupo || 'GAFAS';
          prod.idInterno = productoExistente.idInterno || undefined;
          
          prod.proveedorAnterior = productoExistente.proveedor || '';
          
          // 🔹 IMPORTANTE: Mantener PVP del Excel si es diferente al existente
          // Solo usar PVP existente si el Excel no tiene PVP
          if (!prod.pvp1 || prod.pvp1 <= 0) {
            prod.pvp1 = productoExistente.pvp1 || 0;
          }
          // Si el Excel tiene PVP, se mantiene (para poder reemplazar el PVP existente)
          prod.pvp1Anterior = productoExistente.pvp1 || 0;
          
          prod.observacion = productoExistente.observacion || '';
        }
      }
    } catch (error) {
      console.error('Error al verificar productos existentes:', error);
      // Si hay error, todos los productos se consideran nuevos (estado por defecto)
    }
  }

  /**
   * ✅ Confirmar importación
   */
  async confirmarImportacion(): Promise<void> {
    const datos = this.datosImportacion();
    if (!datos) return;

    await this.validarNumeroFactura(datos.numeroFactura);
    if (this.validacionFactura.mensaje && !this.validacionFactura.valido) {
      this.mensajeError.set(this.validacionFactura.mensaje);
      return;
    }

    // Validar que todos tengan costo
    const sinCosto = datos.productos.filter(p => !p.costo || p.costo <= 0);
    if (sinCosto.length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Productos sin costo',
        text: `${sinCosto.length} producto(s) no tienen costo válido. Por favor completa todos los costos.`,
        confirmButtonText: 'Revisar'
      });
      return;
    }

    this.procesando.set(true);
    this.paso.set(3);
    this.mensajeError.set('');

    try {
      console.log('📦 Iniciando importación...', { 
        proveedor: datos.proveedor, 
        factura: datos.numeroFactura,
        productos: datos.productos.length 
      });

      // 1. Crear ingreso
      const nuevoIngreso: Ingreso = {
        proveedor: datos.proveedor,
        numeroFactura: datos.numeroFactura,
        fecha: datos.fecha,
        tipoCompra: 'CONTADO',
        descuento: datos.descuento || 0,
        flete: datos.flete || 0,
        iva: datos.iva || 0,
        observacion: `Importado desde Excel el ${new Date().toLocaleDateString()}`,
        estado: 'BORRADOR'
      };

      console.log('📝 Creando ingreso borrador...');
      const ingresoId = await this.ingresosService.crearIngresoBorrador(nuevoIngreso);
      console.log('✅ Ingreso creado:', ingresoId);

      // 2. Convertir productos a detalles de ingreso
      const detalles: DetalleIngreso[] = datos.productos.map(p => ({
        tipo: p.estado,
        productoId: p.productoId,
        nombre: p.nombre,
        modelo: p.modelo || '',
        color: p.color || '',
        grupo: p.grupo || 'GAFAS',
        codigo: p.codigo, // CODIGO SIST (será idInterno en producto nuevo)
        idInterno: Number(p.codigo) || undefined, // Convertir a número para idInterno
        cantidad: p.cantidad,
        costoUnitario: p.costo || 0,
        pvp1: p.pvp1 || 0,
        iva: p.iva || 0, // Agregar IVA del producto
        observacion: p.observacion || '',
        // 🔹 NUEVO: Información de productos desactivados
        estaDesactivado: p.estaDesactivado || false,
        stockActivoAnterior: p.stockActivoAnterior || 0
      }));

      console.log('💾 Finalizando ingreso con', detalles.length, 'productos...');
      
      // 3. Finalizar ingreso (crea/actualiza productos automáticamente)
      await this.ingresosService.finalizarIngreso(ingresoId, detalles);
      
      console.log('✅ Importación completada exitosamente');

      // 4. Redirigir
      await Swal.fire({
        icon: 'success',
        title: '¡Importación completada!',
        text: `${datos.productos.length} productos procesados correctamente`,
        timer: 2000,
        showConfirmButton: false
      });
      this.router.navigate(['/ingresos']);
      
    } catch (error: any) {
      console.error('❌ Error en importación:', error);
      this.mensajeError.set('Error al importar: ' + (error.message || 'Error desconocido'));
      this.paso.set(2);
    } finally {
      this.procesando.set(false);
    }
  }

  /**
   * ⬅️ Volver al paso anterior
   */
  volver(): void {
    if (this.paso() === 2) {
      this.paso.set(1);
      this.datosImportacion.set(null);
      this.archivoSeleccionado.set(null);
    }
  }

  /**
   * ➕ Mostrar formulario para crear proveedor
   */
  abrirFormularioProveedor(): void {
    this.mostrarFormProveedor.set(true);
  }

  /**
   * � Validaciones del formulario de proveedor
   */
  validarFormatoCodigo(codigo: string): boolean {
    if (!codigo) return false;
    const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
    const numeros = (codigo.match(/[0-9]/g) || []).length;
    return letras >= 1 && numeros >= 4;
  }

  async validarCodigo(): Promise<void> {
    const codigo = this.proveedorForm.get('codigo')?.value;
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

  async validarNombre(): Promise<void> {
    const nombre = this.proveedorForm.get('nombre')?.value;
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

  async validarRUC(): Promise<void> {
    const ruc = this.proveedorForm.get('ruc')?.value;
    
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

  async validarNumeroFactura(numero?: string): Promise<void> {
    const value = numero ?? this.datosImportacion()?.numeroFactura;
    if (!value || value.trim() === '') {
      this.validacionFactura.valido = false;
      this.validacionFactura.mensaje = '';
      return;
    }

    this.validandoNumeroFactura = true;
    try {
      const existe = await this.ingresosService.numeroFacturaExists(value);
      if (existe) {
        this.validacionFactura.valido = false;
        this.validacionFactura.mensaje = 'Este número de factura ya existe';
      } else {
        this.validacionFactura.valido = true;
        this.validacionFactura.mensaje = 'Número de factura disponible';
      }
    } catch (error) {
      console.error('Error al validar número de factura:', error);
    } finally {
      this.validandoNumeroFactura = false;
    }
  }

  validarTelefono(tipo: 'principal' | 'secundario'): void {
    const campo = tipo === 'principal' ? 'telefonoPrincipal' : 'telefonoSecundario';
    const telefono = this.proveedorForm.get(tipo === 'principal' ? 'telefonoPrincipal' : 'telefonoSecundario')?.value;
    
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

  validarCodigoLugar(): void {
    const codigoLugar = this.proveedorForm.get('codigoLugar')?.value;
    
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
      this.validaciones.codigoLugar.mensaje = 'Código debe estar entre 01 y 24';
    }
  }

  /**
   * �💾 Guardar nuevo proveedor
   */
  async guardarNuevoProveedor(): Promise<void> {
    if (this.proveedorForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor completa todos los campos obligatorios del proveedor',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Validar nombre duplicado
    await this.validarNombre();
    if (!this.validaciones.nombre.valido && this.validaciones.nombre.mensaje) {
      return;
    }

    // Validar RUC duplicado y formato
    await this.validarRUC();
    if (!this.validaciones.ruc.valido && this.validaciones.ruc.mensaje) {
      return;
    }

    // Validar código si está presente
    const codigoValue = this.proveedorForm.get('codigo')?.value;
    if (codigoValue) {
      await this.validarCodigo();
      if (!this.validaciones.codigo.valido) {
        return;
      }
    }

    this.procesando.set(true);

    try {
      const formValue = this.proveedorForm.value;
      const nuevoProveedor: Proveedor = {
        codigo: formValue.codigo,
        nombre: formValue.nombre,
        ruc: formValue.ruc,
        representante: formValue.representante,
        telefonos: {
          principal: formValue.telefonoPrincipal,
          secundario: formValue.telefonoSecundario
        },
        direccion: {
          codigoLugar: formValue.codigoLugar,
          direccion: formValue.direccion
        }
      };

      await this.proveedoresService.createProveedor(nuevoProveedor);

      // Actualizar estado
      this.proveedorExiste.set(true);
      this.proveedorExistente.set(nuevoProveedor);
      this.mostrarFormProveedor.set(false);

      await Swal.fire({
        icon: 'success',
        title: '¡Proveedor creado!',
        text: `El proveedor ${nuevoProveedor.nombre} ha sido registrado exitosamente`,
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error al crear proveedor:', error);
      Swal.fire({
        icon: 'error',
        title: 'No se pudo crear',
        text: error?.message || 'No se pudo crear el proveedor. Intenta nuevamente.',
        confirmButtonText: 'Cerrar'
      });
    } finally {
      this.procesando.set(false);
    }
  }

  /**
   * ❌ Cerrar formulario de proveedor
   */
  cerrarFormularioProveedor(): void {
    this.mostrarFormProveedor.set(false);
  }

  /**
   * ❌ Cancelar
   */
  cancelar(): void {
    this.router.navigate(['/productos']);
  }

  /**
   * 📊 Contadores para el footer
   */
  get productosNuevos(): number {
    return this.datosImportacion()?.productos.filter(p => p.estado === 'NUEVO').length || 0;
  }

  get productosExistentes(): number {
    return this.datosImportacion()?.productos.filter(p => p.estado === 'EXISTENTE').length || 0;
  }
}
