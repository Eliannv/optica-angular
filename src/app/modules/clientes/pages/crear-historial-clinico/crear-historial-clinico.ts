import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { ClientesService } from '../../../../core/services/clientes';
import { Cliente } from '../../../../core/models/cliente.model';
import { EnterNextDirective } from '../../../../shared/directives/enter-next.directive';

type Mode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-crear-historial-clinico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EnterNextDirective],
  templateUrl: './crear-historial-clinico.html',
  styleUrl: './crear-historial-clinico.css'
})
export class CrearHistorialClinicoComponent implements OnInit {

  clienteId!: string;
  cliente: Cliente | null = null;

  loading = true;
  form!: FormGroup;
  clienteForm!: FormGroup;

  mode: Mode = 'create';
  existeHistorial = false;

  provinciasEcuador = [
    'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi',
    'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja',
    'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza',
    'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas',
    'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private historialSrv: HistorialClinicoService,
    private clientesSrv: ClientesService
  ) {}

  async ngOnInit() {
    // 1) Form Historial Clínico
    this.form = this.fb.group({
      dp: [null],
      add: [null],
      odEsfera: [null],
      odCilindro: [null],
      odEje: [null],

      oiEsfera: [null],
      oiCilindro: [null],
      oiEje: [null],

      de: ['', Validators.required],
      altura: [null],
      color: ['', Validators.required],
      observacion: ['']
    });

    // 2) Form Información Personal del Cliente
    this.clienteForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      cedula: ['', {
        validators: [Validators.required, Validators.pattern(/^\d{10}$/)],
        asyncValidators: [this.uniqueCedulaClienteValidator()],
        updateOn: 'blur'
      }],
      email: ['', {
        validators: [Validators.email],
        asyncValidators: [this.uniqueEmailClienteValidator()],
        updateOn: 'blur'
      }],
      telefono: ['', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
      pais: ['Ecuador'],
      provincia: [''],
      ciudad: [''],
      direccion: ['']
    });

    // 3) Id cliente (tu ruta usa /clientes/:id/crear-historial-clinico)
    this.clienteId = this.route.snapshot.paramMap.get('id')!;

    // 4) Cargar datos del cliente
    this.cliente = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));
    if (this.cliente) {
      this.clienteForm.patchValue(this.cliente);
    }

    // 5) mode por query param
    const qpMode = (this.route.snapshot.queryParamMap.get('mode') || '').toLowerCase();
    if (qpMode === 'create' || qpMode === 'edit' || qpMode === 'view') {
      this.mode = qpMode;
    }

    // 6) Cargar historial si existe
    const snap = await this.historialSrv.obtenerHistorial(this.clienteId);
    this.existeHistorial = snap.exists();

    if (this.existeHistorial) {
      this.form.patchValue(snap.data() as any);
      // si no mandaron mode, por defecto es edit
      if (!qpMode) this.mode = 'edit';
    } else {
      // si no existe y no mandaron mode, por defecto create
      if (!qpMode) this.mode = 'create';
    }

    // 7) Si es view => solo lectura
    if (this.mode === 'view') {
      this.form.disable({ emitEvent: false });
      this.clienteForm.disable({ emitEvent: false });
    }

    this.loading = false;
  }

  // ✅ Guardar (crea o actualiza historial Y datos del cliente)
  async guardar() {
    // Si está en view, no guarda
    if (this.mode === 'view') return;

    // Validar ambos formularios
    if (this.form.invalid || this.clienteForm.invalid) {
      this.form.markAllAsTouched();
      this.clienteForm.markAllAsTouched();
      return;
    }

    try {
      // Guardar historial clínico
      await this.historialSrv.guardarHistorial(
        this.clienteId,
        this.form.getRawValue() as any
      );

      // Guardar datos personales del cliente
      await this.clientesSrv.updateCliente(
        this.clienteId,
        this.clienteForm.getRawValue() as Partial<Cliente>
      );

      // Mostrar mensaje de éxito
      await Swal.fire({
        icon: 'success',
        title: 'Guardado exitoso',
        text: 'La información del historial clínico y datos del cliente se han guardado correctamente.',
        showConfirmButton: false,
        timer: 2000
      });

      // volver a la lista de historiales
      this.router.navigate(['/clientes/historial-clinico']);
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: error?.message || 'Ocurrió un error al guardar la información. Por favor, intenta nuevamente.',
        confirmButtonColor: '#d33'
      });
    }
  }

  cancelar() {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  // Helpers para validaciones
  esInvalidoCliente(campo: string): boolean {
    const control = this.clienteForm.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  getMensajeErrorCliente(campo: string): string {
    const control = this.clienteForm.get(campo);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['pattern']) {
      if (campo === 'cedula') return 'Debe tener 10 dígitos';
      if (campo === 'telefono') return 'Debe iniciar con 0 y tener 10 dígitos';
    }
    if (control.errors['email']) return 'Correo electrónico inválido';
    if (control.errors['emailTomado']) return 'Este correo ya está registrado en el sistema';
    if (control.errors['cedulaTomada']) return 'Esta cédula ya está registrada en el sistema';
    return 'Campo inválido';
  }

  // 👇 helpers opcionales para el HTML
  get esView() { return this.mode === 'view'; }
  get esEdit() { return this.mode === 'edit'; }
  get esCreate() { return this.mode === 'create'; }

  // Validador asíncrono para email único, excluyendo el cliente actual
  uniqueEmailClienteValidator() {
    return async (control: any) => {
      const value = (control.value || '').trim().toLowerCase();
      if (!value) return null;
      const existe = await this.clientesSrv.existeEmail(value, this.clienteId);
      return existe ? { emailTomado: true } : null;
    };
  }

  // Validador asíncrono para cédula única, excluyendo el cliente actual
  uniqueCedulaClienteValidator() {
    return async (control: any) => {
      const value = (control.value || '').trim();
      if (!value) return null;
      const existe = await this.clientesSrv.existeCedula(value, this.clienteId);
      return existe ? { cedulaTomada: true } : null;
    };
  }
}
