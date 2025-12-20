import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  doc,
  docData,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Factura } from '../models/factura.model';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private fs = inject(Firestore);
  private facturasRef = collection(this.fs, 'facturas');

  // ✅ EXISTENTE
  crearFactura(factura: Omit<Factura, 'id'>) {
    return addDoc(this.facturasRef, {
      ...factura,
      fecha: serverTimestamp()
    });
  }

  // ✅ EXISTENTE
  getFacturas(): Observable<Factura[]> {
    return collectionData(this.facturasRef, { idField: 'id' }) as Observable<Factura[]>;
  }

  // ✅ EXISTENTE
  getFacturaById(id: string): Observable<Factura> {
    const ref = doc(this.fs, `facturas/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<Factura>;
  }

  // =========================================================
  // ✅ NUEVO: DEUDA / PENDIENTES
  // =========================================================

  /**
   * Devuelve resumen rápido para mostrar badge en lista:
   * deudaTotal = suma de saldoPendiente de facturas PENDIENTES del cliente
   * pendientes = cantidad de facturas pendientes
   */
  async getResumenDeuda(clienteId: string): Promise<{ deudaTotal: number; pendientes: number }> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('estadoPago', '==', 'PENDIENTE')
    );

    const snap = await getDocs(q);
    let deudaTotal = 0;
    let pendientes = 0;

    snap.forEach(d => {
      const data: any = d.data();
      const saldo = Number(data?.saldoPendiente || 0);
      if (saldo > 0) {
        deudaTotal += saldo;
        pendientes++;
      }
    });

    return {
      deudaTotal: +deudaTotal.toFixed(2),
      pendientes
    };
  }

  /**
   * Trae facturas pendientes de un cliente (para pantalla cobrar deuda)
   * OJO: requiere índice compuesto en Firestore si usas orderBy con where.
   * Si te da error de índice, puedes quitar el orderBy.
   */
  getPendientesPorCliente(clienteId: string): Observable<any[]> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('estadoPago', '==', 'PENDIENTE'),
      orderBy('fecha', 'desc')
    );

    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }

  /**
   * Actualiza pago: abonado/saldo/estado.
   * Ideal para registrar abonos.
   */
  async actualizarPagoFactura(facturaId: string, payload: {
    abonado?: number;
    saldoPendiente?: number;
    estadoPago?: 'PENDIENTE' | 'PAGADA';
    metodoPago?: string;
    ultimaActualizacionPago?: any;
  }) {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    await updateDoc(ref, {
      ...payload,
      // opcional: timestamp servidor para auditar
      ultimaActualizacionPago: serverTimestamp()
    } as any);
  }
}
