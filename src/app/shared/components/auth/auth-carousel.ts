/**
 * Componente de autenticación tipo carrusel que gestiona login, registro y recuperación de contraseña.
 * 
 * Proporciona una interfaz unificada para todas las operaciones de autenticación del sistema,
 * permitiendo navegar entre diferentes vistas mediante signals. Integra validaciones síncronas
 * y asíncronas para garantizar la integridad de los datos de usuario.
 * 
 * Funcionalidades principales:
 * - Inicio de sesión con validación de credenciales y estado de cuenta
 * - Registro de nuevos empleados con validaciones exhaustivas
 * - Recuperación de contraseña mediante enlace por correo electrónico
 * - Monitoreo de conectividad para prevenir operaciones sin conexión
 */

import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  ValidationErrors,
  AsyncValidatorFn,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { RolUsuario } from '../../../core/models/usuario.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import { EnterNextDirective } from '../../directives/enter-next.directive';
import { ClientesService } from '../../../core/services/clientes';

@Component({
  selector: 'app-auth-carousel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EnterNextDirective],
  templateUrl: './auth-carousel.html',
  styleUrl: './auth-carousel.scss',
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AuthCarousel implements OnInit, OnDestroy {
  // Control de las secciones: 1 = login | 2 = registro | 3 = forgot password
  activeSlide = signal(1);

  // Formulario de login
  loginForm: FormGroup;

  // Formulario de registro
  registerForm: FormGroup;

  // Formulario de recuperación de contraseña
  forgotForm: FormGroup;

  // Estados de carga
  isLoading = false;

  // Estados para recuperación de contraseña
  emailSent = signal(false);
  errorMessage = signal('');

  // Control de visibilidad de contraseñas
  showPassword = signal(false);
  showRegisterPassword = signal(false);
  showConfirmPassword = signal(false);

  // Suscripciones
  private connectivitySubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private connectivityService: ConnectivityService,
    private router: Router,
    private clientesService: ClientesService
  ) {
    // Formulario de login
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    // Formulario de registro
    this.registerForm = this.fb.group(
      {
        cedula: ['', {
          validators: [Validators.required, Validators.maxLength(10), Validators.pattern(/^[0-9]+$/)],
          asyncValidators: [this.uniqueCedulaValidator()],
          updateOn: 'blur'
        }],
        nombre: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
        apellido: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
        fechaNacimiento: ['', [Validators.required, this.mayorEdadValidator]],
        correo: ['', {
          validators: [Validators.required, Validators.email],
          asyncValidators: [this.uniqueEmailValidator()],
          updateOn: 'blur'
        }],
        password: ['', [Validators.required, Validators.minLength(8), this.passwordFuerteValidator]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordsIgualesValidator }
    );

    // Formulario de recuperación
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    // Monitorear la conectividad
    this.connectivitySubscription = this.connectivityService.getOnlineStatus().subscribe(isOnline => {
      if (!isOnline && !this.isLoading) {
        Swal.fire({
          icon: 'error',
          title: 'Sin conexión a internet',
          text: 'Se ha perdido la conexión a internet. Verifica tu red para continuar.',
          confirmButtonColor: '#d33',
          allowOutsideClick: false
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.connectivitySubscription?.unsubscribe();
  }

  // ========== VALIDACIONES PERSONALIZADAS ==========
  /**
   * Valida que el usuario sea mayor de 18 años.
   * Calcula la edad basándose en la fecha de nacimiento ingresada.
   * 
   * @param control Control del formulario que contiene la fecha de nacimiento.
   * @returns ValidationErrors si es menor de edad, null si es válido.
   */
  mayorEdadValidator(control: AbstractControl): ValidationErrors | null {
    const fecha = new Date(control.value);
    if (isNaN(fecha.getTime())) return null;
    const hoy = new Date();
    const edad = hoy.getFullYear() - fecha.getFullYear();
    return edad < 18 ? { menorEdad: true } : null;
  }

  /**
   * Valida que la contraseña cumpla con criterios de seguridad.
   * Requiere: mayúscula, minúscula, número y símbolo especial.
   * 
   * @param control Control del formulario que contiene la contraseña.
   * @returns ValidationErrors si la contraseña es débil, null si es válida.
   */
  passwordFuerteValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value || '';
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/;
    return strongPassword.test(value) ? null : { weakPassword: true };
  }

  /**
   * Valida que las contraseñas coincidan en el formulario de registro.
   * Compara los valores de 'password' y 'confirmPassword'.
   * 
   * @param group FormGroup que contiene ambos campos de contraseña.
   * @returns ValidationErrors si no coinciden, null si coinciden.
   */
  passwordsIgualesValidator(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  // ========== CAMBIO DE SLIDES ==========
  /**
   * Navega a una sección específica del carrusel de autenticación.
   * 
   * @param slide Número de sección: 1 = Login, 2 = Registro, 3 = Recuperación de contraseña.
   */
  goTo(slide: number): void {
    this.activeSlide.set(slide);
  }

  // ========== TOGGLE VISIBILIDAD DE CONTRASEÑAS ==========
  /**
   * Alterna la visibilidad de los campos de contraseña.
   * Permite al usuario ver u ocultar el texto de la contraseña.
   * 
   * @param field Campo a alternar: 'login', 'register' o 'confirm'.
   */
  togglePasswordVisibility(field: 'login' | 'register' | 'confirm'): void {
    if (field === 'login') {
      this.showPassword.set(!this.showPassword());
    } else if (field === 'register') {
      this.showRegisterPassword.set(!this.showRegisterPassword());
    } else if (field === 'confirm') {
      this.showConfirmPassword.set(!this.showConfirmPassword());
    }
  }

  // ========== LOGIN ==========
  /**
   * Procesa el inicio de sesión de un usuario empleado.
   * 
   * Valida las credenciales contra Firebase Authentication y verifica el estado
   * de la cuenta (activa/bloqueada), sucursal asignada y permisos de máquina.
   * En caso de éxito, redirige al usuario según su rol.
   * 
   * Maneja diversos escenarios de error:
   * - Sin conexión a internet
   * - Cuenta no autorizada o bloqueada
   * - Restricciones de sucursal o computadora
   * - Credenciales inválidas
   */
  onLogin(): void {
    if (this.loginForm.invalid) return;

    // Verificar conexión antes de intentar login
    if (!this.connectivityService.isOnline()) {
      Swal.fire({
        icon: 'error',
        title: 'Sin conexión a internet',
        text: 'No se puede iniciar sesión sin conexión a internet. Verifica tu red e intenta nuevamente.',
        confirmButtonColor: '#d33',
      });
      return;
    }

    this.isLoading = true;
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (usuario) => {
        this.isLoading = false;
        
        // Redirigir según el rol del usuario
        if (usuario.rol === RolUsuario.ADMINISTRADOR) {
          this.router.navigate(['/clientes/historial-clinico']);
        } else if (usuario.rol === RolUsuario.OPERADOR) {
          this.router.navigate(['/clientes/historial-clinico']);
        }

        Swal.fire({
          icon: 'success',
          title: 'Bienvenido',
          text: `¡Hola ${usuario.nombre}!`,
          showConfirmButton: false,
          timer: 2000,
        });
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error en login:', err);
        
        let errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
        let errorTitle = 'Error de inicio de sesión';
        let errorIcon: 'error' | 'warning' = 'error';

        // Manejar errores específicos
        if (err.message) {
          if (err.message.startsWith('OFFLINE:')) {
            errorIcon = 'error';
            errorTitle = 'Sin conexión a internet';
            errorMessage = err.message.replace('OFFLINE: ', '');
          } else if (err.message.startsWith('UNAUTHORIZED:')) {
            errorIcon = 'warning';
            errorTitle = 'Cuenta sin autorización';
            errorMessage = err.message.replace('UNAUTHORIZED: ', '');
          } else if (err.message.startsWith('BLOCKED:')) {
            errorIcon = 'error';
            errorTitle = 'Cuenta bloqueada';
            errorMessage = err.message.replace('BLOCKED: ', '');
          } else if (err.message.includes('inactiva') || err.message.includes('bloqueada')) {
            errorMessage = err.message;
          } else if (err.message.includes('sucursal') || err.message.includes('computadora')) {
            errorIcon = 'warning';
            errorTitle = 'Acceso restringido';
            errorMessage = err.message;
          } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
          } else if (err.code === 'auth/network-request-failed') {
            errorTitle = 'Error de conexión';
            errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
          }
        }

        Swal.fire({
          icon: errorIcon,
          title: errorTitle,
          text: errorMessage,
          confirmButtonColor: '#d33',
        });
      },
    });
  }

  // ========== RECUPERAR CONTRASEÑA ==========
  /**
   * Procesa la solicitud de recuperación de contraseña.
   * Envía un correo electrónico con un enlace para restablecer la contraseña del usuario.
   * Actualiza el estado visual para mostrar confirmación o errores sin usar modales.
   * 
   * @returns Promise<void> Indica la finalización del proceso de envío.
   */
  async onForgotPassword(): Promise<void> {
    if (this.forgotForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage.set('');

    try {
      const email = this.forgotForm.value.email;
      await this.authService.resetPassword(email);
      this.emailSent.set(true);
    } catch (error: any) {
      console.error('Error al enviar correo de recuperación:', error);
      this.errorMessage.set(error.message || 'Error al enviar el correo. Intenta nuevamente.');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Regresa a la pantalla de inicio de sesión y resetea el estado de recuperación.
   */
  backToLogin(): void {
    this.emailSent.set(false);
    this.errorMessage.set('');
    this.forgotForm.reset();
    this.goTo(1);
  }

  // ========== REGISTRO ==========
  /**
   * Procesa el registro de un nuevo empleado en el sistema.
   * 
   * Crea una cuenta de usuario en Firebase Authentication y un documento
   * correspondiente en Firestore con los datos del empleado. El usuario se crea
   * siempre con rol de empleado (requiere aprobación administrativa posterior).
   * 
   * Realiza validaciones de unicidad para cédula y correo electrónico.
   * En caso de éxito, limpia el formulario y redirige al login.
   */
  onRegister(): void {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    const formData = this.registerForm.value;

    // Datos para crear el usuario (siempre como empleado)
    const userData = {
      cedula: formData.cedula,
      nombre: formData.nombre,
      apellido: formData.apellido,
      fechaNacimiento: formData.fechaNacimiento,
      email: formData.correo,
      password: formData.password,
    };

    this.authService.register(userData).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire({
          icon: 'success',
          title: '¡Registro Exitoso!',
          text: 'Tu cuenta ha sido creada. Ahora puedes iniciar sesión.',
          showConfirmButton: false,
          timer: 2500,
        });

        // Limpiar formulario
        this.registerForm.reset();
        this.registerForm.markAsPristine();
        this.registerForm.markAsUntouched();

        // Ir al login después de 2 segundos
        setTimeout(() => {
          this.goTo(1);
        }, 2000);
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error en registro:', err);

        // Manejar errores específicos y marcar los campos como inválidos
        if (err.message) {
          if (err.message.includes('email-already-in-use') || err.message.includes('correo')) {
            // Marcar el campo de correo como inválido con error personalizado
            this.registerForm.get('correo')?.setErrors({ emailTomado: true });
            this.registerForm.get('correo')?.markAsTouched();
            return; // No mostrar Swal, solo el icono de error en el campo
          } else if (err.message.includes('cédula') || err.message.includes('cedula')) {
            // Marcar el campo de cédula como inválido con error personalizado
            this.registerForm.get('cedula')?.setErrors({ cedulaTomada: true });
            this.registerForm.get('cedula')?.markAsTouched();
            return; // No mostrar Swal, solo el icono de error en el campo
          } else if (err.message.includes('weak-password')) {
            Swal.fire({
              icon: 'error',
              title: 'Contraseña débil',
              text: 'La contraseña es muy débil.',
              confirmButtonColor: '#d33',
            });
            return;
          }
        }

        // Para otros errores, mostrar alerta genérica
        Swal.fire({
          icon: 'error',
          title: 'Error en el registro',
          text: 'No se pudo completar el registro. Intenta nuevamente.',
          confirmButtonColor: '#d33',
        });
      },
    });
  }
  
  /**
   * Validador asíncrono que verifica la unicidad de la cédula en el sistema.
   * Consulta Firestore para determinar si ya existe un cliente con la misma cédula.
   * 
   * @returns AsyncValidatorFn que retorna error 'cedulaTomada' si existe, null si está disponible.
   */
  uniqueCedulaValidator(): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').trim();
      if (!value) return null;
      
      try {
        const existe = await this.clientesService.existeCedula(value);
        return existe ? { cedulaTomada: true } : null;
      } catch (error) {
        console.error('Error al validar cédula:', error);
        return null;
      }
    };
  }

  /**
   * Validador asíncrono que verifica la unicidad del correo electrónico en el sistema.
   * Consulta Firestore para determinar si ya existe un cliente con el mismo email.
   * 
   * @returns AsyncValidatorFn que retorna error 'emailTomado' si existe, null si está disponible.
   */
  uniqueEmailValidator(): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const value = (control.value || '').trim();
      if (!value) return null;
      
      try {
        const existe = await this.clientesService.existeEmail(value);
        return existe ? { emailTomado: true } : null;
      } catch (error) {
        console.error('Error al validar email:', error);
        return null;
      }
    };
  }
}

