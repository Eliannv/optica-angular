/**
 * Servicio para calcular métricas y estadísticas de empleados.
 * 
 * REGLA ANTI-DUPLICADOS (CRÍTICA):
 * Cada métrica usa UNA SOLA FUENTE DE DATOS:
 * 
 * 📄 Ventas → colección 'facturas' (campo usuarioId)
 * 💳 Cobros de deuda → colección 'facturas_deudas' (campo usuarioId)
 * 💰 Movimientos de caja → colecciones 'movimientos_cajas_*' (campo usuario_id)
 * 👤 Pagos a empleado → 'movimientos_cajas_banco' (categoria = PAGO_TRABAJADOR)
 * 
 * ⚠️ NUNCA mezclar fuentes ni usar movimientos de caja para calcular ventas.
 */
import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { Observable, from, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  MetricasVentas,
  MetricasCobros,
  MetricasPagos,
  ResumenMensual,
  EmpleadoConMetricas,
  MetricaGlobal,
  RankingItem,
  FiltrosMetricas,
  PagoEmpleado
} from '../models/empleado-metricas.model';
import { Usuario } from '../models/usuario.model';

@Injectable({
  providedIn: 'root'
})
export class EmpleadoMetricasService {
  private firestore = inject(Firestore);

  /**
   * Calcula métricas de ventas de un empleado en un período.
   * Fuente ÚNICA: colección 'facturas'
   */
  async calcularMetricasVentas(
    usuarioId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<MetricasVentas> {
    try {
      const facturasRef = collection(this.firestore, 'facturas');
      const q = query(
        facturasRef,
        where('usuarioId', '==', usuarioId),
        where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
        where('fecha', '<=', Timestamp.fromDate(fechaFin))
      );

      const snapshot = await getDocs(q);
      const facturas = snapshot.docs.map(doc => doc.data());

      const totalVentas = facturas.length;
      const montoTotalVendido = facturas.reduce((sum, f: any) => sum + (f.total || 0), 0);
      const promedioPorVenta = totalVentas > 0 ? montoTotalVendido / totalVentas : 0;

      return {
        totalVentas,
        montoTotalVendido,
        promedioPorVenta
      };
    } catch (error: any) {
      return {
        totalVentas: 0,
        montoTotalVendido: 0,
        promedioPorVenta: 0
      };
    }
  }

  /**
   * Calcula métricas de cobros de deuda de un empleado.
   * Fuente ÚNICA: colección 'facturas_deudas'
   */
  async calcularMetricasCobros(
    usuarioId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<MetricasCobros> {
    try {
      const cobrosRef = collection(this.firestore, 'facturas_deudas');
      const q = query(
        cobrosRef,
        where('usuarioId', '==', usuarioId),
        where('fechaPago', '>=', Timestamp.fromDate(fechaInicio)),
        where('fechaPago', '<=', Timestamp.fromDate(fechaFin))
      );

      const snapshot = await getDocs(q);
      const cobros = snapshot.docs.map(doc => doc.data());

      const totalCobros = cobros.length;
      const montoCobrado = cobros.reduce((sum, c: any) => sum + (c.montoPagado || 0), 0);

      return {
        totalCobros,
        montoCobrado,
        cantidadCobros: totalCobros
      };
    } catch (error: any) {
      return {
        totalCobros: 0,
        montoCobrado: 0,
        cantidadCobros: 0
      };
    }
  }

  /**
   * Calcula pagos recibidos por el empleado.
   * Fuente ÚNICA: movimientos_cajas_banco (categoria = PAGO_TRABAJADOR)
   */
  async calcularMetricasPagos(
    usuarioId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<MetricasPagos> {
    try {
      const movimientosRef = collection(this.firestore, 'movimientos_cajas_banco');
      const q = query(
        movimientosRef,
        where('usuario_id', '==', usuarioId),
        where('categoria', '==', 'PAGO_TRABAJADOR'),
        where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
        where('fecha', '<=', Timestamp.fromDate(fechaFin))
      );

      const pagos: PagoEmpleado[] = [];
      let totalPagado = 0;

      const movimientos = await getDocs(q);
      movimientos.docs.forEach(doc => {
        const data = doc.data();
        const fecha = data['fecha']?.toDate ? data['fecha'].toDate() : new Date(data['fecha']);
        const monto = data['monto'] || 0;

        pagos.push({
          fecha,
          monto,
          referencia: data['referencia'],
          observacion: data['descripcion']
        });

        totalPagado += monto;
      });

      pagos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

      return {
        totalPagado,
        cantidadPagos: pagos.length,
        historialPagos: pagos
      };
    } catch (error: any) {
      return {
        totalPagado: 0,
        cantidadPagos: 0,
        historialPagos: []
      };
    }
  }

  /**
   * Calcula el resumen mensual completo de un empleado.
   * Combina las tres fuentes de datos SIN mezclarlas.
   */
  async calcularResumenMensual(
    usuarioId: string,
    year: number,
    month: number
  ): Promise<ResumenMensual> {
    const fechaInicio = new Date(year, month - 1, 1);
    const fechaFin = new Date(year, month, 0, 23, 59, 59);

    const [ventas, cobros, pagos] = await Promise.all([
      this.calcularMetricasVentas(usuarioId, fechaInicio, fechaFin),
      this.calcularMetricasCobros(usuarioId, fechaInicio, fechaFin),
      this.calcularMetricasPagos(usuarioId, fechaInicio, fechaFin)
    ]);

    const mesNombre = this.obtenerNombreMes(month, year);
    const mes = `${year}-${month.toString().padStart(2, '0')}`;

    return {
      mes,
      mesNombre,
      ventas,
      cobros,
      pagos
    };
  }

  /**
   * Calcula antigüedad del empleado en meses.
   */
  calcularAntiguedad(createdAt: any): { meses: number; texto: string } {
    if (!createdAt) {
      return { meses: 0, texto: 'Sin datos' };
    }

    const fechaCreacion = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const ahora = new Date();
    const diffMs = ahora.getTime() - fechaCreacion.getTime();
    const diffMeses = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));

    const años = Math.floor(diffMeses / 12);
    const meses = diffMeses % 12;

    let texto = '';
    if (años > 0) {
      texto += `${años} año${años > 1 ? 's' : ''}`;
      if (meses > 0) {
        texto += ` ${meses} mes${meses > 1 ? 'es' : ''}`;
      }
    } else {
      texto = `${meses} mes${meses > 1 ? 'es' : ''}`;
    }

    return { meses: diffMeses, texto };
  }

  /**
   * Calcula métricas globales del sistema.
   */
  async calcularMetricasGlobales(
    year: number,
    month: number,
    empleados: Usuario[]
  ): Promise<MetricaGlobal[]> {
    const fechaInicio = new Date(year, month - 1, 1);
    const fechaFin = new Date(year, month, 0, 23, 59, 59);

    // Total pagado a empleados
    let totalPagadoEmpleados = 0;
    for (const emp of empleados) {
      if (emp.id) {
        const pagos = await this.calcularMetricasPagos(emp.id, fechaInicio, fechaFin);
        totalPagadoEmpleados += pagos.totalPagado;
      }
    }

    // Empleado con más ventas
    let empleadoTopVentas: { nombre: string; ventas: number } = { nombre: '-', ventas: 0 };
    let empleadoMenorActividad: { nombre: string; ventas: number } = { nombre: '-', ventas: Infinity };

    for (const emp of empleados) {
      if (emp.id) {
        const ventas = await this.calcularMetricasVentas(emp.id, fechaInicio, fechaFin);
        
        if (ventas.totalVentas > empleadoTopVentas.ventas) {
          empleadoTopVentas = { nombre: emp.nombre, ventas: ventas.totalVentas };
        }

        if (ventas.totalVentas < empleadoMenorActividad.ventas) {
          empleadoMenorActividad = { nombre: emp.nombre, ventas: ventas.totalVentas };
        }
      }
    }

    const metricas: MetricaGlobal[] = [
      {
        titulo: 'Total Pagado a Empleados',
        valor: `$${totalPagadoEmpleados.toFixed(2)}`,
        subtitulo: 'Nómina del mes',
        tipo: 'info',
        icono: 'money'
      },
      {
        titulo: 'Empleado Top Ventas',
        valor: empleadoTopVentas.nombre,
        subtitulo: `${empleadoTopVentas.ventas} ventas`,
        tipo: 'success',
        icono: 'trophy'
      },
      {
        titulo: 'Menor Actividad',
        valor: empleadoMenorActividad.nombre !== '-' ? empleadoMenorActividad.nombre : 'N/A',
        subtitulo: empleadoMenorActividad.ventas !== Infinity ? `${empleadoMenorActividad.ventas} ventas` : '',
        tipo: 'warning',
        icono: 'alert'
      }
    ];

    return metricas;
  }

  /**
   * Genera ranking de empleados por ventas.
   */
  async generarRankingVentas(
    empleados: Usuario[],
    fechaInicio: Date,
    fechaFin: Date,
    limit: number = 5
  ): Promise<RankingItem[]> {
    const ranking: RankingItem[] = [];

    for (const emp of empleados) {
      if (emp.id) {
        const ventas = await this.calcularMetricasVentas(emp.id, fechaInicio, fechaFin);
        ranking.push({
          posicion: 0,
          empleadoId: emp.id,
          empleadoNombre: emp.nombre,
          valor: ventas.totalVentas,
          textoValor: `${ventas.totalVentas} ventas`,
          sucursal: emp.sucursal
        });
      }
    }

    // Ordenar por valor descendente
    ranking.sort((a, b) => b.valor - a.valor);

    // Asignar posiciones
    ranking.forEach((item, index) => {
      item.posicion = index + 1;
    });

    return ranking.slice(0, limit);
  }

  /**
   * Genera ranking de empleados por monto vendido.
   */
  async generarRankingMontoVendido(
    empleados: Usuario[],
    fechaInicio: Date,
    fechaFin: Date,
    limit: number = 5
  ): Promise<RankingItem[]> {
    const ranking: RankingItem[] = [];

    for (const emp of empleados) {
      if (emp.id) {
        const ventas = await this.calcularMetricasVentas(emp.id, fechaInicio, fechaFin);
        ranking.push({
          posicion: 0,
          empleadoId: emp.id,
          empleadoNombre: emp.nombre,
          valor: ventas.montoTotalVendido,
          textoValor: `$${ventas.montoTotalVendido.toFixed(2)}`,
          sucursal: emp.sucursal
        });
      }
    }

    // Ordenar por valor descendente
    ranking.sort((a, b) => b.valor - a.valor);

    // Asignar posiciones
    ranking.forEach((item, index) => {
      item.posicion = index + 1;
    });

    return ranking.slice(0, limit);
  }

  /**
   * Calcula historial mensual de un empleado (últimos N meses).
   */
  async calcularHistorialMensual(
    usuarioId: string,
    mesesAtras: number = 6
  ): Promise<ResumenMensual[]> {
    const historiales: ResumenMensual[] = [];
    const ahora = new Date();

    for (let i = 0; i < mesesAtras; i++) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const year = fecha.getFullYear();
      const month = fecha.getMonth() + 1;

      const resumen = await this.calcularResumenMensual(usuarioId, year, month);
      historiales.push(resumen);
    }

    return historiales.reverse(); // Más antiguos primero
  }

  /**
   * Obtiene nombre del mes en español.
   */
  private obtenerNombreMes(month: number, year: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${meses[month - 1]} ${year}`;
  }

  /**
   * Mapea rol numérico a texto legible.
   */
  mapearRolTexto(rol: number): string {
    return rol === 1 ? 'Administrador' : 'Operador / Vendedor';
  }
}
