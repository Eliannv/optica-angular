import { Component, OnInit } from '@angular/core';
import { Proveedor } from '../../../../core/models/proveedor.model';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Router } from '@angular/router';
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
    },
    saldo: 0
  };

  // Validaciones
  validaciones = {
    codigo: { valido: false, mensaje: '' },
    ruc: { valido: false, mensaje: '' },
    telefonoPrincipal: { valido: false, mensaje: '' },
    telefonoSecundario: { valido: false, mensaje: '' },
    codigoLugar: { valido: false, mensaje: '' },
    saldo: { valido: true, mensaje: '' }
  };

  validandoCodigo = false;
  codigoExiste = false;

  constructor(
    private proveedoresService: ProveedoresService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Inicializar con saldo válido
    this.validaciones.saldo.valido = true;
  }

  // Validar formato de código (1 letra y 4 números)
  validarFormatoCodigo(codigo: string): boolean {
    if (!codigo) return false;
    const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
    const numeros = (codigo.match(/[0-9]/g) || []).length;
    return letras >= 1 && numeros >= 4;
  }

  // Validar código del proveedor
  validarCodigo(): void {
    if (!this.proveedor.codigo || this.proveedor.codigo.trim() === '') {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = '';
      return;
    }

    if (!this.validarFormatoCodigo(this.proveedor.codigo)) {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = 'Debe contener al menos 1 letra y 4 números';
    } else {
      this.validaciones.codigo.valido = true;
      this.validaciones.codigo.mensaje = 'Formato válido';
    }
  }

  // Validar RUC ecuatoriano (13 dígitos)
  validarRUC(): void {
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
    if (tercerDigito === 9 || tercerDigito === 6) {
      this.validaciones.ruc.valido = true;
      this.validaciones.ruc.mensaje = 'RUC válido';
      return;
    }

    // Validación más estricta para RUC basado en cédula
    if (tercerDigito >= 0 && tercerDigito <= 5) {
      this.validaciones.ruc.valido = true;
      this.validaciones.ruc.mensaje = 'RUC válido';
    } else {
      this.validaciones.ruc.valido = false;
      this.validaciones.ruc.mensaje = 'Tercer dígito de RUC inválido';
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

  // Validar saldo
  validarSaldo(): void {
    const saldo = this.proveedor.saldo || 0;
    
    // El saldo puede ser positivo (a favor del proveedor) o negativo (deuda)
    // pero debe ser un número válido
    if (isNaN(saldo)) {
      this.validaciones.saldo.valido = false;
      this.validaciones.saldo.mensaje = 'El saldo debe ser un número válido';
    } else {
      this.validaciones.saldo.valido = true;
      if (saldo > 0) {
        this.validaciones.saldo.mensaje = 'Saldo a favor del proveedor';
      } else if (saldo < 0) {
        this.validaciones.saldo.mensaje = 'Deuda con el proveedor';
      } else {
        this.validaciones.saldo.mensaje = 'Sin saldo pendiente';
      }
    }
  }

  guardar() {
    // Validar campos obligatorios
    if (!this.proveedor.nombre || !this.proveedor.ruc) {
      alert('Por favor complete los campos obligatorios (Nombre y RUC)');
      return;
    }

    // Validar formato de código si está presente
    if (this.proveedor.codigo && !this.validarFormatoCodigo(this.proveedor.codigo)) {
      alert('El código debe contener al menos 1 letra y 4 números (Ej: P0001, PROV1234)');
      return;
    }

    // Validar RUC
    this.validarRUC();
    if (!this.validaciones.ruc.valido) {
      alert(`Error en RUC: ${this.validaciones.ruc.mensaje}`);
      return;
    }

    // Validar teléfono principal si está presente
    if (this.proveedor.telefonos?.principal) {
      this.validarTelefono(this.proveedor.telefonos.principal, 'principal');
      if (!this.validaciones.telefonoPrincipal.valido) {
        alert(`Error en teléfono principal: ${this.validaciones.telefonoPrincipal.mensaje}`);
        return;
      }
    }

    // Validar teléfono secundario si está presente
    if (this.proveedor.telefonos?.secundario) {
      this.validarTelefono(this.proveedor.telefonos.secundario, 'secundario');
      if (!this.validaciones.telefonoSecundario.valido) {
        alert(`Error en teléfono secundario: ${this.validaciones.telefonoSecundario.mensaje}`);
        return;
      }
    }

    // Validar código de lugar si está presente
    if (this.proveedor.direccion?.codigoLugar) {
      this.validarCodigoLugar();
      if (!this.validaciones.codigoLugar.valido) {
        alert(`Error en código de lugar: ${this.validaciones.codigoLugar.mensaje}`);
        return;
      }
    }

    // Validar saldo
    this.validarSaldo();
    if (!this.validaciones.saldo.valido) {
      alert(`Error en saldo: ${this.validaciones.saldo.mensaje}`);
      return;
    }

    this.proveedor.fechaIngreso = new Date();
    this.proveedoresService.createProveedor(this.proveedor).then(() => {
      alert('Proveedor creado exitosamente');
      this.router.navigate(['/proveedores']);
    }).catch(error => {
      console.error('Error al crear proveedor:', error);
      alert('Error al crear el proveedor');
    });
  }

  cancelar() {
    this.router.navigate(['/proveedores']);
  }
}
