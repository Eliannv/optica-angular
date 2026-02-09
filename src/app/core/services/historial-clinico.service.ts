/**
 * Servicio para la gestión del historial clínico de los clientes.
 *
 * ✅ ACTUALIZADO: Este servicio maneja la persistencia y recuperación de MÚLTIPLES
 * historiales clínicos por cliente. Cada historial es un documento independiente
 * dentro de la subcolección 'historialClinico' con ID auto-generado.
 *
 * Estructura: clientes/{clienteId}/historialClinico/{historialId}
 *
 * Funcionalidades:
 * - Crear múltiples historiales clínicos por cliente
 * - Listar historiales con paginación
 * - Actualizar historial específico
 * - Obtener historial por ID
 * - Contar total de historiales
 *
 * Forma parte del módulo de clientes y se integra con Firestore para el registro
 * persistente de información médica oftalmológica.
 */

import { Injectable } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  collectionData,
  query,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  QueryConstraint,
  Timestamp,
  getCountFromServer
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { HistoriaClinica } from '../models/historia-clinica.model';

@Injectable({ providedIn: 'root' })
export class HistorialClinicoService {

  constructor(private readonly fs: Firestore) {}

  // ========================================
  // ✅ NUEVOS MÉTODOS (sistema de múltiples historiales)
  // ========================================

  /**
   * Crea un nuevo historial clínico para un cliente.
   *
   * ✅ NUEVO: Genera un documento con ID auto-generado por Firestore.
   * El historial se almacena en: clientes/{clienteId}/historialClinico/{auto-id}
   *
   * @param clienteId Identificador único del cliente.
   * @param data Datos del historial clínico (sin clienteId, createdAt ni updatedAt).
   * @returns Promise<string> ID del historial creado.
   */
  async crearHistorial(
    clienteId: string,
    data: Omit<HistoriaClinica, 'id' | 'clienteId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const colRef = collection(this.fs, `clientes/${clienteId}/historialClinico`);
    
    const docRef = await addDoc(colRef, {
      ...data,
      clienteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return docRef.id;
  }

  /**
   * Actualiza un historial clínico específico.
   *
   * ✅ NUEVO: Permite actualizar un historial existente sin afectar otros historiales del cliente.
   *
   * @param clienteId Identificador del cliente.
   * @param historialId ID del historial a actualizar.
   * @param data Datos a actualizar (parciales).
   * @returns Promise<void> Se resuelve cuando la actualización es exitosa.
   */
  async actualizarHistorial(
    clienteId: string,
    historialId: string,
    data: Partial<Omit<HistoriaClinica, 'id' | 'clienteId' | 'createdAt'>>
  ): Promise<void> {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/${historialId}`);
    
    return updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Obtiene un historial clínico específico por su ID.
   *
   * ✅ NUEVO: Reemplaza obtenerHistorial() que usaba documento fijo 'main'.
   *
   * @param clienteId Identificador del cliente.
   * @param historialId ID del historial a obtener.
   * @returns Promise con el snapshot del documento.
   */
  obtenerHistorialPorId(clienteId: string, historialId: string) {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/${historialId}`);
    return getDoc(ref);
  }

  /**
   * Obtiene todos los historiales clínicos de un cliente con paginación.
   *
   * ✅ NUEVO: Implementa paginación eficiente para evitar lecturas innecesarias.
   * Los historiales se ordenan por createdAt descendente (más recientes primero).
   *
   * @param clienteId Identificador del cliente.
   * @param limit Número máximo de historiales a obtener (default: 10).
   * @param startAfterDoc Último documento de la página anterior (para paginación).
   * @returns Observable<HistoriaClinica[]> Stream reactivo con los historiales.
   */
  getHistorialesPaginados(
    clienteId: string,
    limit: number = 10,
    startAfterDoc?: any
  ): Observable<HistoriaClinica[]> {
    const colRef = collection(this.fs, `clientes/${clienteId}/historialClinico`);
    
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    ];

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    const q = query(colRef, ...constraints);
    return collectionData(q, { idField: 'id' }) as Observable<HistoriaClinica[]>;
  }

  /**
   * Cuenta el total de historiales clínicos de un cliente.
   *
   * ✅ NUEVO: Útil para mostrar indicadores de paginación y estadísticas.
   * Usa getCountFromServer() para optimizar la consulta (no descarga documentos).
   *
   * @param clienteId Identificador del cliente.
   * @returns Promise<number> Total de historiales del cliente.
   */
  async contarHistoriales(clienteId: string): Promise<number> {
    const colRef = collection(this.fs, `clientes/${clienteId}/historialClinico`);
    const snapshot = await getCountFromServer(colRef);
    return snapshot.data().count;
  }

  /**
   * Elimina un historial clínico específico.
   *
   * ✅ NUEVO: Permite eliminar un historial sin afectar otros del mismo cliente.
   * ADVERTENCIA: Esta operación es irreversible. Úsala con precaución.
   *
   * @param clienteId Identificador del cliente.
   * @param historialId ID del historial a eliminar.
   * @returns Promise<void> Se resuelve cuando el historial es eliminado.
   */
  async eliminarHistorial(clienteId: string, historialId: string): Promise<void> {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/${historialId}`);
    return deleteDoc(ref);
  }

  // ========================================
  // ⚠️ MÉTODOS DEPRECADOS (compatibilidad temporal)
  // ========================================

  /**
   * @deprecated Usar crearHistorial() en su lugar.
   * 
   * Guarda o actualiza el historial clínico de un cliente.
   *
   * DEPRECADO: Este método usa el documento fijo 'main' que ya no se utiliza.
   * Solo se mantiene temporalmente para compatibilidad con código legacy.
   *
   * @param clienteId Identificador único del cliente.
   * @param data Datos del historial clínico (sin clienteId, createdAt ni updatedAt).
   * @returns Promise<void> Se resuelve cuando el historial se guarda exitosamente.
   */
  async guardarHistorial(
    clienteId: string,
    data: Omit<HistoriaClinica, 'clienteId' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    console.warn('⚠️ guardarHistorial() está deprecado. Usa crearHistorial() o actualizarHistorial()');
    
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/main`);
    const snap = await getDoc(ref);

    return setDoc(
      ref,
      {
        ...data,
        clienteId,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );
  }

  /**
   * @deprecated Usar obtenerHistorialPorId() en su lugar.
   * 
   * Recupera el documento del historial clínico de un cliente específico.
   *
   * DEPRECADO: Este método usa el documento fijo 'main' que ya no se utiliza.
   * Solo se mantiene temporalmente para compatibilidad con código legacy.
   *
   * @param clienteId Identificador del cliente.
   * @returns Promise con el snapshot del documento (puede estar vacío).
   */
  obtenerHistorial(clienteId: string) {
    console.warn('⚠️ obtenerHistorial() está deprecado. Usa obtenerHistorialPorId()');
    
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/main`);
    return getDoc(ref);
  }

  /**
   * Obtiene todos los documentos de la subcolección historialClinico de un cliente.
   *
   * ✅ ACTUALIZADO: Ahora retorna TODOS los historiales del cliente (no solo 'main').
   * Para mejor rendimiento, considera usar getHistorialesPaginados() en su lugar.
   *
   * @param clienteId Identificador del cliente.
   * @returns Observable<HistoriaClinica[]> Stream reactivo con los documentos del historial.
   */
  getHistorialByCliente(clienteId: string): Observable<HistoriaClinica[]> {
    const historialRef = collection(this.fs, `clientes/${clienteId}/historialClinico`);
    const q = query(historialRef, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<HistoriaClinica[]>;
  }
}
