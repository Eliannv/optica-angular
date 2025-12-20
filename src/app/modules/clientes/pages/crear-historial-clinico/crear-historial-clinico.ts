import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';

type Mode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-crear-historial-clinico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-historial-clinico.html',
  styleUrl: './crear-historial-clinico.css'
})
export class CrearHistorialClinicoComponent implements OnInit {

  clienteId!: string;

  loading = true;
  form!: FormGroup;

  mode: Mode = 'create';
  existeHistorial = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private historialSrv: HistorialClinicoService
  ) {}

  async ngOnInit() {
    // 1) Form
    this.form = this.fb.group({
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

    // 2) Id cliente (tu ruta usa /clientes/:id/crear-historial-clinico)
    this.clienteId = this.route.snapshot.paramMap.get('id')!;

    // 3) mode por query param
    const qpMode = (this.route.snapshot.queryParamMap.get('mode') || '').toLowerCase();
    if (qpMode === 'create' || qpMode === 'edit' || qpMode === 'view') {
      this.mode = qpMode;
    }

    // 4) Cargar historial si existe
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

    // 5) Si es view => solo lectura
    if (this.mode === 'view') {
      this.form.disable({ emitEvent: false });
    }

    this.loading = false;
  }

  // ✅ Guardar (crea o actualiza)
  async guardar() {
    // Si está en view, no guarda
    if (this.mode === 'view') return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    await this.historialSrv.guardarHistorial(
      this.clienteId,
      this.form.getRawValue() as any // por si el form está disable en algún momento
    );

    // volver a la lista de historiales
    this.router.navigate(['/clientes/historial-clinico']);
  }

  cancelar() {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  // 👇 helpers opcionales para el HTML
  get esView() { return this.mode === 'view'; }
  get esEdit() { return this.mode === 'edit'; }
  get esCreate() { return this.mode === 'create'; }
}
