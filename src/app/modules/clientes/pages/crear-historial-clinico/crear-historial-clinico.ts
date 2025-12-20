import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';

@Component({
  selector: 'app-crear-historial-clinico',
  standalone: true, // ✅
  imports: [CommonModule, ReactiveFormsModule], // ✅ formGroup funciona aquí
  templateUrl: './crear-historial-clinico.html',
  styleUrl: './crear-historial-clinico.css'
})
export class CrearHistorialClinicoComponent implements OnInit {

  clienteId!: string;
  loading = true;
  form!: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private historialSrv: HistorialClinicoService
  ) {}

  async ngOnInit() {
    // Inicializar formulario
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

    // Obtener id del cliente
    this.clienteId = this.route.snapshot.paramMap.get('id')!;

    // Cargar historial si existe
    const snap = await this.historialSrv.obtenerHistorial(this.clienteId);
    if (snap.exists()) {
      this.form.patchValue(snap.data() as any);
    }

    this.loading = false;
  }

  async guardar() {
    if (this.form.invalid) return;

    await this.historialSrv.guardarHistorial(
      this.clienteId,
      this.form.value as any
    );

    this.router.navigate(['/clientes']);
  }

  // 👇 Método para el botón Cancelar (HTML)
  cancelar() {
    this.router.navigate(['/clientes']);
  }
}
