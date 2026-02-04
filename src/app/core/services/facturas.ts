/**
 * Gestiona el ciclo de vida completo de las facturas de venta en el sistema.
 * Proporciona operaciones CRUD, generación de IDs secuenciales personalizados,
 * y funcionalidad avanzada para el manejo de pagos pendientes y deudas de clientes.
 *
 * Este servicio implementa un sistema de IDs de 10 dígitos (0000000001, 0000000002, etc.)
 * para facilitar la identificación manual de facturas. También gestiona estados de pago
 * (PENDIENTE/PAGADA) y mantiene trazabilidad de abonos y saldos pendientes.
 *
 * Los datos se persisten en la colección 'facturas' de Firestore y se integran con
 * los módulos de caja chica y caja banco según el método de pago.
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  doc,
  docData,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  updateDoc,
  orderBy,
  setDoc,
  deleteDoc,
  limit,
  startAfter,
  QueryDocumentSnapshot
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, shareReplay, map, tap } from 'rxjs';
import { Factura } from '../models/factura.model';
import { PaginationResult } from '../models/pagination.model';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private fs = inject(Firestore);
  private facturasRef = collection(this.fs, 'facturas');

  // 🎯 CACHÉ con shareReplay
  private facturasCache$ = new BehaviorSubject<Factura[]>([]);
  private cachedAllFacturas$: Observable<Factura[]> | null = null;

  /**
   * Genera un ID secuencial de 10 dígitos (0000000001, 0000000002, etc.)
   * Obtiene el número más alto actual y suma 1
   */
  private async generarIdSecuencial(): Promise<string> {
    // Obtener todas las facturas
    const snap = await getDocs(this.facturasRef);
    let maxNumero = 0;

    // Recorrer y buscar el número más alto
    snap.forEach(doc => {
      const data: any = doc.data();
      const idPersonalizado = data?.idPersonalizado;
      if (idPersonalizado) {
        const num = parseInt(idPersonalizado, 10);
        if (!isNaN(num) && num > maxNumero) {
          maxNumero = num;
        }
      }
    });

    // El siguiente ID es maxNumero + 1, con padding a 10 dígitos
    const nuevoNumero = maxNumero + 1;
    return nuevoNumero.toString().padStart(10, '0');
  }

  // EXISTENTE - MODIFICADO
  async crearFactura(factura: Omit<Factura, 'id'>) {
    // Generar ID secuencial personalizado
    const idPersonalizado = await this.generarIdSecuencial();

    // Convertir Date a Timestamp de Firestore
    const facturaParaGuardar: any = { ...factura };
    
    // Si fecha es un Date, convertirlo a Timestamp
    if (facturaParaGuardar.fecha instanceof Date) {
      facturaParaGuardar.fecha = Timestamp.fromDate(facturaParaGuardar.fecha);
      console.log('📅 Fecha convertida a Timestamp:', facturaParaGuardar.fecha);
    } else if (facturaParaGuardar.fecha) {
      console.warn('⚠️ Fecha no es Date:', typeof facturaParaGuardar.fecha, facturaParaGuardar.fecha);
    } else {
      console.error('❌ Fecha es undefined o null');
    }

    // Usar setDoc con el ID personalizado
    const docRef = doc(this.facturasRef, idPersonalizado);
    await setDoc(docRef, {
      ...facturaParaGuardar,
      idPersonalizado
    });

    console.log('✅ Factura guardada con ID:', idPersonalizado);
    return docRef;
  }

  // EXISTENTE - ACTUALIZADO CON CACHÉ
  getFacturas(): Observable<Factura[]> {
    if (!this.cachedAllFacturas$) {
      this.cachedAllFacturas$ = collectionData(this.facturasRef, { idField: 'id' }).pipe(
        map(data => data as Factura[]),
        tap(facturas => this.facturasCache$.next(facturas)),
        shareReplay(1) // 🎯 Compartir resultado entre suscriptores
      );
    }
    return this.cachedAllFacturas$;
  }

  /**
   * 🆕 Obtener facturas con paginación
   * @param pageSize - Cantidad de documentos por página (default: 50)
   * @param startAfterDoc - Documento desde el cual continuar (para siguiente página)
   */
  getFacturasPaginadas(
    pageSize: number = 50,
    startAfterDoc?: QueryDocumentSnapshot<any>
  ): Observable<PaginationResult<Factura>> {
    let q: any;

    if (startAfterDoc) {
      q = query(
        this.facturasRef,
        orderBy('fecha', 'desc'),
        startAfter(startAfterDoc),
        limit(pageSize + 1) // +1 para detectar si hay más páginas
      );
    } else {
      q = query(
        this.facturasRef,
        orderBy('fecha', 'desc'),
        limit(pageSize + 1)
      );
    }

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => {
        const hasNextPage = facturas.length > pageSize;
        const items = facturas.slice(0, pageSize);
        const lastDoc = items.length > 0 ? items[items.length - 1] : null;

        return {
          items: items as Factura[],
          pageSize,
          hasNextPage,
          cursor: {
            next: hasNextPage ? lastDoc : undefined
          }
        };
      })
    );
  }

  // 🎯 Recargar caché
  reloadFacturas() {
    this.cachedAllFacturas$ = null;
    return this.getFacturas();
  }

  // EXISTENTE
  getFacturaById(id: string): Observable<Factura> {
    const ref = doc(this.fs, `facturas/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<Factura>;
  }

  // =========================================================
  // NUEVO: DEUDA / PENDIENTES
  // =========================================================

  /**
   * Devuelve resumen rápido para mostrar badge en lista:
   * deudaTotal = suma de saldoPendiente de facturas PENDIENTES del cliente
   * pendientes = cantidad de facturas pendientes
   */
  async getResumenDeuda(clienteId: string): Promise<{ deudaTotal: number; pendientes: number; creditosActivos: number; creditoPersonalActivo: boolean }> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('estadoPago', '==', 'PENDIENTE')
    );

    const snap = await getDocs(q);
    let deudaTotal = 0;
    let pendientes = 0;
    let creditosActivos = 0;

    snap.forEach(d => {
      const data: any = d.data();
      const saldo = Number(data?.saldoPendiente || 0);
      const esCreditoPersonal = Boolean(
        data?.esCredito ||
        (data?.tipoVenta && String(data.tipoVenta).toUpperCase() === 'CREDITO') ||
        (data?.estadoCredito && String(data.estadoCredito).toUpperCase() === 'ACTIVO')
      );
      if (saldo > 0) {
        deudaTotal += saldo;
        pendientes++;
        if (esCreditoPersonal) {
          creditosActivos++;
        }
      }
    });

    return {
      deudaTotal: +deudaTotal.toFixed(2),
      pendientes,
      creditosActivos,
      creditoPersonalActivo: creditosActivos > 0
    };
  }

  /**
   * Trae facturas pendientes de un cliente (para pantalla cobrar deuda)
   * Sin orderBy en Firestore para evitar necesidad de índice compuesto
   * Se ordena en el cliente (Angular)
   */
  getPendientesPorCliente(clienteId: string): Observable<any[]> {
    const q = query(
      this.facturasRef,
      where('clienteId', '==', clienteId),
      where('estadoPago', '==', 'PENDIENTE')
      // Sin orderBy para evitar necesidad de índice compuesto
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => {
        // Ordenar en el cliente en lugar de en Firestore
        return (facturas || []).sort((a, b) => {
          const fechaA = a?.fecha?.toDate?.() || new Date(a?.fecha || 0);
          const fechaB = b?.fecha?.toDate?.() || new Date(b?.fecha || 0);
          return fechaB.getTime() - fechaA.getTime(); // descendente
        });
      })
    ) as Observable<any[]>;
  }

  /**
   * Actualiza pago: abonado/saldo/estado.
   * Ideal para registrar abonos.
   */
  async actualizarPagoFactura(facturaId: string, payload: {
    abonado?: number;
    saldoPendiente?: number;
    estadoPago?: 'PENDIENTE' | 'PAGADA';
    metodoPago?: string;
    ultimaActualizacionPago?: any;
  }) {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    await updateDoc(ref, {
      ...payload,
      // opcional: timestamp servidor para auditar
      ultimaActualizacionPago: serverTimestamp()
    } as any);
  }

  /**
   * Marca una factura como PAGADA sin modificar ningún otro campo.
   * NO modifica: total, abonado, saldoPendiente, fecha, items, cliente, impuestos, etc.
   * Solo actualiza el campo estadoPago para indicar que está saldada.
   */
  async marcarFacturaComoPagada(facturaId: string) {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    await updateDoc(ref, {
      estadoPago: 'PAGADA'
    } as any);
  }

  /**
   * Actualiza una factura completa.
   * Permite editar productos, montos, método de pago, etc.
   * NO modifica el historialSnapshot (registro clínico inmutable).
   */
  async actualizarFactura(facturaId: string, factura: Partial<Factura>) {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    
    // Convertir Date a Timestamp si es necesario
    const facturaParaGuardar: any = { ...factura };
    if (facturaParaGuardar.fecha instanceof Date) {
      facturaParaGuardar.fecha = Timestamp.fromDate(facturaParaGuardar.fecha);
    }

    // Remover campos que no deben actualizarse
    delete facturaParaGuardar.id;
    delete facturaParaGuardar.idPersonalizado;
    delete facturaParaGuardar.historialSnapshot; // NO modificar historial clínico

    await updateDoc(ref, {
      ...facturaParaGuardar,
      ultimaActualizacion: serverTimestamp()
    } as any);
    
    console.log('✅ Factura actualizada:', facturaId);
  }

  /**
   * Elimina permanentemente una factura.
   * IMPORTANTE: Esta acción no se puede deshacer.
   * Se recomienda validar que no tenga movimientos en cajas antes de eliminar.
   */
  async eliminarFactura(facturaId: string): Promise<void> {
    const ref = doc(this.fs, `facturas/${facturaId}`);
    await deleteDoc(ref);
    console.log('✅ Factura eliminada permanentemente:', facturaId);
  }
}
