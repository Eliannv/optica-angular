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
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
    this.form = this.fb.group({
      dp: [''],
      add: [''],

      odEsfera: [''],
      odCilindro: [''],
      odEje: [''],
      odAVSC: [''],
      odAVCC: [''],

      oiEsfera: [''],
      oiCilindro: [''],
      oiEje: [''],
      oiAVSC: [''],
      oiAVCC: [''],

      de: [''],
      altura: [''],
      color: [''],
      observacion: [''],

      doctor: [''],

      // Medidas del armazón (montura)
      armazonH: [''],
      armazonV: [''],
      armazonDM: [''],
      armazonP: [''],
      armazonTipo: [''],
      armazonDNP_OD: [''],
      armazonDNP_OI: [''],
      armazonAltura: ['']
    });

    /* =========================
       FORM CLIENTE
       ========================= */
    this.clienteForm = this.fb.group({
      nombres: [''],
      apellidos: [''],
      cedula: [''],
      email: [''],
      telefono: [''],
      pais: [''],
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
      // 🔧 Obtener valores del formulario sin restricciones ni normalizaciones
      const data = this.form.getRawValue();

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
}
