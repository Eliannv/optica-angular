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
      this.producto.proveedor = this.nuevoProveedor.codigo || '';
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
