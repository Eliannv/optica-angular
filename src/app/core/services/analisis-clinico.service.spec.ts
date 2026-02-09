/**
 * Tests unitarios para AnalisisClinicoService
 * 
 * Verifica que el servicio genera correctamente:
 * - Métricas de evolución de graduación
 * - Porcentajes de tipos de lente
 * - Tiempo promedio entre visitas
 * - Datos para gráficos
 */

import { TestBed } from '@angular/core/testing';
import { AnalisisClinicoService } from './analisis-clinico.service';
import { HistoriaClinica } from '../models/historia-clinica.model';

describe('AnalisisClinicoService', () => {
  let service: AnalisisClinicoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnalisisClinicoService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────
  // 🧪 PRUEBAS DE CASOS ESPECIALES
  // ──────────────────────────────────────────────────────────────

  it('debe retornar dashboard vacío con array vacío', () => {
    const dashboard = service.generarDashboard([]);
    
    expect(dashboard.tarjetas.evolucionGraduacion.estado).toBe('NO APLICA');
    expect(dashboard.tarjetas.evolucionGraduacion.valorPromedio).toBe(0);
    expect(dashboard.graficos.lineaGraduacion.length).toBe(0);
  });

  it('debe manejar un solo historial correctamente', () => {
    const historiales: HistoriaClinica[] = [
      {
        id: '1',
        clienteId: 'CLI001',
        odEsfera: -2.00,
        oiEsfera: -1.75,
        odCilindro: -0.50,
        oiCilindro: -0.25,
        odEje: 90,
        oiEje: 85,
        dp: 63,
        de: 'MONOFOCAL',
        altura: 20,
        color: 'Negro',
        observacion: '',
        createdAt: new Date('2024-01-15')
      }
    ];

    const dashboard = service.generarDashboard(historiales);

    expect(dashboard.tarjetas.evolucionGraduacion.estado).toBe('NO APLICA');
    expect(dashboard.tarjetas.evolucionGraduacion.valorPromedio).toBe(0);
    expect(dashboard.tarjetas.tiposLente['MONOFOCAL']).toBe(100);
    expect(dashboard.tarjetas.tiempoPromedioEntreVisitasMeses).toBe(0);
    expect(dashboard.graficos.lineaGraduacion.length).toBe(1);
  });

  // ──────────────────────────────────────────────────────────────
  // 🧪 PRUEBAS DE EVOLUCIÓN DE GRADUACIÓN
  // ──────────────────────────────────────────────────────────────

  it('debe calcular evolución ESTABLE correctamente', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-06-01'), -2.10, -2.15, 'MONOFOCAL')
    ];

    const dashboard = service.generarDashboard(historiales);
    const evolucion = dashboard.tarjetas.evolucionGraduacion;

    // Promedio hist1: (-2.00 + -2.00) / 2 = -2.00
    // Promedio hist2: (-2.10 + -2.15) / 2 = -2.125
    // Diferencia: |-2.00 - (-2.125)| = 0.125 ≤ 0.25 → ESTABLE

    expect(evolucion.estado).toBe('ESTABLE');
    expect(evolucion.valorPromedio).toBe(0.13); // Redondeado a 2 decimales
  });

  it('debe calcular evolución PROGRESIVA correctamente', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-06-01'), -2.50, -2.60, 'PROGRESIVO')
    ];

    const dashboard = service.generarDashboard(historiales);
    const evolucion = dashboard.tarjetas.evolucionGraduacion;

    // Promedio hist1: -2.00
    // Promedio hist2: (-2.50 + -2.60) / 2 = -2.55
    // Diferencia: |-2.00 - (-2.55)| = 0.55 > 0.25 → PROGRESIVO

    expect(evolucion.estado).toBe('PROGRESIVO');
    expect(evolucion.valorPromedio).toBe(0.55);
  });

  it('debe manejar valores null en esfera', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, null, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-06-01'), -2.25, null, 'MONOFOCAL')
    ];

    const dashboard = service.generarDashboard(historiales);
    const evolucion = dashboard.tarjetas.evolucionGraduacion;

    // Solo usa OD: |-2.00 - (-2.25)| = 0.25 → ESTABLE
    expect(evolucion.estado).toBe('ESTABLE');
    expect(evolucion.valorPromedio).toBe(0.25);
  });

  // ──────────────────────────────────────────────────────────────
  // 🧪 PRUEBAS DE TIPOS DE LENTE
  // ──────────────────────────────────────────────────────────────

  it('debe calcular porcentajes de tipos de lente correctamente', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-02-01'), -2.10, -2.10, 'MONOFOCAL'),
      crearHistorial('3', new Date('2024-03-01'), -2.20, -2.20, 'MONOFOCAL'),
      crearHistorial('4', new Date('2024-04-01'), -2.30, -2.30, 'PROGRESIVO'),
      crearHistorial('5', new Date('2024-05-01'), -2.40, -2.40, 'BIFOCAL')
    ];

    const dashboard = service.generarDashboard(historiales);
    const tipos = dashboard.tarjetas.tiposLente;

    expect(tipos['MONOFOCAL']).toBe(60); // 3/5 = 60%
    expect(tipos['PROGRESIVO']).toBe(20); // 1/5 = 20%
    expect(tipos['BIFOCAL']).toBe(20); // 1/5 = 20%
  });

  it('debe normalizar tipos de lente correctamente', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'monofocal'),
      crearHistorial('2', new Date('2024-02-01'), -2.10, -2.10, 'MONOFOCAL CR-39'),
      crearHistorial('3', new Date('2024-03-01'), -2.20, -2.20, 'Lente Monofocal')
    ];

    const dashboard = service.generarDashboard(historiales);
    const tipos = dashboard.tarjetas.tiposLente;

    // Todos deberían normalizarse a 'MONOFOCAL'
    expect(tipos['MONOFOCAL']).toBe(100);
  });

  // ──────────────────────────────────────────────────────────────
  // 🧪 PRUEBAS DE TIEMPO ENTRE VISITAS
  // ──────────────────────────────────────────────────────────────

  it('debe calcular tiempo promedio entre visitas correctamente', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-05-01'), -2.10, -2.10, 'MONOFOCAL'), // 4 meses
      crearHistorial('3', new Date('2024-11-01'), -2.20, -2.20, 'MONOFOCAL')  // 6 meses
    ];

    const dashboard = service.generarDashboard(historiales);

    // Promedio: (4 + 6) / 2 = 5 meses
    expect(dashboard.tarjetas.tiempoPromedioEntreVisitasMeses).toBe(5);
  });

  // ──────────────────────────────────────────────────────────────
  // 🧪 PRUEBAS DE DATOS PARA GRÁFICOS
  // ──────────────────────────────────────────────────────────────

  it('debe generar datos de línea de graduación correctamente', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-15'), -2.00, -1.75, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-05-20'), -2.25, -2.00, 'PROGRESIVO')
    ];

    const dashboard = service.generarDashboard(historiales);
    const linea = dashboard.graficos.lineaGraduacion;

    expect(linea.length).toBe(2);
    expect(linea[0].fecha).toBe('15/01/2024');
    expect(linea[0].od).toBe(-2.00);
    expect(linea[0].oi).toBe(-1.75);
    expect(linea[1].fecha).toBe('20/05/2024');
    expect(linea[1].od).toBe(-2.25);
    expect(linea[1].oi).toBe(-2.00);
  });

  it('debe generar datos de barras de tipos de lente correctamente', () => {
    const historiales: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-02-01'), -2.10, -2.10, 'MONOFOCAL'),
      crearHistorial('3', new Date('2024-03-01'), -2.20, -2.20, 'PROGRESIVO')
    ];

    const dashboard = service.generarDashboard(historiales);
    const barras = dashboard.graficos.barrasTiposLente;

    expect(barras.length).toBe(2);
    
    const monofocal = barras.find(b => b.tipo === 'MONOFOCAL');
    const progresivo = barras.find(b => b.tipo === 'PROGRESIVO');

    expect(monofocal?.cantidad).toBe(2);
    expect(progresivo?.cantidad).toBe(1);

    // Debe estar ordenado por cantidad descendente
    expect(barras[0].cantidad).toBeGreaterThanOrEqual(barras[1].cantidad);
  });

  it('debe generar datos de donut de estabilidad correctamente', () => {
    const historialesEstables: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-06-01'), -2.10, -2.10, 'MONOFOCAL')
    ];

    const dashboardEstable = service.generarDashboard(historialesEstables);
    const donutEstable = dashboardEstable.graficos.donutEstabilidad;

    expect(donutEstable.find(d => d.tipo === 'ESTABLE')?.porcentaje).toBe(100);
    expect(donutEstable.find(d => d.tipo === 'PROGRESIVO')?.porcentaje).toBe(0);

    const historialesProgresivos: HistoriaClinica[] = [
      crearHistorial('1', new Date('2024-01-01'), -2.00, -2.00, 'MONOFOCAL'),
      crearHistorial('2', new Date('2024-06-01'), -2.60, -2.60, 'PROGRESIVO')
    ];

    const dashboardProgresivo = service.generarDashboard(historialesProgresivos);
    const donutProgresivo = dashboardProgresivo.graficos.donutEstabilidad;

    expect(donutProgresivo.find(d => d.tipo === 'ESTABLE')?.porcentaje).toBe(0);
    expect(donutProgresivo.find(d => d.tipo === 'PROGRESIVO')?.porcentaje).toBe(100);
  });

  // ──────────────────────────────────────────────────────────────
  // 🛠️ HELPERS DE PRUEBA
  // ──────────────────────────────────────────────────────────────

  function crearHistorial(
    id: string,
    fecha: Date,
    odEsfera: number | null,
    oiEsfera: number | null,
    tipoLente: string
  ): HistoriaClinica {
    return {
      id,
      clienteId: 'TEST_CLIENT',
      odEsfera,
      oiEsfera,
      odCilindro: -0.50,
      oiCilindro: -0.25,
      odEje: 90,
      oiEje: 85,
      dp: 63,
      de: tipoLente,
      altura: 20,
      color: 'Negro',
      observacion: '',
      createdAt: fecha
    };
  }
});
