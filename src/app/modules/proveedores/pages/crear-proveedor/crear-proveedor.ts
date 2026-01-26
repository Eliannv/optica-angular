import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';

/**
 * Componente para crear o editar proveedores
 * 
 * @description
 * Formulario con validaciones en tiempo real para nombre único, RUC ecuatoriano válido,
 * teléfonos celulares/convencionales de El Oro, códigos de provincia y código del proveedor.
 * Soporta tanto creación como edición de proveedores.
 * 
 * @example
 * ```html
 * <app-crear-proveedor></app-crear-proveedor>
 * ```
 */
@Component({
  selector: 'app-crear-proveedor',
  standalone: false,
  templateUrl: './crear-proveedor.html',
  styleUrl: './crear-proveedor.css',
})
export class CrearProveedor implements OnInit {

  proveedor: Proveedor = {
    codigo: '',
    nombre: '',
    ruc: '',
    representante: '',
    telefonos: {
      principal: '',
      secundario: ''
    },
    direccion: {
      codigoLugar: '',
      direccion: ''
    }
  };

  validaciones = {
    codigo: { valido: false, mensaje: '' },
    nombre: { valido: false, mensaje: '' },
    ruc: { valido: false, mensaje: '' },
    telefonoPrincipal: { valido: false, mensaje: '' },
    telefonoSecundario: { valido: false, mensaje: '' },
    codigoLugar: { valido: false, mensaje: '' }
  };

  validandoCodigo = false;
  codigoExiste = false;
  validandoNombre = false;
  validandoRuc = false;
  guardando = false;
  esEdicion = false;
  proveedorIdOriginal: string | null = null;
  nombreOriginal: string = '';
  rucOriginal: string = '';

