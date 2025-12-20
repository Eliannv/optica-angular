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

  crearVenta(data: any) {
    return addDoc(this.ventasRef, {
      ...data,
      createdAt: serverTimestamp()
    });
  }
}
