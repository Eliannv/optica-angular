import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { collection, query, getDocs, Firestore, where, orderBy, Timestamp } from '@angular/fire/firestore';

import { CobrosService } from '../../../../core/services/cobros.service';
import { ClientesService } from '../../../../core/services/clientes';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { Cobro } from '../../../../core/models/cobro.model';

/**
 * Componente de Reporte de Ventas Generales.
 * 
 * **Funcionalidades:**
 * - Reporte basado exclusivamente en registros de cobros de clientes
 * - Filtros por rango de fechas (Desde/Hasta)
 * - Filtros por tipo de documento/operación
 * - Impresión compatible con impresoras POS y normales
 * - Sin filtro de bodega (sistema de una sola bodega)
 * 
 * **Flujo:**
 * 1. Carga todos los cobros desde Firestore
 * 2. Aplica filtros de fecha y tipo seleccionados
 * 3. Muestra resultados en tabla
 * 4. Permite imprimir reporte con filtros aplicados
 */
@Component({
  selector: 'app-ventas-generales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas-generales.html',
  styleUrl: './ventas-generales.css'
})
export class VentasGeneralesComponent implements OnInit, OnDestroy {
  loading = true;
  cobros: Cobro[] = [];
  cobrosFiltrados: any[] = []; // Puede contener Cobros o Egresos
  movimientosCajaChica: any[] = []; // Movimientos de caja chica
  registrosCombinados: any[] = []; // Cobros + Egresos combinados
  
  // Filtros
  fechaDesde = '';
  fechaHasta = '';
  tiposSeleccionados: string[] = []; // Array para múltiples selecciones
  
  // Opciones de tipos disponibles
  tiposDisponibles = [
    { valor: 'ORDEN_TRABAJO', label: 'Orden de Trabajo' },
    { valor: 'ORDEN_SIN_HISTORIA', label: 'Orden Sin Historia' },
    { valor: 'PAGOS', label: 'Pagos (Efectivo)' },
    { valor: 'TARJETA', label: 'Tarjeta de Crédito/Débito' },
    { valor: 'TRANSFERENCIAS', label: 'Transferencias' },
    { valor: 'EGRESO', label: 'Egreso' }
  ];

  // Totales
  totalCobrado = 0;
  cantidadRegistros = 0;
  totalesPorMetodo: { [key: string]: number } = {};
  totalesPorTipo: { [key: string]: number } = {};

  private subscription?: Subscription;

  constructor(
    private cobrosService: CobrosService,
    private clientesService: ClientesService,
    private cajaChicaService: CajaChicaService,
    private firestore: Firestore,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Establecer fechas por defecto: primer día del mes actual hasta hoy
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    // Formatear fechas a formato YYYY-MM-DD requerido por input type="date"
    this.fechaDesde = this.formatearFechaInput(primerDiaMes);
    this.fechaHasta = this.formatearFechaInput(hoy);
    
    this.cargarCobros();
  }

