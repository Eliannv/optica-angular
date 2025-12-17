import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  docData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Proveedor } from '../models/proveedor.model';

@Injectable({
  providedIn: 'root',
})
export class ProveedoresService {
  private firestore = inject(Firestore);
  private proveedoresRef = collection(this.firestore, 'proveedores');

  // 🔹 Obtener todos los proveedores
  getProveedores(): Observable<Proveedor[]> {
    return collectionData(this.proveedoresRef, {
      idField: 'id',
    }) as Observable<Proveedor[]>;
  }

  // 🔹 Obtener un proveedor por ID
  getProveedorById(id: string): Observable<Proveedor> {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);
    return docData(proveedorDoc, {
      idField: 'id',
    }) as Observable<Proveedor>;
  }

  // 🔹 Crear proveedor
  createProveedor(proveedor: Proveedor) {
    return addDoc(this.proveedoresRef, {
      ...proveedor,
      createdAt: new Date(),
      saldo: proveedor.saldo || 0,
    });
  }

  // 🔹 Actualizar proveedor
  updateProveedor(id: string, proveedor: Partial<Proveedor>) {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);
    return updateDoc(proveedorDoc, {
      ...proveedor,
      updatedAt: new Date(),
    });
  }

  // 🔹 Eliminar proveedor
  deleteProveedor(id: string) {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);
    return deleteDoc(proveedorDoc);
  }
}
