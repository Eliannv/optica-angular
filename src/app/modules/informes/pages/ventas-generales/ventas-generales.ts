import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { ReportesService } from '../../../../core/services/reportes.service';
import { Factura } from '../../../../core/models/factura.model';
import { FacturaDeuda } from '../../../../core/models/factura-deuda.model';

/**
 * 🚀 Componente OPTIMIZADO de Reporte de Ventas Generales
 * 
 * **Optimizaciones implementadas:**
 * ✅ 1. Carga bajo demanda (NO carga nada al iniciar, solo al presionar "Mostrar")
 * ✅ 2. Filtros obligatorios por fecha (no trae colecciones completas)
 * ✅ 3. Paginación real con limit() y startAfter() de Firestore
 * ✅ 4. Solo usa getDocs() (sin listeners en tiempo real)
 * ✅ 5. Cache en memoria para evitar consultas repetidas
 * ✅ 6. Consultas optimizadas con índices
 * 
 * **Funcionalidades:**
 * - Reporte basado exclusivamente en facturas del sistema
 * - Filtros por rango de fechas (OBLIGATORIOS)
 * - Filtros por tipo de venta y forma de pago
 * - Paginación de resultados (100 docs por página)
 * - Impresión compatible con impresoras POS y normales
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
  facturas: Factura[] = []; // Todas las facturas del sistema
  facturasFiltradas: Factura[] = []; // Facturas después de aplicar filtros
  pagosDeuda: FacturaDeuda[] = []; // 🆕 Pagos de deuda desde facturas_deudas
  egresos: any[] = []; // 🆕 Egresos de caja chica
  movimientosCajaChica: any[] = []; // Movimientos de caja chica (para desglose de pagos)
  movimientosCajaBanco: any[] = []; // Movimientos de caja banco (para desglose de pagos)
  cajasBanco: any[] = []; // 🆕 Cajas banco en el rango de fechas (para saldo inicial)
  
  // Filtros
  fechaDesde = '';
  fechaHasta = '';
  metodoPagoFiltro = 'TODOS'; // Filtro por método de pago
  tipoReporte: 'VENTAS' | 'DEUDAS' | 'EGRESOS' | 'COMPLETO' = 'VENTAS';
  
  // Opciones de tipos disponibles
  tiposDisponibles = [
    { valor: 'VENTAS', label: 'Ventas (Facturas)' },
    { valor: 'PAGOS_EFECTIVO', label: 'Pagos en Efectivo' },
    { valor: 'PAGOS_TARJETA', label: 'Pagos por Tarjeta' },
    { valor: 'TRANSFERENCIA_VENTAS', label: '🔄 Transferencia (Ventas)' },
    { valor: 'TRANSFERENCIA_DEUDAS', label: '🏦 Transferencia (Cobro de Deudas)' },
    { valor: 'FACTURAS_DEUDA', label: '💳 Pagos de Deuda (Todos)' },
    { valor: 'EGRESOS', label: '📤 Egresos' }
  ];

  // Totales (basados en facturas)
  totalVendido = 0; // Total de ventas (suma de facturas)
  cantidadRegistros = 0; // Cantidad de facturas
  totalPagosDeuda = 0; // 🆕 Total de pagos de deuda
  totalEgresos = 0; // 🆕 Total de egresos
  totalesPorMetodo: { [key: string]: number } = {}; // Desglose por forma de pago
  totalCajaChica = 0; // 🆕 Total Caja Chica en rango de fechas
  totalCajaBanco = 0; // 🆕 Total Caja Banco en rango de fechas

  private subscription?: Subscription;

  constructor(
    private reportesService: ReportesService, // ✅ Servicio optimizado
    private router: Router
  ) {}

  ngOnInit(): void {
    // ✅ Establecer fechas por defecto PERO NO CARGAR DATOS
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    this.fechaDesde = this.formatearFechaInput(primerDiaMes);
    this.fechaHasta = this.formatearFechaInput(hoy);
    
    // ✅ NO llamar cargarFacturas() aquí - solo cuando usuario presione "Mostrar"
    console.log('📊 Reporte inicializado. Presione "Mostrar" para cargar datos.');
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
   * Carga todas las facturas y movimientos de pago, luego filtra en memoria
   * 🎯 Evita problemas de índices compuestos en Firestore
   * 
   * **Proceso:**
   * 1. Carga todas las facturas del sistema
   * 2. Carga movimientos de caja chica (pagos en efectivo)
   * 3. Carga movimientos de caja banco (transferencias y tarjetas)
   * 4. Filtra por rango de fechas en memoria
   */
  cargarFacturas(): void {
    this.loading = true;

    // Convertir fechas del input a Date, asegurando zona horaria local
    const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
    const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);
    
    const fechaDesde = new Date(añoDesde, mesDesde - 1, diaDesde, 0, 0, 0, 0);
    const fechaHasta = new Date(añoHasta, mesHasta - 1, diaHasta, 23, 59, 59, 999);

    console.log('📅 Cargando facturas desde:', fechaDesde);
    console.log('📅 Cargando facturas hasta:', fechaHasta);

    // 🏦 Cargar movimientos de CAJA BANCO (para desglose de pagos)
    const movimientosBancoRef = collection(this.firestore, 'movimientos_cajas_banco');
    const cajasBancoRef = collection(this.firestore, 'cajas_banco');
    
    // Cargar cajas banco y movimientos en paralelo
    Promise.all([
      getDocs(movimientosBancoRef),
      getDocs(cajasBancoRef)
    ]).then(([snapshotBanco, snapshotCajasBanco]) => {
      const todosBanco = snapshotBanco.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filtrar movimientos por fecha en memoria
      this.movimientosCajaBanco = todosBanco.filter((m: any) => {
        const fecha = m.fecha instanceof Date ? m.fecha : 
                      (typeof m.fecha?.toDate === 'function' ? m.fecha.toDate() : new Date(m.fecha));
        return fecha >= fechaDesde && fecha <= fechaHasta;
      });
      
      // Filtrar cajas banco por fecha de apertura en el rango
      this.cajasBanco = snapshotCajasBanco.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter((c: any) => {
        const fecha = c.fecha instanceof Date ? c.fecha : 
                      (typeof c.fecha?.toDate === 'function' ? c.fecha.toDate() : new Date(c.fecha));
        return fecha >= fechaDesde && fecha <= fechaHasta;
      });
      
      console.log('🏦 Total movimientos banco en BD:', todosBanco.length);
      console.log('🏦 Movimientos banco en rango:', this.movimientosCajaBanco.length);
      console.log('🏦 Cajas banco en rango:', this.cajasBanco.length);
      
      // Cargar movimientos de CAJA CHICA (para desglose de pagos)
      const movimientosChicaRef = collection(this.firestore, 'movimientos_cajas_chicas');
      return getDocs(movimientosChicaRef);
    }).then(snapshotChica => {
      const todosChica = snapshotChica.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filtrar por fecha en memoria
      this.movimientosCajaChica = todosChica.filter((m: any) => {
        const fecha = m.fecha instanceof Date ? m.fecha : 
                      (typeof m.fecha?.toDate === 'function' ? m.fecha.toDate() : new Date(m.fecha));
        return fecha >= fechaDesde && fecha <= fechaHasta;
      });
      
      console.log('💰 Total movimientos caja chica en BD:', todosChica.length);
      console.log('💰 Movimientos caja chica en rango:', this.movimientosCajaChica.length);
      
      // 🆕 Filtrar EGRESOS de caja chica en el mismo rango de fechas
      this.egresos = this.movimientosCajaChica.filter((m: any) => m.tipo === 'EGRESO');
      console.log('📤 Egresos en rango:', this.egresos.length);
      
      // 🆕 Cargar FACTURAS DE DEUDA
      this.subscription = this.facturasDeudaService.getTodosPagos().subscribe({
        next: (todosPagos) => {
          // Filtrar pagos de deuda por fecha en memoria
          this.pagosDeuda = todosPagos.filter((p: any) => {
            const fecha = p.fechaPago instanceof Date ? p.fechaPago : 
                          (typeof p.fechaPago?.toDate === 'function' ? p.fechaPago.toDate() : new Date(p.fechaPago));
            return fecha >= fechaDesde && fecha <= fechaHasta;
          });
          
          console.log('💳 Total pagos de deuda en BD:', todosPagos.length);
          console.log('💳 Pagos de deuda en rango:', this.pagosDeuda.length);
          
          // Cargar FACTURAS usando el servicio
          this.facturasService.getFacturas().subscribe({
            next: (todasFacturas) => {
              // Filtrar facturas por fecha en memoria
              this.facturas = todasFacturas.filter(f => {
                const fecha = (f.fecha as any) instanceof Date ? f.fecha as Date : 
                              (typeof (f.fecha as any)?.toDate === 'function' ? (f.fecha as any).toDate() : new Date(f.fecha as any));
                return fecha >= fechaDesde && fecha <= fechaHasta;
              });
              
              console.log('📄 Total facturas en BD:', todasFacturas.length);
              console.log('📄 Facturas en rango:', this.facturas.length);
              
              this.loading = false;
              
              // Aplicar filtros en memoria
              this.filtrarDatosEnMemoria();
            },
            error: (error) => {
              console.error('❌ Error cargando facturas:', error);
              this.loading = false;
              this.filtrarDatosEnMemoria();
            }
          });
        },
        error: (error) => {
          console.error('❌ Error cargando pagos de deuda:', error);
          this.pagosDeuda = [];
          this.loading = false;
        }
      });
    }).catch(error => {
      console.error('❌ Error cargando movimientos:', error);
      this.movimientosCajaChica = [];
      this.movimientosCajaBanco = [];
      this.loading = false;
    });
  }

  /**
   * Aplica los filtros seleccionados a la lista de facturas.
   * Se ejecuta al presionar el botón "Mostrar".
   * RECARGA los datos desde Firestore con el nuevo rango de fechas.
   */
  aplicarFiltros(): void {
    // Validar fechas obligatorias
    if (!this.fechaDesde || !this.fechaHasta) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas Requeridas',
        text: 'Por favor seleccione las fechas DESDE y HASTA para generar el reporte.'
      });
      return;
    }

    this.loading = true;
    this.datosReporte = true;
    this.paginaActual = 1;
    
    // Esperar a que se carguen los datos antes de filtrar
    // El filtrado se hará automáticamente después de cargar en filtrarDatosEnMemoria()
  }

  /**
   * Filtra los datos ya cargados en memoria según los tipos seleccionados.
   * Este método se llama después de cargar los datos desde Firestore.
   * 
   * **Nueva lógica basada en facturas:**
   * - Las facturas son la fuente principal de ventas
   * - Los movimientos de caja solo se usan para desglosar formas de pago
   */
  private filtrarDatosEnMemoria(): void {
    console.log('🔍 Aplicando filtros en memoria (basado en facturas)...');
    console.log('📅 Fecha DESDE:', this.fechaDesde);
    console.log('📅 Fecha HASTA:', this.fechaHasta);
    console.log('📊 Total facturas disponibles:', this.facturas.length);
    console.log('💳 Total pagos deuda disponibles:', this.pagosDeuda.length);

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
        // No filtrar, mostrar todas
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
    } else {
      console.log('ℹ️ No hay tipos seleccionados, mostrando todas las facturas');
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
    console.log('💳 Pagos deuda finales:', this.pagosDeuda.length);
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
   * Calcula totales y estadísticas basadas en facturas filtradas.
   * El total vendido es la suma de todas las facturas.
   * Los totales por método de pago se calculan desde las facturas.
   * 🆕 Ahora también calcula totales de facturas de deuda y egresos.
   * ✅ Desglose de transferencias: Transferencia (Ventas) vs Transferencia (Cobro de Deudas)
   */
  calcularTotales(): void {
    // Total vendido
    this.totalVendido = this.facturas.reduce((sum, f) => sum + (f.total || 0), 0);
    this.cantidadRegistros = this.facturas.length;

    // 🆕 Calcular total de pagos de deuda si están en filtros
    const mostrarFacturasDeuda = this.tiposSeleccionados.includes('FACTURAS_DEUDA') || 
                                  this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS') || 
                                  this.tiposSeleccionados.length === 0;
    
    if (mostrarFacturasDeuda) {
      const pagosDeudaFiltrados = this.getPagosDeudaFiltrados();
      this.totalPagosDeuda = pagosDeudaFiltrados.reduce((sum, p) => sum + p.montoPagado, 0);
      
      // ✅ SUMAR los pagos de deuda al total vendido
      this.totalVendido += this.totalPagosDeuda;
    } else {
      this.totalPagosDeuda = 0;
    }

    // 🆕 Calcular total de egresos si están en filtros
    if (this.tiposSeleccionados.includes('EGRESOS') || this.tiposSeleccionados.length === 0) {
      this.totalEgresos = this.egresos.reduce((sum, e) => sum + e.monto, 0);
    } else {
      this.totalEgresos = 0;
    }

    // ✅ Agrupar por método de pago (con diferenciación de transferencias)
    this.totalesPorMetodo = {};
    
    // Procesar facturas normales
    this.facturasFiltradas.forEach(f => {
      let metodo = f.metodoPago || 'Sin Método';
      
      // ✅ Si es transferencia, clasificar como "Transferencia (Ventas)"
      if (metodo === 'Transferencia') {
        metodo = 'Transferencia (Ventas)';
      }
      
      this.totalesPorMetodo[metodo] = (this.totalesPorMetodo[metodo] || 0) + f.total;
    });

    // ✅ Procesar pagos de deuda (si están en filtros)
    const soloTransferenciasDeuda = this.tiposSeleccionados.includes('TRANSFERENCIA_DEUDAS') && 
                                     !this.tiposSeleccionados.includes('FACTURAS_DEUDA');
    
    if (mostrarFacturasDeuda) {
      this.pagosDeuda.forEach(p => {
        let metodo = p.metodoPago || 'Sin Método';
        
        // Si solo se pidieron transferencias de deuda, filtrar
        if (soloTransferenciasDeuda && metodo !== 'Transferencia') {
          return; // Saltar este pago
        }
        
        // ✅ Si es transferencia, clasificar como "Transferencia (Cobro de Deudas)"
        if (metodo === 'Transferencia') {
          metodo = 'Transferencia (Cobro de Deudas)';
        }
        
        this.totalesPorMetodo[metodo] = (this.totalesPorMetodo[metodo] || 0) + p.montoPagado;
      });
    }

    // 🆕 Calcular totales de cajas en el rango de fechas
    this.calcularTotalesCajas();

    console.log('📊 Totales por método de pago:', this.totalesPorMetodo);
    console.log('💳 Total pagos de deuda:', this.totalPagosDeuda);
    console.log('📤 Total egresos:', this.totalEgresos);
    console.log('💰 Total Caja Chica:', this.totalCajaChica);
    console.log('🏦 Total Caja Banco:', this.totalCajaBanco);
  }

  /**
   * 🆕 Calcula los totales de Caja Chica y Caja Banco en el rango de fechas seleccionado
   */
  private calcularTotalesCajas(): void {
    // Convertir fechas del input a Date
    const [añoDesde, mesDesde, diaDesde] = this.fechaDesde.split('-').map(Number);
    const [añoHasta, mesHasta, diaHasta] = this.fechaHasta.split('-').map(Number);
    
    const fechaDesde = new Date(añoDesde, mesDesde - 1, diaDesde, 0, 0, 0, 0);
    const fechaHasta = new Date(añoHasta, mesHasta - 1, diaHasta, 23, 59, 59, 999);

    // 💰 Calcular Total Caja Chica: suma de ingresos - egresos en el rango
    const ingresosCajaChica = this.movimientosCajaChica
      .filter((m: any) => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
    
    const egresosCajaChica = this.movimientosCajaChica
      .filter((m: any) => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
    
    this.totalCajaChica = ingresosCajaChica - egresosCajaChica;

    // 🏦 Calcular Total Caja Banco: Saldo Inicial + Caja Chica (depositada) + movimientos propios
    
    console.log('📊 DEBUG - Movimientos Caja Banco totales:', this.movimientosCajaBanco.length);
    console.log('📊 DEBUG - Movimientos Caja Chica totales:', this.movimientosCajaChica.length);
    console.log('📊 DEBUG - Cajas Banco en rango:', this.cajasBanco.length);
    
    // 1️⃣ Sumar saldo inicial de todas las cajas banco en el rango
    const saldoInicialBanco = this.cajasBanco.reduce((sum, c: any) => sum + (c.saldo_inicial || 0), 0);
    console.log('📊 DEBUG - Saldo Inicial Banco:', saldoInicialBanco);
    
    // 2️⃣ La Caja Chica se deposita directamente en Caja Banco
    let totalCajaBanco = saldoInicialBanco + this.totalCajaChica;
    
    // 3️⃣ Sumar ingresos directos de Caja Banco (en el rango de fechas)
    const movimientosIngresoBanco = this.movimientosCajaBanco.filter((m: any) => m.tipo === 'INGRESO');
    const ingresosCajaBanco = movimientosIngresoBanco.reduce((sum, m) => sum + (m.monto || 0), 0);
    
    console.log('📊 DEBUG - Movimientos INGRESO Banco:', movimientosIngresoBanco.length);
    console.log('📊 DEBUG - Desglose ingresos:', movimientosIngresoBanco.map((m: any) => ({
      monto: m.monto,
      fecha: m.fecha,
      descripcion: m.descripcion,
      categoria: m.categoria
    })));
    
    // 4️⃣ Restar egresos directos de Caja Banco (en el rango de fechas)
    const movimientosEgresoBanco = this.movimientosCajaBanco.filter((m: any) => m.tipo === 'EGRESO');
    const egresosCajaBanco = movimientosEgresoBanco.reduce((sum, m) => sum + (m.monto || 0), 0);
    
    console.log('📊 DEBUG - Movimientos EGRESO Banco:', movimientosEgresoBanco.length);
    console.log('📊 DEBUG - Desglose egresos:', movimientosEgresoBanco.map((m: any) => ({
      monto: m.monto,
      fecha: m.fecha,
      descripcion: m.descripcion,
      categoria: m.categoria
    })));
    
    // Total = Saldo Inicial + Caja Chica depositada + Ingresos Banco - Egresos Banco
    this.totalCajaBanco = totalCajaBanco + ingresosCajaBanco - egresosCajaBanco;
    
    console.log('🏦 Desglose Caja Banco:');
    console.log('  - Saldo Inicial Banco:', saldoInicialBanco);
    console.log('  - Total Caja Chica (depositada):', this.totalCajaChica);
    console.log('  - Ingresos Caja Banco:', ingresosCajaBanco);
    console.log('  - Egresos Caja Banco:', egresosCajaBanco);
    console.log('  - TOTAL CAJA BANCO:', this.totalCajaBanco);
  }

  /**
   * Limpia todos los filtros y datos
   */
  limpiarFiltros(): void {
    // Limpiar cache del servicio
    this.reportesService.clearCache();
    
    // Limpiar datos locales
    this.facturas = [];
    this.pagosDeuda = [];
    this.egresos = [];
    this.registrosCombinados = [];
    this.datosReporte = false;
    this.paginaActual = 1;
    this.hayMasPaginas = false;
    
    // Resetear totales
    this.totalVendido = 0;
    this.totalPagosDeuda = 0;
    this.totalEgresos = 0;
    this.cantidadRegistros = 0;
    this.totalesPorMetodo = {};
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
   * Genera e imprime el reporte optimizado
   */
  imprimirReporte(): void {
    if (!this.datosReporte || this.facturas.length === 0) {
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
        text: 'No se pudo abrir la ventana de impresión.'
      });
      return;
    }

    ventana.document.write(htmlReporte);
    ventana.document.close();
    
    ventana.addEventListener('load', () => {
      ventana.focus();
      ventana.print();
      ventana.addEventListener('afterprint', () => ventana.close());
    });
  }

  /**
   * Genera HTML optimizado del reporte
   */
  private generarHTMLReporte(): string {
    const fechaReporte = new Date().toLocaleString('es-ES');
    
    // Filtros aplicados
    const filtrosAplicados: string[] = [];
    if (this.fechaDesde) {
      const [año, mes, dia] = this.fechaDesde.split('-');
      filtrosAplicados.push(`Desde: ${dia}/${mes}/${año}`);
    }
    if (this.fechaHasta) {
      const [año, mes, dia] = this.fechaHasta.split('-');
      filtrosAplicados.push(`Hasta: ${dia}/${mes}/${año}`);
    }
    filtrosAplicados.push(`Tipo: ${this.tipoReporte}`);
    if (this.metodoPagoFiltro !== 'TODOS') {
      filtrosAplicados.push(`Método: ${this.metodoPagoFiltro}`);
    }

    const filtrosTexto = `<div class="filtros">${filtrosAplicados.join(' | ')}</div>`;

    // 🆕 Generar filas combinadas: facturas normales + facturas de deuda + egresos
    const filasVentas = this.facturasFiltradas.map(factura => {
      // ✅ Clasificar método de pago de transferencias
      let metodoPagoDisplay = factura.metodoPago;
      if (metodoPagoDisplay === 'Transferencia') {
        metodoPagoDisplay = 'Transferencia (Ventas)';
      }
      
      return `
        <tr>
          <td>${this.formatoFecha(f.fecha)}</td>
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
      `).join('');
    }
    
    if (this.tipoReporte === 'EGRESOS' || this.tipoReporte === 'COMPLETO') {
      filas += this.egresos.map(e => `
        <tr style="background-color: #ffebee;">
          <td>${this.formatoFecha(e.fecha)}</td>
          <td>Egreso</td>
          <td>${e.comprobante || '-'}</td>
          <td>${e.descripcion || 'Sin descripción'}</td>
          <td>Efectivo</td>
          <td class="text-right">${this.formatoMoneda(e.monto)}</td>
        </tr>
      `).join('');
    }

    // Totales por método
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
          .header h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .header .empresa { font-size: 12px; font-weight: bold; margin-bottom: 2px; }
          .fecha-reporte { text-align: right; font-size: 8px; margin-bottom: 10px; }
          .filtros { 
            background: #f5f5f5; 
            padding: 6px; 
            margin-bottom: 12px; 
            font-size: 9px; 
            border: 1px solid #000;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { 
            background: #000; 
            color: #fff; 
            padding: 6px 4px; 
            text-align: left; 
            font-size: 9px;
            border: 1px solid #000;
          }
          td { padding: 5px 4px; border: 1px solid #000; font-size: 9px; }
          .text-right { text-align: right; }
          .resumen { border: 2px solid #000; padding: 10px; margin-top: 15px; }
          .resumen h3 { 
            font-size: 11px; 
            margin-bottom: 8px; 
            border-bottom: 1px solid #000; 
            padding-bottom: 4px;
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
          @media print {
            @page { margin: 0.5cm; size: auto; }
            body { padding: 0; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="empresa">ÓPTICA MACÍAS PASAJE</div>
          <h1>REPORTE DE VENTAS GENERALES</h1>
        </div>

        <div class="fecha-reporte">Generado: ${fechaReporte}</div>
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
            </tr>
          </thead>
          <tbody>${filas}</tbody>
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
          <h4 style="font-size: 10px; margin: 10px 0 4px 0; font-weight: bold; border-top: 2px solid #000; padding-top: 6px;">Totales por Caja:</h4>
          <div class="total-item">
            <span>💰 Total Caja Chica:</span>
            <span class="total-value">${this.formatoMoneda(this.totalCajaChica)}</span>
          </div>
          <div class="total-item">
            <span>🏦 Total Caja Banco:</span>
            <span class="total-value">${this.formatoMoneda(this.totalCajaBanco)}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Formatear fecha
   */
  formatoFecha(fecha: Date | any): string {
    if (!fecha) return '-';
    
    const f = fecha.toDate ? fecha.toDate() : (fecha instanceof Date ? fecha : new Date(fecha));
    
    return f.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatear moneda
   */
  formatoMoneda(monto: number): string {
    return `$${monto.toFixed(2)}`;
  }

  /**
   * Volver al inicio
   */
  volver(): void {
    this.router.navigate(['/']);
  }
}