  /**
   * Formatea una fecha a formato YYYY-MM-DD para input type="date"
   */
  private formatearFechaInput(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Alterna la selección de un tipo en el array de tipos seleccionados.
   */
  toggleTipo(tipo: string): void {
    const index = this.tiposSeleccionados.indexOf(tipo);
    if (index > -1) {
      // Si ya está seleccionado, quitarlo
      this.tiposSeleccionados.splice(index, 1);
    } else {
      // Si no está seleccionado, agregarlo
      this.tiposSeleccionados.push(tipo);
    }
  }

  /**
   * Verifica si un tipo está seleccionado.
   */
  isTipoSeleccionado(tipo: string): boolean {
    return this.tiposSeleccionados.includes(tipo);
  }

  /**
   * Carga cobros y movimientos de caja chica CON FILTRO DE FECHAS
   * 🎯 OPTIMIZADO: Carga solo el período seleccionado
   */
  cargarCobros(): void {
    this.loading = true;

    // 🎯 Usar filtro de fechas DENTRO del query de Firestore
    const fechaDesde = new Date(this.fechaDesde);
    const fechaHasta = new Date(this.fechaHasta);
    fechaHasta.setHours(23, 59, 59, 999); // Incluir todo el día final

    // Cargar cobros del período
    this.subscription = this.cobrosService.getCobrosEnRangoOptimizado(fechaDesde, fechaHasta).subscribe({
      next: (cobros) => {
        this.cobros = cobros;
        
        // Cargar movimientos de caja chica del período
        const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
        const q = query(
          movimientosRef,
          where('fecha', '>=', Timestamp.fromDate(fechaDesde)),
          where('fecha', '<=', Timestamp.fromDate(fechaHasta))
        );
        
        getDocs(q).then(snapshot => {
          this.movimientosCajaChica = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Ordenar movimientos por fecha DESC en memoria
          this.movimientosCajaChica.sort((a, b) => {
            const fechaA = a.fecha?.toDate?.() || new Date(a.fecha);
            const fechaB = b.fecha?.toDate?.() || new Date(b.fecha);
            return fechaB.getTime() - fechaA.getTime();
          });
          
          this.loading = false;
          console.log('✅ Cobros cargados:', this.cobros.length);
          console.log('✅ Movimientos caja chica cargados:', this.movimientosCajaChica.length);
          console.log('📊 Ejemplo movimientos:', this.movimientosCajaChica.slice(0, 3));
          
          // Contar egresos
          const egresos = this.movimientosCajaChica.filter(m => m.tipo === 'EGRESO');
          console.log('💰 Total egresos:', egresos.length);
          if (egresos.length > 0) {
            console.log('📋 Ejemplo egresos:', egresos.slice(0, 3));
          }
        }).catch(error => {
          console.error('❌ Error cargando movimientos de caja chica:', error);
          // Continuar sin movimientos de caja chica
          this.movimientosCajaChica = [];
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('Error cargando cobros:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los datos. Intente nuevamente.'
        });
        this.loading = false;
      }
    });
  }

  /**
   * Aplica los filtros seleccionados a la lista de cobros y movimientos de caja chica.
   * Se ejecuta al presionar el botón "Mostrar".
   */
  aplicarFiltros(): void {
    if (!this.fechaDesde || !this.fechaHasta) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas Requeridas',
        text: 'Por favor seleccione las fechas DESDE y HASTA para generar el reporte.'
      });
      return;
    }

    console.log('🔍 Aplicando filtros...');
    console.log('📅 Fecha DESDE:', this.fechaDesde);
    console.log('📅 Fecha HASTA:', this.fechaHasta);
    console.log('📊 Total cobros disponibles:', this.cobros.length);
    console.log('📊 Total movimientos caja chica:', this.movimientosCajaChica.length);

