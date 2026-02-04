import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy, Timestamp } from '@angular/fire/firestore';
import { Observable, map, shareReplay } from 'rxjs';
import { Cobro, FiltrosCobros } from '../models/cobro.model';

/**
 * Servicio para gestionar y consultar cobros realizados a facturas.
 * 
 * Los cobros se derivan de las facturas que tienen abonos registrados.
 * Este servicio permite generar informes y reportes de cobros con
 * diferentes filtros aplicados.
 * 
 * **Funcionalidades:**
 * - Obtener listado de cobros con filtros
 * - Calcular totales y estadísticas de cobros
 * - Generar reportes por período
 * - Filtrar por cliente, método de pago, fechas
 */
@Injectable({
  providedIn: 'root'
})
export class CobrosService {
  private facturasCollection;

  constructor(private firestore: Firestore) {
    this.facturasCollection = collection(this.firestore, 'facturas');
  }

  /**
   * Obtiene todos los cobros (facturas con abonos) aplicando filtros opcionales.
   * 🎯 ACTUALIZADO: Con shareReplay para caché
   * 
   * **Lógica:**
   * 1. Consulta todas las facturas que tienen abonos > 0
   * 2. Las ordena por fecha descendente (más recientes primero)
   * 3. Transforma cada factura en un objeto Cobro
   * 4. Aplica filtros adicionales en el cliente
   * 
   * **Nota:** Solo se consideran facturas con abonado > 0 ya que son
   * las únicas que tienen cobros registrados.
   * 
   * @param filtros Filtros opcionales para aplicar a la consulta
   * @returns Observable con array de Cobros
   */
  getCobros(filtros?: FiltrosCobros): Observable<Cobro[]> {
    // Query base: facturas con abonos ordenadas por fecha
    let q = query(
      this.facturasCollection,
      where('abonado', '>', 0),
      orderBy('fecha', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => {
        // Transformar facturas a cobros
        let cobros: Cobro[] = facturas.map(factura => this.facturaACobro(factura));

        // Aplicar filtros en el cliente
        if (filtros) {
          cobros = this.aplicarFiltros(cobros, filtros);
        }

        return cobros;
      }),
      shareReplay(1) // 🎯 Caché compartido
    );
  }

