import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp, doc, getDoc } from '@angular/fire/firestore';
import { Venta } from '../../modules/ventas/crear-venta/crear-venta';

@Injectable({ providedIn: 'root' })
export class VentasService {
  private fs = inject(Firestore);
  private ventasRef = collection(this.fs, 'ventas');

  crearVenta(data: Venta) {
    return addDoc(this.ventasRef, {
      ...data,
      createdAt: serverTimestamp()
    });
  }
}
