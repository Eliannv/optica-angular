import { Injectable } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from '@angular/fire/firestore';
import { HistoriaClinica } from '../models/historia-clinica.model';

@Injectable({ providedIn: 'root' })
export class HistorialClinicoService {

  constructor(private fs: Firestore) {}

  guardarHistorial(clienteId: string, data: Omit<HistoriaClinica, 'clienteId'>) {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/main`);

    return setDoc(ref, {
      ...data,
      clienteId,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  obtenerHistorial(clienteId: string) {
    const ref = doc(this.fs, `clientes/${clienteId}/historialClinico/main`);
    return getDoc(ref);
  }
}
