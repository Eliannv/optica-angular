/**
 * Servicio para la gestión completa del ciclo de vida de clientes en el sistema.
 *
 * Este servicio se encarga de las operaciones CRUD (Crear, Leer, Actualizar, Eliminar)
 * sobre la colección 'clientes' en Firestore. Implementa un patrón de soft-delete
 * donde los clientes se marcan como inactivos en lugar de eliminarse físicamente,
 * y garantiza la unicidad de cédulas y correos electrónicos tanto en la colección
 * de clientes como en la colección de usuarios del sistema.
 *
 * Forma parte del módulo de clientes de la aplicación de gestión de óptica.
 */

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
  private readonly firestore = inject(Firestore);
  private readonly clientesRef = collection(this.firestore, 'clientes');

  /**
   * Recupera todos los clientes activos del sistema.
   *
   * Este método filtra automáticamente los clientes desactivados (soft-delete),
   * retornando únicamente aquellos cuyo campo 'activo' es diferente de false.
   * Los resultados se emiten en tiempo real a través de un Observable.
   *
   * @returns Observable<Cliente[]> Stream reactivo con la lista de clientes activos.
   */
  getClientes(): Observable<Cliente[]> {
    const q = query(this.clientesRef, where('activo', '!=', false));
    return collectionData(q, {
      idField: 'id',
    }) as Observable<Cliente[]>;
  }

  /**
   * Obtiene un cliente específico por su identificador único.
   *
   * Retorna un Observable que emite los cambios en tiempo real del documento
   * del cliente, permitiendo reactividad automática ante actualizaciones.
   *
   * @param id Identificador único del cliente en Firestore.
   * @returns Observable<Cliente> Stream reactivo con los datos del cliente.
   */
  getClienteById(id: string): Observable<Cliente> {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return docData(clienteDoc, {
      idField: 'id',
    }) as Observable<Cliente>;
  }

  /**
   * Registra un nuevo cliente en el sistema.
   *
   * El cliente se crea con estado activo por defecto y se añaden automáticamente
   * las marcas de tiempo de creación y última actualización. El ID es generado
   * automáticamente por Firestore.
   *
   * @param cliente Datos del cliente a registrar (sin id, createdAt ni updatedAt).
   * @returns Promise con la referencia del documento creado.
   */
  createCliente(cliente: Cliente) {
    return addDoc(this.clientesRef, {
      ...cliente,
      activo: true, // 🔹 Nuevo cliente siempre activo
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Actualiza parcialmente los datos de un cliente existente.
   *
   * Permite modificar uno o más campos del cliente sin necesidad de enviar
   * el objeto completo. La fecha de última actualización se actualiza automáticamente.
   *
   * @param id Identificador del cliente a actualizar.
   * @param cliente Objeto con los campos a modificar (puede ser parcial).
   * @returns Promise que se resuelve cuando la actualización se completa.
   */
  updateCliente(id: string, cliente: Partial<Cliente>) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      ...cliente,
      updatedAt: new Date(),
    });
  }

  /**
   * Desactiva un cliente mediante soft-delete.
   *
   * En lugar de eliminar físicamente el registro, marca el cliente como inactivo
   * mediante el campo 'activo'. Esto permite preservar el historial y la
   * posibilidad de reactivación futura.
   *
   * @param id Identificador del cliente a desactivar.
   * @returns Promise que se resuelve cuando la desactivación se completa.
   */
  desactivarCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Reactiva un cliente previamente desactivado.
   *
   * Revierte la operación de soft-delete, permitiendo que el cliente vuelva
   * a aparecer en las consultas de clientes activos.
   *
   * @param id Identificador del cliente a reactivar.
   * @returns Promise que se resuelve cuando la reactivación se completa.
   */
  activarCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Elimina permanentemente un cliente del sistema (hard-delete).
   *
   * ADVERTENCIA: Esta operación es irreversible y elimina el documento
   * físicamente de Firestore. Solo debe usarse en entornos de desarrollo/testing
   * o en casos excepcionales. Para operaciones normales, usar desactivarCliente().
   *
   * @param id Identificador del cliente a eliminar permanentemente.
   * @returns Promise que se resuelve cuando la eliminación se completa.
   */
  deleteCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return deleteDoc(clienteDoc);
  }

  /**
   * Verifica la unicidad global de una cédula en el sistema.
   *
   * Consulta tanto la colección de clientes activos como la de usuarios para
   * garantizar que la cédula no esté duplicada en ninguna parte del sistema.
   * Útil para validaciones en formularios de creación y edición.
   *
   * @param cedula Número de cédula a verificar.
   * @param excluirClienteId ID del cliente a excluir de la búsqueda (usado en edición).
   * @returns Promise<boolean> true si la cédula ya existe, false si está disponible.
   */
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

  /**
   * Verifica la unicidad global de un correo electrónico en el sistema.
   *
   * Realiza búsquedas tanto en la colección de clientes activos como en usuarios,
   * considerando variaciones en mayúsculas/minúsculas y compatibilidad con el
   * campo legacy 'correo'. Esto garantiza que no haya duplicados de email en el sistema.
   *
   * @param email Correo electrónico a verificar.
   * @param excluirClienteId ID del cliente a excluir de la búsqueda (usado en edición).
   * @returns Promise<boolean> true si el email ya existe, false si está disponible.
   */
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
