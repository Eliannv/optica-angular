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

  // 🔹 Crear producto
  createProducto(producto: Producto) {
    return addDoc(this.productosRef, {
      ...producto,
      createdAt: new Date(),
      stock: producto.stock || 0,
    });
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