  /**
   * 🆕 Obtener cobros en un rango de fechas OPTIMIZADO
   * Filtra en Firestore para reducir documentos cargados
   * 
   * @param fechaInicio Fecha de inicio
   * @param fechaFin Fecha de fin
   * @returns Observable con cobros del período
   */
  getCobrosEnRangoOptimizado(fechaInicio: Date, fechaFin: Date): Observable<Cobro[]> {
    // Query: facturas con abonos ordenadas por fecha DESC
    // Sin orderBy para evitar requerir índice compuesto
    const q = query(
      this.facturasCollection,
      where('abonado', '>', 0),
      where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
      where('fecha', '<=', Timestamp.fromDate(fechaFin))
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => {
        // Ordenar en memoria por fecha DESC
        const sorted = facturas.sort((a, b) => {
          const fechaA = a.fecha?.toDate?.() || new Date(a.fecha);
          const fechaB = b.fecha?.toDate?.() || new Date(b.fecha);
          return fechaB.getTime() - fechaA.getTime();
        });
        return sorted.map(f => this.facturaACobro(f));
      }),
      shareReplay(1) // 🎯 Caché compartido
    );
  }

  /**
   * Obtiene cobros de un cliente específico.
   * 
   * @param clienteId ID del cliente
   * @returns Observable con array de Cobros del cliente
   */
  getCobrosCliente(clienteId: string): Observable<Cobro[]> {
    const q = query(
      this.facturasCollection,
      where('clienteId', '==', clienteId),
      where('abonado', '>', 0),
      orderBy('fecha', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => facturas.map(f => this.facturaACobro(f)))
    );
  }

  /**
   * Obtiene cobros en un rango de fechas específico.
   * 
   * @param fechaInicio Fecha de inicio del período
   * @param fechaFin Fecha de fin del período
   * @returns Observable con array de Cobros en el período
   */
  getCobrosEnRango(fechaInicio: Date, fechaFin: Date): Observable<Cobro[]> {
    const q = query(
      this.facturasCollection,
      where('abonado', '>', 0),
      where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
      where('fecha', '<=', Timestamp.fromDate(fechaFin)),
      orderBy('fecha', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((facturas: any[]) => facturas.map(f => this.facturaACobro(f)))
    );
  }

  /**
   * Convierte una factura en un objeto Cobro.
   * 
   * **Nota importante sobre el monto:**
   * El campo `abonado` en la factura representa el total acumulado de todos
   * los abonos realizados, NO el monto individual del último cobro.
   * 
   * Para un reporte preciso de cobros individuales, se requeriría un
   * historial de movimientos de abonos. Por ahora, mostramos el total abonado.
   * 
   * @param factura Factura de Firestore
   * @returns Objeto Cobro
   */
  private facturaACobro(factura: any): Cobro {
    // Convertir Timestamp de Firestore a Date
    let fecha: Date;
    if (factura.fecha?.toDate) {
      fecha = factura.fecha.toDate();
    } else if (factura.fecha instanceof Date) {
      fecha = factura.fecha;
    } else {
      fecha = new Date(factura.fecha);
    }

    return {
      id: factura.id || '',
      facturaId: factura.id || '',
      facturaIdPersonalizado: factura.idPersonalizado,
      clienteId: factura.clienteId || '',
      clienteNombre: factura.clienteNombre || 'Cliente',
      clienteTelefono: factura.clienteTelefono,
      fecha: fecha,
      monto: factura.abonado || 0, // Total abonado acumulado
      metodoPago: factura.metodoPago || 'Efectivo',
      codigoTransferencia: factura.codigoTransferencia,
      totalFactura: factura.total || 0,
      totalAbonado: factura.abonado || 0,
      saldoPendiente: factura.saldoPendiente || 0,
      estadoPago: factura.estadoPago || 'PENDIENTE',
      esCredito: factura.esCredito || false,
      estadoCredito: factura.estadoCredito,
      usuarioId: factura.usuarioId,
      usuarioNombre: factura.usuarioNombre,
      createdAt: factura.createdAt?.toDate ? factura.createdAt.toDate() : new Date()
    };
  }

  /**
   * Aplica filtros a un array de cobros.
   * 
   * @param cobros Array de cobros a filtrar
   * @param filtros Filtros a aplicar
   * @returns Array de cobros filtrado
   */
  private aplicarFiltros(cobros: Cobro[], filtros: FiltrosCobros): Cobro[] {
    return cobros.filter(cobro => {
      // Filtro por rango de fechas
      if (filtros.fechaInicio) {
        const fechaInicio = new Date(filtros.fechaInicio);
        fechaInicio.setHours(0, 0, 0, 0);
        if (cobro.fecha < fechaInicio) return false;
      }

      if (filtros.fechaFin) {
        const fechaFin = new Date(filtros.fechaFin);
        fechaFin.setHours(23, 59, 59, 999);
        if (cobro.fecha > fechaFin) return false;
      }

      // Filtro por cliente
      if (filtros.clienteId && cobro.clienteId !== filtros.clienteId) {
        return false;
      }

      // Filtro por método de pago
      if (filtros.metodoPago && filtros.metodoPago !== 'TODOS') {
        if (cobro.metodoPago !== filtros.metodoPago) return false;
      }

      // Filtro por crédito personal
      if (filtros.soloCreditoPersonal && !cobro.esCredito) {
        return false;
      }

      // Filtro por estado de pago
      if (filtros.estadoPago && filtros.estadoPago !== 'TODAS') {
        if (cobro.estadoPago !== filtros.estadoPago) return false;
      }

      return true;
    });
  }

  /**
   * Calcula el total cobrado de un array de cobros.
   * 
   * @param cobros Array de cobros
   * @returns Total cobrado
   */
  calcularTotalCobrado(cobros: Cobro[]): number {
    return cobros.reduce((sum, cobro) => sum + cobro.monto, 0);
  }

  /**
   * Agrupa cobros por método de pago con totales.
   * 
   * @param cobros Array de cobros
   * @returns Objeto con totales por método de pago
   */
  agruparPorMetodoPago(cobros: Cobro[]): { [metodoPago: string]: number } {
    return cobros.reduce((acc, cobro) => {
      const metodo = cobro.metodoPago || 'Efectivo';
      acc[metodo] = (acc[metodo] || 0) + cobro.monto;
      return acc;
    }, {} as { [metodoPago: string]: number });
  }

  /**
   * Agrupa cobros por cliente con totales.
   * 
   * @param cobros Array de cobros
   * @returns Array de objetos con cliente y total cobrado
   */
  agruparPorCliente(cobros: Cobro[]): { clienteNombre: string; total: number }[] {
    const grupos: { [clienteNombre: string]: number } = cobros.reduce((acc, cobro) => {
      const nombre = cobro.clienteNombre || 'Sin nombre';
      acc[nombre] = (acc[nombre] || 0) + cobro.monto;
      return acc;
    }, {} as { [clienteNombre: string]: number });

    return Object.entries(grupos)
      .map(([clienteNombre, total]) => ({ clienteNombre, total }))
      .sort((a, b) => b.total - a.total); // Ordenar por total descendente
  }
}
