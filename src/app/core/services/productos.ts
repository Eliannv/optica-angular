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
import { map } from 'rxjs/operators';
import { Producto } from '../models/producto.model';

@Injectable({
  providedIn: 'root',
})
export class ProductosService {
  private firestore = inject(Firestore);
  private productosRef = collection(this.firestore, 'productos');

  // 🔹 Obtener todos los productos (SOLO ACTIVOS)
  // Incluye productos con activo:true O sin el campo (para compatibilidad con datos anteriores)
  getProductos(): Observable<Producto[]> {
    return collectionData(this.productosRef, {
      idField: 'id',
    }).pipe(
      // Filtrar en cliente: incluir si activo es true o no está definido (legacy), excluir si es false
      map((productos: any[]) =>
        productos.filter((p) => p.activo !== false)
      )
    ) as Observable<Producto[]>;
  }

  // 🔹 Obtener TODOS los productos (incluyendo inactivos) - para importación
  getProductosTodosInclusoInactivos(): Observable<Producto[]> {
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

  // 🔹 Obtener productos por ingreso ID
  getProductosPorIngreso(ingresoId: string): Observable<Producto[]> {
    const q = query(this.productosRef, where('ingresoId', '==', ingresoId));
    return collectionData(q, { idField: 'id' }) as Observable<Producto[]>;
  }

  // 🔹 Obtener el último ID del contador sin incrementarlo
  async getCounterDoc(): Promise<number | null> {
    const counterDoc = doc(this.firestore, 'counters/productos');
    const counterSnapshot = await getDoc(counterDoc);
    
    // Verificar si existen productos en la colección
    const productosSnapshot = await getDocs(this.productosRef);
    const hayProductos = !productosSnapshot.empty;
    
    if (!hayProductos) {
      // Si no hay productos, el próximo será 1
      return 1;
    }
    
    if (counterSnapshot.exists()) {
      return counterSnapshot.data()['lastId'] || null;
    }
    
    return null;
  }

  // 🔹 Generar siguiente ID interno automáticamente
  async getNextIdInterno(): Promise<number> {
    const counterDoc = doc(this.firestore, 'counters/productos');
    
    // 1. Obtener todos los productos para encontrar el máximo idInterno real
    const productosSnapshot = await getDocs(this.productosRef);
    let maxIdInterno = 0;
    
    productosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data['idInterno'] && typeof data['idInterno'] === 'number') {
        if (data['idInterno'] > maxIdInterno) {
          maxIdInterno = data['idInterno'];
        }
      }
    });
    
    // 2. El siguiente ID será el máximo + 1, o 1 si no hay productos
    const nextId = maxIdInterno > 0 ? maxIdInterno + 1 : 1;
    
    // 3. Actualizar el contador para futuras referencias
    try {
      await setDoc(counterDoc, { lastId: nextId }, { merge: true });
    } catch (error) {
      console.warn('⚠️ No se pudo actualizar el contador, pero se usará el ID:', nextId);
    }
    
    return nextId;
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

    // Stock ilimitado para grupo LUNAS
    const esLunas = (producto as any)?.grupo === 'LUNAS';

    return addDoc(this.productosRef, {
      ...producto,
      idInterno,
      activo: true, // 🔹 Nuevo producto siempre activo
      createdAt: new Date(),
      updatedAt: new Date(),
      stock: esLunas ? 0 : (producto.stock || 0),
      ...(esLunas ? { stockIlimitado: true } : {}),
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

  // 🔹 Descontar stock de forma segura (transacción)
  async descontarStock(id: string, cantidad: number): Promise<void> {
    if (!id || !isFinite(cantidad) || cantidad <= 0) return;
    const productoDoc = doc(this.firestore, `productos/${id}`);

    await runTransaction(this.firestore, async (t) => {
      const snap = await t.get(productoDoc);
      if (!snap.exists()) {
        throw new Error('Producto no encontrado');
      }
      const data = snap.data() as any;

      // No descontar stock si es stock ilimitado (grupo LUNAS)
      if (data?.grupo === 'LUNAS' || data?.stockIlimitado === true) {
        // No actualizamos stock
        return;
      }
      const stockActual = Number(data?.stock || 0);
      if (stockActual < cantidad) {
        throw new Error(`Stock insuficiente. Disponible: ${stockActual}, requerido: ${cantidad}`);
      }
      t.update(productoDoc, {
        stock: stockActual - cantidad,
        updatedAt: new Date(),
      });
    });
  }

  // 🔹 Eliminar producto (SOFT DELETE: desactivar)
  desactivarProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  // 🔹 Reactivar producto (reversible)
  activarProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  // 🔹 Eliminar producto (HARD DELETE: para desarrollo/test)
  deleteProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return deleteDoc(productoDoc);
  }
}
