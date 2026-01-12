import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-registrar-movimiento',
  standalone: false,
  templateUrl: './registrar-movimiento.html',
  styleUrls: ['./registrar-movimiento.css']
})
export class RegistrarMovimientoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);

  formulario!: FormGroup;
  guardando = false;
  mensaje = '';

  categorias_ingresos = ['CIERRE_CAJA_CHICA', 'TRANSFERENCIA_CLIENTE', 'OTRO_INGRESO'];
  categorias_egresos = ['PAGO_TRABAJADOR', 'OTRO_EGRESO'];
  categorias_actuales: string[] = this.categorias_ingresos;

  ngOnInit(): void {
    this.inicializarFormulario();
  }

  inicializarFormulario(): void {
    this.formulario = this.fb.group({
      tipo: ['INGRESO', Validators.required],
      categoria: ['CIERRE_CAJA_CHICA', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      referencia: ['']
    });

    this.formulario.get('tipo')!.valueChanges.subscribe((tipo) => {
      this.onTipoChange(tipo);
    });
  }

  onTipoChange(tipo: string): void {
    const categoriaControl = this.formulario.get('categoria');
    if (tipo === 'INGRESO') {
      this.categorias_actuales = this.categorias_ingresos;
      categoriaControl?.setValue('CIERRE_CAJA_CHICA');
    } else {
      this.categorias_actuales = this.categorias_egresos;
      categoriaControl?.setValue('PAGO_TRABAJADOR');
    }
  }

  async guardarMovimiento(): Promise<void> {
    if (!this.formulario.valid) {
      this.mensaje = 'Por favor completa todos los campos obligatorios';
      return;
    }

    this.guardando = true;
    const usuario = this.authService.getCurrentUser();

    try {
      const movimiento = {
        ...this.formulario.value,
        fecha: new Date(),
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre
      };

      await this.cajaBancoService.registrarMovimiento(movimiento);
      this.mensaje = '✓ Movimiento registrado correctamente';
      
      setTimeout(() => {
        this.router.navigate(['/caja-banco']);
      }, 1500);
    } catch (error) {
      console.error('Error al guardar movimiento:', error);
      this.mensaje = '✗ Error al guardar el movimiento';
    } finally {
      this.guardando = false;
    }
  }

  volver(): void {
    this.router.navigate(['/caja-banco']);
  }
}
