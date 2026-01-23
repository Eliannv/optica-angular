/**
 * Gestiona el catálogo completo de productos del sistema de inventario.
 * Maneja operaciones CRUD con validaciones de unicidad, generación automática de IDs
 * internos secuenciales, actualizaciones de stock mediante transacciones Firestore
 * y soft delete para preservar historial.
 *
 * Este servicio implementa:
 * - Generación automática de idInterno (secuencial numérico)
 * - Descuento de stock con transacciones atómicas (evita condiciones de carrera)
 * - Soft delete (campo activo) para mantener trazabilidad
 * - Validación de códigos duplicados (opcional según validaciones del modelo)
 * - Filtrado automático de productos desactivados en consultas
 *
 * Los datos se persisten en 'productos' de Firestore.
 * Se integra con ingreso.service.ts para actualizaciones de stock y movimientos.service.ts para trazabilidad.
 *
 * Forma parte del módulo de inventario del sistema de gestión de la óptica.
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

  /**
   * Recupera todos los productos activos del sistema.
   * Incluye productos con activo:true O sin el campo (compatibilidad con datos legacy).
   * Filtra en el cliente para evitar requerimiento de índice Firestore.
   *
   * @returns Observable<Producto[]> Stream reactivo con los productos activos.
   */
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

  /**
   * Recupera TODOS los productos incluyendo los desactivados.
   * Utilizado para importaciones y reportes históricos.
   *
   * @returns Observable<Producto[]> Stream con todos los productos sin filtrar.
   */
  getProductosTodosInclusoInactivos(): Observable<Producto[]> {
    return collectionData(this.productosRef, {
      idField: 'id',
    }) as Observable<Producto[]>;
  }

  /**
   * Recupera un producto específico por su ID de Firestore.
   *
   * @param id ID del producto.
   * @returns Observable<Producto> Stream con los datos del producto.
   */
  getProductoById(id: string): Observable<Producto> {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return docData(productoDoc, {
      idField: 'id',
    }) as Observable<Producto>;
  }

  /**
   * Recupera todos los productos asociados a un ingreso específico.
   *
   * @param ingresoId ID del ingreso.
   * @returns Observable<Producto[]> Stream con los productos del ingreso.
   */
  getProductosPorIngreso(ingresoId: string): Observable<Producto[]> {
    const q = query(this.productosRef, where('ingresoId', '==', ingresoId));
    return collectionData(q, { idField: 'id' }) as Observable<Producto[]>;
  }

  /**
   * Obtiene el último ID del contador de productos sin incrementarlo.
   * Valida si existen productos en la colección y retorna el siguiente ID disponible.
   *
   * @returns Promise<number | null> Último ID usado o 1 si no hay productos, null si no existe contador.
   */
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

  /**
   * Genera el siguiente ID interno secuencial usando un documento contador atómico.
   * Utiliza transacción Firestore para evitar duplicados en operaciones concurrentes.
   *
   * @returns Promise<number> Siguiente ID interno disponible (mínimo 1).
   */
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

  /**
   * Verifica si un código de armazón ya existe en otro producto.
   * Permite excluir un ID específico (para validaciones en edición).
   *
   * @param codigo Código de armazón a verificar.
   * @param excludeId ID del producto a excluir de la búsqueda (opcional).
   * @returns Promise<boolean> True si el código ya existe en otro producto.
   */
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

  /**
   * Crea un nuevo producto con generación automática de ID interno secuencial.
   * Aplica lógica especial para productos del grupo LUNAS (stock ilimitado).
   *
   * @param producto Datos del producto a crear (sin idInterno).
   * @returns Promise con DocumentReference del producto creado.
   */
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

  /**
   * Busca un producto por su código de armazón.
   * Retorna el primer producto que coincida con el código.
   *
   * @param codigo Código de armazón a buscar.
   * @returns Promise<Producto | null> Producto encontrado o null.
   */
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

  /**
   * Actualiza los datos de un producto existente.
   * Actualiza automáticamente el campo updatedAt.
   *
   * @param id ID del producto.
   * @param producto Datos parciales a actualizar.
   * @returns Promise<void> Se resuelve cuando la actualización se completa.
   */
  updateProducto(id: string, producto: Partial<Producto>) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      ...producto,
      updatedAt: new Date(),
    });
  }

  /**
   * Descuenta stock de un producto usando transacción atómica de Firestore.
   * No aplica descuento a productos con stock ilimitado (grupo LUNAS).
   *
   * @param id ID del producto.
   * @param cantidad Cantidad a descontar (positivo).
   * @returns Promise<void> Se resuelve cuando la transacción se completa.
   * @throws Error si el producto no existe o no hay stock suficiente.
   */
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

  /**
   * Desactiva un producto (soft delete) cambiando su campo activo a false.
   * El producto se mantiene en la base de datos pero se oculta de las consultas principales.
   *
   * @param id ID del producto a desactivar.
   * @returns Promise<void> Se resuelve cuando la actualización se completa.
   */
  desactivarProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Reactiva un producto desactivado cambiando su campo activo a true.
   * Permite revertir un soft delete.
   *
   * @param id ID del producto a reactivar.
   * @returns Promise<void> Se resuelve cuando la actualización se completa.
   */
  activarProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  // Eliminar producto (HARD DELETE: para desarrollo/test)
  deleteProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return deleteDoc(productoDoc);
  }
}