    const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
    const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);

    console.log('🕐 Filtro DESDE:', diaDesde, '/', mesDesde, '/', añoDesde);
    console.log('🕐 Filtro HASTA:', diaHasta, '/', mesHasta, '/', añoHasta);

    // ========== FILTRAR COBROS ==========
    let resultadoCobros = [...this.cobros];

    resultadoCobros = resultadoCobros.filter(c => {
      // Convertir Timestamp de Firestore a Date
      let fechaCobro: Date;
      if (c.fecha && (c.fecha as any).toDate) {
        fechaCobro = (c.fecha as any).toDate();
      } else if (c.fecha instanceof Date) {
        fechaCobro = c.fecha;
      } else {
        fechaCobro = new Date(c.fecha);
      }
      
      const añoCobro = fechaCobro.getFullYear();
      const mesCobro = fechaCobro.getMonth() + 1;
      const diaCobro = fechaCobro.getDate();
      
      const fechaCobroNum = añoCobro * 10000 + mesCobro * 100 + diaCobro;
      const fechaDesdeNum = añoDesde * 10000 + mesDesde * 100 + diaDesde;
      const fechaHastaNum = añoHasta * 10000 + mesHasta * 100 + diaHasta;
      
      return fechaCobroNum >= fechaDesdeNum && fechaCobroNum <= fechaHastaNum;
    });

    console.log('✅ Cobros después de filtro de fecha:', resultadoCobros.length);

    // ========== FILTRAR EGRESOS DE CAJA CHICA ==========
    let egresos: any[] = [];
    
    // Si EGRESO está seleccionado o no hay tipos seleccionados (mostrar todos)
    const mostrarEgresos = this.tiposSeleccionados.length === 0 || this.tiposSeleccionados.includes('EGRESO');
    
    console.log('🔍 Mostrar egresos?', mostrarEgresos);
    console.log('🔍 Movimientos caja chica disponibles:', this.movimientosCajaChica.length);
    
    if (mostrarEgresos) {
      // Primero filtrar por tipo EGRESO
      const egresosDisponibles = this.movimientosCajaChica.filter(m => m.tipo === 'EGRESO');
      console.log('💰 Egresos totales disponibles:', egresosDisponibles.length);
      
      egresos = egresosDisponibles
        .filter(m => {
          // Convertir Timestamp de Firestore a Date
          let fechaMovimiento: Date;
          if (m.fecha && (m.fecha as any).toDate) {
            fechaMovimiento = (m.fecha as any).toDate();
          } else if (m.fecha instanceof Date) {
            fechaMovimiento = m.fecha;
          } else {
            fechaMovimiento = new Date(m.fecha);
          }
          
          const añoMov = fechaMovimiento.getFullYear();
          const mesMov = fechaMovimiento.getMonth() + 1;
          const diaMov = fechaMovimiento.getDate();
          
          const fechaMovNum = añoMov * 10000 + mesMov * 100 + diaMov;
          const fechaDesdeNum = añoDesde * 10000 + mesDesde * 100 + diaDesde;
          const fechaHastaNum = añoHasta * 10000 + mesHasta * 100 + diaHasta;
          
          const cumpleFiltro = fechaMovNum >= fechaDesdeNum && fechaMovNum <= fechaHastaNum;
          
          if (cumpleFiltro) {
            console.log('✅ Egreso aceptado:', diaMov + '/' + mesMov + '/' + añoMov, 'Descripción:', m.descripcion, 'Monto:', m.monto);
          }
          
          return cumpleFiltro;
        })
        .map(m => ({
          ...m,
          esEgreso: true, // Marca para identificar egresos en la tabla
          clienteNombre: m.descripcion || 'Egreso', // Usar descripción como nombre
          monto: m.monto,
          fecha: m.fecha
        }));
      
      console.log('✅ Egresos después de filtro de fecha:', egresos.length);
    }

    // ========== FILTRAR POR TIPO (SOLO COBROS) ==========
    if (this.tiposSeleccionados.length > 0) {
      // Si EGRESO está seleccionado, excluirlo del filtro de cobros
      const tiposCobros = this.tiposSeleccionados.filter(t => t !== 'EGRESO');
      
      if (tiposCobros.length > 0) {
        // Hay tipos de cobros seleccionados, filtrar
        resultadoCobros = resultadoCobros.filter(c => tiposCobros.includes(this.clasificarTipoCobro(c)));
        console.log('✅ Tipos seleccionados para cobros:', tiposCobros);
        console.log('✅ Cobros después de filtro de tipo:', resultadoCobros.length);
      } else {
        // Solo se seleccionó EGRESO, no mostrar cobros
        resultadoCobros = [];
        console.log('✅ Solo EGRESO seleccionado, ocultando todos los cobros');
      }
    } else {
      console.log('ℹ️ No hay tipos seleccionados, mostrando todos');
    }

    // ========== COMBINAR COBROS Y EGRESOS ==========
    this.cobrosFiltrados = [...resultadoCobros, ...egresos];
    
    // Ordenar por fecha (más reciente primero)
    this.cobrosFiltrados.sort((a, b) => {
      const fechaA = this.obtenerFechaDate(a.fecha);
      const fechaB = this.obtenerFechaDate(b.fecha);
      return fechaB.getTime() - fechaA.getTime();
    });
    
    this.calcularTotales();
    
    console.log('💰 Total combinado (cobros + egresos):', this.totalCobrado);
    console.log('📋 Registros finales:', this.cobrosFiltrados.length);
  }

  /**
   * Convierte un Timestamp de Firestore o Date a objeto Date
   */
  private obtenerFechaDate(fecha: any): Date {
    if (fecha && (fecha as any).toDate) {
      return (fecha as any).toDate();
    } else if (fecha instanceof Date) {
      return fecha;
    } else {
      return new Date(fecha);
    }
  }

  /**
   * Clasifica un cobro según su tipo.
   * Criterios:
   * - TRANSFERENCIAS: Cobros con transferencia bancaria
   * - TARJETA: Cobros con tarjeta de crédito/débito
   * - PAGOS: Cobros en efectivo
   * - ORDEN_TRABAJO: Cobros con historial clínico (esCredito)
   * - ORDEN_SIN_HISTORIA: Cobros sin historial clínico
   * - EGRESO: (reservado para futura implementación)
   */
  private clasificarTipoCobro(cobro: Cobro): string {
    // Primero clasificar por método de pago
    if (cobro.metodoPago === 'Transferencia') {
      return 'TRANSFERENCIAS';
    } else if (cobro.metodoPago === 'Tarjeta') {
      return 'TARJETA';
    } else if (cobro.metodoPago === 'Efectivo') {
      return 'PAGOS';
    }
    
    // Si no es ninguno de los anteriores, clasificar por características del cobro
    const tieneHistorial = cobro.esCredito !== undefined;
    
    if (tieneHistorial && cobro.esCredito) {
      return 'ORDEN_TRABAJO';
    } else if (!tieneHistorial) {
      return 'ORDEN_SIN_HISTORIA';
    }
    
    return 'ORDEN_TRABAJO'; // Default
  }

  /**
   * Obtiene la etiqueta legible del tipo de cobro o egreso.
   */
  getTipoCobroLabel(cobro: any): string {
    // Si es un egreso de caja chica
    if (cobro.esEgreso) {
      return 'Egreso';
    }
    
    // Si es un cobro normal, clasificar por tipo
    const tipo = this.clasificarTipoCobro(cobro);
    const labels: { [key: string]: string } = {
      'ORDEN_TRABAJO': 'Orden de Trabajo',
      'ORDEN_SIN_HISTORIA': 'Orden Sin Historia',
      'PAGOS': 'Pago Efectivo',
      'TARJETA': 'Tarjeta Crédito/Débito',
      'TRANSFERENCIAS': 'Transferencia',
      'EGRESO': 'Egreso'
    };
    return labels[tipo] || tipo;
  }

  /**
   * Calcula totales y estadísticas de los cobros filtrados.
   * Los egresos se suman normalmente (pero se mostrarán como negativos en la UI).
   */
  calcularTotales(): void {
    // Total combinado (cobros - egresos)
    this.totalCobrado = this.cobrosFiltrados.reduce((sum, c) => {
      return c.esEgreso ? sum - c.monto : sum + c.monto;
    }, 0);
    
    this.cantidadRegistros = this.cobrosFiltrados.length;

    // Agrupar por método de pago (solo cobros)
    const soloCobros = this.cobrosFiltrados.filter(c => !c.esEgreso);
    this.totalesPorMetodo = this.cobrosService.agruparPorMetodoPago(soloCobros);
    
    // Agregar egresos como categoría separada
    const totalEgresos = this.cobrosFiltrados
      .filter(c => c.esEgreso)
      .reduce((sum, c) => sum + c.monto, 0);
    
    if (totalEgresos > 0) {
      this.totalesPorMetodo['Egresos'] = totalEgresos;
    }

    // Agrupar por tipo de documento
    this.totalesPorTipo = {};
    this.cobrosFiltrados.forEach(c => {
      const tipo = c.esEgreso ? 'EGRESO' : this.clasificarTipoCobro(c);
      this.totalesPorTipo[tipo] = (this.totalesPorTipo[tipo] || 0) + c.monto;
    });
  }

  /**
   * Limpia todos los filtros aplicados.
   */
  limpiarFiltros(): void {
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.tiposSeleccionados = [];
    this.cobrosFiltrados = [];
    this.totalCobrado = 0;
    this.cantidadRegistros = 0;
    this.totalesPorMetodo = {};
    this.totalesPorTipo = {};
  }

  /**
   * Formatea una fecha a string legible.
   */
  formatoFecha(fecha: Date | any): string {
    if (!fecha) return '-';
    
    let f: Date;
    if (fecha.toDate) {
      // Es un Timestamp de Firestore
      f = fecha.toDate();
    } else if (fecha instanceof Date) {
      f = fecha;
    } else {
      f = new Date(fecha);
    }
    
    return f.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatea un monto como moneda.
   */
  formatoMoneda(monto: number): string {
    return `$${monto.toFixed(2)}`;
  }

  /**
   * Genera e imprime el reporte de ventas generales.
   */
  imprimirReporte(): void {
    if (this.cobrosFiltrados.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin Datos',
        text: 'No hay registros para imprimir. Aplique filtros y presione "Mostrar" primero.'
      });
      return;
    }

    const htmlReporte = this.generarHTMLReporte();
    const ventana = window.open('', 'PRINT', 'height=800,width=900');
    
    if (!ventana) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir la ventana de impresión. Verifique que no esté bloqueada por el navegador.'
      });
      return;
    }

    ventana.document.write(htmlReporte);
    ventana.document.close();
    
    ventana.addEventListener('load', () => {
      ventana.focus();
      ventana.print();
      
      ventana.addEventListener('afterprint', () => {
        ventana.close();
      });
    });
  }

  /**
   * Genera el HTML del reporte para impresión.
   * Compatible con impresoras POS y normales.
   */
  private generarHTMLReporte(): string {
    const fechaReporte = new Date().toLocaleString('es-ES');
    
    // Descripción de filtros aplicados
    const filtrosAplicados: string[] = [];
    
    // ✅ Convertir fechas sin desfase de zona horaria
    if (this.fechaDesde) {
      const [año, mes, dia] = this.fechaDesde.split('-');
      filtrosAplicados.push(`Desde: ${dia}/${mes}/${año}`);
    }
    if (this.fechaHasta) {
      const [año, mes, dia] = this.fechaHasta.split('-');
      filtrosAplicados.push(`Hasta: ${dia}/${mes}/${año}`);
    }
    
    if (this.tiposSeleccionados.length > 0) {
      const tipoLabels: { [key: string]: string } = {
        'ORDEN_TRABAJO': 'Orden de Trabajo',
        'ORDEN_SIN_HISTORIA': 'Orden Sin Historia',
        'PAGOS': 'Pagos',
        'TARJETA': 'Tarjeta Crédito/Débito',
        'TRANSFERENCIAS': 'Transferencias',
        'EGRESO': 'Egreso'
      };
      const tiposTexto = this.tiposSeleccionados.map(t => tipoLabels[t] || t).join(', ');
      filtrosAplicados.push(`Tipos: ${tiposTexto}`);
    }

    const filtrosTexto = filtrosAplicados.length > 0 
      ? `<div class="filtros">${filtrosAplicados.join(' | ')}</div>`
      : '';

    // Generar filas de la tabla
    const filas = this.cobrosFiltrados.map(cobro => {
      // Si es un egreso, mostrar diferente
      if (cobro.esEgreso) {
        return `
          <tr class="fila-egreso" style="background-color: #ffe0e0;">
            <td>${this.formatoFecha(cobro.fecha)}</td>
            <td style="color: #d00; font-weight: bold;">EGRESO</td>
            <td>${cobro.clienteNombre}</td>
            <td>${this.getTipoCobroLabel(cobro)}</td>
            <td>Caja Chica</td>
            <td class="text-right" style="color: #d00;">-${this.formatoMoneda(cobro.monto)}</td>
            <td class="text-right">-</td>
            <td class="text-center">-</td>
          </tr>
        `;
      }
      
      // Si es un cobro normal
      return `
        <tr>
          <td>${this.formatoFecha(cobro.fecha)}</td>
          <td>${cobro.facturaIdPersonalizado || cobro.facturaId || '-'}</td>
          <td>${cobro.clienteNombre}</td>
          <td>${this.getTipoCobroLabel(cobro)}</td>
          <td>${cobro.metodoPago}</td>
          <td class="text-right">${this.formatoMoneda(cobro.monto)}</td>
          <td class="text-right">${this.formatoMoneda(cobro.saldoPendiente || 0)}</td>
          <td class="text-center">${cobro.esCredito ? 'Sí' : 'No'}</td>
        </tr>
      `;
    }).join('');

    // Generar filas de totales por método
    const totalesMetodo = Object.entries(this.totalesPorMetodo)
      .map(([metodo, total]) => `
        <div class="total-item">
          <span>${metodo}:</span>
          <span class="total-value">${this.formatoMoneda(total)}</span>
        </div>
      `).join('');

    // Generar filas de totales por tipo
    const totalesTipo = Object.entries(this.totalesPorTipo)
      .map(([tipo, total]) => {
        const labels: { [key: string]: string } = {
          'ORDEN_TRABAJO': 'Órdenes de Trabajo',
          'ORDEN_SIN_HISTORIA': 'Órdenes Sin Historia',
          'PAGOS': 'Pagos Efectivo',
          'TARJETA': 'Tarjeta Crédito/Débito',
          'TRANSFERENCIAS': 'Transferencias',
          'EGRESO': 'Egresos'
        };
        return `
        <div class="total-item">
          <span>${labels[tipo] || tipo}:</span>
          <span class="total-value">${this.formatoMoneda(total)}</span>
        </div>
      `;
      }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Ventas Generales</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 10px; 
            font-size: 10px;
            color: #000;
            background: #fff;
          }
          .header { 
            text-align: center; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #000; 
            padding-bottom: 10px; 
          }
          .header h1 { 
            font-size: 16px; 
            margin-bottom: 3px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .header .empresa { 
            font-size: 12px; 
            font-weight: bold;
            margin-bottom: 2px;
          }
          .header .subtitulo { 
            font-size: 10px;
          }
          .fecha-reporte { 
            text-align: right; 
            font-size: 8px;
            margin-bottom: 10px; 
          }
          .filtros { 
            background: #f5f5f5; 
            padding: 6px; 
            margin-bottom: 12px; 
            font-size: 9px; 
            border-left: 2px solid #000;
            border: 1px solid #000;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15px; 
          }
          th { 
            background: #000; 
            color: #fff; 
            padding: 6px 4px; 
            text-align: left; 
            font-size: 9px;
            border: 1px solid #000;
          }
          td { 
            padding: 5px 4px; 
            border: 1px solid #000; 
            font-size: 9px; 
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .resumen { 
            border: 2px solid #000; 
            padding: 10px; 
            margin-top: 15px; 
          }
          .resumen h3 { 
            font-size: 11px; 
            margin-bottom: 8px; 
            border-bottom: 1px solid #000; 
            padding-bottom: 4px;
            text-transform: uppercase;
          }
          .resumen-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 8px; 
          }
          .resumen-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 3px 0;
            font-size: 9px;
          }
          .resumen-item.total { 
            font-weight: bold; 
            font-size: 11px; 
            border-top: 2px solid #000; 
            padding-top: 6px; 
            margin-top: 4px; 
          }
          .total-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 3px 0; 
            font-size: 9px; 
          }
          .total-value { 
            font-weight: bold;
          }
          @media print {
            @page { 
              margin: 0.5cm; 
              size: auto;
            }
            body { padding: 0; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="empresa">ÓPTICA MACÍAS PASAJE</div>
          <h1>REPORTE DE VENTAS GENERALES</h1>
          <div class="subtitulo">Basado en Cobros de Clientes</div>
        </div>

        <div class="fecha-reporte">
          Generado: ${fechaReporte}
        </div>

        ${filtrosTexto}

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Factura/Orden</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Método Pago</th>
              <th class="text-right">Cobrado</th>
              <th class="text-right">Saldo</th>
              <th class="text-center">Crédito</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>

        <div class="resumen">
          <h3>RESUMEN</h3>
          <div class="resumen-grid">
            <div>
              <div class="resumen-item">
                <span>Total Registros:</span>
                <span>${this.cantidadRegistros}</span>
              </div>
              <h4 style="font-size: 10px; margin: 6px 0 4px 0; font-weight: bold;">Por Método de Pago:</h4>
              ${totalesMetodo}
            </div>
            <div>
              <h4 style="font-size: 10px; margin-bottom: 4px; font-weight: bold;">Por Tipo de Documento:</h4>
              ${totalesTipo}
            </div>
          </div>
          <div class="resumen-item total">
            <span>TOTAL COBRADO:</span>
            <span>${this.formatoMoneda(this.totalCobrado)}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Navega de regreso al inicio.
   */
  volver(): void {
    this.router.navigate(['/']);
  }
}
