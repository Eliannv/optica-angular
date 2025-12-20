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
    codigo: '',
    nombre: '',
    nuevoCodigo: '',
    grupo: '',
    stock: 0,
    unidad: '1',
    iva: true,
    observacion: null,
    costos: {
      caja: '0.00',
      unidad: '0.00'
    },
    datos: {
      dato1: '',
      dato2: ''
    },
    precios: {
      caja: '0.00',
      pvp1: '0.00',
      pvp2: '0.00',
      unidad: '0.00'
    },
    proveedores: {
      principal: '',
      secundario: '',
      terciario: ''
    }
  };

  proveedores: Proveedor[] = [];
  mostrarFormNuevoProveedor = false;
  nuevoProveedor: Proveedor = this.getProveedorVacio();
  proximoIdInterno: number | null = null;
  validandoCodigo = false;
  codigoExiste = false;

  // Validaciones
  validaciones = {
    codigo: { valido: false, mensaje: '' },
    grupo: { valido: false, mensaje: '' },
    precios: { valido: true, mensaje: '' }
  };

  constructor(
    private productosService: ProductosService,
    private proveedoresService: ProveedoresService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarProveedores();
    this.cargarProximoId();
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
    }
  }

  guardarNuevoProveedor(): void {
    if (!this.nuevoProveedor.nombre || !this.nuevoProveedor.ruc) {
      alert('Complete los campos obligatorios del proveedor (Nombre y RUC)');
      return;
    }

    this.proveedoresService.createProveedor(this.nuevoProveedor).then((docRef) => {
      alert('Proveedor creado exitosamente');
      // Asignar el nuevo proveedor como principal
      this.producto.proveedores.principal = this.nuevoProveedor.codigo || '';
      this.cargarProveedores();
      this.mostrarFormNuevoProveedor = false;
      this.nuevoProveedor = this.getProveedorVacio();
    }).catch(error => {
      console.error('Error al crear proveedor:', error);
      alert('Error al crear el proveedor');
    });
  }

  cancelarNuevoProveedor(): void {
    this.mostrarFormNuevoProveedor = false;
    this.nuevoProveedor = this.getProveedorVacio();
  }

  // Validar formato de código (mínimo 1 letra y 4 números)
  validarFormatoCodigo(codigo: string): boolean {
    if (!codigo) return false;
    
    const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
    const numeros = (codigo.match(/[0-9]/g) || []).length;
    
    return letras >= 1 && numeros >= 4;
  }

  // Validar código de armazón (formato + unicidad)
  async validarCodigoArmazon(): Promise<void> {
    if (!this.producto.codigo || this.producto.codigo.trim() === '') {
      this.codigoExiste = false;
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = '';
      return;
    }

    // Validar formato
    if (!this.validarFormatoCodigo(this.producto.codigo)) {
      this.validaciones.codigo.valido = false;
      this.validaciones.codigo.mensaje = 'Debe contener al menos 1 letra y 4 números';
      this.codigoExiste = false;
      return;
    }

    // Validar unicidad
    this.validandoCodigo = true;
    this.validaciones.codigo.mensaje = '';
    try {
      this.codigoExiste = await this.productosService.codigoArmazonExists(this.producto.codigo);
      if (!this.codigoExiste) {
        this.validaciones.codigo.valido = true;
        this.validaciones.codigo.mensaje = 'Código disponible';
      } else {
        this.validaciones.codigo.valido = false;
        this.validaciones.codigo.mensaje = 'Este código ya existe';
      }
    } catch (error) {
      console.error('Error al validar código:', error);
      this.codigoExiste = false;
      this.validaciones.codigo.valido = false;
    } finally {
      this.validandoCodigo = false;
    }
  }

  // Validar formato de grupo
  validarGrupo(): void {
    if (!this.producto.grupo || this.producto.grupo.trim() === '') {
      this.validaciones.grupo.valido = false;
      this.validaciones.grupo.mensaje = '';
      return;
    }

    if (!this.validarFormatoCodigo(this.producto.grupo)) {
      this.validaciones.grupo.valido = false;
      this.validaciones.grupo.mensaje = 'Debe contener al menos 1 letra y 4 números';
    } else {
      this.validaciones.grupo.valido = true;
      this.validaciones.grupo.mensaje = 'Formato válido';
    }
  }

  // Validar lógica de precios
  validarPrecios(): void {
    const costoCaja = parseFloat(this.producto.costos.caja || '0');
    const precioCaja = parseFloat(this.producto.precios.caja || '0');
    const pvp1 = parseFloat(this.producto.precios.pvp1 || '0');
    const unidad = parseFloat(this.producto.unidad || '1');

    // Validar que precio caja sea mayor que costo caja
    if (precioCaja > 0 && costoCaja > 0 && precioCaja <= costoCaja) {
      this.validaciones.precios.valido = false;
      this.validaciones.precios.mensaje = 'El precio de caja debe ser mayor que el costo';
      return;
    }

    // Validar que PVP1 sea mayor que el costo por unidad
    const costoUnidad = costoCaja / unidad;
    if (pvp1 > 0 && costoUnidad > 0 && pvp1 <= costoUnidad) {
      this.validaciones.precios.valido = false;
      this.validaciones.precios.mensaje = 'El PVP1 debe ser mayor que el costo por unidad';
      return;
    }

    // Validar que unidad sea mayor a 0
    if (unidad <= 0) {
      this.validaciones.precios.valido = false;
      this.validaciones.precios.mensaje = 'La unidad debe ser mayor a 0';
      return;
    }

    this.validaciones.precios.valido = true;
    this.validaciones.precios.mensaje = '';
  }

  async guardar() {
    // Validar campos obligatorios
    if (!this.producto.codigo || !this.producto.nombre) {
      alert('Por favor complete los campos obligatorios (Código de Armazón y Nombre)');
      return;
    }

    // Validar formato de código
    if (!this.validarFormatoCodigo(this.producto.codigo)) {
      alert('El código de armazón debe contener al menos 1 letra y 4 números (Ej: O0012, ARM1234)');
      return;
    }

    // Validar formato de grupo si está presente
    if (this.producto.grupo && !this.validarFormatoCodigo(this.producto.grupo)) {
      alert('El grupo debe contener al menos 1 letra y 4 números (Ej: O0002, GRP1234)');
      return;
    }

    // Verificar si el código ya existe
    const existe = await this.productosService.codigoArmazonExists(this.producto.codigo);
    if (existe) {
      alert(`El código de armazón "${this.producto.codigo}" ya existe. Por favor use un código diferente.`);
      return;
    }

    // Validar lógica de precios
    this.validarPrecios();
    if (!this.validaciones.precios.valido) {
      alert(`Error en precios: ${this.validaciones.precios.mensaje}`);
      return;
    }

    try {
      const docRef = await this.productosService.createProducto(this.producto);
      
      // Obtener el producto recién creado para mostrar su ID interno
      const productoCreado = await this.productosService.getProductoById(docRef.id).toPromise();
      
      alert(`Producto creado exitosamente\nID Interno: ${productoCreado?.idInterno || 'N/A'}\nCódigo Armazón: ${this.producto.codigo}`);
      this.router.navigate(['/productos']);
    } catch (error) {
      console.error('Error al crear producto:', error);
      alert('Error al crear el producto');
    }
  }

  cancelar() {
    this.router.navigate(['/productos']);
  }
}
