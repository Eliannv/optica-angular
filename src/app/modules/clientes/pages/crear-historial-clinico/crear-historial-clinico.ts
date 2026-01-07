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

    /* =========================
       FORM HISTORIAL CLÍNICO
       ========================= */
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
      observacion: [''],

      // 🔧 IMPORTANTE: valor por defecto
      doctor: ['']
    });

    /* =========================
       FORM CLIENTE
       ========================= */
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

    /* =========================
       CARGA DE DATOS
       ========================= */
    this.clienteId = this.route.snapshot.paramMap.get('id')!;

    this.cliente = await firstValueFrom(
      this.clientesSrv.getClienteById(this.clienteId)
    );

    if (this.cliente) {
      this.clienteForm.patchValue(this.cliente);
    }

    const qpMode = (this.route.snapshot.queryParamMap.get('mode') || '').toLowerCase();
    if (qpMode === 'create' || qpMode === 'edit' || qpMode === 'view') {
      this.mode = qpMode;
    }

    const snap = await this.historialSrv.obtenerHistorial(this.clienteId);
    this.existeHistorial = snap.exists();

    if (this.existeHistorial) {
      const data = snap.data() as any;

      // 🔧 FIX CLAVE: forzar doctor
      this.form.patchValue({
        ...data,
        doctor: data?.doctor ?? ''
      });

      if (!qpMode) this.mode = 'edit';
    } else {
      if (!qpMode) this.mode = 'create';
    }

    if (this.mode === 'view') {
      this.form.disable({ emitEvent: false });
      this.clienteForm.disable({ emitEvent: false });
    }

    this.loading = false;
  }

  /* =========================
     GUARDAR
     ========================= */
  async guardar() {
    if (this.mode === 'view') return;

    if (this.form.invalid || this.clienteForm.invalid) {
      this.form.markAllAsTouched();
      this.clienteForm.markAllAsTouched();
      return;
    }

    try {
      // 🔧 doble seguridad
      const data = this.form.getRawValue();
      data.doctor = data.doctor ?? '';

      await this.historialSrv.guardarHistorial(this.clienteId, data);

      await this.clientesSrv.updateCliente(
        this.clienteId,
        this.clienteForm.getRawValue() as Partial<Cliente>
      );

      await Swal.fire({
        icon: 'success',
        title: 'Guardado exitoso',
        text: 'El historial clínico fue guardado correctamente.',
        timer: 2000,
        showConfirmButton: false
      });

      this.router.navigate(['/clientes/historial-clinico']);

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error?.message || 'Error al guardar',
        confirmButtonColor: '#d33'
      });
    }
  }

  cancelar() {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  /* =========================
     HELPERS
     ========================= */
  get esView() { return this.mode === 'view'; }
  get esEdit() { return this.mode === 'edit'; }
  get esCreate() { return this.mode === 'create'; }

  esInvalidoCliente(campo: string): boolean {
    const c = this.clienteForm.get(campo);
    return !!(c && c.invalid && c.touched);
  }

  getMensajeErrorCliente(campo: string): string {
    const c = this.clienteForm.get(campo);
    if (!c || !c.errors) return '';

    if (c.errors['required']) return 'Campo requerido';
    if (c.errors['minlength']) return 'Muy corto';
    if (c.errors['pattern']) return 'Formato inválido';
    if (c.errors['email']) return 'Email inválido';
    if (c.errors['emailTomado']) return 'Email ya registrado';
    if (c.errors['cedulaTomada']) return 'Cédula ya registrada';

    return 'Campo inválido';
  }

  uniqueEmailClienteValidator() {
    return async (control: any) => {
      const v = (control.value || '').trim().toLowerCase();
      if (!v) return null;
      const existe = await this.clientesSrv.existeEmail(v, this.clienteId);
      return existe ? { emailTomado: true } : null;
    };
  }

  uniqueCedulaClienteValidator() {
    return async (control: any) => {
      const v = (control.value || '').trim();
      if (!v) return null;
      const existe = await this.clientesSrv.existeCedula(v, this.clienteId);
      return existe ? { cedulaTomada: true } : null;
    };
  }
}
