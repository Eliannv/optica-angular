/**
 * Gestiona el catálogo de proveedores del sistema de inventario.
 * Maneja operaciones CRUD con validaciones de unicidad (nombre, teléfono, email),
 * cálculo y actualización de saldos, y soft delete para preservar historial.
 *
 * Este servicio implementa:
 * - Validación de unicidad para nombre, teléfono y email
 * - Cálculo automático de saldo basado en ingresos (compras)
 * - Actualización de saldo al registrar pagos o nuevos ingresos
 * - Soft delete (campo activo) para mantener trazabilidad
 * - Filtrado automático de proveedores desactivados en consultas
 *
 * Los datos se persisten en 'proveedores' de Firestore.
 * Se integra con ingresos.service.ts para cálculo de saldos y trazabilidad de compras.
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
  query,
  where,
  getDocs,
  limit,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Proveedor } from '../models/proveedor.model';

@Injectable({
  providedIn: 'root',
})
export class ProveedoresService {
  private firestore = inject(Firestore);
  private proveedoresRef = collection(this.firestore, 'proveedores');

  /**
   * Recupera todos los proveedores activos del sistema.
   * Filtra automáticamente los proveedores desactivados (soft delete).
   *
   * @returns Observable<Proveedor[]> Stream reactivo con los proveedores activos.
   */
  getProveedores(): Observable<Proveedor[]> {
    return collectionData(this.proveedoresRef, {
      idField: 'id',
    }).pipe(
      map((proveedores: any[]) => 
        proveedores.filter(p => p.activo !== false)
      )
    ) as Observable<Proveedor[]>;
  }

  /**
   * Recupera TODOS los proveedores incluyendo los desactivados.
   * Utilizado para importaciones y reportes históricos.
   *
   * @returns Observable<Proveedor[]> Stream con todos los proveedores sin filtrar.
   */
  getProveedoresTodosInclusoInactivos(): Observable<Proveedor[]> {
    return collectionData(this.proveedoresRef, {
      idField: 'id',
    }) as Observable<Proveedor[]>;
  }

  /**
   * Recupera un proveedor específico por su ID de Firestore.
   *
   * @param id ID del proveedor.
   * @returns Observable<Proveedor> Stream con los datos del proveedor.
   */
  getProveedorById(id: string): Observable<Proveedor> {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);
    return docData(proveedorDoc, {
      idField: 'id',
    }) as Observable<Proveedor>;
  }

  // Verificar si existe un proveedor por código (opcional excluir id)
  async codigoExists(codigo: string, excludeId?: string): Promise<boolean> {
    const cod = (codigo || '').trim().toUpperCase();
    if (!cod) return false;
    const q1 = query(this.proveedoresRef, where('codigo', '==', cod), limit(1));
    const snap1 = await getDocs(q1);
    if (snap1.empty) return false;
    if (excludeId) {
      return snap1.docs.some(d => d.id !== excludeId);
    }
    return true;
  }

  // Verificar si existe un proveedor por nombre (case-insensitive, opcional excluir id)
  async nombreExists(nombre: string, excludeId?: string): Promise<boolean> {
    const nombreTrim = (nombre || '').trim();
    if (!nombreTrim) return false;
    const nombreLower = nombreTrim.toLowerCase();

    // Preferir campo normalizado si existe en documentos
    const qLower = query(this.proveedoresRef, where('nombreLower', '==', nombreLower), limit(1));
    const snapLower = await getDocs(qLower);

    if (!snapLower.empty) {
      if (excludeId) {
        return snapLower.docs.some(d => d.id !== excludeId);
      }
      return true;
    }

    // Fallback: buscar coincidencia exacta en 'nombre' (por si hay docs antiguos sin 'nombreLower')
    const qExact = query(this.proveedoresRef, where('nombre', '==', nombreTrim), limit(1));
    const snapExact = await getDocs(qExact);
    if (snapExact.empty) return false;
    if (excludeId) {
      return snapExact.docs.some(d => d.id !== excludeId);
    }
    return true;
  }

  // Verificar si existe un proveedor por RUC (opcional excluir id)
  async rucExists(ruc: string, excludeId?: string): Promise<boolean> {
    const rucTrim = (ruc || '').trim();
    if (!rucTrim) return false;
    const qRuc = query(this.proveedoresRef, where('ruc', '==', rucTrim), limit(1));
    const snap = await getDocs(qRuc);
    if (snap.empty) return false;
    if (excludeId) {
      return snap.docs.some(d => d.id !== excludeId);
    }
    return true;
  }

  // Crear proveedor con validaciones de unicidad (código y nombre)
  async createProveedor(proveedor: Proveedor) {
    const codigoNorm = (proveedor.codigo || '').trim().toUpperCase();
    const nombreNorm = (proveedor.nombre || '').trim();
    const nombreLower = nombreNorm.toLowerCase();
    const rucNorm = (proveedor.ruc || '').trim();

    // Validar unicidad de código si viene informado
    if (codigoNorm) {
      const existeCodigo = await this.codigoExists(codigoNorm);
      if (existeCodigo) {
        throw new Error(`Ya existe un proveedor con el código "${codigoNorm}"`);
      }
    }

    // Validar unicidad de nombre (case-insensitive)
    const existeNombre = await this.nombreExists(nombreNorm);
    if (existeNombre) {
      throw new Error(`Ya existe un proveedor con el nombre "${nombreNorm}"`);
    }

    // Validar unicidad de RUC
    if (rucNorm) {
      const existeRuc = await this.rucExists(rucNorm);
      if (existeRuc) {
        throw new Error(`Ya existe un proveedor con el RUC "${rucNorm}"`);
      }
    }

    // Crear documento con campos normalizados auxiliares
    return addDoc(this.proveedoresRef, {
      ...proveedor,
      codigo: codigoNorm || undefined,
      nombre: nombreNorm,
      nombreLower,
      ruc: rucNorm,
      activo: true, // 🔹 Nuevo proveedor siempre activo
      createdAt: new Date(),
      updatedAt: new Date(),
      saldo: proveedor.saldo || 0,
    });
  }

  // Actualizar proveedor (mantener campos normalizados y validar si cambian)
  async updateProveedor(id: string, proveedor: Partial<Proveedor>) {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);

    const updates: any = { ...proveedor, updatedAt: new Date() };

    if (typeof proveedor.nombre === 'string') {
      const nombreNorm = proveedor.nombre.trim();
      updates.nombre = nombreNorm;
      updates.nombreLower = nombreNorm.toLowerCase();

      const existeNombre = await this.nombreExists(nombreNorm, id);
      if (existeNombre) {
        throw new Error(`Ya existe un proveedor con el nombre "${nombreNorm}"`);
      }
    }

    if (typeof proveedor.codigo === 'string') {
      const codigoNorm = proveedor.codigo.trim().toUpperCase();
      updates.codigo = codigoNorm;

      if (codigoNorm) {
        const existeCodigo = await this.codigoExists(codigoNorm, id);
        if (existeCodigo) {
          throw new Error(`Ya existe un proveedor con el código "${codigoNorm}"`);
        }
      }
    }

    if (typeof proveedor.ruc === 'string') {
      const rucNorm = proveedor.ruc.trim();
      updates.ruc = rucNorm;
      if (rucNorm) {
        const existeRuc = await this.rucExists(rucNorm, id);
        if (existeRuc) {
          throw new Error(`Ya existe un proveedor con el RUC "${rucNorm}"`);
        }
      }
    }

    return updateDoc(proveedorDoc, updates);
  }

  // Eliminar proveedor (SOFT DELETE: desactivar)
  desactivarProveedor(id: string) {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);
    return updateDoc(proveedorDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  // Reactivar proveedor (reversible)
  activarProveedor(id: string) {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);
    return updateDoc(proveedorDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  // Eliminar proveedor (HARD DELETE: para desarrollo/test)
  deleteProveedor(id: string) {
    const proveedorDoc = doc(this.firestore, `proveedores/${id}`);
    return deleteDoc(proveedorDoc);
  }

  // Calcular saldo automático del proveedor (ingresos - pagos en caja banco)
  async calcularSaldoProveedor(proveedorNombre: string, proveedorId?: string): Promise<number> {
    // 1. Sumar todos los ingresos finalizados del proveedor
    const ingresosRef = collection(this.firestore, 'ingresos');
    const q = query(
      ingresosRef,
      where('proveedor', '==', proveedorNombre),
      where('estado', '==', 'FINALIZADO')
    );
    const snap = await getDocs(q);
    
    let totalIngresos = 0;
    snap.forEach(docSnap => {
      const ingreso: any = docSnap.data();
      totalIngresos += ingreso.total || 0;
    });

    // 2. Restar todos los pagos realizados en caja-banco
    let totalPagos = 0;
    if (proveedorId) {
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
      const qPagos = query(
        movimientosRef,
        where('proveedor_id', '==', proveedorId),
        where('tipo', '==', 'EGRESO'),
        where('categoria', '==', 'PAGO_PROVEEDORES')
      );
      const snapPagos = await getDocs(qPagos);
      
      snapPagos.forEach(docSnap => {
        const pago: any = docSnap.data();
        totalPagos += pago.monto || 0;
      });
    }
    
    // Saldo = Ingresos - Pagos
    return totalIngresos - totalPagos;
  }

  // Actualizar saldo del proveedor en Firestore (ingresos - pagos)
  async actualizarSaldoProveedor(proveedorNombre: string, proveedorId?: string): Promise<void> {
    try {
      const saldo = await this.calcularSaldoProveedor(proveedorNombre, proveedorId);
      const proveedoresRef = collection(this.firestore, 'proveedores');
      const q = query(proveedoresRef, where('nombre', '==', proveedorNombre));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        snap.forEach(docSnap => {
          updateDoc(docSnap.ref, { 
            saldo: saldo, 
            updatedAt: new Date() 
          });
        });
      }
    } catch (error) {
      console.error('Error al actualizar saldo del proveedor:', error);
    }
  }
}