  constructor(
    private proveedoresService: ProveedoresService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  /**
   * Inicializa el componente y detecta si es modo edición
   * 
   * @description
   * Si recibe un ID por parámetros de ruta, carga el proveedor para edición.
   */
  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      if (params['id']) {
        this.esEdicion = true;
        this.proveedorIdOriginal = params['id'];
        this.cargarProveedor(params['id']);
      }
    });
  }

  /**
   * Carga los datos de un proveedor existente para edición
   * 
   * @param id - ID del proveedor a cargar
   * 
   * @private
   */
  async cargarProveedor(id: string): Promise<void> {
    try {
      const proveedor$ = this.proveedoresService.getProveedorById(id);
      proveedor$.subscribe({
        next: (proveedor) => {
          if (proveedor) {
            this.proveedor = { ...proveedor };
            this.nombreOriginal = proveedor.nombre || '';
            this.rucOriginal = proveedor.ruc || '';
          } else {
            Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No se pudo cargar el proveedor' });
            this.router.navigate(['/proveedores']);
          }
        },
        error: (error) => {
          console.error('Error al cargar proveedor:', error);
          Swal.fire({ icon: 'error', title: 'Error', text: 'Error al cargar el proveedor' });
          this.router.navigate(['/proveedores']);
        }
      });
    } catch (error) {
      console.error('Error al cargar proveedor:', error);
      await Swal.fire({ icon: 'error', title: 'Error', text: 'Error al cargar el proveedor' });
      this.router.navigate(['/proveedores']);
    }
  }

  /**
   * Verifica si el formulario es válido para guardar
   * 
   * @returns true si todos los campos obligatorios y validaciones están correctas
   */
  get puedeGuardar(): boolean {
    // No guardar mientras se está guardando
    if (this.guardando) {
      return false;
    }

    if (!this.proveedor.nombre || !this.proveedor.ruc) {
      return false;
    }

    if (this.validandoNombre || this.validandoRuc) {
      return false;
    }

    if (this.validaciones.nombre.mensaje && !this.validaciones.nombre.valido) {
      return false;
    }

    if (this.proveedor.codigo && this.validaciones.codigo.mensaje && !this.validaciones.codigo.valido) {
      return false;
    }

    if (this.validaciones.ruc.mensaje && !this.validaciones.ruc.valido) {
      return false;
    }

    if (this.proveedor.telefonos?.principal && this.validaciones.telefonoPrincipal.mensaje && !this.validaciones.telefonoPrincipal.valido) {
      return false;
    }

    if (this.proveedor.telefonos?.secundario && this.validaciones.telefonoSecundario.mensaje && !this.validaciones.telefonoSecundario.valido) {
      return false;
    }

    if (this.proveedor.direccion?.codigoLugar && this.validaciones.codigoLugar.mensaje && !this.validaciones.codigoLugar.valido) {
      return false;
    }

    return true;
  }

  /**
   * Valida el formato del código del proveedor (mínimo 1 letra y 4 números)
   * 
   * @param codigo - Código a validar
   * @returns true si cumple con el formato requerido
   * 
   * @private
   */
  validarFormatoCodigo(codigo: string): boolean {
    if (!codigo) return false;
    const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
    const numeros = (codigo.match(/[0-9]/g) || []).length;
    return letras >= 1 && numeros >= 4;
  }

  /**
   * Valida que el código del proveedor sea único en el sistema
   * 
   * @description
   * Verifica formato (1 letra + 4 números) y unicidad en Firestore.
   */
  async validarCodigo(): Promise<void> {
    if (!this.proveedor.codigo || this.proveedor.codigo.trim() === '') {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = '';
      this.validandoCodigo = false;
      return;
    }

    if (!this.validarFormatoCodigo(this.proveedor.codigo)) {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = 'Debe contener al menos 1 letra y 4 números';
      this.validandoCodigo = false;
      return;
    }

    this.validandoCodigo = true;
    try {
      const existe = await this.proveedoresService.codigoExists(this.proveedor.codigo);
      if (existe) {
        this.validaciones.codigo.valido = false;
        this.validaciones.codigo.mensaje = 'Este código ya está registrado';
      } else {
        this.validaciones.codigo.valido = true;
        this.validaciones.codigo.mensaje = 'Código disponible';
      }
    } catch (error) {
      console.error('Error al validar código:', error);
    } finally {
      this.validandoCodigo = false;
    }
  }

  /**
   * Valida que el nombre del proveedor sea único
   * 
   * @description
   * Consulta Firestore para verificar que no exista otro proveedor con el mismo nombre.
   */
  async validarNombre(): Promise<void> {
    // Si el campo está vacío, limpiar validación
    if (!this.proveedor.nombre || this.proveedor.nombre.trim() === '') {
      this.validaciones.nombre.valido = false;
      this.validaciones.nombre.mensaje = '';
      this.validandoNombre = false;
      return;
    }

    // Si estamos editando Y el valor NO cambió del original, no hacer nada
    if (this.esEdicion && this.proveedor.nombre === this.nombreOriginal) {
      this.validaciones.nombre.valido = false;
      this.validaciones.nombre.mensaje = '';
      this.validandoNombre = false;
      return;
    }

    // A partir de aquí, el valor SÍ cambió (o es modo creación), validar
    this.validandoNombre = true;
    
    this.ngZone.runOutsideAngular(async () => {
      try {
        const existe = await this.proveedoresService.nombreExists(
          this.proveedor.nombre,
          this.esEdicion ? this.proveedorIdOriginal || undefined : undefined
        );
        
        this.ngZone.run(() => {
          if (existe) {
            this.validaciones.nombre.valido = false;
            this.validaciones.nombre.mensaje = 'Ya existe un proveedor con este nombre';
          } else {
            this.validaciones.nombre.valido = true;
            this.validaciones.nombre.mensaje = 'Nombre disponible';
          }
          this.validandoNombre = false;
          this.cdr.detectChanges();
        });
      } catch (error) {
        console.error('Error al validar nombre:', error);
        this.ngZone.run(() => {
          this.validandoNombre = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  /**
   * Valida el formato y unicidad del RUC ecuatoriano
   * 
   * @description
   * Verifica que el RUC tenga 13 dígitos, código de provincia válido (01-24),
   * tercer dígito válido (0-6, 9) y que no esté duplicado en el sistema.
   */
  async validarRUC(): Promise<void> {
    const ruc = this.proveedor.ruc;
    
    if (!ruc || ruc.trim() === '') {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = '';
      this.validandoRuc = false;
      return;
    }

    if (!/^\d{13}$/.test(ruc)) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'El RUC debe tener exactamente 13 dígitos';
      this.validandoRuc = false;
      return;
    }

    const provincia = parseInt(ruc.substring(0, 2));
    if (provincia < 1 || provincia > 24) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'Código de provincia inválido (primeros 2 dígitos)';
      this.validandoRuc = false;
      return;
    }

    const tercerDigito = parseInt(ruc.charAt(2));
    
    if (!(tercerDigito === 9 || tercerDigito === 6 || (tercerDigito >= 0 && tercerDigito <= 5))) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'Tercer dígito de RUC inválido';
      this.validandoRuc = false;
      return;
    }

    // Si estamos editando Y el RUC NO cambió del original, no hacer nada
    if (this.esEdicion && this.proveedor.ruc === this.rucOriginal) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = '';
      this.validandoRuc = false;
      return;
    }

    // A partir de aquí, el RUC SÍ cambió (o es modo creación), validar en Firestore
    this.validandoRuc = true;
    
    this.ngZone.runOutsideAngular(async () => {
      try {
        const existe = await this.proveedoresService.rucExists(
          ruc,
          this.esEdicion ? this.proveedorIdOriginal || undefined : undefined
        );
        
        this.ngZone.run(() => {
          if (existe) {
            this.validaciones.ruc.valido = false;
            this.validaciones.ruc.mensaje = 'Este RUC ya está registrado';
          } else {
            this.validaciones.ruc.valido = true;
            this.validaciones.ruc.mensaje = 'RUC válido';
          }
          this.validandoRuc = false;
          this.cdr.detectChanges();
        });
      } catch (error) {
        console.error('Error al validar RUC:', error);
        this.ngZone.run(() => {
          this.validandoRuc = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  /**
   * Valida formato de teléfono ecuatoriano (celular o convencional de El Oro)
   * 
   * @param telefono - Número de teléfono a validar
   * @param tipo - Tipo de teléfono ('principal' o 'secundario')
   * 
   * @description
   * Celular: 09XXXXXXXX (10 dígitos)
   * Convencional El Oro: 07XXXXXXX (9 dígitos)
   */
  validarTelefono(telefono: string, tipo: 'principal' | 'secundario'): void {
    const campo = tipo === 'principal' ? 'telefonoPrincipal' : 'telefonoSecundario';
    
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
   * Valida el código de provincia ecuatoriano
   * 
   * @description
   * Código 07 corresponde a El Oro - Pasaje. Acepta códigos entre 01-24.
   */
  validarCodigoLugar(): void {
    const codigo = this.proveedor.direccion?.codigoLugar;
    
    if (!codigo || codigo.trim() === '') {
      this.validaciones.codigoLugar.valido = false;
      this.validaciones.codigoLugar.mensaje = '';
      return;
    }

    if (codigo === '07') {
      this.validaciones.codigoLugar.valido = true;
      this.validaciones.codigoLugar.mensaje = 'El Oro - Pasaje ✅';
    } else if (/^\d{2}$/.test(codigo)) {
      const codigoProv = parseInt(codigo);
      if (codigoProv >= 1 && codigoProv <= 24) {
        this.validaciones.codigoLugar.valido = true;
        this.validaciones.codigoLugar.mensaje = 'Código de provincia válido';
      } else {
        this.validaciones.codigoLugar.valido = false;
        this.validaciones.codigoLugar.mensaje = 'Código debe estar entre 01 y 24';
      }
    } else {
      this.validaciones.codigoLugar.valido = false;
      this.validaciones.codigoLugar.mensaje = 'Debe ser un código de 2 dígitos (Ej: 07 para El Oro)';
    }
  }

  /**
   * Guarda el proveedor (creación o actualización)
   * 
   * @description
   * Realiza todas las validaciones necesarias antes de guardar.
   * Crea o actualiza el proveedor en Firestore según el modo.
   */
  async guardar() {
    if (!this.proveedor.nombre || !this.proveedor.ruc) {
      await Swal.fire({ icon: 'warning', title: 'Campos obligatorios', text: 'Por favor complete Nombre y RUC' });
      return;
    }

    if (this.proveedor.nombre !== this.nombreOriginal) {
      await this.validarNombre();
      if (!this.validaciones.nombre.valido && this.validaciones.nombre.mensaje) {
        return;
      }
    }

    if (!this.esEdicion && this.proveedor.codigo) {
      await this.validarCodigo();
      if (!this.validaciones.codigo.valido) {
        return;
      }
    }

    if (this.proveedor.ruc !== this.rucOriginal) {
      this.validarRUC();
      if (!this.validaciones.ruc.valido) {
        await Swal.fire({ icon: 'error', title: 'RUC inválido', text: this.validaciones.ruc.mensaje || 'Verifique el RUC' });
        return;
      }
    }

    if (this.proveedor.telefonos?.principal) {
      this.validarTelefono(this.proveedor.telefonos.principal, 'principal');
      if (!this.validaciones.telefonoPrincipal.valido) {
        await Swal.fire({ icon: 'error', title: 'Teléfono principal', text: this.validaciones.telefonoPrincipal.mensaje });
        return;
      }
    }

    if (this.proveedor.telefonos?.secundario) {
      this.validarTelefono(this.proveedor.telefonos.secundario, 'secundario');
      if (!this.validaciones.telefonoSecundario.valido) {
        await Swal.fire({ icon: 'error', title: 'Teléfono secundario', text: this.validaciones.telefonoSecundario.mensaje });
        return;
      }
    }

    if (this.proveedor.direccion?.codigoLugar) {
      this.validarCodigoLugar();
      if (!this.validaciones.codigoLugar.valido) {
        await Swal.fire({ icon: 'error', title: 'Código de provincia', text: this.validaciones.codigoLugar.mensaje });
        return;
      }
    }

    try {
      this.guardando = true;
      this.cdr.detectChanges();
      
      if (this.esEdicion && this.proveedorIdOriginal) {
        await this.proveedoresService.updateProveedor(this.proveedorIdOriginal, this.proveedor);
        await Swal.fire({ icon: 'success', title: 'Proveedor actualizado', timer: 1500, showConfirmButton: false });
      } else {
        this.proveedor.fechaIngreso = new Date();
        await this.proveedoresService.createProveedor(this.proveedor);
        await Swal.fire({ icon: 'success', title: 'Proveedor creado', timer: 1500, showConfirmButton: false });
      }
      this.router.navigate(['/proveedores']);
    } catch (error: any) {
      console.error('Error al guardar proveedor:', error);
      const titulo = this.esEdicion ? 'No se pudo actualizar' : 'No se pudo crear';
      await Swal.fire({ icon: 'error', title: titulo, text: error?.message || 'Error al guardar el proveedor' });
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Cancela la operación y vuelve a la lista de proveedores
   */
  cancelar() {
    this.router.navigate(['/proveedores']);
  }
}
