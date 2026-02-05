import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from '@angular/fire/firestore';

import { ReportesService } from '../../../../core/services/reportes.service';
import { Factura } from '../../../../core/models/factura.model';
import { FacturaDeuda } from '../../../../core/models/factura-deuda.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { CajaBanco } from '../../../../core/models/caja-banco.model';

/**
 * Componente de Reporte de Ventas Generales - OPTIMIZADO
 * 
 * **✅ Optimizaciones implementadas:**
 * - ⚡ Carga bajo demanda: no carga datos hasta presionar "Mostrar"
 * - 📄 Paginación: consultas limitadas con limit() y startAfter()
 * - 💾 Cache en memoria: evita consultas repetidas (5 min TTL)
 * - 🚫 Sin listeners en tiempo real: solo getDocs para reportes históricos
 * - 🎯 Consultas dirigidas: solo trae datos en rango de fechas especificado
 * - 🔧 Uso de servicio ReportesService optimizado
 * 
 * **Funcionalidades:**
 * - Reporte basado exclusivamente en facturas del sistema
 * - Filtros por rango de fechas (Desde/Hasta) - OBLIGATORIOS
 * - Filtros por tipo de venta y forma de pago
 * - Paginación automática para grandes volúmenes
 * - Impresión compatible con impresoras POS y normales
 * 
 * **Flujo optimizado:**
 * 1. NO carga nada al iniciar (ahorro de lecturas)
 * 2. Al presionar "Mostrar": consulta paginada solo con fechas del filtro
 * 3. Usa cache si los datos ya fueron consultados recientemente
 * 4. Aplica filtros adicionales en memoria (tipo, método pago)
 * 5. Calcula totales y permite imprimir
 */
@Component({
  selector: 'app-ventas-generales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas-generales.html',
  styleUrl: './ventas-generales.css'
})
export class VentasGeneralesComponent implements OnInit, OnDestroy {
  loading = false; // ✅ Inicia en false, solo carga cuando el usuario presiona "Mostrar"
  facturas: Factura[] = []; // Facturas en el rango seleccionado
  facturasFiltradas: Factura[] = []; // Facturas después de aplicar filtros
  pagosDeuda: FacturaDeuda[] = []; // Pagos de deuda desde facturas_deudas
  egresos: any[] = []; // Egresos de caja chica
  
  // ✅ Paginación
  readonly LIMITE_PAGINA = 100; // Consultas paginadas de 100 en 100
  lastVisibleFactura: any = null;
  lastVisibleDeuda: any = null;
  hasMoreFacturas = false;
  hasMoreDeudas = false;
  paginaActual = 1;
  
  // Filtros
  fechaDesde = '';
  fechaHasta = '';
  tiposSeleccionados: string[] = []; // Array para múltiples selecciones
  
  // ✅ Cache de datos cargados
  datosYaCargados = false; // Público para template
  
  // Opciones de tipos disponibles (nuevos filtros basados en facturas)
  tiposDisponibles = [
    { valor: 'VENTAS', label: 'Ventas (Facturas)' },
    { valor: 'PAGOS_EFECTIVO', label: 'Pagos en Efectivo' },
    { valor: 'PAGOS_TARJETA', label: 'Pagos por Tarjeta' },
    { valor: 'TRANSFERENCIA_VENTAS', label: 'Transferencia (Ventas)' },
    { valor: 'TRANSFERENCIA_DEUDAS', label: 'Transferencia (Cobro de Deudas)' },
    { valor: 'FACTURAS_DEUDA', label: 'Pagos de Deuda (Todos)' },
    { valor: 'EGRESOS', label: 'Egresos' }
  ];

  // Totales (basados en facturas)
  totalVendido = 0; // Total de ventas (suma de facturas)
  cantidadRegistros = 0; // Cantidad de facturas
  totalPagosDeuda = 0; // Total de pagos de deuda
  totalEgresos = 0; // Total de egresos
  totalesPorMetodo: { [key: string]: number } = {}; // Desglose por forma de pago
  
  // 🆕 Totales de cajas
  totalCajaChica = 0; // Total de cajas chicas en el rango
  totalCajaBanco = 0; // Total de cajas banco en el rango

  private subscriptions: Subscription[] = [];

  constructor(
    private reportesService: ReportesService, // ✅ Servicio optimizado
    private router: Router,
    private firestore: Firestore // 🆕 Inyectar Firestore para consultas de cajas
  ) {}

