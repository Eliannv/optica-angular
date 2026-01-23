/**
 * Componente para la creación y edición de clientes.
 *
 * Este componente proporciona un formulario reactivo completo para registrar nuevos
 * clientes o editar información de clientes existentes. Implementa validaciones
 * síncronas y asíncronas, incluyendo la verificación de unicidad de cédula y correo
 * electrónico tanto en la colección de clientes como en usuarios.
 *
 * Características principales:
 * - Formulario reactivo con validaciones robustas
 * - Validación asíncrona de cédula y email (unicidad global)
 * - Modo dual: creación y edición
 * - Navegación con parámetro returnTo para retorno contextual
 * - Directiva de navegación por teclado (Enter)
 */

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { Cliente } from '../../../../core/models/cliente.model';
import { ClientesService } from '../../../../core/services/clientes';
import { Router, ActivatedRoute } from '@angular/router';
import { EnterNextDirective } from '../../../../shared/directives/enter-next.directive';

@Component({
  selector: 'app-crear-cliente',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EnterNextDirective],
  templateUrl: './crear-cliente.html',
  styleUrls: ['./crear-cliente.css'],
})
export class CrearCliente implements OnInit {

  clienteForm!: FormGroup;
  clienteIdEdicion: string | null = null;

  readonly provinciasEcuador = [
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

  /**
   * Inicializa el componente y configura el formulario reactivo.
   *
   * Determina si se está en modo creación o edición mediante el parámetro
   * 'clienteId' en la query string. En modo edición, carga los datos del cliente
   * existente. El formulario incluye validaciones síncronas (pattern, required)
   * y asíncronas (unicidad de cédula y email).
   */
  ngOnInit() {
    this.clienteIdEdicion = this.route.snapshot.queryParamMap.get('clienteId');
    
    this.clienteForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      cedula: ['', {
        validators: [Validators.required, Validators.pattern(/^\d{10}$/)],
        asyncValidators: [this.uniqueCedulaValidator()],
        updateOn: 'blur'
      }],
      telefono: ['', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
      email: ['', {
        validators: [Validators.required, Validators.email],
        asyncValidators: [this.uniqueEmailValidator()],
        updateOn: 'blur'
      }],
      fechaNacimiento: [''],
      direccion: ['', [Validators.required, Validators.minLength(5)]],
      pais: ['Ecuador', [Validators.required]],
      provincia: ['', [Validators.required]],
      ciudad: ['', [Validators.required, Validators.minLength(2)]]
    });

    // Si estamos editando, cargar datos del cliente
    if (this.clienteIdEdicion) {
      this.cargarClienteParaEditar();
    }
  }

  /**
   * Carga los datos de un cliente existente para edición.
   *
   * Recupera el cliente de Firestore y pre-llena el formulario con sus datos.
   * Los validadores asíncronos de cédula y email se actualizan para excluir
   * el cliente actual de las búsquedas de duplicados.
   */
  private async cargarClienteParaEditar() {
    try {
      const cliente = await this.clientesService.getClienteById(this.clienteIdEdicion!).toPromise();
      if (cliente) {
        this.clienteForm.patchValue({
          nombres: cliente.nombres,
          apellidos: cliente.apellidos,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
          email: cliente.email,
          fechaNacimiento: cliente.fechaNacimiento ? this.formatearFechaParaInput(cliente.fechaNacimiento) : '',
          direccion: cliente.direccion,
          pais: cliente.pais,
          provincia: cliente.provincia,
          ciudad: cliente.ciudad
        });
        // Marcar cédula y email como válidos (ya existen)
        this.clienteForm.get('cedula')?.updateValueAndValidity({ emitEvent: false });
        this.clienteForm.get('email')?.updateValueAndValidity({ emitEvent: false });
      }
    } catch (error) {
      console.error('Error al cargar cliente:', error);
    }
  }

