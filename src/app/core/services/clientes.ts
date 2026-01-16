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

  // 🔹 Obtener todos los clientes (SOLO ACTIVOS)
  getClientes(): Observable<Cliente[]> {
    const q = query(this.clientesRef, where('activo', '!=', false));
    return collectionData(q, {
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
      activo: true, // 🔹 Nuevo cliente siempre activo
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 🔹 Actualizar cliente
  updateCliente(id: string, cliente: Partial<Cliente>) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      ...cliente,
      updatedAt: new Date(),
    });
  }

  // 🔹 Eliminar cliente (SOFT DELETE: desactivar)
  desactivarCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  // 🔹 Reactivar cliente (reversible)
  activarCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  // 🔹 Eliminar cliente (HARD DELETE: para desarrollo/test)
  deleteCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return deleteDoc(clienteDoc);
  }

  // 🔹 Verificar unicidad global de cédula (clientes ACTIVOS y usuarios)
  async existeCedula(cedula: string, excluirClienteId?: string): Promise<boolean> {
    // Buscar en clientes ACTIVOS
    const qClientes = query(
      this.clientesRef,
      where('cedula', '==', cedula),
      where('activo', '!=', false)
    );
    const snapClientes = await getDocs(qClientes);
    const existeEnClientes = snapClientes.docs.some(d => d.id !== excluirClienteId);
    if (existeEnClientes) return true;

    // Buscar en usuarios
    const usuariosRef = collection(this.firestore, 'usuarios');
    const qUsuarios = query(usuariosRef, where('cedula', '==', cedula));
    const snapUsuarios = await getDocs(qUsuarios);
    return !snapUsuarios.empty;
  }

  // 🔹 Verificar unicidad global de email (clientes ACTIVOS y usuarios)
  async existeEmail(email: string, excluirClienteId?: string): Promise<boolean> {
    const emailLower = email.toLowerCase();
    
    // Buscar en clientes ACTIVOS (compatibilidad: algunos documentos antiguos usan 'correo')
    const qClientesEmail = query(
      this.clientesRef,
      where('email', '==', email),
      where('activo', '!=', false)
    );
    const qClientesEmailLower = query(
      this.clientesRef,
      where('email', '==', emailLower),
      where('activo', '!=', false)
    );
    const qClientesCorreo = query(
      this.clientesRef,
      where('correo', '==', email),
      where('activo', '!=', false)
    );
    const qClientesCorreoLower = query(
      this.clientesRef,
      where('correo', '==', emailLower),
      where('activo', '!=', false)
    );
    
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
