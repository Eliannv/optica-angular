import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Ingreso } from '../../../../core/models/ingreso.model';
import { IngresosService } from '../../../../core/services/ingresos.service';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Proveedor } from '../../../../core/models/proveedor.model';

@Component({
  selector: 'app-crear-ingreso',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './crear-ingreso.html',
  styleUrls: ['./crear-ingreso.css'],
})
export class CrearIngresoComponent implements OnInit {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private ingresosService = inject(IngresosService);
  private proveedoresService = inject(ProveedoresService);

  // Señales
  guardando = signal(false);
  error = signal<string | null>(null);
  mostrarFormNuevoProveedor = signal(false);
  busquedaProveedor = signal('');

  // Datos del formulario
  ingreso: Ingreso = {
    proveedor: '',
    numeroFactura: '',
    fecha: new Date(),
    tipoCompra: 'CONTADO',
    observacion: '',
  };

  // Lista de proveedores desde Firebase
  proveedores: Proveedor[] = [];
  proveedoresFiltrados: Proveedor[] = [];
  
  // Formulario reactivo para nuevo proveedor
  formNuevoProveedor!: FormGroup;

  // Validaciones para el proveedor
  validaciones = {
    codigo: { valido: false, mensaje: '' },
    ruc: { valido: false, mensaje: '' },
    telefonoPrincipal: { valido: false, mensaje: '' },
    telefonoSecundario: { valido: false, mensaje: '' },
    codigoLugar: { valido: false, mensaje: '' }
  };

  ngOnInit() {
    this.cargarProveedores();
    this.initFormNuevoProveedor();
  }

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

  seleccionarProveedor(codigo: string) {
    this.ingreso.proveedor = codigo;
    this.busquedaProveedor.set('');
  }

  // Validaciones
  validarFormatoCodigo(codigo: string): boolean {
    if (!codigo) return false;
    const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
    const numeros = (codigo.match(/[0-9]/g) || []).length;
    return letras >= 1 && numeros >= 4;
  }

  validarCodigo(): void {
    const codigo = this.formNuevoProveedor.get('codigo')?.value;
    if (!codigo || codigo.trim() === '') {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = '';
      return;
    }

    if (!this.validarFormatoCodigo(codigo)) {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = 'Debe contener al menos 1 letra y 4 números';
    } else {
      this.validaciones.codigo.valido = true;
      this.validaciones.codigo.mensaje = 'Formato válido';
    }
  }

  validarRUC(): void {
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
    if (tercerDigito === 9 || tercerDigito === 6 || (tercerDigito >= 0 && tercerDigito <= 5)) {
      this.validaciones.ruc.valido = true;
      this.validaciones.ruc.mensaje = 'RUC válido';
    } else {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'Tercer dígito de RUC inválido';
    }
  }

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
        direccion: '',
        saldo: 0
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
        },
        saldo: valores.saldo || 0
      };

      const docRef = await this.proveedoresService.createProveedor(nuevoProveedor);
      
      // Asignar el código del nuevo proveedor al ingreso (o ID si no tiene código)
      this.ingreso.proveedor = nuevoProveedor.codigo || docRef.id;
      
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
      this.error.set('Error al crear el proveedor');
    } finally {
      this.guardando.set(false);
    }
  }

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
      direccion: '',
      saldo: 0
    });
  }

  async continuar() {
    // Validaciones
    if (!this.ingreso.proveedor || !this.ingreso.numeroFactura) {
      this.error.set('Por favor completa los campos obligatorios');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    try {
      // Crear ingreso borrador
      const ingresoId = await this.ingresosService.crearIngresoBorrador(
        this.ingreso
      );

      // Navegar al paso 2 (agregar productos)
      this.router.navigate(['/productos/ingreso', ingresoId, 'agregar-productos']);
    } catch (err: any) {
      console.error('Error al crear ingreso:', err);
      this.error.set('Error al crear el ingreso. Intenta nuevamente.');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() {
    this.router.navigate(['/productos']);
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
}
