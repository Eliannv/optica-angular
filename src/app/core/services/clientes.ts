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
  getDocs,
  query,
  where,
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

  // 🔹 Verificar unicidad global de cédula (clientes y usuarios)
  async existeCedula(cedula: string, excluirClienteId?: string): Promise<boolean> {
    // Buscar en clientes
    const qClientes = query(this.clientesRef, where('cedula', '==', cedula));
    const snapClientes = await getDocs(qClientes);
    const existeEnClientes = snapClientes.docs.some(d => d.id !== excluirClienteId);
    if (existeEnClientes) return true;

    // Buscar en usuarios
    const usuariosRef = collection(this.firestore, 'usuarios');
    const qUsuarios = query(usuariosRef, where('cedula', '==', cedula));
    const snapUsuarios = await getDocs(qUsuarios);
    return !snapUsuarios.empty;
  }

  // 🔹 Verificar unicidad global de email (clientes y usuarios)
  async existeEmail(email: string, excluirClienteId?: string): Promise<boolean> {
    const emailLower = email.toLowerCase();
    
    // Buscar en clientes (compatibilidad: algunos documentos antiguos usan 'correo')
    // Buscar tanto con el email original como en minúsculas
    const qClientesEmail = query(this.clientesRef, where('email', '==', email));
    const qClientesEmailLower = query(this.clientesRef, where('email', '==', emailLower));
    const qClientesCorreo = query(this.clientesRef, where('correo', '==', email));
    const qClientesCorreoLower = query(this.clientesRef, where('correo', '==', emailLower));
    
    const [snapClientesEmail, snapClientesEmailLower, snapClientesCorreo, snapClientesCorreoLower] = await Promise.all([
      getDocs(qClientesEmail),
      getDocs(qClientesEmailLower),
      getDocs(qClientesCorreo),
      getDocs(qClientesCorreoLower)
    ]);

    const existeEnClientes = [
      ...snapClientesEmail.docs, 
      ...snapClientesEmailLower.docs,
      ...snapClientesCorreo.docs,
      ...snapClientesCorreoLower.docs
    ].some(d => d.id !== excluirClienteId);
    if (existeEnClientes) return true;

    // Buscar en usuarios (campo estándar 'email')
    const usuariosRef = collection(this.firestore, 'usuarios');
    const qUsuarios = query(usuariosRef, where('email', '==', email));
    const qUsuariosLower = query(usuariosRef, where('email', '==', emailLower));
    const [snapUsuarios, snapUsuariosLower] = await Promise.all([
      getDocs(qUsuarios),
      getDocs(qUsuariosLower)
    ]);
    return !snapUsuarios.empty || !snapUsuariosLower.empty;
  }
}
