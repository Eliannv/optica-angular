/**
 * Componente para listar todos los ítems del catálogo.
 * Permite crear, editar y desactivar ítems del catálogo.
 * Muestra los ítems filtrados por categoría activa.
 * Módulo: Catálogo (ítems sin inventario)
 */
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from '../../../../core/services/catalogo.service';
import { CatalogoItem, CategoriaCatalogo, CATEGORIA_LABELS } from '../../../../core/models/catalogo.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-listar-catalogo',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './listar-catalogo.html',
  styleUrl: './listar-catalogo.css'
})
export class ListarCatalogoComponent implements OnInit {
  private catalogoService = inject(CatalogoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  items: CatalogoItem[] = [];
  itemsFiltrados: CatalogoItem[] = [];
  itemsPaginados: CatalogoItem[] = [];
  paginaActual: number = 1;
  itemsPorPagina: number = 10;
  totalItems: number = 0;
  Math = Math;
  
  categoriaSeleccionada: CategoriaCatalogo | null = null;
  cargando = false;
  mostrarInactivos = false;
  terminoBusqueda: string = '';
  ordenamiento: string = 'reciente';

  categorias: CategoriaCatalogo[] = Object.values(CategoriaCatalogo);
  categoriasLabels = CATEGORIA_LABELS;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const categoriaParam = params.get('categoria') as CategoriaCatalogo | null;
      this.categoriaSeleccionada = this.categorias.includes(categoriaParam as CategoriaCatalogo)
        ? (categoriaParam as CategoriaCatalogo)
        : null;
      this.cargarItems();
    });
  }

  /**
   * Carga los ítems del catálogo desde el servicio.
   */
  private cargarItems(): void {
    this.cargando = true;
    this.catalogoService.getItemsTodosInclusoInactivos().subscribe({
      next: (items: CatalogoItem[]) => {
        this.items = items;
        this.aplicarFiltros();
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
   * Aplica todos los filtros (categoría, búsqueda, ordenamiento) y actualiza la paginación
   */
  aplicarFiltros(): void {
    let resultado = [...this.items];

    // Filtro por categoría (solo si viene del sidebar hijo)
    if (this.categoriaSeleccionada) {
      resultado = resultado.filter(item => item.categoria === this.categoriaSeleccionada);
    }

    // Filtro por búsqueda
    if (this.terminoBusqueda.trim()) {
      const termino = this.terminoBusqueda.toLowerCase().trim();
      resultado = resultado.filter(item =>
        (item.nombre?.toLowerCase().includes(termino) || false) ||
        (item.observacion?.toLowerCase().includes(termino) || false) ||
        (this.getCategoriLabel(item.categoria)?.toLowerCase().includes(termino) || false)
      );
    }

    // Ordenamiento
    if (this.ordenamiento === 'reciente') {
      resultado.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(0);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    }

    this.itemsFiltrados = resultado;
    this.totalItems = resultado.length;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Actualiza la paginación mostrando los ítems correspondientes a la página actual
   */
  actualizarPaginacion(): void {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    this.itemsPaginados = [...this.itemsFiltrados.slice(inicio, fin)];
  }

  /**
   * Busca ítems según el término de búsqueda
   */
  buscarItems(): void {
    this.aplicarFiltros();
  }

  /**
   * Limpia el campo de búsqueda y recarga los ítems
   */
  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.aplicarFiltros();
  }

  /**
   * Cambia el ordenamiento de los ítems
   */
  cambiarOrdenamiento(tipo: string): void {
    this.ordenamiento = tipo;
    this.aplicarFiltros();
  }

  /**
   * Navega a la página siguiente si existe
   */
  paginaSiguiente(): void {
    if (this.paginaActual * this.itemsPorPagina < this.totalItems) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la página anterior si existe
   */
  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la primera página
   */
  irPrimeraPagina(): void {
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Navega a la última página
   */
  irUltimaPagina(): void {
    this.paginaActual = Math.ceil(this.totalItems / this.itemsPorPagina);
    this.actualizarPaginacion();
  }

  /**
   * TrackBy para optimizar el renderizado de la lista
   */
  trackByItemId(index: number, item: CatalogoItem): string {
    return item.id || index.toString();
  }

  /**
   * Filtra los ítems por la categoría seleccionada.
   */
  filtrarPorCategoria(): void {
    this.aplicarFiltros();
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
   * Activa o desactiva un ítem (toggle)
   */
  async toggleEstadoItem(item: CatalogoItem): Promise<void> {
    const esActivo = item.activo !== false;
    const accion = esActivo ? 'desactivar' : 'activar';
    
    const result = await Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} ítem?`,
      text: esActivo 
        ? 'El ítem se desactivará pero podrá reactivarlo después'
        : 'El ítem será reactivado y aparecerá en las listas',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed && item.id) {
      try {
        if (esActivo) {
          await this.catalogoService.desactivarItem(item.id);
        } else {
          await this.catalogoService.activarItem(item.id);
        }
        const mensaje = esActivo 
          ? 'Ítem desactivado exitosamente' 
          : 'Ítem activado exitosamente';
        Swal.fire(esActivo ? 'Desactivado' : 'Activado', mensaje, 'success');
        this.cargarItems();
      } catch (error) {
        console.error(`Error al ${accion} ítem:`, error);
        Swal.fire('Error', `No se pudo ${accion} el ítem`, 'error');
      }
    }
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
