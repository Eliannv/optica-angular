import { Component, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { RolUsuario } from '../../../core/models/usuario.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-auth-carousel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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
export class AuthCarousel {
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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    // Formulario de login
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    // Formulario de registro
    this.registerForm = this.fb.group(
      {
        cedula: ['', [Validators.required, Validators.maxLength(10), Validators.pattern(/^[0-9]+$/)]],
        nombre: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
        apellido: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
        fechaNacimiento: ['', [Validators.required, this.mayorEdadValidator]],
        correo: ['', [Validators.required, Validators.email]],
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

  // ========== VALIDACIONES PERSONALIZADAS ==========
  // Validación: mayor de edad
  mayorEdadValidator(control: AbstractControl) {
    const fecha = new Date(control.value);
    if (isNaN(fecha.getTime())) return null;
    const hoy = new Date();
    const edad = hoy.getFullYear() - fecha.getFullYear();
    return edad < 18 ? { menorEdad: true } : null;
  }

  // Validación: contraseña fuerte
  passwordFuerteValidator(control: AbstractControl) {
    const value = control.value || '';
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/;
    return strongPassword.test(value) ? null : { weakPassword: true };
  }

  // Validación: contraseñas iguales
  passwordsIgualesValidator(group: AbstractControl) {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  // ========== CAMBIO DE SLIDES ==========
  goTo(slide: number) {
    this.activeSlide.set(slide);
  }

  // ========== LOGIN ==========
  onLogin() {
    if (this.loginForm.invalid) return;

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
        let errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';

        if (err.message && err.message.includes('inactiva')) {
          errorMessage = err.message;
        }

        Swal.fire({
          icon: 'error',
          title: 'Error de inicio de sesión',
          text: errorMessage,
          confirmButtonColor: '#d33',
        });
      },
    });
  }

  // ========== RECUPERAR CONTRASEÑA ==========
  onForgotPassword() {
    if (this.forgotForm.invalid) return;

    this.isLoading = true;
    const { email } = this.forgotForm.value;

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire({
          title: 'Correo enviado',
          text: 'Revisa tu correo electrónico para recuperar tu contraseña.',
          icon: 'success',
          confirmButtonColor: '#28a745',
        });
        this.goTo(1); // Volver al login
      },
      error: (err: any) => {
        this.isLoading = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudo enviar el correo. Verifica que el email sea correcto.',
          icon: 'error',
          confirmButtonColor: '#d33',
        });
      },
    });
  }

  // ========== REGISTRO ==========
  onRegister() {
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

        let errorMessage = 'No se pudo completar el registro. Intenta nuevamente.';

        if (err.message) {
          if (err.message.includes('email-already-in-use')) {
            errorMessage = 'Este correo ya está registrado.';
          } else if (err.message.includes('weak-password')) {
            errorMessage = 'La contraseña es muy débil.';
          }
        }

        Swal.fire({
          icon: 'error',
          title: 'Error en el registro',
          text: errorMessage,
          confirmButtonColor: '#d33',
        });
      },
    });
  }
}

