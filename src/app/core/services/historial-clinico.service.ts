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

  constructor(private fs: Firestore) {}

  async guardarHistorial(
    clienteId: string,
    data: Omit<HistoriaClinica, 'clienteId' | 'createdAt' | 'updatedAt'>
  ) {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/main`);

    // 🔎 verificar si ya existe
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

  obtenerHistorial(clienteId: string) {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/main`);
    return getDoc(ref);
  }

  getHistorialByCliente(clienteId: string): Observable<any> {
    const historialRef = collection(this.fs, `clientes/${clienteId}/historialClinico`);
    return collectionData(historialRef, { idField: 'id' });
  }
}
