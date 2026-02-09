/**
 * Servicio de análisis clínico para dashboard de historiales.
 * 
 * Genera métricas, KPIs y datos para gráficos a partir de un array de historiales clínicos.
 * Incluye cálculos de evolución de graduación, tipos de lente, estabilidad visual, etc.
 */

import { Injectable } from '@angular/core';
import { HistoriaClinica } from '../models/historia-clinica.model';

export interface DashboardClinico {
  tarjetas: {
    evolucionGraduacion: {
      valorPromedio: number;
      estado: 'ESTABLE' | 'PROGRESIVO' | 'NO APLICA';
    };
    tiposLente: Record<string, number>;
    tiempoPromedioEntreVisitasMeses: number;
  };
  graficos: {
    lineaGraduacion: Array<{
      fecha: string;
      od: number | null;
      oi: number | null;
    }>;
    barrasTiposLente: Array<{
      tipo: string;
      cantidad: number;
    }>;
    donutEstabilidad: Array<{
      tipo: 'ESTABLE' | 'PROGRESIVO';
      porcentaje: number;
    }>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AnalisisClinicoService {

  constructor() {}

  /**
   * Genera el dashboard clínico completo a partir de un array de historiales.
   * Los historiales deben estar ordenados por fecha ascendente (createdAt).
   */
  generarDashboard(historiales: HistoriaClinica[]): DashboardClinico {
    if (!historiales || historiales.length === 0) {
      return this.dashboardVacio();
    }

    if (historiales.length === 1) {
      return this.dashboardUnSoloHistorial(historiales[0]);
    }

    return {
      tarjetas: {
        evolucionGraduacion: this.calcularEvolucionGraduacion(historiales),
        tiposLente: this.calcularPorcentajesTiposLente(historiales),
        tiempoPromedioEntreVisitasMeses: this.calcularTiempoPromedioEntreVisitas(historiales)
      },
      graficos: {
        lineaGraduacion: this.generarDatosLineaGraduacion(historiales),
        barrasTiposLente: this.generarDatosBarrasTiposLente(historiales),
        donutEstabilidad: this.generarDatosDonutEstabilidad(historiales)
      }
    };
  }

  // ────────────────────────────────────────────────────────────
  // 🔹 CÁLCULO DE TARJETAS (KPIs)
  // ────────────────────────────────────────────────────────────

  /**
   * 1️⃣ Calcula la evolución promedio de graduación entre historiales consecutivos.
   * Usa el promedio de esfera OD y OI.
   */
  private calcularEvolucionGraduacion(historiales: HistoriaClinica[]): {
    valorPromedio: number;
    estado: 'ESTABLE' | 'PROGRESIVO' | 'NO APLICA';
  } {
    if (historiales.length < 2) {
      return { valorPromedio: 0, estado: 'NO APLICA' };
    }

    let sumaDiferencias = 0;
    let conteo = 0;

    for (let i = 1; i < historiales.length; i++) {
      const actual = historiales[i];
      const anterior = historiales[i - 1];

      // Calcular promedio de esfera OD y OI para cada historial
      const promedioActual = this.promedioEsfera(actual);
      const promedioAnterior = this.promedioEsfera(anterior);

      if (promedioActual !== null && promedioAnterior !== null) {
        const diferencia = Math.abs(promedioActual - promedioAnterior);
        sumaDiferencias += diferencia;
        conteo++;
      }
    }

    if (conteo === 0) {
      return { valorPromedio: 0, estado: 'NO APLICA' };
    }

    const promedio = sumaDiferencias / conteo;
    const estado = promedio <= 0.25 ? 'ESTABLE' : 'PROGRESIVO';

    return {
      valorPromedio: parseFloat(promedio.toFixed(2)),
      estado
    };
  }

  /**
   * 2️⃣ Calcula el porcentaje de cada tipo de lente.
   */
  private calcularPorcentajesTiposLente(historiales: HistoriaClinica[]): Record<string, number> {
    const conteo: Record<string, number> = {};
    const total = historiales.length;

    historiales.forEach(h => {
      const tipo = this.normalizarTipoLente(h.de);
      conteo[tipo] = (conteo[tipo] || 0) + 1;
    });

    // Convertir a porcentajes
    const porcentajes: Record<string, number> = {};
    for (const tipo in conteo) {
      porcentajes[tipo] = parseFloat(((conteo[tipo] / total) * 100).toFixed(1));
    }

    return porcentajes;
  }

  /**
   * 3️⃣ Calcula el tiempo promedio entre visitas en meses.
   */
  private calcularTiempoPromedioEntreVisitas(historiales: HistoriaClinica[]): number {
    if (historiales.length < 2) {
      return 0;
    }

    let sumaMeses = 0;
    let conteo = 0;

    for (let i = 1; i < historiales.length; i++) {
      const actual = this.parseFecha(historiales[i].createdAt);
      const anterior = this.parseFecha(historiales[i - 1].createdAt);

      if (actual && anterior) {
        const diferenciaMeses = this.diferenciaEnMeses(anterior, actual);
        sumaMeses += diferenciaMeses;
        conteo++;
      }
    }

    if (conteo === 0) {
      return 0;
    }

    return parseFloat((sumaMeses / conteo).toFixed(1));
  }

  // ────────────────────────────────────────────────────────────
  // 🔹 GENERACIÓN DE DATOS PARA GRÁFICOS
  // ────────────────────────────────────────────────────────────

  /**
   * 4️⃣ Gráfico de línea – Evolución de esfera OD y OI.
   */
  private generarDatosLineaGraduacion(historiales: HistoriaClinica[]): Array<{
    fecha: string;
    od: number | null;
    oi: number | null;
  }> {
    return historiales.map(h => ({
      fecha: this.formatearFechaGrafico(h.createdAt),
      od: h.odEsfera,
      oi: h.oiEsfera
    }));
  }

  /**
   * 5️⃣ Gráfico de barras – Conteo total de cada tipo de lente.
   */
  private generarDatosBarrasTiposLente(historiales: HistoriaClinica[]): Array<{
    tipo: string;
    cantidad: number;
  }> {
    const conteo: Record<string, number> = {};

    historiales.forEach(h => {
      const tipo = this.normalizarTipoLente(h.de);
      conteo[tipo] = (conteo[tipo] || 0) + 1;
    });

    return Object.entries(conteo)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  /**
   * 6️⃣ Gráfico donut – Estabilidad visual.
   */
  private generarDatosDonutEstabilidad(historiales: HistoriaClinica[]): Array<{
    tipo: 'ESTABLE' | 'PROGRESIVO';
    porcentaje: number;
  }> {
    const evolucion = this.calcularEvolucionGraduacion(historiales);

    if (evolucion.estado === 'NO APLICA') {
      return [
        { tipo: 'ESTABLE', porcentaje: 100 },
        { tipo: 'PROGRESIVO', porcentaje: 0 }
      ];
    }

    const esEstable = evolucion.estado === 'ESTABLE';

    return [
      { tipo: 'ESTABLE', porcentaje: esEstable ? 100 : 0 },
      { tipo: 'PROGRESIVO', porcentaje: esEstable ? 0 : 100 }
    ];
  }

  // ────────────────────────────────────────────────────────────
  // 🛠️ MÉTODOS AUXILIARES
  // ────────────────────────────────────────────────────────────

  /**
   * Calcula el promedio de esfera entre OD y OI.
   * Retorna null si ambos valores son null.
   */
  private promedioEsfera(historial: HistoriaClinica): number | null {
    const od = historial.odEsfera;
    const oi = historial.oiEsfera;

    if (od === null && oi === null) {
      return null;
    }

    if (od === null) return oi;
    if (oi === null) return od;

    return (od + oi) / 2;
  }

  /**
   * Normaliza el tipo de lente a categorías estándar.
   */
  private normalizarTipoLente(de: string): string {
    if (!de) return 'SIN ESPECIFICAR';

    const upper = de.toUpperCase().trim();

    if (upper.includes('MONOFOCAL')) return 'MONOFOCAL';
    if (upper.includes('BIFOCAL')) return 'BIFOCAL';
    if (upper.includes('PROGRESIVO')) return 'PROGRESIVO';
    if (upper.includes('MULTIFOCAL')) return 'MULTIFOCAL';

    return upper;
  }

  /**
   * Parsea createdAt (puede ser Date, Timestamp de Firestore, o string ISO).
   */
  private parseFecha(createdAt: any): Date | null {
    if (!createdAt) return null;

    // Si es Date
    if (createdAt instanceof Date) {
      return createdAt;
    }

    // Si es Firestore Timestamp
    if (createdAt.toDate && typeof createdAt.toDate === 'function') {
      return createdAt.toDate();
    }

    // Si es string ISO
    if (typeof createdAt === 'string') {
      const parsed = new Date(createdAt);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * Calcula la diferencia en meses entre dos fechas.
   */
  private diferenciaEnMeses(fecha1: Date, fecha2: Date): number {
    const meses = (fecha2.getFullYear() - fecha1.getFullYear()) * 12;
    return meses + (fecha2.getMonth() - fecha1.getMonth());
  }

  /**
   * Formatea una fecha para mostrar en gráficos (formato corto: DD/MM/YYYY).
   */
  private formatearFechaGrafico(createdAt: any): string {
    const fecha = this.parseFecha(createdAt);
    if (!fecha) return 'Sin fecha';

    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear();

    return `${dia}/${mes}/${año}`;
  }

  /**
   * Dashboard vacío cuando no hay historiales.
   */
  private dashboardVacio(): DashboardClinico {
    return {
      tarjetas: {
        evolucionGraduacion: {
          valorPromedio: 0,
          estado: 'NO APLICA'
        },
        tiposLente: {},
        tiempoPromedioEntreVisitasMeses: 0
      },
      graficos: {
        lineaGraduacion: [],
        barrasTiposLente: [],
        donutEstabilidad: [
          { tipo: 'ESTABLE', porcentaje: 100 },
          { tipo: 'PROGRESIVO', porcentaje: 0 }
        ]
      }
    };
  }

  /**
   * Dashboard para un solo historial (sin evolución).
   */
  private dashboardUnSoloHistorial(historial: HistoriaClinica): DashboardClinico {
    const tipo = this.normalizarTipoLente(historial.de);

    return {
      tarjetas: {
        evolucionGraduacion: {
          valorPromedio: 0,
          estado: 'NO APLICA'
        },
        tiposLente: {
          [tipo]: 100
        },
        tiempoPromedioEntreVisitasMeses: 0
      },
      graficos: {
        lineaGraduacion: [
          {
            fecha: this.formatearFechaGrafico(historial.createdAt),
            od: historial.odEsfera,
            oi: historial.oiEsfera
          }
        ],
        barrasTiposLente: [
          { tipo, cantidad: 1 }
        ],
        donutEstabilidad: [
          { tipo: 'ESTABLE', porcentaje: 100 },
          { tipo: 'PROGRESIVO', porcentaje: 0 }
        ]
      }
    };
  }
}
