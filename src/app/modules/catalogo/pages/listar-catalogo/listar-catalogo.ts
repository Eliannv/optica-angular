/**
 * Componente para listar todos los ítems del catálogo.
 * Permite crear, editar y desactivar ítems del catálogo.
 * Muestra los ítems filtrados por categoría activa.
 * Módulo: Catálogo (ítems sin inventario)
 */
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { CatalogoService } from '../../../../core/services/catalogo.service';
import { CatalogoItem, CategoriaCatalogo, CATEGORIA_LABELS } from '../../../../core/models/catalogo.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-listar-catalogo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './listar-catalogo.html',
  styleUrl: './listar-catalogo.css'
})
export class ListarCatalogoComponent implements OnInit {
  private catalogoService = inject(CatalogoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  items: CatalogoItem[] = [];
  itemsFiltrados: CatalogoItem[] = [];
  categoriaSeleccionada: CategoriaCatalogo | null = null;
  cargando = false;
  mostrarInactivos = false;

  categorias: CategoriaCatalogo[] = Object.values(CategoriaCatalogo);
  categoriasLabels = CATEGORIA_LABELS;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const categoriaParam = params.get('categoria') as CategoriaCatalogo | null;
      this.categoriaSeleccionada = this.categorias.includes(categoriaParam as CategoriaCatalogo)
        ? (categoriaParam as CategoriaCatalogo)
        : null;
      this.filtrarPorCategoria();
    });
    this.cargarItems();
  }

  /**
   * Carga los ítems del catálogo desde el servicio.
   */
  private cargarItems(): void {
    this.cargando = true;
    const items$ = this.mostrarInactivos
      ? this.catalogoService.getItemsTodosInclusoInactivos()
      : this.catalogoService.getItems();

    items$.subscribe({
      next: (items: CatalogoItem[]) => {
        this.items = items;
        this.filtrarPorCategoria();
        this.cargando = false;
      },
      error: (error: any) => {
        console.error('Error al cargar ítems:', error);
        Swal.fire('Error', 'No se pudieron cargar los ítems del catálogo', 'error');
        this.cargando = false;
      }
    });
  }

  /**
   * Filtra los ítems por la categoría seleccionada.
   */
  filtrarPorCategoria(): void {
    if (this.categoriaSeleccionada) {
      this.itemsFiltrados = this.items.filter(
        (item) => item.categoria === this.categoriaSeleccionada
      );
    } else {
      this.itemsFiltrados = this.items;
    }
  }

  /**
   * Selecciona una categoría para filtrar.
   */
  seleccionarCategoria(categoria: CategoriaCatalogo | null): void {
    this.categoriaSeleccionada =
      this.categoriaSeleccionada === categoria ? null : categoria;
    this.filtrarPorCategoria();
  }

  /**
   * Alterna la visualización de ítems inactivos.
   */
  toggleMostrarInactivos(): void {
    this.mostrarInactivos = !this.mostrarInactivos;
    this.cargarItems();
  }

  /**
   * Navega al formulario para crear un nuevo ítem.
   */
  irACrear(): void {
    this.router.navigate(['/catalogo/crear']);
  }

  /**
   * Navega al formulario para editar un ítem.
   */
  irAEditar(id: string): void {
    this.router.navigate(['/catalogo/editar', id]);
  }

  /**
   * Desactiva un ítem después de confirmación.
   */
  async desactivarItem(item: CatalogoItem): Promise<void> {
    const result = await Swal.fire({
      title: '¿Desactivar ítem?',
      text: `¿Está seguro que desea desactivar "${item.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed && item.id) {
      try {
        await this.catalogoService.desactivarItem(item.id);
        Swal.fire('Éxito', 'Ítem desactivado correctamente', 'success');
        this.cargarItems();
      } catch (error) {
        console.error('Error al desactivar ítem:', error);
        Swal.fire('Error', 'No se pudo desactivar el ítem', 'error');
      }
    }
  }

  /**
   * Activa un ítem inactivo.
   */
  async activarItem(item: CatalogoItem): Promise<void> {
    if (!item.id) return;

    try {
      await this.catalogoService.activarItem(item.id);
      Swal.fire('Éxito', 'Ítem activado correctamente', 'success');
      this.cargarItems();
    } catch (error) {
      console.error('Error al activar ítem:', error);
      Swal.fire('Error', 'No se pudo activar el ítem', 'error');
    }
  }

  /**
   * Elimina permanentemente un ítem inactivo después de doble confirmación.
   * ADVERTENCIA: Esta acción es irreversible.
   */
  async eliminarItem(item: CatalogoItem): Promise<void> {
    const result = await Swal.fire({
      title: '¿Eliminar permanentemente?',
      html: `<p><strong>ADVERTENCIA:</strong> Esta acción es <u>irreversible</u>.</p>
             <p>¿Está seguro que desea eliminar "<strong>${item.nombre}</strong>" de forma permanente?</p>`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      input: 'checkbox',
      inputPlaceholder: 'Entiendo que esta acción es irreversible',
      inputValidator: (result) => {
        return !result && 'Debes confirmar que entiendes que esta acción es irreversible';
      }
    });

    if (result.isConfirmed && item.id) {
      try {
        await this.catalogoService.eliminarItem(item.id);
        Swal.fire('Eliminado', 'Ítem eliminado permanentemente', 'success');
        this.cargarItems();
      } catch (error) {
        console.error('Error al eliminar ítem:', error);
        Swal.fire('Error', 'No se pudo eliminar el ítem', 'error');
      }
    }
  }

  /**
   * Obtiene la etiqueta de la categoría.
   */
  getCategoriLabel(categoria: string): string {
    return this.categoriasLabels[categoria] || categoria;
  }

  /**
   * Obtiene el estado en formato legible.
   */
  getEstado(activo: boolean | undefined): string {
    return activo === false ? 'Inactivo' : 'Activo';
  }
}
