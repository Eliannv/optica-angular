import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./auth-carousel.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  forgotPasswordForm: FormGroup;
  isLoading = false;
  emailSent = signal(false);
  errorMessage = signal('');

  constructor() {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async onSubmit(): Promise<void> {
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage.set('');

    try {
      const email = this.forgotPasswordForm.value.email;
      await this.authService.resetPassword(email);
      this.emailSent.set(true);
    } catch (error: any) {
      console.error('Error al enviar correo de recuperación:', error);
      this.errorMessage.set(error.message || 'Error al enviar el correo. Intenta nuevamente.');
    } finally {
      this.isLoading = false;
    }
  }

  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}
