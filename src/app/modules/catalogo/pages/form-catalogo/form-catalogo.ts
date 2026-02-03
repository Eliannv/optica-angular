/**
 * Componente de formulario para crear y editar ítems del catálogo.
 * Utiliza formularios reactivos y validaciones básicas.
 * Módulo: Catálogo (ítems sin inventario)
 */
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CatalogoService } from '../../../../core/services/catalogo.service';
import { CatalogoItem, CategoriaCatalogo, CATEGORIA_LABELS } from '../../../../core/models/catalogo.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-form-catalogo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './form-catalogo.html',
  styleUrl: './form-catalogo.css'
})
export class FormCatalogoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private catalogoService = inject(CatalogoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form!: FormGroup;
  cargando = false;
  editando = false;
  itemId: string | null = null;
  categorias: CategoriaCatalogo[] = Object.values(CategoriaCatalogo);
  categoriasLabels = CATEGORIA_LABELS;

  ngOnInit(): void {
    this.inicializarFormulario();
    this.verificarSiEsEdicion();
  }

  /**
   * Inicializa el formulario con validaciones.
   */
  private inicializarFormulario(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      categoria: ['', Validators.required],
      precio: [null, [Validators.min(0)]],
      iva: [15, [Validators.required, Validators.min(0), Validators.max(100)]],
      activo: [true, Validators.required],
      observacion: ['']
    });
  }

  /**
   * Verifica si se está editando un ítem existente.
   */
  private verificarSiEsEdicion(): void {
    this.route.params.subscribe((params) => {
      if (params['id']) {
        this.itemId = params['id'];
        this.editando = true;
        this.cargarItem(params['id']);
      }
    });
  }

  /**
   * Carga los datos del ítem a editar.
   */
  private cargarItem(id: string): void {
    this.cargando = true;
    this.catalogoService.getItemById(id).subscribe({
      next: (item: CatalogoItem) => {
        this.form.patchValue(item);
        this.cargando = false;
      },
      error: (error: any) => {
        console.error('Error al cargar ítem:', error);
        Swal.fire('Error', 'No se pudo cargar el ítem', 'error');
        this.router.navigate(['/catalogo']);
        this.cargando = false;
      }
    });
  }

  /**
   * Envía el formulario para crear o actualizar un ítem.
   */
  async enviar(): Promise<void> {
    if (this.form.invalid) {
      Swal.fire('Validación', 'Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    this.cargando = true;
    const datos = this.form.value as CatalogoItem;

    try {
      if (this.editando && this.itemId) {
        await this.catalogoService.actualizarItem(this.itemId, datos);
        await Swal.fire('Éxito', 'Ítem actualizado correctamente', 'success');
      } else {
        await this.catalogoService.crearItem(datos);
        await Swal.fire('Éxito', 'Ítem creado correctamente', 'success');
      }
      this.router.navigate(['/catalogo']);
    } catch (error) {
      console.error('Error al guardar ítem:', error);
      Swal.fire('Error', 'No se pudo guardar el ítem', 'error');
    } finally {
      this.cargando = false;
    }
  }

  /**
   * Cancela la edición y regresa al listado.
   */
  cancelar(): void {
    this.router.navigate(['/catalogo']);
  }

  /**
   * Obtiene el control de un campo del formulario.
   */
  get(fieldName: string) {
    return this.form.get(fieldName);
  }

  /**
   * Verifica si un campo tiene error.
   */
  tieneError(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  /**
   * Obtiene el mensaje de error de un campo.
   */
  getMensajeError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control) return '';

    if (control.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control.hasError('minlength')) {
      return `Mínimo ${control.getError('minlength')?.requiredLength} caracteres`;
    }
    if (control.hasError('min')) {
      return `Mínimo ${control.getError('min')?.min}`;
    }
    if (control.hasError('max')) {
      return `Máximo ${control.getError('max')?.max}`;
    }
    return 'Campo inválido';
  }

  /**
   * Obtiene la etiqueta de la categoría.
   */
  getCategoriLabel(categoria: string): string {
    return this.categoriasLabels[categoria] || categoria;
  }

  /**
   * Calcula el precio con IVA en tiempo real.
   */
  get precioConIVA(): number | null {
    const precio = this.form.get('precio')?.value;
    const iva = this.form.get('iva')?.value;
    if (precio && iva) {
      return precio * (1 + iva / 100);
    }
    return null;
  }
}
