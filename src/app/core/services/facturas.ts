/**
 * Gestiona el ciclo de vida completo de las facturas de venta en el sistema.
 * Proporciona operaciones CRUD, generación de IDs secuenciales personalizados,
 * y funcionalidad avanzada para el manejo de pagos pendientes y deudas de clientes.
 *
 * Este servicio implementa un sistema de IDs de 10 dígitos (0000000001, 0000000002, etc.)
 * para facilitar la identificación manual de facturas. También gestiona estados de pago
 * (PENDIENTE/PAGADA) y mantiene trazabilidad de abonos y saldos pendientes.
 *
 * Los datos se persisten en la colección 'facturas' de Firestore y se integran con
 * los módulos de caja chica y caja banco según el método de pago.
 */
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
  orderBy,
  setDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Factura } from '../models/factura.model';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private fs = inject(Firestore);
  private facturasRef = collection(this.fs, 'facturas');

  /**
   * Genera un ID secuencial de 10 dígitos (0000000001, 0000000002, etc.)
   * Obtiene el número más alto actual y suma 1
   */
  private async generarIdSecuencial(): Promise<string> {
    // Obtener todas las facturas
    const snap = await getDocs(this.facturasRef);
    let maxNumero = 0;

    // Recorrer y buscar el número más alto
    snap.forEach(doc => {
      const data: any = doc.data();
      const idPersonalizado = data?.idPersonalizado;
      if (idPersonalizado) {
        const num = parseInt(idPersonalizado, 10);
        if (!isNaN(num) && num > maxNumero) {
          maxNumero = num;
        }
      }
    });

    // El siguiente ID es maxNumero + 1, con padding a 10 dígitos
    const nuevoNumero = maxNumero + 1;
    return nuevoNumero.toString().padStart(10, '0');
  }

  // EXISTENTE - MODIFICADO
  async crearFactura(factura: Omit<Factura, 'id'>) {
    // Generar ID secuencial personalizado
    const idPersonalizado = await this.generarIdSecuencial();

    // Usar setDoc con el ID personalizado en lugar de addDoc
    const docRef = doc(this.facturasRef, idPersonalizado);
    await setDoc(docRef, {
      ...factura,
      idPersonalizado,
      fecha: serverTimestamp()
    });

    return docRef;
  }

  // EXISTENTE
  getFacturas(): Observable<Factura[]> {
    return collectionData(this.facturasRef, { idField: 'id' }) as Observable<Factura[]>;
  }

  // EXISTENTE
  getFacturaById(id: string): Observable<Factura> {
    const ref = doc(this.fs, `facturas/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<Factura>;
  }

  // =========================================================
  // NUEVO: DEUDA / PENDIENTES
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
   * Sin orderBy en Firestore para evitar necesidad de índice compuesto
   * Se ordena en el cliente (Angular)
   */
  getPendientesPorCliente(clienteId: string): Observable<any[]> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('estadoPago', '==', 'PENDIENTE')
      // Sin orderBy para evitar necesidad de índice compuesto
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => {
        // Ordenar en el cliente en lugar de en Firestore
        return (facturas || []).sort((a, b) => {
          const fechaA = a?.fecha?.toDate?.() || new Date(a?.fecha || 0);
          const fechaB = b?.fecha?.toDate?.() || new Date(b?.fecha || 0);
          return fechaB.getTime() - fechaA.getTime(); // descendente
        });
      })
    ) as Observable<any[]>;
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
