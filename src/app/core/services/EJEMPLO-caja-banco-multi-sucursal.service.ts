/**
 * EJEMPLO PRÁCTICO: Modificación de CajaBancoService para Multi-Sucursal
 * 
 * Este archivo muestra PASO A PASO cómo modificar un servicio existente
 * para agregar soporte de filtrado por sucursal.
 * 
 * ⚠️ IMPORTANTE: Este es un archivo de EJEMPLO/REFERENCIA.
 * NO lo uses directamente, sino como guía para modificar el archivo real.
 */

import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CajaBanco, MovimientoCajaBanco } from '../models/caja-banco.model';
import { AuthService } from './auth.service';
import { SucursalQueryHelperService } from './sucursal-query-helper.service'; // ✅ PASO 1: Importar

@Injectable({
  providedIn: 'root',
})
export class CajaBancoServiceEjemplo {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private sucursalHelper = inject(SucursalQueryHelperService); // ✅ PASO 2: Inyectar

  /**
   * ✅ EJEMPLO 1: Modificar método GET simple
   * 
   * ANTES:
   * getCajasBanco(): Observable<CajaBanco[]> {
   *   const cajasRef = collection(this.firestore, 'cajas_banco');
   *   const q = query(cajasRef, orderBy('fecha', 'desc'));
   *   return collectionData(q, { idField: 'id' });
   * }
   * 
   * DESPUÉS:
   */
  getCajasBanco(): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    
    // ✅ PASO 3: Usar el helper para agregar filtro de sucursal
    const q = this.sucursalHelper.agregarFiltroSucursal(
      cajasRef,
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        // Filtrar cajas activas en memoria
        return (cajas || []).filter(c => c.activo !== false);
      })
    ) as Observable<CajaBanco[]>;
  }

  /**
   * ✅ EJEMPLO 2: Modificar método GET con rango de fechas
   * 
   * IMPORTANTE: Cuando ya hay un where() con desigualdad (>=, <, etc.),
   * NO puedes agregar otro where() con desigualdad en un campo diferente.
   * 
   * Solución: Filtrar por sucursal después de obtener los resultados.
   */
  getCajasBancoPorMes(year: number, monthIndex0: number): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const inicioMes = new Date(year, monthIndex0, 1);
    const inicioSiguienteMes = new Date(year, monthIndex0 + 1, 1);
    
    // Obtener ID de sucursal actual
    const sucursalId = this.sucursalHelper.getSucursalIdActual();
    
    let q;
    if (sucursalId) {
      // Si hay sucursal específica, agregarla como filtro de igualdad ANTES del rango
      q = query(
        cajasRef,
        where('sucursalId', '==', sucursalId),
        where('fecha', '>=', inicioMes),
        where('fecha', '<', inicioSiguienteMes),
        orderBy('fecha', 'desc')
      );
    } else {
      // Si es "TODAS", solo filtrar por fecha
      q = query(
        cajasRef,
        where('fecha', '>=', inicioMes),
        where('fecha', '<', inicioSiguienteMes),
        orderBy('fecha', 'desc')
      );
    }
    
    return collectionData(q, { idField: 'id' }) as Observable<CajaBanco[]>;
  }

  /**
   * ✅ EJEMPLO 3: Modificar método CREATE
   * 
   * ANTES:
   * async crearCajaBanco(datos: Partial<CajaBanco>): Promise<string> {
   *   const cajasRef = collection(this.firestore, 'cajas_banco');
   *   const docRef = await addDoc(cajasRef, {
   *     ...datos,
   *     activo: true,
   *     createdAt: new Date()
   *   });
   *   return docRef.id;
   * }
   * 
   * DESPUÉS:
   */
  async crearCajaBanco(datos: Partial<CajaBanco>): Promise<string> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    
    // ✅ PASO 4: Agregar sucursalId y sucursalNombre automáticamente
    const docRef = await addDoc(cajasRef, {
      ...datos,
      ...this.sucursalHelper.getSucursalParaDocumento(), // ✅ NUEVO
      activo: true,
      createdAt: new Date()
    });
    
    return docRef.id;
  }

  /**
   * ✅ EJEMPLO 4: Modificar método CREATE de movimiento (subcolección)
   * 
   * Los movimientos también deben tener sucursalId
   */
  async registrarMovimiento(
    cajaId: string,
    movimiento: Partial<MovimientoCajaBanco>
  ): Promise<string> {
    const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
    
    // ✅ AGREGAR sucursalId y sucursalNombre
    const docRef = await addDoc(movimientosRef, {
      ...movimiento,
      ...this.sucursalHelper.getSucursalParaDocumento(), // ✅ NUEVO
      cajaId,
      fecha: Timestamp.fromDate(movimiento.fecha as Date),
      createdAt: new Date()
    });
    
    return docRef.id;
  }

  /**
   * ✅ EJEMPLO 5: Método con búsqueda compleja
   * 
   * Cuando necesites combinar múltiples filtros
   */
  async buscarCajasPorEstado(estado: 'ABIERTA' | 'CERRADA'): Promise<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    const sucursalId = this.sucursalHelper.getSucursalIdActual();
    
    let q;
    if (sucursalId) {
      // Con filtro de sucursal
      q = query(
        cajasRef,
        where('sucursalId', '==', sucursalId),
        where('estado', '==', estado),
        orderBy('fecha', 'desc')
      );
    } else {
      // Sin filtro de sucursal (TODAS)
      q = query(
        cajasRef,
        where('estado', '==', estado),
        orderBy('fecha', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CajaBanco));
  }

  /**
   * ✅ EJEMPLO 6: Método que obtiene TODOS los documentos con límite
   * 
   * Útil cuando el admin selecciona "TODAS" y necesitas paginación
   */
  getCajasBancoConLimite(limite: number = 50): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    
    // ✅ Usa agregarFiltroConLimite para aplicar límite automáticamente si es "TODAS"
    const q = this.sucursalHelper.agregarFiltroConLimite(
      cajasRef,
      limite,
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }) as Observable<CajaBanco[]>;
  }

  /**
   * ✅ EJEMPLO 7: Método de UPDATE (no necesita cambios)
   * 
   * Los UPDATE no modifican sucursalId (ya existe en el documento)
   */
  async actualizarCajaBanco(id: string, datos: Partial<CajaBanco>): Promise<void> {
    const docRef = doc(this.firestore, `cajas_banco/${id}`);
    
    // ✅ NO agregar sucursalId aquí - ya existe
    // Solo actualizar los campos que cambian
    await updateDoc(docRef, {
      ...datos,
      updatedAt: new Date()
    });
  }

  /**
   * ✅ EJEMPLO 8: Validación antes de crear
   * 
   * Asegurarse de que hay una sucursal seleccionada
   */
  async crearCajaBancoConValidacion(datos: Partial<CajaBanco>): Promise<string> {
    // ✅ Validar que hay sucursal seleccionada
    try {
      const sucursalData = this.sucursalHelper.getSucursalParaDocumento();
      
      const cajasRef = collection(this.firestore, 'cajas_banco');
      const docRef = await addDoc(cajasRef, {
        ...datos,
        ...sucursalData,
        activo: true,
        createdAt: new Date()
      });
      
      return docRef.id;
    } catch (error: any) {
      if (error.message.includes('sucursal')) {
        throw new Error('Debe seleccionar una sucursal específica para crear una caja banco');
      }
      throw error;
    }
  }
}

