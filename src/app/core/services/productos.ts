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
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  runTransaction,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Producto } from '../models/producto.model';

@Injectable({
  providedIn: 'root',
})
export class ProductosService {
  private firestore = inject(Firestore);
  private productosRef = collection(this.firestore, 'productos');

  // 🔹 Obtener todos los productos
  getProductos(): Observable<Producto[]> {
    return collectionData(this.productosRef, {
      idField: 'id',
    }) as Observable<Producto[]>;
  }

  // 🔹 Obtener un producto por ID
  getProductoById(id: string): Observable<Producto> {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return docData(productoDoc, {
      idField: 'id',
    }) as Observable<Producto>;
  }

  // 🔹 Obtener el último ID del contador sin incrementarlo
  async getCounterDoc(): Promise<number | null> {
    const counterDoc = doc(this.firestore, 'counters/productos');
    const counterSnapshot = await getDoc(counterDoc);
    
    if (counterSnapshot.exists()) {
      return counterSnapshot.data()['lastId'] || null;
    }
    
    return null;
  }

  // 🔹 Generar siguiente ID interno automáticamente
  async getNextIdInterno(): Promise<number> {
    const counterDoc = doc(this.firestore, 'counters/productos');
    
    return runTransaction(this.firestore, async (transaction) => {
      const counterSnapshot = await transaction.get(counterDoc);
      
      let nextId = 1001; // Valor inicial
      
      if (counterSnapshot.exists()) {
        const currentId = counterSnapshot.data()['lastId'] || 1000;
        nextId = currentId + 1;
      }
      
      // Actualizar el contador
      transaction.set(counterDoc, { lastId: nextId }, { merge: true });
      
      return nextId;
    });
  }

  // 🔹 Verificar si un código de armazón ya existe
  async codigoArmazonExists(codigo: string, excludeId?: string): Promise<boolean> {
    const q = query(
      this.productosRef,
      where('codigo', '==', codigo)
    );
    
    const snapshot = await getDocs(q);
    
    // Si hay documentos con ese código
    if (snapshot.empty) {
      return false;
    }
    
    // Si estamos editando, excluir el propio documento
    if (excludeId) {
      return snapshot.docs.some(doc => doc.id !== excludeId);
    }
    
    return true;
  }

  // 🔹 Crear producto con ID automático
  async createProducto(producto: Producto) {
    // Generar ID interno automáticamente
    const idInterno = await this.getNextIdInterno();
    
    return addDoc(this.productosRef, {
      ...producto,
      idInterno,
      createdAt: new Date(),
      stock: producto.stock || 0,
    });
  }

  // 🔹 Buscar productos por código de armazón
  async getProductoByCodigo(codigo: string): Promise<Producto | null> {
    const q = query(
      this.productosRef,
      where('codigo', '==', codigo)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Producto;
  }

  // 🔹 Actualizar producto
  updateProducto(id: string, producto: Partial<Producto>) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      ...producto,
      updatedAt: new Date(),
    });
  }

  // 🔹 Eliminar producto
  deleteProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return deleteDoc(productoDoc);
  }
}