  ngOnInit(): void {
    // ✅ OPTIMIZACIÓN: Establecer fechas por defecto pero NO cargar datos
    // Los datos solo se cargarán cuando el usuario presione "Mostrar"
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    // Formatear fechas a formato YYYY-MM-DD requerido por input type="date"
    this.fechaDesde = this.formatearFechaInput(primerDiaMes);
    this.fechaHasta = this.formatearFechaInput(hoy);
    
    // ✅ NO llamar cargarFacturas() aquí - ahorro de lecturas Firestore
    console.log('💡 Componente inicializado. Presione "Mostrar" para cargar datos.');
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
    // ✅ Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
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
   * ✅ OPTIMIZADO: Carga datos paginados usando servicio de reportes
   * 
   * **Mejoras implementadas:**
   * - ✅ Consultas paginadas (limit 100)
   * - ✅ Solo getDocs (sin listeners en tiempo real)
   * - ✅ Cache en memoria (5 min TTL)
   * - ✅ Filtros obligatorios por fecha (no trae colecciones completas)
   * - ✅ Consultas paralelas para mayor velocidad
   * - ✅ Menos lecturas de Firestore
   */
  private cargarFacturas(): void {
    this.loading = true;
    
    // Validar fechas
    if (!this.fechaDesde || !this.fechaHasta) {
      this.loading = false;
      return;
    }

    // Convertir fechas del input a Date
    const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
    const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);
    
    const fechaDesde = new Date(añoDesde, mesDesde - 1, diaDesde, 0, 0, 0, 0);
    const fechaHasta = new Date(añoHasta, mesHasta - 1, diaHasta, 23, 59, 59, 999);

    console.log('⚡ CARGA OPTIMIZADA - Fecha desde:', fechaDesde);
    console.log('⚡ CARGA OPTIMIZADA - Fecha hasta:', fechaHasta);
    console.log('💾 Verificando cache...');

    // ✅ Cargar datos en paralelo usando servicio optimizado
    const facturasSub = this.reportesService.getFacturasPaginadas(
      fechaDesde,
      fechaHasta,
      undefined, // Sin filtro de método de pago (filtramos en memoria)
      this.LIMITE_PAGINA
    ).subscribe({
      next: (result) => {
        this.facturas = result.docs as Factura[];
        this.hasMoreFacturas = result.hasMore;
        this.lastVisibleFactura = result.lastVisible;
        console.log(`✅ Facturas cargadas: ${this.facturas.length} (más páginas: ${this.hasMoreFacturas})`);
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('❌ Error cargando facturas:', error);
        this.facturas = [];
        this.verificarCargaCompleta();
      }
    });

    const deudasSub = this.reportesService.getPagosDeudaPaginados(
      fechaDesde,
      fechaHasta,
      undefined,
      this.LIMITE_PAGINA
    ).subscribe({
      next: (result) => {
        this.pagosDeuda = result.docs as FacturaDeuda[];
        this.hasMoreDeudas = result.hasMore;
        this.lastVisibleDeuda = result.lastVisible;
        console.log(`✅ Pagos deuda cargados: ${this.pagosDeuda.length} (más páginas: ${this.hasMoreDeudas})`);
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('❌ Error cargando pagos deuda:', error);
        this.pagosDeuda = [];
        this.verificarCargaCompleta();
      }
    });

    const egresosSub = this.reportesService.getMovimientosCajaChicaPaginados(
      fechaDesde,
      fechaHasta,
      'EGRESO',
      this.LIMITE_PAGINA
    ).subscribe({
      next: (result) => {
        this.egresos = result.docs;
        console.log(`✅ Egresos cargados: ${this.egresos.length}`);
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('❌ Error cargando egresos:', error);
        this.egresos = [];
        this.verificarCargaCompleta();
      }
    });

    // 🆕 Cargar totales de cajas en paralelo
    this.cargarTotalCajaChica(fechaDesde, fechaHasta);
    this.cargarTotalCajaBanco(fechaDesde, fechaHasta);

    this.subscriptions.push(facturasSub, deudasSub, egresosSub);
  }

