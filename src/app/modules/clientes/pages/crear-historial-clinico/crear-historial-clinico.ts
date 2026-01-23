/**
 * Componente para la creación y edición de historiales clínicos.
 *
 * Este componente proporciona un formulario reactivo completo para gestionar el historial
 * clínico oftalmológico de los clientes, incluyendo:
 * - Datos de refracción ocular (esfera, cilindro, eje) para ambos ojos
 * - Agudeza visual sin corrección (AVSC) y con corrección (AVCC)
 * - Medidas del armazón (montura)
 * - Información del cliente
 * - Observaciones y datos del doctor
 *
 * Soporta tres modos de operación: create (crear), edit (editar) y view (solo lectura).
 * Los datos se almacenan en un único documento 'main' dentro de la subcolección
 * 'historialClinico' de cada cliente.
 */

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

  readonly provinciasEcuador = [
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

  /**
   * Inicializa el componente y configura los formularios reactivos.
   *
   * Crea dos formularios independientes: uno para el historial clínico (con campos
   * de refracción y medidas del armazón) y otro para datos del cliente. Carga el
   * cliente desde Firestore, determina el modo de operación (create/edit/view),
   * y si existe historial previo, pre-llena el formulario con esos datos.
   */
  async ngOnInit() {

    /* =========================
       FORM HISTORIAL CLÍNICO
       ========================= */
    // Patrón: permite solo letras, números, espacios, guiones, puntos y comas
    const patternTexto = /^[a-zA-Z0-9\s\-.,\/ñáéíóúü]+$/i;
    // Patrón para AVSC/AVCC: permite números y diagonal (ej: 20/29, 20/40)
    const patternAV = /^[\d/\s]*$/;

    this.form = this.fb.group({
      dp: [null],
      add: [null],

      odEsfera: [null],
      odCilindro: [null],
      odEje: [null],
      odAVSC: [null],
      odAVCC: [null],

      oiEsfera: [null],
      oiCilindro: [null],
      oiEje: [null],
      oiAVSC: [null],
      oiAVCC: [null],

      de: [''],
      altura: [null],
      color: [''],
      observacion: [''],

      doctor: [''],

      // Medidas del armazón (montura)
      armazonH: [null, Validators.required],
      armazonV: [null, Validators.required],
      armazonDM: [null, Validators.required],
      armazonP: [null, Validators.required],
      armazonTipo: ['', Validators.required],
      armazonDNP_OD: [null, Validators.required],
      armazonDNP_OI: [null, Validators.required],
      armazonAltura: [null, Validators.required]
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

  /**
   * Guarda o actualiza el historial clínico y los datos del cliente.
   *
   * Antes de guardar, normaliza los campos vacíos (numéricos a 0, textos a 'N/A'),
   * valida que todos los campos obligatorios del armazón estén completos, y persiste
   * tanto el historial como los datos actualizados del cliente en Firestore.
   * Tras el guardado exitoso, navega de vuelta a la lista de historiales.
   */
  async guardar() {
    if (this.mode === 'view') return;

    try {
      // 🔧 Obtener valores del formulario
      const data = this.form.getRawValue();
      
      // 🔧 Llenar campos vacíos con 0 automáticamente
      const fieldsToDefault = ['dp', 'add', 'altura', 'odEsfera', 'odCilindro', 'odEje', 'odAVSC', 'odAVCC', 'oiEsfera', 'oiCilindro', 'oiEje', 'oiAVSC', 'oiAVCC'];
      fieldsToDefault.forEach(field => {
        if (data[field] === null || data[field] === undefined || data[field] === '') {
          data[field] = 0;
        }
      });

      // 🔧 Llenar campos de texto vacíos con valores por defecto
      data.de = data.de || 'N/A';
      data.color = data.color || 'N/A';
      data.doctor = data.doctor || 'N/A';
      data.observacion = data.observacion || '';

      // ✅ Validar campos requeridos del armazón
      if (!data.armazonH || !data.armazonV || !data.armazonDM || !data.armazonP || 
          !data.armazonTipo || !data.armazonDNP_OD || !data.armazonDNP_OI || !data.armazonAltura) {
        await Swal.fire({
          icon: 'warning',
          title: 'Campos incompletos',
          text: 'Todos los campos de Medidas del Armazón son obligatorios.',
          confirmButtonColor: '#3085d6'
        });
        return;
      }

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

  /**
   * Cancela la operación y retorna a la lista de historiales clínicos.
   */
  cancelar() {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  /**
   * Verifica si el componente está en modo solo lectura.
   */
  get esView(): boolean { return this.mode === 'view'; }

  /**
   * Verifica si el componente está en modo edición.
   */
  get esEdit(): boolean { return this.mode === 'edit'; }

  /**
   * Verifica si el componente está en modo creación.
   */
  get esCreate(): boolean { return this.mode === 'create'; }

  /**
   * Determina si el botón guardar debe estar habilitado.
   *
   * Valida que todos los campos obligatorios (de, color, doctor y campos del armazón)
   * estén válidos antes de permitir el guardado.
   *
   * @returns true si el formulario es válido, false en caso contrario.
   */
  canGuardar(): boolean {
    // Solo valida los campos requeridos: de, color, doctor y campos del armazón
    const de = this.form.get('de');
    const color = this.form.get('color');
    const doctor = this.form.get('doctor');
    
    // Validar campos del armazón
    const armazonH = this.form.get('armazonH');
    const armazonV = this.form.get('armazonV');
    const armazonDM = this.form.get('armazonDM');
    const armazonP = this.form.get('armazonP');
    const armazonTipo = this.form.get('armazonTipo');
    const armazonDNP_OD = this.form.get('armazonDNP_OD');
    const armazonDNP_OI = this.form.get('armazonDNP_OI');
    const armazonAltura = this.form.get('armazonAltura');
    
    return !!(de?.valid && color?.valid && doctor?.valid && 
              armazonH?.valid && armazonV?.valid && armazonDM?.valid && 
              armazonP?.valid && armazonTipo?.valid && armazonDNP_OD?.valid && 
              armazonDNP_OI?.valid && armazonAltura?.valid);
  }

  /**
   * Verifica si un campo del formulario de cliente es inválido y tocado.
   */
  esInvalidoCliente(campo: string): boolean {
    const c = this.clienteForm.get(campo);
    return !!(c && c.invalid && c.touched);
  }

  /**
   * Verifica si un campo del formulario de historial es inválido y tocado.
   */
  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c && c.invalid && c.touched);
  }

  /**
   * Genera el mensaje de error apropiado para un campo del formulario de cliente.
   */
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

  /**
   * Genera el mensaje de error apropiado para un campo del formulario de historial.
   */
  getMensajeError(campo: string): string {
    const c = this.form.get(campo);
    if (!c || !c.errors) return '';

    if (c.errors['required']) return 'Campo requerido';
    if (c.errors['minlength']) return 'Mínimo 2 caracteres';
    if (c.errors['maxlength']) return 'Máximo 500 caracteres';
    if (c.errors['pattern']) return 'Caracteres especiales no permitidos';
    if (c.errors['min']) return 'Valor debe ser positivo';

    return 'Campo inválido';
  }

  /**
   * Validador asíncrono para verificar unicidad de email del cliente.
   */
  uniqueEmailClienteValidator() {
    return async (control: any) => {
      const v = (control.value || '').trim().toLowerCase();
      if (!v) return null;
      const existe = await this.clientesSrv.existeEmail(v, this.clienteId);
      return existe ? { emailTomado: true } : null;
    };
  }

  /**
   * Validador asíncrono para verificar unicidad de cédula del cliente.
   */
  uniqueCedulaClienteValidator() {
    return async (control: any) => {
      const v = (control.value || '').trim();
      if (!v) return null;
      const existe = await this.clientesSrv.existeCedula(v, this.clienteId);
      return existe ? { cedulaTomada: true } : null;
    };
  }
}
