/**
 * Componente para visualizar el dashboard clínico con métricas y análisis
 * de los historiales de un cliente.
 * 
 * Muestra:
 * - Tarjetas con KPIs (evolución, tipos de lente, tiempo entre visitas)
 * - Datos preparados para gráficos (línea, barras, donut)
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardClinico } from '../../../../core/services/analisis-clinico.service';

@Component({
  selector: 'app-dashboard-clinico',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-clinico.component.html',
  styleUrl: './dashboard-clinico.component.css'
})
export class DashboardClinicoComponent {
  @Input() dashboard: DashboardClinico | null = null;
  @Input() totalHistoriales: number = 0;

  /**
   * Obtiene las claves de tipos de lente para iterar en el template.
   */
  get tiposLenteKeys(): string[] {
    return this.dashboard?.tarjetas?.tiposLente
      ? Object.keys(this.dashboard.tarjetas.tiposLente)
      : [];
  }

  /**
   * Obtiene el valor de un tipo de lente específico.
   */
  getTipoLenteValue(tipo: string): number {
    return this.dashboard?.tarjetas?.tiposLente?.[tipo] ?? 0;
  }

  /**
   * Retorna el color de estado según la evolución.
   */
  getEstadoColor(estado: string): string {
    switch (estado) {
      case 'ESTABLE':
        return 'success';
      case 'PROGRESIVO':
        return 'warning';
      default:
        return 'secondary';
    }
  }

  /**
   * Retorna el icono de estado.
   */
  getEstadoIcon(estado: string): string {
    switch (estado) {
      case 'ESTABLE':
        return '✓';
      case 'PROGRESIVO':
        return '↗';
      default:
        return '−';
    }
  }
}
