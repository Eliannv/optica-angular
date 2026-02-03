import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
  QueryConstraint,
  getDocs
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { 
  EgresoMercaderia, 
  FiltrosEgresoMercaderia, 
  ResumenEgresos,
  ProductoEgresado,
  MotivoEgreso,
  MOTIVOS_EGRESO,
  DetalleProductoEgreso
} from '../models/egreso.model';

/**
 * Servicio para gestionar egresos de mercadería.
 * 
 * Funcionalidades:
 * - Registrar egresos de productos con diferentes motivos
 * - Consultar egresos con filtros avanzados
 * - Obtener estadísticas y resúmenes
 * - Actualizar stock automáticamente al registrar egreso
 * 
 * Colección Firestore: 'egresosMercaderia'
 */
@Injectable({
  providedIn: 'root'
})
export class EgresoMercaderiaService {
  private firestore = inject(Firestore);
  private egresosCollection = collection(this.firestore, 'egresosMercaderia');

  /**
   * Obtiene todos los egresos con filtros opcionales
   */
  getEgresos(filtros?: FiltrosEgresoMercaderia): Observable<EgresoMercaderia[]> {
    const constraints: QueryConstraint[] = [];

    // Filtro de solo activos (por defecto true)
    if (filtros?.soloActivos !== false) {
      constraints.push(where('activo', '==', true));
    }

    // Filtro por motivo
    if (filtros?.motivo) {
      constraints.push(where('motivo', '==', filtros.motivo));
    }

    // Filtro por usuario
    if (filtros?.usuarioId) {
      constraints.push(where('usuarioId', '==', filtros.usuarioId));
    }

    // Filtro por sucursal
    if (filtros?.sucursalId) {
      constraints.push(where('sucursalId', '==', filtros.sucursalId));
    }

    // Ordenar por fecha descendente
    constraints.push(orderBy('fecha', 'desc'));

    const q = query(this.egresosCollection, ...constraints);

    return collectionData(q, { idField: 'id' }).pipe(
      map((egresos: any[]) => {
        return egresos
          .map(egreso => this.convertirTimestamp(egreso))
          .filter(egreso => this.aplicarFiltrosCliente(egreso, filtros));
      })
    );
  }

