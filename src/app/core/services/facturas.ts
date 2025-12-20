import { inject, Injectable } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, docData, serverTimestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Factura } from '../models/factura.model';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private fs = inject(Firestore);
  private facturasRef = collection(this.fs, 'facturas');

  crearFactura(factura: Omit<Factura, 'id'>) {
    return addDoc(this.facturasRef, {
      ...factura,
      fecha: serverTimestamp()
    });
  }

  getFacturas(): Observable<Factura[]> {
    return collectionData(this.facturasRef, { idField: 'id' }) as Observable<Factura[]>;
  }

  getFacturaById(id: string): Observable<Factura> {
    const ref = doc(this.fs, `facturas/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<Factura>;
  }
}
