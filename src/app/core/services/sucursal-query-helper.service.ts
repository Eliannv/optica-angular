/**
 * Helper Service para Filtros de Sucursal en Firestore
 * 
 * Proporciona métodos de utilidad para agregar filtros de sucursal
 * a queries de Firestore según el contexto actual del usuario.
 * 
 * Uso:
 * - Para queries simples: usar `agregarFiltroSucursal()`
 * - Para queries con paginación: manejar limit() manualmente
 * - Para operaciones CREATE: usar `getSucursalParaDocumento()`
 */
import { Injectable, inject } from '@angular/core';
import { 
  Query, 
  query, 
  where, 
  limit as firestoreLimit,
  CollectionReference
} from '@angular/fire/firestore';
import { SucursalContextService } from './sucursal-context.service';
import { TODAS_LAS_SUCURSALES } from '../models/sucursal-constants';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SucursalQueryHelperService {
  private sucursalContext = inject(SucursalContextService);

  /**
   * Agrega el filtro de sucursal a una query de Firestore
   * 
   * @param collectionRef Referencia a la colección
   * @param constraints Constraints adicionales (orderBy, limit, etc.)
   * @returns Query con filtro de sucursal aplicado
   * 
   * Ejemplo:
   * ```typescript
   * const q = this.queryHelper.agregarFiltroSucursal(
   *   collection(this.firestore, 'facturas'),
   *   orderBy('fecha', 'desc'),
   *   limit(50)
   * );
   * ```
   */
  agregarFiltroSucursal(
    collectionRef: CollectionReference,
    ...constraints: any[]
  ): Query {
    const sucursalId = this.sucursalContext.getSucursalIdActual();
    
    if (!sucursalId || sucursalId === TODAS_LAS_SUCURSALES) {
      // Sin filtro de sucursal - devolver query con constraints
      return query(collectionRef, ...constraints);
    }

    // Con filtro de sucursal específica
    return query(
      collectionRef,
      where('sucursalId', '==', sucursalId),
      ...constraints
    );
  }

  /**
   * Agrega filtro de sucursal con límite automático si es "TODAS"
   * 
   * @param collectionRef Referencia a la colección
   * @param limitSize Límite de documentos (solo aplica si es TODAS)
   * @param constraints Constraints adicionales
   * @returns Query con filtros aplicados
   */
  agregarFiltroConLimite(
    collectionRef: CollectionReference,
    limitSize: number = 100,
    ...constraints: any[]
  ): Query {
    const sucursalId = this.sucursalContext.getSucursalIdActual();
    
    if (!sucursalId || sucursalId === TODAS_LAS_SUCURSALES) {
      // "TODAS" - aplicar límite para evitar cargar todo
      return query(collectionRef, ...constraints, firestoreLimit(limitSize));
    }

    // Sucursal específica - sin límite automático
    return query(
      collectionRef,
      where('sucursalId', '==', sucursalId),
      ...constraints
    );
  }

  /**
   * Verifica si se debe aplicar límite (cuando es "TODAS")
   */
  necesitaLimite(): boolean {
    const sucursalId = this.sucursalContext.getSucursalIdActual();
    return !sucursalId || sucursalId === TODAS_LAS_SUCURSALES;
  }

  /**
   * Obtiene el objeto con sucursalId y sucursalNombre para agregar a documentos nuevos
   * 
   * @returns Objeto con sucursalId y sucursalNombre
   * @throws Error si no hay sucursal seleccionada o si es "TODAS"
   * 
   * Ejemplo:
   * ```typescript
   * const nuevaFactura = {
   *   ...datosFactura,
   *   ...this.queryHelper.getSucursalParaDocumento()
   * };
   * ```
   */
  getSucursalParaDocumento(): { sucursalId: string; sucursalNombre: string } {
    const sucursalId = this.sucursalContext.getSucursalIdParaCrear();
    const sucursalNombre = this.sucursalContext.getSucursalNombreParaCrear();
    
    return {
      sucursalId,
      sucursalNombre
    };
  }

  /**
   * Obtiene solo el ID de sucursal actual (null si es TODAS o no hay selección)
   */
  getSucursalIdActual(): string | null {
    const id = this.sucursalContext.getSucursalIdActual();
    return (id === TODAS_LAS_SUCURSALES) ? null : id;
  }

  /**
   * Verifica si está seleccionada "TODAS"
   */
  esTodasSucursales(): boolean {
    return this.sucursalContext.esTodasSucursales();
  }

  /**
   * Obtiene el Observable de sucursal seleccionada
   * Útil para componentes que necesitan recargar cuando cambia
   */
  getSucursalSeleccionada(): Observable<any> {
    return this.sucursalContext.getSucursalSeleccionada();
  }
}