  /**
   * Convierte una fecha de Firestore o Date al formato requerido por input[type="date"].
   *
   * Maneja diferentes formatos de fecha (Date, Timestamp de Firestore, string)
   * y los convierte al formato ISO 'YYYY-MM-DD' requerido por el elemento HTML input.
   *
   * @param fecha Fecha en formato Date, Firestore Timestamp o string.
   * @returns Fecha en formato 'YYYY-MM-DD' o string vacío si es inválida.
   */
  private formatearFechaParaInput(fecha: any): string {
    if (!fecha) return '';
    let date: Date;
    if (fecha instanceof Date) {
      date = fecha;
    } else if (fecha && typeof fecha.toDate === 'function') {
      date = fecha.toDate();
    } else {
      date = new Date(fecha);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Guarda o actualiza el cliente en Firestore.
   *
   * Valida el formulario completo antes de proceder. Si está en modo edición,
   * actualiza el cliente existente; caso contrario, crea uno nuevo. Tras la
   * operación exitosa, navega de vuelta a la página origen (returnTo).
   */
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

    try {
      if (this.clienteIdEdicion) {
        // Editar cliente existente
        await this.clientesService.updateCliente(this.clienteIdEdicion, cliente);
      } else {
        // Crear nuevo cliente
        await this.clientesService.createCliente(cliente);
      }

      const returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '/clientes/historial-clinico';
      this.router.navigate([returnTo]);
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al guardar el cliente',
        confirmButtonText: 'Entendido'
      });
    }
  }

  /**
   * Cancela la operación y retorna a la página de origen.
   *
   * Navega a la ruta especificada en el parámetro 'returnTo' o a la lista
   * de historiales clínicos por defecto.
   */
  cancelar() {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '/clientes/historial-clinico';
    this.router.navigate([returnTo]);
  }

  /**
   * Verifica si un campo del formulario es inválido y ha sido tocado.
   *
   * Útil para mostrar mensajes de error solo después de que el usuario
   * haya interactuado con el campo.
   *
   * @param campo Nombre del campo a validar.
   * @returns true si el campo es inválido y fue tocado, false en caso contrario.
   */
  esInvalido(campo: string): boolean {
    const control = this.clienteForm.get(campo);
    return !!(control?.invalid && control?.touched);
  }

  /**
   * Genera el mensaje de error apropiado para un campo específico.
   *
   * Evalúa los diferentes tipos de errores de validación (required, pattern,
   * minlength, etc.) y retorna un mensaje descriptivo y amigable para el usuario.
   *
   * @param campo Nombre del campo para el cual generar el mensaje de error.
   * @returns Mensaje de error descriptivo o string vacío si no hay error.
   */
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
      if (control?.hasError('cedulaTomada')) {
        return 'Esta cédula ya está registrada en el sistema';
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
      if (control?.hasError('emailTomado')) {
        return 'Este correo ya está registrado en el sistema';
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

  /**
   * Validador asíncrono para verificar la unicidad de la cédula.
   *
   * Consulta tanto la colección de clientes como la de usuarios para garantizar
   * que la cédula no esté duplicada en el sistema. En modo edición, excluye
   * el cliente actual de la búsqueda.
   *
   * @returns AsyncValidatorFn Función validadora asíncrona para Angular Forms.
   */
  uniqueCedulaValidator(): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').trim();
      if (!value) return null;
      const existe = await this.clientesService.existeCedula(value, this.clienteIdEdicion || undefined);
      return existe ? { cedulaTomada: true } : null;
    };
  }

  /**
   * Validador asíncrono para verificar la unicidad del email.
   *
   * Consulta tanto la colección de clientes como la de usuarios para garantizar
   * que el correo electrónico no esté duplicado. La búsqueda es case-insensitive.
   * En modo edición, excluye el cliente actual.
   *
   * @returns AsyncValidatorFn Función validadora asíncrona para Angular Forms.
   */
  uniqueEmailValidator(): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').trim().toLowerCase();
      if (!value) return null;
      const existe = await this.clientesService.existeEmail(value, this.clienteIdEdicion || undefined);
      return existe ? { emailTomado: true } : null;
    };
  }
}