/**
 * 📋 CHECKLIST DE MODIFICACIÓN
 * 
 * Para modificar cualquier servicio Firestore, seguir estos pasos:
 * 
 * □ PASO 1: Importar SucursalQueryHelperService
 * □ PASO 2: Inyectar en el constructor usando inject()
 * □ PASO 3: En métodos GET:
 *   □ Usar agregarFiltroSucursal() para queries simples
 *   □ Usar agregarFiltroConLimite() para queries con paginación
 *   □ Para queries complejas, obtener sucursalId y crear query manualmente
 * □ PASO 4: En métodos CREATE:
 *   □ Usar getSucursalParaDocumento() para agregar sucursalId y sucursalNombre
 * □ PASO 5: En métodos UPDATE:
 *   □ NO modificar sucursalId (solo si es necesario por lógica de negocio)
 * □ PASO 6: Probar con:
 *   □ Usuario ADMIN con "TODAS" seleccionado
 *   □ Usuario ADMIN con sucursal específica
 *   □ Usuario OPERADOR con su sucursal asignada
 * 
 * 
 * 🔴 ERRORES COMUNES A EVITAR:
 * 
 * ❌ Combinar múltiples where() con desigualdad en campos diferentes
 *    Solución: Usar un solo rango de desigualdad y filtrar el resto en memoria o usar igualdad
 * 
 * ❌ Olvidar agregar sucursalId en operaciones CREATE
 *    Solución: Siempre usar getSucursalParaDocumento()
 * 
 * ❌ No validar que hay sucursal seleccionada antes de CREATE
 *    Solución: Usar try/catch o validar antes
 * 
 * ❌ Modificar sucursalId en UPDATE sin razón
 *    Solución: Solo actualizar campos que realmente cambian
 * 
 * ❌ No considerar el caso "TODAS" para ADMIN
 *    Solución: Usar agregarFiltroConLimite() o manejar manualmente
 */
