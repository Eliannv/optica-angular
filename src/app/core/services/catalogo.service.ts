/**
 * Servicio de Catálogo - Gestión de ítems vendibles sin inventario.
 *
 * Maneja operaciones CRUD para ítems del catálogo que se venden sin
 * manejar stock real, generación de compras ni deuda.
 * Todos los ítems del catálogo tienen stock infinito.
 *
 * Los datos se persisten en la colección 'catalogo' de Firestore.
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  docData,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CatalogoItem, CategoriaCatalogo } from '../models/catalogo.model';

@Injectable({
  providedIn: 'root',
})
export class CatalogoService {
  private firestore = inject(Firestore);
  private productosRef = collection(this.firestore, 'productos');

  /**
   * Recupera todos los ítems activos del catálogo.
   * Ordenados alfabéticamente por nombre.
   *
   * @returns Observable<CatalogoItem[]> Stream con los ítems activos.
   */
  getItems(): Observable<CatalogoItem[]> {
    const q = query(this.productosRef, orderBy('nombre', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((items: any[]) =>
        items
          .filter((item) => this.esCatalogo(item))
          .map((item) => this.mapProductoToCatalogo(item))
      )
    ) as Observable<CatalogoItem[]>;
  }

  /**
   * Recupera todos los ítems activos de una categoría específica.
   *
   * @param categoria Categoría a filtrar.
   * @returns Observable<CatalogoItem[]> Stream con los ítems de la categoría.
   */
  getItemsPorCategoria(categoria: CategoriaCatalogo): Observable<CatalogoItem[]> {
    const q = query(this.productosRef, orderBy('nombre', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((items: any[]) =>
        items
          .filter((item) => this.esCatalogo(item))
          .map((item) => this.mapProductoToCatalogo(item))
          .filter((item) => item.categoria === categoria)
      )
    ) as Observable<CatalogoItem[]>;
  }

  /**
   * Recupera un ítem específico del catálogo por su ID.
   *
   * @param id ID del ítem.
   * @returns Observable<CatalogoItem> Stream con los datos del ítem.
   */
  getItemById(id: string): Observable<CatalogoItem> {
    const itemDoc = doc(this.firestore, `productos/${id}`);
    return docData(itemDoc, {
      idField: 'id',
    }).pipe(map((item: any) => this.mapProductoToCatalogo(item))) as Observable<CatalogoItem>;
  }

  /**
   * Recupera TODOS los ítems incluyendo los desactivados.
   * Utilizado para administración y reportes históricos.
   *
   * @returns Observable<CatalogoItem[]> Stream con todos los ítems sin filtrar.
   */
  getItemsTodosInclusoInactivos(): Observable<CatalogoItem[]> {
    const q = query(this.productosRef, orderBy('nombre', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((items: any[]) =>
        items
          .filter((item) => this.esCatalogo(item, true))
          .map((item) => this.mapProductoToCatalogo(item))
      )
    ) as Observable<CatalogoItem[]>;
  }

  /**
   * Crea un nuevo ítem en el catálogo.
   * Calcula automáticamente precioConIVA si se proporciona precio e iva.
   *
   * @param item Datos del nuevo ítem.
   * @returns Promise<string> ID del documento creado.
   */
  async crearItem(item: CatalogoItem): Promise<string> {
    const itemConIVA = this.calcularPrecioConIVA(item);
    const docRef = await addDoc(this.productosRef, {
      nombre: itemConIVA.nombre,
      grupo: this.mapCategoriaToGrupo(itemConIVA.categoria),
      pvp1: itemConIVA.precio || 0,
      iva: itemConIVA.iva || 0,
      precioConIVA: itemConIVA.precioConIVA || 0,
      observacion: itemConIVA.observacion || '',
      activo: itemConIVA.activo !== false,
      tipo_control_stock: 'ILIMITADO',
      stock: 0,
      controlaStock: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return docRef.id;
  }

  /**
   * Actualiza un ítem del catálogo.
   * Calcula automáticamente precioConIVA si se proporciona precio e iva.
   *
   * @param id ID del ítem a actualizar.
   * @param item Datos actualizados del ítem.
   * @returns Promise<void>
   */
  async actualizarItem(id: string, item: Partial<CatalogoItem>): Promise<void> {
    const itemConIVA = this.calcularPrecioConIVA(item);
    const itemDoc = doc(this.firestore, `productos/${id}`);
    await updateDoc(itemDoc, {
      nombre: itemConIVA.nombre,
      grupo: itemConIVA.categoria ? this.mapCategoriaToGrupo(itemConIVA.categoria) : undefined,
      pvp1: itemConIVA.precio,
      iva: itemConIVA.iva,
      precioConIVA: itemConIVA.precioConIVA,
      observacion: itemConIVA.observacion,
      activo: itemConIVA.activo,
      tipo_control_stock: 'ILIMITADO',
      stock: 0,
      controlaStock: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Desactiva un ítem del catálogo (soft delete).
   * Preserva los datos para historial y trazabilidad.
   *
   * @param id ID del ítem a desactivar.
   * @returns Promise<void>
   */
  async desactivarItem(id: string): Promise<void> {
    const itemDoc = doc(this.firestore, `productos/${id}`);
    await updateDoc(itemDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Activa un ítem del catálogo previamente desactivado.
   *
   * @param id ID del ítem a activar.
   * @returns Promise<void>
   */
  async activarItem(id: string): Promise<void> {
    const itemDoc = doc(this.firestore, `productos/${id}`);
    await updateDoc(itemDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Elimina permanentemente un ítem del catálogo.
   * ADVERTENCIA: Esta operación es irreversible. Preferir desactivarItem().
   *
   * @param id ID del ítem a eliminar.
   * @returns Promise<void>
   */
  async eliminarItem(id: string): Promise<void> {
    const itemDoc = doc(this.firestore, `productos/${id}`);
    await deleteDoc(itemDoc);
  }

  private esCatalogo(item: any, incluirInactivos: boolean = false): boolean {
    const activo = incluirInactivos ? true : item.activo !== false;
    const tipoControl = (item?.tipo_control_stock || '').toString().toUpperCase();
    const grupo = (item?.grupo || '').toString().toUpperCase();
    const esGrupoCatalogo =
      grupo.includes('LUNAS') ||
      grupo.includes('LENTES DE CONTACTO') ||
      grupo.includes('LIQUIDO') ||
      grupo.includes('SERVICIO');
    return activo && tipoControl === 'ILIMITADO' && esGrupoCatalogo;
  }

  private mapProductoToCatalogo(item: any): CatalogoItem {
    const categoria = this.mapGrupoToCategoria(item?.grupo);
    const precio = item?.pvp1 ?? item?.precio ?? 0;
    const iva = item?.iva ?? 0;
    return {
      id: item?.id,
      nombre: item?.nombre || '',
      categoria,
      precio,
      iva,
      precioConIVA: item?.precioConIVA ?? (precio ? precio * (1 + (iva || 0) / 100) : 0),
      activo: item?.activo !== false,
      observacion: item?.observacion || null,
      createdAt: item?.createdAt,
      updatedAt: item?.updatedAt,
    };
  }

  private mapGrupoToCategoria(grupo?: string): CategoriaCatalogo {
    const g = (grupo || '').toUpperCase();
    if (g.includes('LENTES DE CONTACTO')) return CategoriaCatalogo.LENTE_CONTACTO;
    if (g.includes('LIQUIDO')) return CategoriaCatalogo.LIQUIDO;
    if (g.includes('LUNAS')) return CategoriaCatalogo.LUNA;
    return CategoriaCatalogo.SERVICIO;
  }

  private mapCategoriaToGrupo(categoria?: 'LUNA' | 'LENTE_CONTACTO' | 'LIQUIDO' | 'SERVICIO'): string {
    switch (categoria) {
      case 'LUNA':
      case CategoriaCatalogo.LUNA:
        return 'LUNAS';
      case 'LENTE_CONTACTO':
      case CategoriaCatalogo.LENTE_CONTACTO:
        return 'LENTES DE CONTACTO';
      case 'LIQUIDO':
      case CategoriaCatalogo.LIQUIDO:
        return 'LIQUIDO DE LENTES DE CONTACTO';
      case 'SERVICIO':
      case CategoriaCatalogo.SERVICIO:
      default:
        return 'SERVICIOS';
    }
  }

  /**
   * Calcula precioConIVA a partir de precio e iva.
   * Fórmula: precioConIVA = precio * (1 + iva/100)
   *
   * @param item Ítem con precio e iva.
   * @returns El ítem con precioConIVA calculado.
   */
  private calcularPrecioConIVA(item: Partial<CatalogoItem>): Partial<CatalogoItem> {
    if (item.precio && item.iva) {
      return {
        ...item,
        precioConIVA: item.precio * (1 + item.iva / 100),
      };
    }
    return item;
  }
}
