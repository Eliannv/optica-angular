import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, updateDoc, deleteDoc, getDoc, query, where, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Sucursal } from '../models/sucursal.model';
import { CacheLocalStorageService } from './cache-local-storage.service';

@Injectable({
  providedIn: 'root'
})
export class SucursalesService {
  private collectionName = 'sucursales';

  constructor(
    private firestore: Firestore,
    private cache: CacheLocalStorageService
  ) {}

  /**
   * Obtener todas las sucursales
   * 🎯 FASE 2: Con localStorage cache (24h TTL)
   */
  getSucursales(): Observable<Sucursal[]> {
    // Primero intentar desde cache local
    const cached = this.cache.obtenerSucursales();
    if (cached) {
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    // Si no está en cache, traer de Firestore y cachear
    const colRef = collection(this.firestore, this.collectionName);
    return collectionData(colRef, { idField: 'id' }).pipe(
      map((sucursales: any[]) =>
        sucursales.map((s) => this.convertirTimestamps(s))
      ),
      tap(sucursales => {
        // 🎯 Cachear en localStorage después de obtener de Firestore
        this.cache.guardarSucursales(sucursales);
      })
    );
  }

  /**
   * Obtener sucursales activas
   */
  getSucursalesActivas(): Observable<Sucursal[]> {
    return this.getSucursales().pipe(
      map(sucursales => sucursales.filter(s => s.activo))
    );
  }

  /**
   * Verificar si un código de sucursal ya existe
   */
  async existeCodigo(codigo: string, excluirId?: string): Promise<boolean> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('codigo', '==', codigo.toUpperCase()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return false;
    
    // Si se proporciona un ID para excluir, verificar que no sea el mismo documento
    if (excluirId) {
      return snapshot.docs.some(doc => doc.id !== excluirId);
    }
    
    return true;
  }

  /**
   * Guardar o actualizar una sucursal
   */
  async guardarSucursal(sucursal: Partial<Sucursal>, creadoPor?: string): Promise<void> {
    const sucursalId = sucursal.id || sucursal.codigo?.toUpperCase();
    if (!sucursalId) {
      throw new Error('Se requiere ID o código');
    }

    const docRef = doc(this.firestore, this.collectionName, sucursalId);
    const docSnap = await getDoc(docRef);

    const datos: any = {
      ...sucursal,
      codigo: sucursal.codigo?.toUpperCase(),
      activo: sucursal.activo ?? true
    };

    if (docSnap.exists()) {
      // Actualizar existente
      delete datos.fechaCreacion;
      delete datos.creadoPor;
      delete datos.id;
      await updateDoc(docRef, datos);
    } else {
      // Crear nueva
      datos.fechaCreacion = new Date();
      datos.creadoPor = creadoPor || null;
      delete datos.id;
      await setDoc(docRef, datos);
    }
  }

  /**
   * Cambiar estado de una sucursal
   * 🎯 FASE 2: Invalidar cache cuando cambia
   */
  async cambiarEstadoSucursal(sucursalId: string, activo: boolean): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, sucursalId);
    await updateDoc(docRef, { activo });
    // ⚠️ Invalidar cache para forzar recarga en próxima consulta
    this.cache.invalidarSucursales();
  }

  /**
   * Actualizar datos de una sucursal existente
   */
  async actualizarSucursal(sucursalId: string, datos: Partial<Sucursal>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, sucursalId);
    const datosActualizacion: any = {
      ...datos,
      codigo: datos.codigo?.toUpperCase()
    };
    
    // Eliminar campos que no deben actualizarse
    delete datosActualizacion.id;
    delete datosActualizacion.fechaCreacion;
    delete datosActualizacion.creadoPor;
    
    await updateDoc(docRef, datosActualizacion);
  }

  /**
   * Eliminar una sucursal
   * 🎯 FASE 2: Invalidar cache cuando cambia
   */
  async eliminarSucursal(sucursalId: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, sucursalId);
    await deleteDoc(docRef);
    // ⚠️ Invalidar cache para forzar recarga en próxima consulta
    this.cache.invalidarSucursales();
  }

  /**
   * Convertir timestamps de Firestore a Date
   */
  private convertirTimestamps(sucursal: any): Sucursal {
    return {
      ...sucursal,
      fechaCreacion: sucursal.fechaCreacion?.toDate?.() || sucursal.fechaCreacion
    };
  }
}
