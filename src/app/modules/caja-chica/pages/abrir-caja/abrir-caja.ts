import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-abrir-caja',
  standalone: false,
  templateUrl: './abrir-caja.html',
  styleUrls: ['./abrir-caja.css']
})
export class AbrirCajaComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  form!: FormGroup;
  cargando = false;
  error = '';

  ngOnInit(): void {
    this.inicializarFormulario();
  }

  inicializarFormulario(): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    this.form = this.formBuilder.group({
      fecha: [hoy.toISOString().split('T')[0], Validators.required],
      monto_inicial: ['', [Validators.required, Validators.min(0)]],
      observacion: ['']
    });
  }

  abrirCaja(): void {
    if (this.form.invalid) {
      this.error = 'Por favor completa todos los campos requeridos';
      return;
    }

    this.cargando = true;
    this.error = '';

    const usuario = this.authService.getCurrentUser();
    const montoParse = parseFloat(this.form.get('monto_inicial')?.value);

    const nuevaCaja = {
      fecha: new Date(this.form.get('fecha')?.value),
      monto_inicial: montoParse,
      monto_actual: montoParse,
      estado: 'ABIERTA' as const,
      usuario_id: usuario?.id,
      usuario_nombre: usuario?.nombre || 'Usuario Desconocido',
      observacion: this.form.get('observacion')?.value || ''
    };

    this.cajaChicaService.abrirCajaChica(nuevaCaja).then(
      (cajaId) => {
        this.cargando = false;
        // 💾 Guardar en localStorage la caja abierta actual
        localStorage.setItem('cajaChicaAbierta', cajaId);
        console.log('✅ Caja abierta:', cajaId);
        this.router.navigate(['/caja-chica/ver', cajaId]);
      },
      (error) => {
        this.cargando = false;
        console.error('Error al abrir caja:', error);
        this.error = 'Error al abrir la caja chica';
      }
    );
  }

  volver(): void {
    this.router.navigate(['/caja-chica']);
  }

  get montoControl() {
    return this.form.get('monto_inicial');
  }
}
