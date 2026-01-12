import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

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
  maxFecha = '';

  ngOnInit(): void {
    this.inicializarFormulario();
    this.validarCajaAbiertaHoy();
  }

  inicializarFormulario(): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    this.maxFecha = hoy.toISOString().split('T')[0];

    this.form = this.formBuilder.group({
      fecha: [this.maxFecha, Validators.required],
      monto_inicial: ['', [Validators.required, Validators.min(0)]],
      observacion: ['']
    });
  }

  validarCajaAbiertaHoy(): void {
    const cajaAbiertaId = localStorage.getItem('cajaChicaAbierta');
    if (cajaAbiertaId) {
      this.cajaChicaService.getCajaChicaById(cajaAbiertaId).subscribe({
        next: (caja) => {
          if (caja && caja.estado === 'ABIERTA') {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const fechaCaja = new Date(caja.fecha);
            fechaCaja.setHours(0, 0, 0, 0);
            
            if (fechaCaja.getTime() === hoy.getTime()) {
              Swal.fire({
                icon: 'warning',
                title: 'Caja ya abierta',
                text: `Ya existe una caja abierta hoy por ${caja.usuario_nombre}. Ciérrala primero.`,
                confirmButtonText: 'Ir a la caja',
                allowOutsideClick: false,
                allowEscapeKey: false
              }).then((result) => {
                if (result.isConfirmed) {
                  this.router.navigate(['/caja-chica/ver', cajaAbiertaId]);
                }
              });
            }
          } else {
            // La caja no existe o está cerrada, limpiar localStorage
            localStorage.removeItem('cajaChicaAbierta');
          }
        },
        error: () => {
          // Si hay error al obtener la caja, limpiar localStorage (caja no existe)
          localStorage.removeItem('cajaChicaAbierta');
        }
      });
    }
  }

  abrirCaja(): void {
    if (this.form.invalid) {
      Swal.fire({
        icon: 'error',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos requeridos'
      });
      return;
    }

    // Validar que la fecha no sea futura
    const fechaSel = new Date(this.form.get('fecha')?.value);
    const hoyCmp = new Date();
    fechaSel.setHours(0,0,0,0);
    hoyCmp.setHours(0,0,0,0);
    if (fechaSel.getTime() > hoyCmp.getTime()) {
      Swal.fire({
        icon: 'warning',
        title: 'Fecha inválida',
        text: 'La fecha de apertura no puede ser posterior a hoy.'
      });
      return;
    }

    // Verificación rápida en localStorage (ayuda UX)
    const cajaAbiertaId = localStorage.getItem('cajaChicaAbierta');
    if (cajaAbiertaId) {
      Swal.fire({
        icon: 'error',
        title: 'Caja ya abierta',
        text: 'Ya existe una caja abierta para hoy'
      });
      return;
    }

    this.cargando = true;

    const usuario = this.authService.getCurrentUser();
    const montoParse = parseFloat(this.form.get('monto_inicial')?.value);

    // Crear la fecha en zona horaria local (evitar offset timezone)
    const fechaStr = this.form.get('fecha')?.value;
    const [year, month, day] = fechaStr.split('-');
    const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);

    const nuevaCaja = {
      fecha,
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
        localStorage.setItem('cajaChicaAbierta', cajaId);
        Swal.fire({
          icon: 'success',
          title: 'Caja abierta',
          text: `Caja chica abierta con $${montoParse.toFixed(2)}`,
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/caja-chica/ver', cajaId]);
        });
      },
      (error) => {
        this.cargando = false;
        console.error('Error al abrir caja:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: (error?.message) || 'No se pudo abrir la caja chica'
        });
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
