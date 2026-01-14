import { Component, OnInit } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';

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

  // Validaciones
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
  esEdicion = false;
  proveedorIdOriginal: string | null = null;
  nombreOriginal: string = '';
  rucOriginal: string = '';

  constructor(
    private proveedoresService: ProveedoresService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Detectar si es edición
    this.activatedRoute.params.subscribe(params => {
      if (params['id']) {
        this.esEdicion = true;
        this.proveedorIdOriginal = params['id'];
        this.cargarProveedor(params['id']);
      }
    });
  }

  // Cargar datos del proveedor para edición
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

  // Verificar si el formulario es válido para guardar
  get puedeGuardar(): boolean {
    // Campos obligatorios
    if (!this.proveedor.nombre || !this.proveedor.ruc) {
      return false;
    }

    // Evitar guardar mientras se valida nombre o RUC
    if (this.validandoNombre || this.validandoRuc) {
      return false;
    }

    // Validar nombre (si tiene mensaje, debe ser válido)
    if (this.validaciones.nombre.mensaje && !this.validaciones.nombre.valido) {
      return false;
    }

    // Validar código (si hay código ingresado, debe ser válido)
    if (this.proveedor.codigo && this.validaciones.codigo.mensaje && !this.validaciones.codigo.valido) {
      return false;
    }

    // Validar RUC (si tiene mensaje, debe ser válido)
    if (this.validaciones.ruc.mensaje && !this.validaciones.ruc.valido) {
      return false;
    }

    // Validar teléfonos (si están llenos y tienen mensaje, deben ser válidos)
    if (this.proveedor.telefonos?.principal && this.validaciones.telefonoPrincipal.mensaje && !this.validaciones.telefonoPrincipal.valido) {
      return false;
    }

    if (this.proveedor.telefonos?.secundario && this.validaciones.telefonoSecundario.mensaje && !this.validaciones.telefonoSecundario.valido) {
      return false;
    }

    // Validar código de lugar (si está lleno y tiene mensaje, debe ser válido)
    if (this.proveedor.direccion?.codigoLugar && this.validaciones.codigoLugar.mensaje && !this.validaciones.codigoLugar.valido) {
      return false;
    }

    return true;
  }

  // Validar formato de código (1 letra y 4 números)
  validarFormatoCodigo(codigo: string): boolean {
    if (!codigo) return false;
    const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
    const numeros = (codigo.match(/[0-9]/g) || []).length;
    return letras >= 1 && numeros >= 4;
  }

  // Validar código del proveedor
  async validarCodigo(): Promise<void> {
    if (!this.proveedor.codigo || this.proveedor.codigo.trim() === '') {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = '';
      return;
    }

    if (!this.validarFormatoCodigo(this.proveedor.codigo)) {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = 'Debe contener al menos 1 letra y 4 números';
      return;
    }

    // Verificar si el código ya existe
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
    }
  }

  // Validar nombre del proveedor (unicidad)
  async validarNombre(): Promise<void> {
    if (!this.proveedor.nombre || this.proveedor.nombre.trim() === '') {
      this.validaciones.nombre.valido = false;
      this.validaciones.nombre.mensaje = '';
      return;
    }

    this.validandoNombre = true;
    try {
      const existe = await this.proveedoresService.nombreExists(this.proveedor.nombre);
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

  // Validar RUC ecuatoriano (13 dígitos)
  async validarRUC(): Promise<void> {
    const ruc = this.proveedor.ruc;
    
    if (!ruc || ruc.trim() === '') {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = '';
      return;
    }

    // RUC ecuatoriano debe tener 13 dígitos
    if (!/^\d{13}$/.test(ruc)) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'El RUC debe tener exactamente 13 dígitos';
      return;
    }

    // Validar que los dos primeros dígitos sean código de provincia válido (01-24)
    const provincia = parseInt(ruc.substring(0, 2));
    if (provincia < 1 || provincia > 24) {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'Código de provincia inválido (primeros 2 dígitos)';
      return;
    }

    // El tercer dígito define el tipo de RUC
    const tercerDigito = parseInt(ruc.charAt(2));
    
    // Tipo 9 = RUC público o privado sin cédula
    // Tipo 6 = RUC sociedades públicas
    // Tipo 0-5 = Persona natural o jurídica con cédula
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

  // Validar teléfono ecuatoriano (celular o convencional)
  validarTelefono(telefono: string, tipo: 'principal' | 'secundario'): void {
    const campo = tipo === 'principal' ? 'telefonoPrincipal' : 'telefonoSecundario';
    
    if (!telefono || telefono.trim() === '') {
      this.validaciones[campo].valido = false;
      this.validaciones[campo].mensaje = '';
      return;
    }

    // Teléfono celular: 09XXXXXXXX (10 dígitos)
    // Teléfono convencional: 07XXXXXXX (9 dígitos) - El Oro empieza con 07
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

  // Validar código de lugar (código de provincia)
  validarCodigoLugar(): void {
    const codigo = this.proveedor.direccion?.codigoLugar;
    
    if (!codigo || codigo.trim() === '') {
      this.validaciones.codigoLugar.valido = false;
      this.validaciones.codigoLugar.mensaje = '';
      return;
    }

    // Código de provincia El Oro es 07
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

  async guardar() {
    // Validar campos obligatorios
    if (!this.proveedor.nombre || !this.proveedor.ruc) {
      await Swal.fire({ icon: 'warning', title: 'Campos obligatorios', text: 'Por favor complete Nombre y RUC' });
      return;
    }

    // Validar nombre duplicado (solo si cambió o es nuevo)
    if (this.proveedor.nombre !== this.nombreOriginal) {
      await this.validarNombre();
      if (!this.validaciones.nombre.valido && this.validaciones.nombre.mensaje) {
        return;
      }
    }

    // Validar código si está presente (solo en creación)
    if (!this.esEdicion && this.proveedor.codigo) {
      await this.validarCodigo();
      if (!this.validaciones.codigo.valido) {
        return;
      }
    }

    // Validar RUC (solo si cambió o es nuevo)
    if (this.proveedor.ruc !== this.rucOriginal) {
      this.validarRUC();
      if (!this.validaciones.ruc.valido) {
        await Swal.fire({ icon: 'error', title: 'RUC inválido', text: this.validaciones.ruc.mensaje || 'Verifique el RUC' });
        return;
      }
    }

    // Validar teléfono principal si está presente
    if (this.proveedor.telefonos?.principal) {
      this.validarTelefono(this.proveedor.telefonos.principal, 'principal');
      if (!this.validaciones.telefonoPrincipal.valido) {
        await Swal.fire({ icon: 'error', title: 'Teléfono principal', text: this.validaciones.telefonoPrincipal.mensaje });
        return;
      }
    }

    // Validar teléfono secundario si está presente
    if (this.proveedor.telefonos?.secundario) {
      this.validarTelefono(this.proveedor.telefonos.secundario, 'secundario');
      if (!this.validaciones.telefonoSecundario.valido) {
        await Swal.fire({ icon: 'error', title: 'Teléfono secundario', text: this.validaciones.telefonoSecundario.mensaje });
        return;
      }
    }

    // Validar código de lugar si está presente
    if (this.proveedor.direccion?.codigoLugar) {
      this.validarCodigoLugar();
      if (!this.validaciones.codigoLugar.valido) {
        await Swal.fire({ icon: 'error', title: 'Código de provincia', text: this.validaciones.codigoLugar.mensaje });
        return;
      }
    }

    try {
      if (this.esEdicion && this.proveedorIdOriginal) {
        // Actualizar proveedor existente
        await this.proveedoresService.updateProveedor(this.proveedorIdOriginal, this.proveedor);
        await Swal.fire({ icon: 'success', title: 'Proveedor actualizado', timer: 1500, showConfirmButton: false });
      } else {
        // Crear nuevo proveedor
        this.proveedor.fechaIngreso = new Date();
        await this.proveedoresService.createProveedor(this.proveedor);
        await Swal.fire({ icon: 'success', title: 'Proveedor creado', timer: 1500, showConfirmButton: false });
      }
      this.router.navigate(['/proveedores']);
    } catch (error: any) {
      console.error('Error al guardar proveedor:', error);
      const titulo = this.esEdicion ? 'No se pudo actualizar' : 'No se pudo crear';
      await Swal.fire({ icon: 'error', title: titulo, text: error?.message || 'Error al guardar el proveedor' });
    }
  }

  cancelar() {
    this.router.navigate(['/proveedores']);
  }
}
