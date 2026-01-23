/**
 * Servicio para la gestión del historial clínico de los clientes.
 *
 * Este servicio maneja la persistencia y recuperación del historial clínico de cada cliente,
 * almacenándolo como un único documento 'main' dentro de la subcolección 'historialClinico'
 * de cada cliente. Esta estrategia simplifica las consultas y mantiene la información
 * clínica consolidada en un solo lugar.
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
  serverTimestamp,
  collection,
  collectionData
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { HistoriaClinica } from '../models/historia-clinica.model';

@Injectable({ providedIn: 'root' })
export class HistorialClinicoService {

  constructor(private readonly fs: Firestore) {}

  /**
   * Guarda o actualiza el historial clínico de un cliente.
   *
   * Si el documento 'main' ya existe, se realiza una actualización parcial (merge).
   * Si es la primera vez, se crea el documento con timestamp de creación.
   * El campo 'updatedAt' siempre se actualiza con el timestamp del servidor.
   *
   * @param clienteId Identificador único del cliente.
   * @param data Datos del historial clínico (sin clienteId, createdAt ni updatedAt).
   * @returns Promise<void> Se resuelve cuando el historial se guarda exitosamente.
   */
  async guardarHistorial(
    clienteId: string,
    data: Omit<HistoriaClinica, 'clienteId' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
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
   * Recupera el documento del historial clínico de un cliente específico.
   *
   * Este método realiza una lectura única (no reactiva) del documento 'main'
   * del historial clínico. Útil para verificar existencia o para obtener
   * datos puntuales sin suscripciones reactivas.
   *
   * @param clienteId Identificador del cliente.
   * @returns Promise con el snapshot del documento (puede estar vacío).
   */
  obtenerHistorial(clienteId: string) {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/main`);
    return getDoc(ref);
  }

  /**
   * Obtiene todos los documentos de la subcolección historialClinico de un cliente.
   *
   * Retorna un Observable que emite en tiempo real todos los documentos dentro
   * de la subcolección, aunque actualmente solo se usa un documento 'main'.
   * Este método permite extensibilidad futura si se desea almacenar múltiples
   * historiales o versiones.
   *
   * @param clienteId Identificador del cliente.
   * @returns Observable<any> Stream reactivo con los documentos del historial.
   */
  getHistorialByCliente(clienteId: string): Observable<any> {
    const historialRef = collection(this.fs, `clientes/${clienteId}/historialClinico`);
    return collectionData(historialRef, { idField: 'id' });
  }
}