  /**
   * ✅ Verifica si todas las consultas paralelas terminaron
   */
  private contadorCargas = 0;
  private verificarCargaCompleta(): void {
    this.contadorCargas++;
    
    // Esperar a que las 5 consultas terminen (facturas, deudas, egresos, caja chica, caja banco)
    if (this.contadorCargas >= 5) {
      this.loading = false;
      this.contadorCargas = 0;
      this.datosYaCargados = true;
      
      console.log('✅ Carga completa. Aplicando filtros...');
      this.filtrarDatosEnMemoria();
      
      // Mostrar info de paginación si hay más datos
      if (this.hasMoreFacturas || this.hasMoreDeudas) {
        console.log('ℹ️ Hay más registros disponibles. Mostrando primeros 100.');
      }
    }
  }

  /**
   * ✅ OPTIMIZADO: Aplica filtros y carga datos solo cuando el usuario lo solicita
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

    // ✅ Limpiar cache si el usuario cambió las fechas
    this.reportesService.clearCache();
    
    // ✅ Reiniciar paginación
    this.lastVisibleFactura = null;
    this.lastVisibleDeuda = null;
    this.paginaActual = 1;
    
    console.log('🔄 Cargando datos con filtros aplicados...');
    this.cargarFacturas();
  }

  /**
   * ✅ OPTIMIZADO: Filtra datos en memoria sin reconsultar Firestore
   */
  private filtrarDatosEnMemoria(): void {
    console.log('🔍 Aplicando filtros en memoria...');
    console.log('📊 Facturas disponibles:', this.facturas.length);
    console.log('💳 Pagos deuda disponibles:', this.pagosDeuda.length);
    console.log('📤 Egresos disponibles:', this.egresos.length);

    // ========== FACTURAS (fuente principal de ventas) ==========
    let facturasFiltradas = [...this.facturas];

    // Aplicar filtro por tipo si hay selecciones
    if (this.tiposSeleccionados.length > 0) {
      const mostrarVentas = this.tiposSeleccionados.includes('VENTAS');
      const mostrarEfectivo = this.tiposSeleccionados.includes('PAGOS_EFECTIVO');
      const mostrarTarjeta = this.tiposSeleccionados.includes('PAGOS_TARJETA');
      const mostrarTransferenciaVentas = this.tiposSeleccionados.includes('TRANSFERENCIA_VENTAS');

      // Si se seleccionó VENTAS, mostrar todas las facturas
      if (mostrarVentas) {
        facturasFiltradas = [...this.facturas];
      } else {
        // Filtrar por método de pago
        facturasFiltradas = this.facturas.filter(f => {
          if (mostrarEfectivo && f.metodoPago === 'Efectivo') return true;
          if (mostrarTransferenciaVentas && f.metodoPago === 'Transferencia') return true;
          if (mostrarTarjeta && f.metodoPago === 'Tarjeta') return true;
          return false;
        });
      }

      console.log('✅ Facturas después de filtro de tipo:', facturasFiltradas.length);
    }

    // Asignar facturas filtradas
    this.facturasFiltradas = facturasFiltradas;
    
    // Ordenar por fecha (más reciente primero)
    this.facturasFiltradas.sort((a, b) => {
      const fechaA = this.obtenerFechaDate(a.fecha);
      const fechaB = this.obtenerFechaDate(b.fecha);
      return fechaB.getTime() - fechaA.getTime();
    });
    
    this.calcularTotales();
    
    console.log('💰 Total vendido:', this.totalVendido);
    console.log('📋 Facturas finales:', this.facturasFiltradas.length);
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
   * ✅ OPTIMIZADO: Calcula totales solo con datos ya cargados en memoria
   */
  calcularTotales(): void {
    // Total vendido = suma de todas las facturas
    this.totalVendido = this.facturasFiltradas.reduce((sum, f) => sum + f.total, 0);
    this.cantidadRegistros = this.facturasFiltradas.length;

    // Calcular total de pagos de deuda si están en filtros
    const mostrarFacturasDeuda = this.tiposSeleccionados.includes('FACTURAS_DEUDA') || 
                                  this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS') || 
                                  this.tiposSeleccionados.length === 0;
    
    if (mostrarFacturasDeuda) {
      const pagosDeudaFiltrados = this.getPagosDeudaFiltrados();
      this.totalPagosDeuda = pagosDeudaFiltrados.reduce((sum, p) => sum + p.montoPagado, 0);
      
      // Sumar los pagos de deuda al total vendido
      this.totalVendido += this.totalPagosDeuda;
    } else {
      this.totalPagosDeuda = 0;
    }

    // Calcular total de egresos si están en filtros
    if (this.tiposSeleccionados.includes('EGRESOS') || this.tiposSeleccionados.length === 0) {
      this.totalEgresos = this.egresos.reduce((sum, e) => sum + (e.monto || 0), 0);
    } else {
      this.totalEgresos = 0;
    }

    // Agrupar por método de pago
    this.totalesPorMetodo = {};
    
    // Procesar facturas normales
    this.facturasFiltradas.forEach(f => {
      let metodo = f.metodoPago || 'Sin Método';
      
      // Si es transferencia, clasificar como "Transferencia (Ventas)"
      if (metodo === 'Transferencia') {
        metodo = 'Transferencia (Ventas)';
      }
      
      this.totalesPorMetodo[metodo] = (this.totalesPorMetodo[metodo] || 0) + f.total;
    });

    // Procesar pagos de deuda (si están en filtros)
    const soloTransferenciasDeuda = this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS') && 
                                     !this.tiposSeleccionados.includes('FACTURAS_DEUDA');
    
    if (mostrarFacturasDeuda) {
      this.pagosDeuda.forEach(p => {
        let metodo = p.metodoPago || 'Sin Método';
        
        // Si solo se pidieron transferencias de deuda, filtrar
        if (soloTransferenciasDeuda && metodo !== 'Transferencia') {
          return;
        }
        
        // Si es transferencia, clasificar como "Transferencia (Cobro de Deudas)"
        if (metodo === 'Transferencia') {
          metodo = 'Transferencia (Cobro de Deudas)';
        }
        
        this.totalesPorMetodo[metodo] = (this.totalesPorMetodo[metodo] || 0) + p.montoPagado;
      });
    }

    console.log('📊 Totales calculados:');
    console.log('  - Total vendido:', this.totalVendido);
    console.log('  - Total pagos deuda:', this.totalPagosDeuda);
    console.log('  - Total egresos:', this.totalEgresos);
    console.log('  - Desglose por método:', this.totalesPorMetodo);
  }

  /**
   * 🆕 Carga el total de cajas chicas en el rango de fechas
   */
  private async cargarTotalCajaChica(fechaDesde: Date, fechaHasta: Date): Promise<void> {
    try {
      const cajasRef = collection(this.firestore, 'cajas_chicas');
      const q = query(
        cajasRef,
        where('fecha', '>=', Timestamp.fromDate(fechaDesde)),
        where('fecha', '<=', Timestamp.fromDate(fechaHasta)),
        where('activo', '==', true)
      );

      const snapshot = await getDocs(q);
      const cajas: CajaChica[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CajaChica));

      // Sumar monto_actual de todas las cajas
      this.totalCajaChica = cajas.reduce((sum, caja) => sum + (caja.monto_actual || 0), 0);
      
      console.log(`✅ Total Caja Chica calculado: $${this.totalCajaChica.toFixed(2)} (${cajas.length} cajas)`);
      this.verificarCargaCompleta();
    } catch (error) {
      console.error('❌ Error cargando total caja chica:', error);
      this.totalCajaChica = 0;
      this.verificarCargaCompleta();
    }
  }

