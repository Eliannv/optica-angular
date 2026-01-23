/**
 * Gestiona el registro de ventas en Firestore.
 * Este servicio proporciona operaciones básicas para crear ventas y mantener
 * un registro histórico de transacciones comerciales.
 *
 * Nota: La lógica principal de ventas y facturación se encuentra en FacturasService.
 * Este servicio complementa con funcionalidad adicional específica de ventas.
 *
 * Los datos se persisten en la colección 'ventas' de Firestore.
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class VentasService {
  private fs = inject(Firestore);
  private ventasRef = collection(this.fs, 'ventas');

  /**
   * Registra una nueva venta en Firestore.
   * Añade automáticamente un timestamp de creación del servidor.
   *
   * @param data Datos de la venta a registrar.
   * @returns Promise con la referencia del documento creado.
   */
  crearVenta(data: any) {
    return addDoc(this.ventasRef, {
      ...data,
      createdAt: serverTimestamp()
    });
  }
}
