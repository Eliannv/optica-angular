import { Component, OnInit } from '@angular/core';
import { Producto } from '../../../../core/models/producto.model';
import { ProductosService } from '../../../../core/services/productos';
import { Router } from '@angular/router';
import { ProveedoresService } from '../../../../core/services/proveedores';
import { Proveedor } from '../../../../core/models/proveedor.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-crear-producto',
  standalone: false,
  templateUrl: './crear-producto.html',
  styleUrl: './crear-producto.css',
})
export class CrearProducto implements OnInit {

  producto: Producto = {
    codigo: '', // Se generará automáticamente
    nombre: '',
    modelo: '',
    color: '',
    grupo: '',
    stock: 0,
    costo: 0,
    pvp1: 0,
    proveedor: '',
    observacion: ''
  };

  proveedores: Proveedor[] = [];
  mostrarFormNuevoProveedor = false;
  nuevoProveedor: Proveedor = this.getProveedorVacio();
  proximoIdInterno: number | null = null;

  // Validaciones para el proveedor
  validaciones = {
    codigo: { valido: false, mensaje: '' },
    nombre: { valido: false, mensaje: '' },
    ruc: { valido: false, mensaje: '' }
  };

  validandoNombre = false;
  validandoRuc = false;

  constructor(
    private productosService: ProductosService,
    private proveedoresService: ProveedoresService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarProveedores();
    this.cargarProximoId();
  }

  /**
   * Verificar si el formulario de proveedor es válido para guardar
   */
  get puedeGuardarProveedor(): boolean {
    // Campos obligatorios
    if (!this.nuevoProveedor.nombre || !this.nuevoProveedor.ruc) {
      return false;
    }

    if (this.validandoNombre || this.validandoRuc) {
      return false;
    }

    // Validar nombre (si tiene mensaje, debe ser válido)
    if (this.validaciones.nombre.mensaje && !this.validaciones.nombre.valido) {
      return false;
    }

    // Validar código (si hay código ingresado, debe ser válido)
    if (this.nuevoProveedor.codigo && this.validaciones.codigo.mensaje && !this.validaciones.codigo.valido) {
      return false;
    }

    // Validar RUC (si tiene mensaje, debe ser válido)
    if (this.validaciones.ruc.mensaje && !this.validaciones.ruc.valido) {
      return false;
    }

    return true;
  }

  async cargarProximoId(): Promise<void> {
    try {
      // Obtener el próximo ID sin incrementarlo aún
      const counterDoc = await this.productosService.getCounterDoc();
      this.proximoIdInterno = counterDoc ? counterDoc + 1 : 1001;
    } catch (error) {
      console.error('Error al cargar próximo ID:', error);
      this.proximoIdInterno = 1001;
    }
  }

  cargarProveedores(): void {
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedores = proveedores;
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
      }
    });
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
    this.mostrarFormNuevoProveedor = !this.mostrarFormNuevoProveedor;
    if (this.mostrarFormNuevoProveedor) {
      this.nuevoProveedor = this.getProveedorVacio();
      this.validaciones = {
        codigo: { valido: false, mensaje: '' },
        nombre: { valido: false, mensaje: '' },
        ruc: { valido: false, mensaje: '' }
      };
    }
  }

  async validarCodigoProveedor(): Promise<void> {
    if (!this.nuevoProveedor.codigo || this.nuevoProveedor.codigo.trim() === '') {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = '';
      return;
    }

    try {
      const existe = await this.proveedoresService.codigoExists(this.nuevoProveedor.codigo);
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

  async validarNombreProveedor(): Promise<void> {
    if (!this.nuevoProveedor.nombre || this.nuevoProveedor.nombre.trim() === '') {
      this.validaciones.nombre.valido = false;
      this.validaciones.nombre.mensaje = '';
      return;
    }

    this.validandoNombre = true;
    try {
      const existe = await this.proveedoresService.nombreExists(this.nuevoProveedor.nombre);
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
    const ruc = this.nuevoProveedor.ruc;
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

  async guardarNuevoProveedor(): Promise<void> {
    if (!this.nuevoProveedor.nombre || !this.nuevoProveedor.ruc) {
      await Swal.fire({ icon: 'warning', title: 'Campos obligatorios', text: 'Complete Nombre y RUC del proveedor' });
      return;
    }

    // Validar nombre duplicado
    await this.validarNombreProveedor();
    if (!this.validaciones.nombre.valido && this.validaciones.nombre.mensaje) {
      return;
    }

    // Validar RUC
    await this.validarRUC();
    if (!this.validaciones.ruc.valido && this.validaciones.ruc.mensaje) {
      return;
    }

    // Validar código si está presente
    if (this.nuevoProveedor.codigo) {
      await this.validarCodigoProveedor();
      if (!this.validaciones.codigo.valido) {
        return;
      }
    }

    try {
      const docRef = await this.proveedoresService.createProveedor(this.nuevoProveedor);
      await Swal.fire({ icon: 'success', title: 'Proveedor creado', timer: 1500, showConfirmButton: false });
      // Asignar el nuevo proveedor como principal
      this.producto.proveedor = this.nuevoProveedor.codigo || '';
      this.cargarProveedores();
      this.mostrarFormNuevoProveedor = false;
      this.nuevoProveedor = this.getProveedorVacio();
    } catch (error: any) {
      console.error('Error al crear proveedor:', error);
      await Swal.fire({ icon: 'error', title: 'No se pudo crear', text: error?.message || 'Error al crear el proveedor' });
    }
  }

  cancelarNuevoProveedor(): void {
    this.mostrarFormNuevoProveedor = false;
    this.nuevoProveedor = this.getProveedorVacio();
  }

  async guardar() {
    // Validar solo el nombre como campo obligatorio
    if (!this.producto.nombre || this.producto.nombre.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Campo incompleto',
        text: 'Por favor ingrese el nombre del producto'
      });
      return;
    }

    try {
      // Generar código automáticamente basado en el próximo ID interno
      if (this.proximoIdInterno) {
        this.producto.codigo = `PROD${this.proximoIdInterno.toString().padStart(4, '0')}`;
      }

      const docRef = await this.productosService.createProducto(this.producto);
      
      // Obtener el producto recién creado para mostrar su ID interno
      const productoCreado = await this.productosService.getProductoById(docRef.id).toPromise();
      
      await Swal.fire({
        icon: 'success',
        title: 'Producto creado',
        html: `<strong>ID Interno:</strong> ${productoCreado?.idInterno || 'N/A'}<br><strong>Código:</strong> ${this.producto.codigo}`
      });
      
      this.router.navigate(['/productos']);
    } catch (error) {
      console.error('Error al crear producto:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al crear el producto'
      });
    }
  }

  cancelar() {
    this.router.navigate(['/productos']);
  }
}
