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
import { Cliente } from '../models/cliente.model';

@Injectable({
  providedIn: 'root',
})
export class ClientesService {
  private firestore = inject(Firestore);
  private clientesRef = collection(this.firestore, 'clientes');

  // 🔹 Obtener todos los clientes
  getClientes(): Observable<Cliente[]> {
    return collectionData(this.clientesRef, {
      idField: 'id',
    }) as Observable<Cliente[]>;
  }

  // 🔹 Obtener un cliente por ID
  getClienteById(id: string): Observable<Cliente> {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return docData(clienteDoc, {
      idField: 'id',
    }) as Observable<Cliente>;
  }

  // 🔹 Crear cliente
  createCliente(cliente: Cliente) {
    return addDoc(this.clientesRef, {
      ...cliente,
      createdAt: new Date(),
    });
  }

  // 🔹 Actualizar cliente
  updateCliente(id: string, cliente: Partial<Cliente>) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      ...cliente,
    });
  }

  // 🔹 Eliminar cliente
  deleteCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return deleteDoc(clienteDoc);
  }
}
