import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Cliente } from '../../../../core/models/cliente.model';
import { ClientesService } from '../../../../core/services/clientes';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-crear-cliente',
  standalone: false,
  templateUrl: './crear-cliente.html',
  styleUrls: ['./crear-cliente.css'],
})
export class CrearCliente implements OnInit {

  clienteForm!: FormGroup;

  // Datos para los selectores
  provinciasEcuador = [
    'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 
    'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 
    'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 
    'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 
    'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'
  ];

  constructor(
    private fb: FormBuilder,
    private clientesService: ClientesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.clienteForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      cedula: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      telefono: ['', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
      email: ['', [Validators.required, Validators.email]],
      direccion: ['', [Validators.required, Validators.minLength(5)]],
      pais: ['Ecuador', [Validators.required]],
      provincia: ['', [Validators.required]],
      ciudad: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  async guardar() {
    if (this.clienteForm.invalid) {
      Object.keys(this.clienteForm.controls).forEach(key => {
        this.clienteForm.get(key)?.markAsTouched();
      });
      return;
    }

    const cliente: Cliente = {
      ...this.clienteForm.value
    };

    const ref = await this.clientesService.createCliente(cliente);

    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '/clientes/listar';

    this.router.navigate([returnTo], {
      queryParams: { selectedId: ref.id }
    });
  }

  // Métodos auxiliares para validación
  esInvalido(campo: string): boolean {
    const control = this.clienteForm.get(campo);
    return !!(control?.invalid && control?.touched);
  }

  getMensajeError(campo: string): string {
    const control = this.clienteForm.get(campo);
    
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    
    if (campo === 'nombres' || campo === 'apellidos') {
      if (control?.hasError('minlength')) {
        return 'Debe tener al menos 2 caracteres';
      }
      if (control?.hasError('pattern')) {
        return 'Solo se permiten letras y espacios';
      }
    }
    
    if (campo === 'cedula') {
      if (control?.hasError('pattern')) {
        return 'La cédula debe tener 10 dígitos';
      }
    }
    
    if (campo === 'telefono') {
      if (control?.hasError('pattern')) {
        return 'El teléfono debe iniciar con 0 y tener 10 dígitos';
      }
    }
    
    if (campo === 'email') {
      if (control?.hasError('email')) {
        return 'Ingrese un correo electrónico válido';
      }
    }
    
    if (campo === 'direccion') {
      if (control?.hasError('minlength')) {
        return 'La dirección debe tener al menos 5 caracteres';
      }
    }
    
    if (campo === 'ciudad') {
      if (control?.hasError('minlength')) {
        return 'La ciudad debe tener al menos 2 caracteres';
      }
    }
    
    return '';
  }
}