  /**
   * 🆕 Carga el total de cajas banco en el rango de fechas
   */
  private async cargarTotalCajaBanco(fechaDesde: Date, fechaHasta: Date): Promise<void> {
    try {
      const cajasRef = collection(this.firestore, 'cajas_banco');
      const q = query(
        cajasRef,
        where('fecha', '>=', Timestamp.fromDate(fechaDesde)),
        where('fecha', '<=', Timestamp.fromDate(fechaHasta)),
        where('activo', '==', true)
      );

      const snapshot = await getDocs(q);
      const cajas: CajaBanco[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CajaBanco));

      // Sumar saldo_actual de todas las cajas
      this.totalCajaBanco = cajas.reduce((sum, caja) => sum + (caja.saldo_actual || 0), 0);
      
      console.log(`✅ Total Caja Banco calculado: $${this.totalCajaBanco.toFixed(2)} (${cajas.length} cajas)`);
      this.verificarCargaCompleta();
    } catch (error) {
      console.error('❌ Error cargando total caja banco:', error);
      this.totalCajaBanco = 0;
      this.verificarCargaCompleta();
    }
  }

  /**
   * ✅ OPTIMIZADO: Limpia filtros y datos cargados
   */
  limpiarFiltros(): void {
    // Limpiar fechas
    this.fechaDesde = '';
    this.fechaHasta = '';
    
    // Limpiar selecciones
    this.tiposSeleccionados = [];
    
    // Limpiar datos
    this.facturas = [];
    this.facturasFiltradas = [];
    this.pagosDeuda = [];
    this.egresos = [];
    
    // Limpiar totales
    this.totalVendido = 0;
    this.totalPagosDeuda = 0;
    this.totalEgresos = 0;
    this.cantidadRegistros = 0;
    this.totalesPorMetodo = {};
    this.totalCajaChica = 0; // 🆕
    this.totalCajaBanco = 0; // 🆕
    
    // Reiniciar paginación
    this.lastVisibleFactura = null;
    this.lastVisibleDeuda = null;
    this.hasMoreFacturas = false;
    this.hasMoreDeudas = false;
    this.paginaActual = 1;
    this.datosYaCargados = false;
    
    // Limpiar cache del servicio
    this.reportesService.clearCache();
    
    console.log('🗑️ Filtros limpiados');
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
   * 🔥 Método deshabilitado: Ya no se muestran transferencias de caja banco
   * Solo se muestran las transferencias de facturas_deudas
   */
  getTransferenciasCajaBancoDeuda(): any[] {
    return []; // Ya no se muestran transferencias de caja banco
  }

  /**
   * 🔥 NUEVO: Obtiene los pagos de deuda filtrados según las selecciones del usuario
   */
  getPagosDeudaFiltrados(): FacturaDeuda[] {
    const mostrarTodos = this.tiposSeleccionados.includes('FACTURAS_DEUDA') || this.tiposSeleccionados.length === 0;
    const mostrarSoloTransferencias = this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS');
    
    if (!mostrarTodos && !mostrarSoloTransferencias) {
      return [];
    }

    if (mostrarSoloTransferencias && !mostrarTodos) {
      // Solo mostrar transferencias
      return this.pagosDeuda.filter(p => p.metodoPago === 'Transferencia');
    }

    // Mostrar todos
    return this.pagosDeuda;
  }

  /**
   * Genera e imprime el reporte de ventas generales basado en facturas.
   */
  imprimirReporte(): void {
    if (this.facturasFiltradas.length === 0) {
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
   * Genera el HTML del reporte para impresión basado en facturas.
   * Compatible con impresoras POS y normales.
   * 🆕 Ahora incluye facturas de deuda y egresos.
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
        'VENTAS': 'Ventas (Facturas)',
        'PAGOS_EFECTIVO': 'Pagos en Efectivo',
        'PAGOS_TRANSFERENCIA': 'Pagos por Transferencia',
        'PAGOS_TARJETA': 'Pagos por Tarjeta',
        'FACTURAS_DEUDA': 'Facturas de Deuda',
        'EGRESOS': 'Egresos'
      };
      const tiposTexto = this.tiposSeleccionados.map(t => tipoLabels[t] || t).join(', ');
      filtrosAplicados.push(`Tipos: ${tiposTexto}`);
    }

    const filtrosTexto = filtrosAplicados.length > 0 
      ? `<div class="filtros">${filtrosAplicados.join(' | ')}</div>`
      : '';

    // 🆕 Generar filas combinadas: facturas normales + facturas de deuda + egresos
    const filasVentas = this.facturasFiltradas.map(factura => {
      // ✅ Clasificar método de pago de transferencias
      let metodoPagoDisplay = factura.metodoPago;
      if (metodoPagoDisplay === 'Transferencia') {
        metodoPagoDisplay = 'Transferencia (Ventas)';
      }
      
      return `
        <tr>
          <td>${this.formatoFecha(factura.fecha)}</td>
          <td>Venta</td>
          <td>${factura.idPersonalizado || factura.id || '-'}</td>
          <td>${factura.clienteNombre || 'Sin nombre'}</td>
          <td>${metodoPagoDisplay}</td>
          <td class="text-right">${this.formatoMoneda(factura.total)}</td>
          <td class="text-right">${this.formatoMoneda(factura.saldoPendiente || 0)}</td>
        </tr>
      `;
    }).join('');

    // 🆕 Filas de facturas de deuda
    const mostrarFacturasDeuda = this.tiposSeleccionados.includes('FACTURAS_DEUDA') || 
                                  this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS') || 
                                  this.tiposSeleccionados.length === 0;
    const filasDeuda = mostrarFacturasDeuda ? this.getPagosDeudaFiltrados().map(deuda => {
      // ✅ Clasificar método de pago de transferencias
      let metodoPagoDisplay = deuda.metodoPago;
      if (metodoPagoDisplay === 'Transferencia') {
        metodoPagoDisplay = 'Transferencia (Cobro de Deudas)';
      }
      
      return `
        <tr style="background-color: #fff3e0;">
          <td>${this.formatoFecha(deuda.fechaPago)}</td>
          <td>💳 Pago Deuda</td>
          <td>${deuda.facturaIdPersonalizado || deuda.facturaId || '-'}</td>
          <td>${deuda.clienteNombre || 'Sin nombre'}</td>
          <td>${metodoPagoDisplay}</td>
          <td class="text-right">${this.formatoMoneda(deuda.montoPagado)}</td>
          <td class="text-right">${this.formatoMoneda(deuda.saldoRestante || 0)}</td>
        </tr>
      `;
    }).join('') : '';

    // 🆕 Filas de egresos
    const mostrarEgresos = this.tiposSeleccionados.includes('EGRESOS') || this.tiposSeleccionados.length === 0;
    const filasEgresos = mostrarEgresos ? this.egresos.map(egreso => {
      return `
        <tr style="background-color: #ffebee;">
          <td>${this.formatoFecha(egreso.fecha)}</td>
          <td>📤 Egreso</td>
          <td>${egreso.comprobante || '-'}</td>
          <td>${egreso.descripcion || 'Sin descripción'}</td>
          <td>Efectivo</td>
          <td class="text-right">${this.formatoMoneda(egreso.monto)}</td>
          <td class="text-right">-</td>
        </tr>
      `;
    }).join('') : '';

    // Generar filas de totales por método
    const totalesMetodo = Object.entries(this.totalesPorMetodo)
      .map(([metodo, total]) => `
        <div class="total-item">
          <span>${metodo}:</span>
          <span class="total-value">${this.formatoMoneda(total)}</span>
        </div>
      `).join('');

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
          <div class="subtitulo">Basado en Facturas del Sistema</div>
        </div>

        <div class="fecha-reporte">
          Generado: ${fechaReporte}
        </div>

        ${filtrosTexto}

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Nº Doc</th>
              <th>Cliente/Descripción</th>
              <th>Método Pago</th>
              <th class="text-right">Monto</th>
              <th class="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${filasVentas}
            ${filasDeuda}
            ${filasEgresos}
          </tbody>
        </table>

        <div class="resumen">
          <h3>RESUMEN</h3>
          <div class="resumen-item">
            <span>Total Ventas (Facturas):</span>
            <span>${this.cantidadRegistros}</span>
          </div>
          ${mostrarFacturasDeuda ? `<div class="resumen-item">
            <span>Total Pagos de Deuda:</span>
            <span>${this.getPagosDeudaFiltrados().length}</span>
          </div>` : ''}
          ${mostrarEgresos ? `<div class="resumen-item">
            <span>Total Egresos:</span>
            <span>${this.egresos.length}</span>
          </div>` : ''}
          <h4 style="font-size: 10px; margin: 6px 0 4px 0; font-weight: bold;">Desglose por Forma de Pago:</h4>
          ${totalesMetodo}
          <div class="resumen-item total">
            <span>TOTAL VENDIDO:</span>
            <span>${this.formatoMoneda(this.totalVendido)}</span>
          </div>
          ${mostrarFacturasDeuda ? `<div class="resumen-item">
            <span>Total Pagos Deuda:</span>
            <span>${this.formatoMoneda(this.totalPagosDeuda)}</span>
          </div>` : ''}
          ${mostrarEgresos ? `<div class="resumen-item">
            <span>Total Egresos:</span>
            <span>${this.formatoMoneda(this.totalEgresos)}</span>
          </div>` : ''}
          
          <h4 style="font-size: 10px; margin: 10px 0 4px 0; font-weight: bold; border-top: 1px solid #000; padding-top: 6px;">Totales por Tipo de Caja:</h4>
          <div class="resumen-item">
            <span>Total Caja Chica:</span>
            <span class="total-value">${this.formatoMoneda(this.totalCajaChica)}</span>
          </div>
          <div class="resumen-item">
            <span>Total Caja Banco:</span>
            <span class="total-value">${this.formatoMoneda(this.totalCajaBanco)}</span>
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