  /**
   * Registra un nuevo egreso de mercadería con múltiples productos.
   * IMPORTANTE: Este método NO actualiza el stock automáticamente.
   * El stock debe actualizarse desde el componente que llama este método.
   * 
   * Si se especifica un proveedor, se disminuirá su saldo automáticamente.
   */
  async registrarEgreso(egreso: Omit<EgresoMercaderia, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const egresoData = {
      ...egreso,
      fecha: Timestamp.fromDate(egreso.fecha),
      activo: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(this.egresosCollection, egresoData);
    
    // Si el egreso está asociado a un proveedor, actualizar su saldo
    if (egreso.proveedorId && egreso.motivo === 'DEVOLUCION_PROVEEDOR') {
      await this.actualizarSaldoProveedor(egreso.proveedorId, egreso.costoTotal);
    }
    
    return docRef.id;
  }

  /**
   * Actualiza el saldo de un proveedor después de un egreso
   * @param proveedorId ID del proveedor
   * @param monto Monto a disminuir del saldo
   */
  private async actualizarSaldoProveedor(proveedorId: string, monto: number): Promise<void> {
    try {
      const proveedorRef = doc(this.firestore, `proveedores/${proveedorId}`);
      const proveedorSnap = await getDoc(proveedorRef);
      
      if (proveedorSnap.exists()) {
        const proveedor = proveedorSnap.data();
        const nuevoSaldo = (proveedor['saldo'] || 0) - monto;
        
        await updateDoc(proveedorRef, {
          saldo: nuevoSaldo,
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error al actualizar saldo del proveedor:', error);
      // No lanzamos error para no interrumpir el flujo del egreso
    }
  }

  /**
   * Anula (soft delete) un egreso
   * NOTA: No revierte el stock automáticamente
   */
  async anularEgreso(egresoId: string): Promise<void> {
    const egresoRef = doc(this.firestore, 'egresosMercaderia', egresoId);
    await updateDoc(egresoRef, {
      activo: false,
      updatedAt: Timestamp.now()
    });
  }

  /**
   * Obtiene un egreso por su ID (Promise)
   */
  async getEgresoPorId(egresoId: string): Promise<EgresoMercaderia | null> {
    const egresoRef = doc(this.firestore, 'egresosMercaderia', egresoId);
    const egresoSnap = await getDoc(egresoRef);
    
    if (!egresoSnap.exists()) {
      return null;
    }

    const data = egresoSnap.data();
    return this.convertirTimestamp({ id: egresoSnap.id, ...data });
  }

  /**
   * Obtiene un egreso por su ID (Observable)
   */
  getEgresoById(egresoId: string): Observable<EgresoMercaderia | null> {
    return new Observable(observer => {
      this.getEgresoPorId(egresoId)
        .then(egreso => {
          observer.next(egreso);
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  /**
   * Obtiene resumen estadístico de egresos
   */
  getResumenEgresos(filtros?: FiltrosEgresoMercaderia): Observable<ResumenEgresos> {
    return this.getEgresos(filtros).pipe(
      map(egresos => this.calcularResumen(egresos))
    );
  }

  /**
   * Convierte Timestamps de Firestore a Date
   */
  private convertirTimestamp(egreso: any): EgresoMercaderia {
    return {
      ...egreso,
      fecha: egreso.fecha?.toDate ? egreso.fecha.toDate() : egreso.fecha,
      createdAt: egreso.createdAt?.toDate ? egreso.createdAt.toDate() : egreso.createdAt,
      updatedAt: egreso.updatedAt?.toDate ? egreso.updatedAt.toDate() : egreso.updatedAt
    };
  }

  /**
   * Aplica filtros que no se pueden hacer en Firestore query
   */
  private aplicarFiltrosCliente(egreso: EgresoMercaderia, filtros?: FiltrosEgresoMercaderia): boolean {
    if (!filtros) return true;

    // Filtro por rango de fechas
    if (filtros.fechaInicio && egreso.fecha < filtros.fechaInicio) {
      return false;
    }
    if (filtros.fechaFin && egreso.fecha > filtros.fechaFin) {
      return false;
    }

    // Filtro por búsqueda de producto (compatible con sistema antiguo y nuevo)
    if (filtros.productoBusqueda) {
      const busqueda = filtros.productoBusqueda.toLowerCase();
      
      // Sistema antiguo (un solo producto)
      if (egreso.productoNombre) {
        const coincide = 
          (egreso.productoIdInterno?.toString() || '').includes(busqueda) ||
          egreso.productoNombre.toLowerCase().includes(busqueda) ||
          (egreso.productoModelo?.toLowerCase() || '').includes(busqueda);
        
        if (coincide) return true;
      }
      
      // Sistema nuevo (múltiples productos)
      if (egreso.productosEgresados && egreso.productosEgresados.length > 0) {
        const coincideEnAlgunProducto = egreso.productosEgresados.some(p => 
          (p.productoIdInterno?.toString() || '').includes(busqueda) ||
          p.productoNombre.toLowerCase().includes(busqueda) ||
          (p.productoModelo?.toLowerCase() || '').includes(busqueda)
        );
        
        if (!coincideEnAlgunProducto) return false;
      }
    }

    return true;
  }

  /**
   * Calcula resumen estadístico de un array de egresos
   * Compatible con sistema antiguo (un producto) y nuevo (múltiples productos)
   */
  private calcularResumen(egresos: EgresoMercaderia[]): ResumenEgresos {
    const porMotivo: ResumenEgresos['porMotivo'] = {} as any;
    
    // Inicializar todos los motivos
    Object.keys(MOTIVOS_EGRESO).forEach(motivo => {
      porMotivo[motivo as MotivoEgreso] = {
        cantidad: 0,
        unidades: 0,
        costo: 0
      };
    });

    // Agrupar por producto para ranking
    const productoMap = new Map<string, ProductoEgresado>();

    let totalUnidades = 0;
    let costoTotal = 0;

    egresos.forEach(egreso => {
      // Sumar costo total
      costoTotal += egreso.costoTotal;

      // Agrupar por motivo
      porMotivo[egreso.motivo].cantidad++;
      porMotivo[egreso.motivo].costo += egreso.costoTotal;

      // Procesar productos (compatible con ambos sistemas)
      if (egreso.productosEgresados && egreso.productosEgresados.length > 0) {
        // Sistema nuevo: múltiples productos
        egreso.productosEgresados.forEach(detalle => {
          totalUnidades += detalle.cantidad;
          porMotivo[egreso.motivo].unidades += detalle.cantidad;

          if (!productoMap.has(detalle.productoId)) {
            productoMap.set(detalle.productoId, {
              productoId: detalle.productoId,
              productoIdInterno: detalle.productoIdInterno,
              productoNombre: detalle.productoNombre,
              cantidadEgresos: 0,
              unidadesTotales: 0,
              costoTotal: 0
            });
          }

          const prod = productoMap.get(detalle.productoId)!;
          prod.cantidadEgresos++;
          prod.unidadesTotales += detalle.cantidad;
          prod.costoTotal += detalle.costoTotal;
        });
      } else if (egreso.productoId && egreso.cantidad) {
        // Sistema antiguo: un solo producto
        totalUnidades += egreso.cantidad;
        porMotivo[egreso.motivo].unidades += egreso.cantidad;

        if (!productoMap.has(egreso.productoId)) {
          productoMap.set(egreso.productoId, {
            productoId: egreso.productoId,
            productoIdInterno: egreso.productoIdInterno,
            productoNombre: egreso.productoNombre || '',
            cantidadEgresos: 0,
            unidadesTotales: 0,
            costoTotal: 0
          });
        }

        const prod = productoMap.get(egreso.productoId)!;
        prod.cantidadEgresos++;
        prod.unidadesTotales += egreso.cantidad;
        prod.costoTotal += egreso.costoTotal;
      }
    });

    // Convertir map a array y ordenar por unidades totales
    const productosMasEgresados = Array.from(productoMap.values())
      .sort((a, b) => b.unidadesTotales - a.unidadesTotales)
      .slice(0, 10); // Top 10

    return {
      totalEgresos: egresos.length,
      totalUnidades,
      costoTotal,
      porMotivo,
      productosMasEgresados
    };
  }

  /**
   * Obtiene la etiqueta legible de un motivo de egreso
   */
  getEtiquetaMotivo(motivo: MotivoEgreso): string {
    return MOTIVOS_EGRESO[motivo] || motivo;
  }
}
