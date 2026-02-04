/**
 * Servicio para gestionar pagos de deudas de facturas.
 * 
 * Cada pago de deuda crea un documento independiente en la colección 'facturas_deudas'.
 * Las facturas originales nunca se modifican, garantizando inmutabilidad del historial.
 * 
 * Este servicio proporciona:
 * - Crear registros de pago de deuda
 * - Consultar pagos de una factura específica
 * - Obtener todos los pagos de deuda de un cliente
 * - Calcular saldo restante considerando todos los pagos
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FacturaDeuda } from '../models/factura-deuda.model';

@Injectable({ providedIn: 'root' })
export class FacturasDeudaService {
  private fs = inject(Firestore);
  private facturasDeudaRef = collection(this.fs, 'facturas_deudas');

  /**
   * Crea un nuevo registro de pago de deuda.
   * No modifica la factura original (es inmutable).
   * 
   * @param deuda Datos del pago de deuda
   * @returns Referencia al documento creado
   */
  async crearPagoDeuda(deuda: Omit<FacturaDeuda, 'id' | 'createdAt' | 'updatedAt'>) {
    // Convertir Date a Timestamp de Firestore
    const deudaParaGuardar: any = { ...deuda };
    
    if (deudaParaGuardar.fechaPago instanceof Date) {
      deudaParaGuardar.fechaPago = Timestamp.fromDate(deudaParaGuardar.fechaPago);
    }

    const docRef = await addDoc(this.facturasDeudaRef, {
      ...deudaParaGuardar,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Pago de deuda registrado:', docRef.id);
    return docRef;
  }

  /**
   * Obtiene todos los pagos de una factura específica.
   * 
   * @param facturaId ID de la factura
   * @returns Observable con array de pagos ordenados por fecha
   */
  getPagosPorFactura(facturaId: string): Observable<FacturaDeuda[]> {
    const q = query(
      this.facturasDeudaRef,
      where('facturaId', '==', facturaId),
      orderBy('fechaPago', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((pagos: any[]) => 
        pagos.map(pago => ({
          ...pago,
          fechaPago: pago.fechaPago?.toDate ? pago.fechaPago.toDate() : new Date(pago.fechaPago)
        }))
      )
    ) as Observable<FacturaDeuda[]>;
  }

  /**
   * Obtiene todos los pagos de un cliente específico.
   * 
   * @param clienteId ID del cliente
   * @returns Observable con array de pagos ordenados por fecha
   */
  getPagosPorCliente(clienteId: string): Observable<FacturaDeuda[]> {
    const q = query(
      this.facturasDeudaRef,
      where('clienteId', '==', clienteId),
      orderBy('fechaPago', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((pagos: any[]) => 
        pagos.map(pago => ({
          ...pago,
          fechaPago: pago.fechaPago?.toDate ? pago.fechaPago.toDate() : new Date(pago.fechaPago)
        }))
      )
    ) as Observable<FacturaDeuda[]>;
  }

  /**
   * Obtiene todos los pagos de deuda (sin filtro).
   * Útil para reportes generales.
   * 
   * @returns Observable con array de todos los pagos
   */
  getTodosPagos(): Observable<FacturaDeuda[]> {
    const q = query(
      this.facturasDeudaRef,
      orderBy('fechaPago', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((pagos: any[]) => 
        pagos.map(pago => ({
          ...pago,
          fechaPago: pago.fechaPago?.toDate ? pago.fechaPago.toDate() : new Date(pago.fechaPago)
        }))
      )
    ) as Observable<FacturaDeuda[]>;
  }

  /**
   * Calcula el saldo restante de una factura considerando todos los pagos realizados.
   * 
   * Fórmula: totalFactura - suma(montoPagado de todos los pagos)
   * 
   * @param facturaId ID de la factura
   * @param totalFactura Monto total original de la factura
   * @returns Promise con el saldo restante
   */
  async calcularSaldoRestante(facturaId: string, totalFactura: number): Promise<number> {
    const q = query(
      this.facturasDeudaRef,
      where('facturaId', '==', facturaId)
    );

    const snap = await getDocs(q);
    let totalPagado = 0;

    snap.forEach(doc => {
      const deuda: any = doc.data();
      totalPagado += deuda.montoPagado || 0;
    });

    const saldoRestante = Math.max(0, totalFactura - totalPagado);
    return +saldoRestante.toFixed(2);
  }

  /**
   * Obtiene el último pago registrado para una factura.
   * Útil para determinar el estado actual.
   * 
   * @param facturaId ID de la factura
   * @returns Promise con el pago más reciente o null
   */
  async getUltimoPago(facturaId: string): Promise<FacturaDeuda | null> {
    const q = query(
      this.facturasDeudaRef,
      where('facturaId', '==', facturaId),
      orderBy('fechaPago', 'desc')
    );

    const snap = await getDocs(q);
    
    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    const data: any = doc.data();
    
    return {
      ...data,
      id: doc.id,
      fechaPago: data.fechaPago?.toDate ? data.fechaPago.toDate() : new Date(data.fechaPago)
    } as FacturaDeuda;
  }
}
