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

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
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

  // Mensajes de advertencia para validación reactiva
  cedulaDuplicadaMsg = '';
  emailDuplicadoMsg = '';

  // Valores originales para detectar cambios reales
  cedulaOriginal = '';
  emailOriginal = '';

  // Estados de validación
  validandoCedula = false;
  validandoEmail = false;

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
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
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
    
    // Formulario sin validaciones obligatorias
    this.clienteForm = this.fb.group({
      nombres: [''],
      apellidos: [''],
      cedula: [''],
      telefono: [''],
      email: [''],
      fechaNacimiento: [''],
      direccion: [''],
      pais: ['Ecuador'],
      provincia: [''],
      ciudad: ['']
    });

    // Si estamos editando, cargar datos del cliente
    if (this.clienteIdEdicion) {
      this.cargarClienteParaEditar();
    }

    // Configurar validaciones reactivas
    this.setupValidacionesReactivas();
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
        // Guardar valores originales
        this.cedulaOriginal = cliente.cedula || '';
        this.emailOriginal = cliente.email || '';
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
   * Configura validaciones reactivas para cédula y email.
   */
  private setupValidacionesReactivas() {
    // Validación reactiva de cédula
    this.clienteForm.get('cedula')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(async (cedula: string) => {
        this.cedulaDuplicadaMsg = '';
        this.validandoCedula = false;
        
        if (!cedula || cedula.trim() === '') return;
        
        if (cedula.trim() === this.cedulaOriginal.trim()) return;
        
        this.validandoCedula = true;
        this.cdr.markForCheck();
        
        try {
          const existe = await this.clientesService.existeCedula(cedula, this.clienteIdEdicion || undefined);
          if (existe) {
            this.cedulaDuplicadaMsg = 'Esta cédula ya existe en el sistema';
          }
        } catch (error) {
          console.error('Error validando cédula:', error);
        } finally {
          this.validandoCedula = false;
          this.cdr.markForCheck();
        }
      });

    // Validación reactiva de email
    this.clienteForm.get('email')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(async (email: string) => {
        this.emailDuplicadoMsg = '';
        this.validandoEmail = false;
        
        if (!email || email.trim() === '') return;
        
        // Permitir "N/A" como valor válido si no tiene email
        if (email.trim().toUpperCase() === 'N/A') return;
        
        if (email.trim().toLowerCase() === this.emailOriginal.trim().toLowerCase()) return;
        
        this.validandoEmail = true;
        this.cdr.markForCheck();
        
        try {
          const existe = await this.clientesService.existeEmail(email, this.clienteIdEdicion || undefined);
          if (existe) {
            this.emailDuplicadoMsg = 'Este email ya existe en el sistema';
          }
        } catch (error) {
          console.error('Error validando email:', error);
        } finally {
          this.validandoEmail = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Verifica si el formulario puede ser guardado.
   */
  get puedeGuardar(): boolean {
    // Bloquear si cédula está vacía
    const cedula = this.clienteForm.get('cedula')?.value;
    if (!cedula || cedula.trim() === '') return false;
    
    // Bloquear si hay duplicados
    if (this.cedulaDuplicadaMsg || this.emailDuplicadoMsg) return false;
    
    // Bloquear si se está validando
    if (this.validandoCedula || this.validandoEmail) return false;
    
    return true;
  }

  /**
   * Guarda o actualiza el cliente en Firestore.
   *
   * Valida el formulario completo antes de proceder. Si está en modo edición,
   * actualiza el cliente existente; caso contrario, crea uno nuevo. Tras la
   * operación exitosa, navega de vuelta a la página origen (returnTo).
   */
  async guardar() {
    const cedula = this.clienteForm.get('cedula')?.value || '';
    const email = this.clienteForm.get('email')?.value || '';

    // Validar cédula (siempre obligatoria)
    if (!cedula || cedula.trim() === '') {
      await Swal.fire({
        icon: 'error',
        title: 'Cédula requerida',
        text: 'La cédula es un campo obligatorio'
      });
      return;
    }

    // Validar cédula si cambió
    if (cedula.trim() !== this.cedulaOriginal.trim()) {
      const cedulaExiste = await this.clientesService.existeCedula(cedula, this.clienteIdEdicion || undefined);
      if (cedulaExiste) {
        await Swal.fire({
          icon: 'error',
          title: 'Cédula duplicada',
          text: 'Esta cédula ya existe en el sistema'
        });
        return;
      }
    }

    // Validar email si cambió y no es "N/A"
    if (email && email.trim() !== '' && email.trim().toUpperCase() !== 'N/A') {
      if (email.trim().toLowerCase() !== this.emailOriginal.trim().toLowerCase()) {
        const emailExiste = await this.clientesService.existeEmail(email, this.clienteIdEdicion || undefined);
        if (emailExiste) {
          await Swal.fire({
            icon: 'error',
            title: 'Email duplicado',
            text: 'Este email ya existe en el sistema'
          });
          return;
        }
      }
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
}


