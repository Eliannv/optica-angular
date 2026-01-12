import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { MovimientoCajaChica } from '../../../../core/models/caja-chica.model';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-registrar-movimiento',
  standalone: false,
  templateUrl: './registrar-movimiento.html',
  styleUrls: ['./registrar-movimiento.css']
})
export class RegistrarMovimientoComponent implements OnInit {
  private cajaChicaService = inject(CajaChicaService);
  private formBuilder = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  form!: FormGroup;
  cajaId: string = '';
  cargando = false;
  error = '';
  exito = false;
  saldoActual = 0;

  tipos = [
    { value: 'INGRESO', label: 'Ingreso (Efectivo de ventas)' },
    { value: 'EGRESO', label: 'Egreso (Gasto pequeño)' }
  ];

  ngOnInit(): void {
    this.cajaId = this.route.snapshot.paramMap.get('id') || '';
    this.inicializarFormulario();
    this.cargarSaldoActual();
  }

  inicializarFormulario(): void {
    this.form = this.formBuilder.group({
      tipo: ['INGRESO', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      monto: ['', [Validators.required, Validators.min(0.01)]],
      comprobante: [''],
      observacion: ['']
    });
  }

  cargarSaldoActual(): void {
    this.cajaChicaService.getCajaChicaById(this.cajaId).subscribe({
      next: (caja) => {
        this.saldoActual = caja.monto_actual || 0;
      },
      error: (error) => {
        console.error('Error al cargar saldo:', error);
        this.error = 'Error al cargar el saldo actual';
      }
    });
  }

  registrarMovimiento(): void {
    if (this.form.invalid) {
      Swal.fire({
        icon: 'error',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos obligatorios.'
      });
      return;
    }

    const monto = parseFloat(this.form.get('monto')?.value);
    const tipo = this.form.get('tipo')?.value;

    // Validar saldo suficiente para egresos
    if (tipo === 'EGRESO' && monto > this.saldoActual) {
      Swal.fire({
        icon: 'warning',
        title: 'Saldo insuficiente',
        text: 'La caja chica no tiene suficiente saldo para este egreso.'
      });
      return;
    }

    this.cargando = true;
    this.error = '';

    const usuario = this.authService.getCurrentUser();
    const movimiento: MovimientoCajaChica = {
      caja_chica_id: this.cajaId,
      fecha: new Date(),
      tipo,
      descripcion: this.form.get('descripcion')?.value,
      monto,
      comprobante: this.form.get('comprobante')?.value,
      observacion: this.form.get('observacion')?.value,
      ...(usuario?.id ? { usuario_id: usuario.id } : {}),
      ...(usuario?.nombre ? { usuario_nombre: usuario.nombre } : {}),
    };

    this.cajaChicaService.registrarMovimiento(this.cajaId, movimiento).then(
      () => {
        this.cargando = false;
        this.exito = true;
        this.form.reset({ tipo: 'INGRESO' });
        this.cargarSaldoActual();
        Swal.fire({
          icon: 'success',
          title: 'Movimiento registrado',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/caja-chica/ver', this.cajaId]);
        });
      },
      (error) => {
        this.cargando = false;
        console.error('Error al registrar movimiento:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error?.message || 'Error al registrar el movimiento'
        });
      }
    );
  }

  volver(): void {
    this.router.navigate(['/caja-chica/ver', this.cajaId]);
  }

  get montoControl() {
    return this.form.get('monto');
  }

  get descriptionControl() {
    return this.form.get('descripcion');
  }

  formatoMoneda(monto: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(monto || 0);
  }
}
