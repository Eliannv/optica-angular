import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FacturasService } from '../../../../core/services/facturas';
import { FacturasDeudaService } from '../../../../core/services/facturas-deuda.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { RolUsuario } from '../../../../core/models/usuario.model';
import { Factura } from '../../../../core/models/factura.model';
import { DocumentSnapshot } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

/**
 * Tipo literal para filtro de tipo de factura.
 * @typedef {'TODAS' | 'NORMALES' | 'COBROS_DEUDA'} FiltroTipoFactura
 */
type FiltroTipoFactura = 'TODAS' | 'NORMALES' | 'COBROS_DEUDA';

@Component({
  selector: 'app-listar-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listar-facturas.html',
  styleUrl: './listar-facturas.css'
})
export class ListarFacturasComponent implements OnInit, OnDestroy {
  /**
   * Referencia global a Number (para uso en template con ngFor).
   * @type {typeof Number}
   */
  Number = Number;



  /**
   * Tipo de factura actual del filtro seleccionado en UI.
   * Valores válidos: 'TODAS', 'NORMALES' (venta convencional), 'COBROS_DEUDA' (abono de deuda)
   * @type {FiltroTipoFactura}
   * @default 'TODAS'
   */
  filtroTipoFactura: FiltroTipoFactura = 'TODAS';

  /**
   * Término de búsqueda ingresado por el usuario en campo de texto.
   * Se evalúa contra: clienteNombre, metodoPago, idPersonalizado, id Firestore
   * @type {string}
   * @default ''
   */
  term: string = '';

  /** Valor del campo de escáner de código de barras de facturas */
  codigoEscaneadoFactura: string = '';
  private scannerFacturaTimeout: any = null;

  // � FILTROS DE PERIODO Y FECHA
  periodoSeleccionado: string | null = null; // Mes/Año en formato 'MM/YYYY' (ej: '01/2026')
  fechaSeleccionada: string = ''; // Fecha específica en formato 'YYYY-MM-DD'
  minFechaPeriodo: string = ''; // Fecha mínima del periodo seleccionado
  maxFechaPeriodo: string = ''; // Fecha máxima del periodo seleccionado
  periodosDisponibles: Array<{mes: number, anio: number, label: string}> = [];
  cargandoPeriodos = false;
  private subscriptions = new Subscription();

  // �🚀 PAGINACIÓN REAL DESDE FIRESTORE
  facturasPaginadas: any[] = [];
  lastVisible: DocumentSnapshot | null = null;
  firstVisible: DocumentSnapshot | null = null;
  lastVisibleDeuda: DocumentSnapshot | null = null;
  firstVisibleDeuda: DocumentSnapshot | null = null;
  hasMore: boolean = false;
  isLoading: boolean = false;

  // 🔍 Historial de páginas para navegación hacia atrás
  paginasHistorial: Array<{
    firstDoc: DocumentSnapshot | null;
    lastDoc: DocumentSnapshot | null;
    firstDocDeuda: DocumentSnapshot | null;
    lastDocDeuda: DocumentSnapshot | null;
    pageNumber: number;
  }> = [];

  /**
   * Número de página actual (1-indexed para UI, convertida a offset en code).
   * @type {number}
   * @default 1
   * @see actualizarPaginacion()
   */
  paginaActual: number = 1;

  /**
   * Cantidad máxima de facturas a mostrar por página.
   * @type {number}
   * @default 10
   * @remarks Este valor define el "page size" para slicing de array filtrado
   */
  facturasPorPagina: number = 10;

  /**
   * Cantidad total de facturas en resultado filtrado actual.
   * Se usa para validar si hay más páginas en paginaSiguiente/Anterior.
   * @type {number}
   * @default 0
   * @private Calculado automáticamente en filtrar()
   */
  totalFacturas: number = 0;
  facturasParaEstadisticas: any[] = [];
  filtroMetodoPago: string = 'TODAS';
  cargandoEstadisticas: boolean = false;

  /** Controla el estado colapsado de la sección de estadísticas. */
  mostrarEstadisticas: boolean = true;

  /**
   * Referencia global a Math (para uso en template con operaciones matemáticas).
   * @type {typeof Math}
   */
  Math = Math;

  // ─── GETTERS DE ESTADÍSTICAS (calculadas desde facturasPaginadas) ─────────

  private get facturasStats(): any[] {
    if (Array.isArray(this.facturasParaEstadisticas) && this.facturasParaEstadisticas.length > 0) {
      return this.facturasParaEstadisticas;
    }
    return Array.isArray(this.facturasPaginadas) ? this.facturasPaginadas : [];
  }

  get totalFacturasStats(): number {
    // En modo TODAS, no contar los registros de cobros de deuda como facturas independientes
    if (this.filtroTipoFactura === 'TODAS') {
      return this.facturasStats.filter(f => f?.tipoFactura !== 'COBRO_DEUDA').length;
    }
    return this.facturasStats.length;
  }

  get totalFacturado(): number {
    return this.facturasStats.reduce((acc, f) => acc + Number(f?.total || 0), 0);
  }

  get totalAbonado(): number {
    return this.facturasStats.reduce((acc, f) => acc + Number(f?.abonado || 0), 0);
  }

  get saldoPendienteTotal(): number {
    return this.facturasStats.reduce((acc, f) => {
      if (!f?.esCredito) return acc;
      return acc + Number(f?.saldoPendiente || 0);
    }, 0);
  }

  get ticketPromedio(): number {
    const count = this.facturasStats.length;
    if (!count) return 0;
    return this.totalFacturado / count;
  }

  get facturaMaxima(): number {
    if (!this.facturasStats.length) return 0;
    return Math.max(...this.facturasStats.map(f => Number(f?.total || 0)));
  }

  get facturaMinima(): number {
    if (!this.facturasStats.length) return 0;
    return Math.min(...this.facturasStats.map(f => Number(f?.total || 0)));
  }

  get ventasPorDia(): { dia: string; fecha: Date; total: number }[] {
    const agrupado = new Map<string, { fecha: Date; total: number }>();

    this.facturasStats.forEach((f) => {
      const ms = this.getFechaMs(f);
      if (!ms) return;

      const fecha = new Date(ms);
      const inicioDia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
      const key = inicioDia.toISOString().split('T')[0];
      const prev = agrupado.get(key);

      if (prev) {
        prev.total += Number(f?.total || 0);
      } else {
        agrupado.set(key, {
          fecha: inicioDia,
          total: Number(f?.total || 0)
        });
      }
    });

    return Array.from(agrupado.values())
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      .map((v) => ({
        dia: `${String(v.fecha.getDate()).padStart(2, '0')}/${String(v.fecha.getMonth() + 1).padStart(2, '0')}`,
        fecha: v.fecha,
        total: v.total
      }));
  }

  get maxVentaDia(): number {
    if (!this.ventasPorDia.length) return 0;
    return Math.max(...this.ventasPorDia.map(v => v.total));
  }

  get distribucionMetodoPago(): { metodo: string; cantidad: number; monto: number }[] {
    const base = ['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito'];
    const acc = new Map<string, { metodo: string; cantidad: number; monto: number }>();

    base.forEach((metodo) => acc.set(metodo, { metodo, cantidad: 0, monto: 0 }));

    this.facturasStats.forEach((f) => {
      const metodo = this.normalizarMetodoPago(f?.metodoPago);
      const registro = acc.get(metodo) || { metodo, cantidad: 0, monto: 0 };
      registro.cantidad += 1;
      registro.monto += Number(f?.total || 0);
      acc.set(metodo, registro);
    });

    return base.map((metodo) => acc.get(metodo)!).filter(Boolean);
  }

  get distribucionTipoVenta(): { tipo: string; cantidad: number; porcentaje: number }[] {
    const total = this.facturasStats.length;
    const contado = this.facturasStats.filter((f) => (f?.tipoVenta || (f?.esCredito ? 'CREDITO' : 'CONTADO')) === 'CONTADO').length;
    const credito = this.facturasStats.filter((f) => (f?.tipoVenta || (f?.esCredito ? 'CREDITO' : 'CONTADO')) === 'CREDITO').length;

    return [
      {
        tipo: 'CONTADO',
        cantidad: contado,
        porcentaje: total ? (contado / total) * 100 : 0
      },
      {
        tipo: 'CREDITO',
        cantidad: credito,
        porcentaje: total ? (credito / total) * 100 : 0
      }
    ];
  }

  get creditosPendientes(): Factura[] {
    return this.facturasStats
      .filter((f) => Number(f?.saldoPendiente || 0) > 0 && f?.estadoPago === 'PENDIENTE')
      .sort((a, b) => Number(b?.saldoPendiente || 0) - Number(a?.saldoPendiente || 0)) as Factura[];
  }

  get conHistorialClinico(): number {
    return this.facturasStats.filter((f) => Boolean(f?.historialClinicoId)).length;
  }

  private normalizarMetodoPago(metodoPago: string | undefined): string {
    const valor = (metodoPago || '').toLowerCase();
    if (valor.includes('tarj')) return 'Tarjeta';
    if (valor.includes('trans')) return 'Transferencia';
    if (valor.includes('cred')) return 'Crédito';
    return 'Efectivo';
  }

  private async recargarEstadisticasPeriodo(): Promise<void> {
    // Solo el filtro de periodo impulsa las estadísticas — ignorar término, fecha exacta y otros filtros
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (this.periodoSeleccionado) {
      const [mes, anio] = this.periodoSeleccionado.split('/').map(Number);
      startDate = new Date(anio, mes - 1, 1);
      endDate = new Date(anio, mes, 0); // último día del mes
    }

    this.cargandoEstadisticas = true;

    try {
      const [resultadoFacturas, resultadoPagos] = await Promise.all([
        this.facturasSrv.getFacturasPaginadasReal({
          pageSize: 5000,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: '',
          filtroTipoFactura: 'TODAS',
          currentPage: 1,
          startDate,
          endDate,
          fechaExacta: null
        }),
        this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: 5000,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: '',
          currentPage: 1,
          startDate,
          endDate,
          fechaExacta: null
        })
      ]);

      const saldoActualMap = this.buildSaldoActualMap(resultadoPagos.pagos);
      const facturasNormales = resultadoFacturas.facturas.map(f => {
        const facturaId = f?.id;
        const saldoActual = Number((facturaId ? saldoActualMap.get(facturaId) : undefined) ?? f?.saldoPendiente ?? 0);
        return {
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: saldoActual,
          abonado: Number(f?.abonado || 0),
          tipoFactura: f?.tipoFactura || 'NORMAL'
        };
      });

      const facturasDeudaConvertidas = await this.mapearCobrosDeuda(resultadoPagos.pagos);
      const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
      todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));
      this.facturasParaEstadisticas = todasFacturas;
    } catch (error) {
      console.error('Error recargando estadísticas por periodo:', error);
      this.facturasParaEstadisticas = [...this.facturasPaginadas];
    } finally {
      this.cargandoEstadisticas = false;
    }
  }

  /**
   * ID de la caja chica actualmente abierta.
   * @type {string | null}
   * @default null
   */
  cajaChicaAbiertaId: string | null = null;

  /**
   * Set de IDs de facturas que tienen movimientos en la caja chica abierta.
   * Usado para determinar qué facturas pueden editarse/eliminarse.
   * @type {Set<string>}
   */
  facturasEnCajaAbierta: Set<string> = new Set();

  constructor(
    private facturasSrv: FacturasService,
    private facturasDeudaSrv: FacturasDeudaService,
    private cajaBancoSrv: CajaBancoService,
    private router: Router,
    private cajaChicaSrv: CajaChicaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarPeriodosDisponibles();
    this.verificarCajaAbierta();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.facturasPaginadas = [];
    this.facturasParaEstadisticas = [];
    this.paginasHistorial = [];
  }

  /**
   * 📆 Carga los periodos disponibles basados en cajas banco.
   * Selecciona automáticamente el periodo más reciente.
   */
  cargarPeriodosDisponibles(): void {
    this.cargandoPeriodos = true;
    const sub = this.cajaBancoSrv.getCajasBanco().subscribe({
      next: (cajasBanco) => {
        // Obtener periodos únicos ordenados por fecha descendente
        const periodosMap = new Map<string, {mes: number, anio: number, label: string}>();

        cajasBanco.forEach(caja => {
          let fecha: Date;
          if (caja.fecha instanceof Date) {
            fecha = caja.fecha;
          } else if (caja.fecha && typeof caja.fecha === 'object' && 'toDate' in caja.fecha) {
            fecha = (caja.fecha as any).toDate();
          } else {
            fecha = new Date(caja.fecha);
          }

          const mes = fecha.getMonth() + 1; // 1-12
          const anio = fecha.getFullYear();
          const key = `${mes.toString().padStart(2, '0')}/${anio}`;

          if (!periodosMap.has(key)) {
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            periodosMap.set(key, {
              mes,
              anio,
              label: `${meses[mes - 1]} ${anio}`
            });
          }
        });

        // Convertir a array y ordenar por fecha descendente
        this.periodosDisponibles = Array.from(periodosMap.values())
          .sort((a, b) => {
            if (a.anio !== b.anio) return b.anio - a.anio;
            return b.mes - a.mes;
          });

        // Seleccionar automáticamente el periodo más reciente
        if (this.periodosDisponibles.length > 0) {
          const periodo = this.periodosDisponibles[0];
          this.periodoSeleccionado = `${periodo.mes.toString().padStart(2, '0')}/${periodo.anio}`;
          this.calcularRangoFechasPeriodo();
          this.cargarPrimeraPage();
        }

        this.cargandoPeriodos = false;
      },
      error: (error) => {
        console.error('Error al cargar periodos:', error);
        this.cargandoPeriodos = false;
        // Si falla, cargar sin filtro de periodo
        this.cargarPrimeraPage();
      }
    });
    this.subscriptions.add(sub);
  }

  /**
   * 🗓️ Calcula el rango de fechas permitidas según el periodo seleccionado.
   */
  calcularRangoFechasPeriodo(): void {
    if (!this.periodoSeleccionado) {
      this.minFechaPeriodo = '';
      this.maxFechaPeriodo = '';
      return;
    }

    const [mes, anio] = this.periodoSeleccionado.split('/').map(Number);

    // Primer día del mes
    const primerDia = new Date(anio, mes - 1, 1);
    // Último día del mes
    const ultimoDia = new Date(anio, mes, 0);

    // Formato YYYY-MM-DD para input type="date"
    this.minFechaPeriodo = primerDia.toISOString().split('T')[0];
    this.maxFechaPeriodo = ultimoDia.toISOString().split('T')[0];
  }

  /**
   * 📆 Cambia el filtro de periodo y recarga desde el inicio.
   */
  cambiarFiltroPeriodo(periodo: string | null): void {
    this.periodoSeleccionado = periodo;
    this.fechaSeleccionada = '';
    this.calcularRangoFechasPeriodo();
    this.filtrar();
  }

  /**
   * 📅 Cambia el filtro de fecha específica y recarga.
   */
  cambiarFiltroFecha(fecha: string): void {
    this.fechaSeleccionada = fecha;
    this.filtrar();
  }

  /**
   * 🧹 Limpia el filtro de fecha específica.
   */
  limpiarFiltroFecha(): void {
    this.fechaSeleccionada = '';
    this.filtrar();
  }

  /**
   * 📋 Obtiene el label del periodo para mostrar en UI.
   */
  getPeriodoDisplay(periodo: {mes: number, anio: number, label: string}): string {
    return periodo.label;
  }

  /**
   * 🗓️ Obtiene las fechas de inicio y fin según los filtros activos.
   * @returns Objeto con startDate, endDate y fechaExacta
   */
  private obtenerFiltrosFecha(): {
    startDate: Date | null;
    endDate: Date | null;
    fechaExacta: Date | null;
  } {
    // Fecha exacta tiene prioridad
    if (this.fechaSeleccionada) {
      // Parsear como medianoche local (evita desfase UTC en zonas UTC-)
      const [y, m, d] = this.fechaSeleccionada.split('-').map(Number);
      return {
        startDate: null,
        endDate: null,
        fechaExacta: new Date(y, m - 1, d)
      };
    }

    // Si hay periodo seleccionado, calcular rango
    if (this.periodoSeleccionado) {
      const [mes, anio] = this.periodoSeleccionado.split('/').map(Number);
      const startDate = new Date(anio, mes - 1, 1); // Primer día del mes
      const endDate = new Date(anio, mes, 0); // Último día del mes
      return { startDate, endDate, fechaExacta: null };
    }

    // Sin filtros de fecha
    return { startDate: null, endDate: null, fechaExacta: null };
  }

  async verificarCajaAbierta(): Promise<void> {
    try {
      const caja = await this.cajaChicaSrv.getCajaAbierta();

      if (caja?.id && caja.estado === 'ABIERTA') {
        this.cajaChicaAbiertaId = caja.id;

        // Cargar movimientos de esta caja para saber qué facturas pertenecen a ella
        this.cajaChicaSrv.getMovimientosCajaChica(caja.id).subscribe((movimientos: any[]) => {
          this.facturasEnCajaAbierta.clear();
          movimientos.forEach((mov: any) => {
            // ✅ Solo considerar movimientos de VENTA (no de cobro de deuda)
            if (mov.comprobante && mov.descripcion?.startsWith('Venta #')) {
              this.facturasEnCajaAbierta.add(mov.comprobante);
            }
          });
          console.log('📋 Facturas con venta en caja abierta:', Array.from(this.facturasEnCajaAbierta));
        });

        console.log('🔍 Caja chica ABIERTA encontrada:', caja.id);
      } else {
        this.cajaChicaAbiertaId = null;
        this.facturasEnCajaAbierta.clear();
        console.log('🔍 No hay caja chica abierta');
      }
    } catch (error) {
      this.cajaChicaAbiertaId = null;
      this.facturasEnCajaAbierta.clear();
      console.log('❌ Error verificando caja chica:', error);
    }
  }


  puedeEditarEliminar(factura: any): boolean {
    // ❌ RESTRICCIÓN: Operadores (Rol 2) no pueden editar ni eliminar facturas
    const usuario = this.authService.getCurrentUser();
    if (usuario?.rol === RolUsuario.OPERADOR) {
      return false;
    }

    return factura.metodoPago === 'Efectivo'
           && this.cajaChicaAbiertaId !== null
           && factura.id
           && this.facturasEnCajaAbierta.has(factura.id);
  }

  private getFechaMs(f: any): number {
    const v = f?.fecha;
    if (!v) return 0;

    // Firestore Timestamp
    if (typeof v?.toDate === 'function') return v.toDate().getTime();

    // Date
    if (v instanceof Date) return v.getTime();

    // string/number
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  private buildSaldoActualMap(pagos: any[]): Map<string, number> {
    const latest = new Map<string, { fechaMs: number; saldo: number }>();

    (pagos || []).forEach(p => {
      const facturaId = p?.facturaId;
      if (!facturaId) return;

      const fecha = this.convertirFecha(p?.fechaPago);
      const fechaMs = fecha.getTime();
      const saldo = Number(p?.saldoRestante || 0);
      const prev = latest.get(facturaId);

      if (!prev || fechaMs >= prev.fechaMs) {
        latest.set(facturaId, { fechaMs, saldo });
      }
    });

    const result = new Map<string, number>();
    latest.forEach((value, key) => result.set(key, value.saldo));
    return result;
  }

  /**
   * 🔧 Convierte cualquier formato de fecha a Date válido
   */
  private convertirFecha(fecha: any): Date {
    if (!fecha) return new Date();

    // Firestore Timestamp
    if (typeof fecha?.toDate === 'function') return fecha.toDate();

    // Ya es Date
    if (fecha instanceof Date) return fecha;

    // String o número - intentar convertir
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /**
   * ✅ Mapea cobros de deuda obteniendo valores reales de las facturas originales
   * NO calcula nada, solo lee lo que ya está en la BD
   */
  private async mapearCobrosDeuda(pagos: any[]): Promise<any[]> {
    // Obtener facturas originales para cada pago de deuda
    const facturasOriginalesMap = new Map<string, any>();
    const facturasIds = [...new Set(pagos.map((p: any) => p.facturaId).filter(Boolean))];

    await Promise.all(
      facturasIds.map(async (facturaId: string) => {
        const factura = await this.facturasSrv.getFacturaByIdAsync(facturaId);
        if (factura) {
          facturasOriginalesMap.set(facturaId, factura);
        }
      })
    );

    return pagos.map((deuda: any) => {
      const facturaOriginal = facturasOriginalesMap.get(deuda.facturaId);
      // ✅ Para COBROS_DEUDA:
      // - abonado: monto pagado EN ESTE cobro específico (montoPagado)
      // - saldoPendiente y total: valores actuales de la factura original
      const montoPagado = Number(deuda.montoPagado || 0);
      const saldoPendiente = facturaOriginal?.saldoPendiente ?? Number(deuda.saldoRestante || 0);
      const saldoRestante = Number(deuda.saldoRestante ?? saldoPendiente ?? 0);
      const total = facturaOriginal?.total ?? Number(deuda.totalFactura || 0);

      return {
        // ✅ Para COBROS_DEUDA, usar el ID del pago para navegación
        id: deuda.id,
        facturaId: deuda.facturaId,  // Guardar referencia a factura original
        idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
        clienteNombre: deuda.clienteNombre || '',
        clienteTelefono: deuda.clienteTelefono || '',
        clienteId: deuda.clienteId || '',
        fecha: deuda.fechaPago || new Date(),
        total,
        abonado: montoPagado,  // ✅ Monto de ESTE pago (no acumulado)
        saldoPendiente,  // ✅ Saldo actual de la factura original
        saldoRestante, // ✅ Saldo restante registrado en facturas_deudas
        metodoPago: deuda.metodoPago || '',
        items: deuda.items || [],
        esCredito: deuda.esCreditoPersonal || false,
        estadoPago: facturaOriginal?.estadoPago ?? 'PENDIENTE',
        tipoFactura: 'COBRO_DEUDA',
        usuarioId: deuda.usuarioId || '',
        usuarioNombre: deuda.usuarioNombre || '',
        createdAt: deuda.createdAt || new Date(),
        updatedAt: deuda.updatedAt || new Date(),
        origenCaja: deuda.origenCaja || '',
        cajaChicaId: deuda.cajaChicaId || ''
      };
    });
  }

  private async cargarPrimeraPage(): Promise<void> {
    this.isLoading = true;
    this.paginaActual = 1;
    this.paginasHistorial = [];

    try {
      const { startDate, endDate, fechaExacta } = this.obtenerFiltrosFecha();

      // 🔍 Según filtro activo, cargamos solo la fuente necesaria
      if (this.filtroTipoFactura === 'NORMALES') {
        // Solo facturas normales
        const resultado = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          filtroTipoFactura: 'NORMALES',
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta,
          filtroMetodoPago: this.filtroMetodoPago
        });

        this.facturasPaginadas = resultado.facturas.map(f => {
          const total = Number(f?.total || 0);
          const saldoPendiente = Number(f?.saldoPendiente || 0);
          const abonado = Number(f?.abonado || 0);

          return {
            ...f,
            total,
            saldoPendiente,
            abonado,
            tipoFactura: f.tipoFactura || 'NORMAL'
          };
        });

        this.lastVisible = resultado.lastDoc;
        this.firstVisible = resultado.firstDoc;
        this.hasMore = resultado.hasMore;
        this.lastVisibleDeuda = null;
        this.firstVisibleDeuda = null;

        if (resultado.firstDoc) {
          this.paginasHistorial.push({
            firstDoc: resultado.firstDoc,
            lastDoc: resultado.lastDoc,
            firstDocDeuda: null,
            lastDocDeuda: null,
            pageNumber: 1
          });
        }

      } else if (this.filtroTipoFactura === 'COBROS_DEUDA') {
        // Solo cobros de deuda
        const resultado = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta
        });

        this.facturasPaginadas = await this.mapearCobrosDeuda(resultado.pagos);

        this.lastVisibleDeuda = resultado.lastDoc;
        this.firstVisibleDeuda = resultado.firstDoc;
        this.hasMore = resultado.hasMore;
        this.lastVisible = null;
        this.firstVisible = null;

        if (resultado.firstDoc) {
          this.paginasHistorial.push({
            firstDoc: null,
            lastDoc: null,
            firstDocDeuda: resultado.firstDoc,
            lastDocDeuda: resultado.lastDoc,
            pageNumber: 1
          });
        }

      } else {
        // TODAS: cargamos ambas fuentes
        const resultadoFacturas = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          filtroTipoFactura: 'TODAS',
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta,
          filtroMetodoPago: this.filtroMetodoPago
        });

        const resultadoPagos = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta
        });

        const saldoActualMap = this.buildSaldoActualMap(resultadoPagos.pagos);

        const facturasNormales = resultadoFacturas.facturas.map(f => {
          const facturaId = f?.id;
          const total = Number(f?.total || 0);
          const saldoActual = Number((facturaId ? saldoActualMap.get(facturaId) : undefined) ?? f?.saldoPendiente ?? 0);
          const abonado = Number(f?.abonado || 0);

          return {
            ...f,
            total,
            saldoPendiente: saldoActual,
            abonado,
            tipoFactura: f.tipoFactura || 'NORMAL'
          };
        });

        const facturasDeudaConvertidas = await this.mapearCobrosDeuda(resultadoPagos.pagos);

        const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
        todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

        this.facturasPaginadas = todasFacturas.slice(0, this.facturasPorPagina);
        this.hasMore = resultadoFacturas.hasMore || resultadoPagos.hasMore;
        this.lastVisible = resultadoFacturas.lastDoc;
        this.firstVisible = resultadoFacturas.firstDoc;
        this.lastVisibleDeuda = resultadoPagos.lastDoc;
        this.firstVisibleDeuda = resultadoPagos.firstDoc;

        if (resultadoFacturas.firstDoc || resultadoPagos.firstDoc) {
          this.paginasHistorial.push({
            firstDoc: resultadoFacturas.firstDoc,
            lastDoc: resultadoFacturas.lastDoc,
            firstDocDeuda: resultadoPagos.firstDoc,
            lastDocDeuda: resultadoPagos.lastDoc,
            pageNumber: 1
          });
        }
      }

      if (this.filtroMetodoPago !== 'TODAS') {
        this.facturasPaginadas = this.facturasPaginadas.filter(
          f => this.normalizarMetodoPago(f?.metodoPago) === this.filtroMetodoPago
        );
      }

      this.totalFacturas = this.facturasPaginadas.length;
      await this.recargarEstadisticasPeriodo();

    } catch (error) {
      console.error('Error al cargar facturas:', error);
      Swal.fire('Error', 'No se pudieron cargar las facturas', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🔄 Cargar página actual con filtros (para navegación anterior/siguiente con filtros activos)
   * NO modifica paginaActual, solo carga los datos correspondientes a la página actual
   */
  private async cargarPaginaConFiltros(): Promise<void> {
    try {
      const { startDate, endDate, fechaExacta } = this.obtenerFiltrosFecha();

      if (this.filtroTipoFactura === 'NORMALES') {
        const resultado = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          filtroTipoFactura: 'NORMALES',
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta,
          filtroMetodoPago: this.filtroMetodoPago
        });

        this.facturasPaginadas = resultado.facturas.map(f => {
          const total = Number(f?.total || 0);
          const saldoPendiente = Number(f?.saldoPendiente || 0);
          const abonado = Number(f?.abonado || 0);

          return {
            ...f,
            total,
            saldoPendiente,
            abonado,
            tipoFactura: f.tipoFactura || 'NORMAL'
          };
        });

        this.hasMore = resultado.hasMore;

      } else if (this.filtroTipoFactura === 'COBROS_DEUDA') {
        const resultado = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta
        });

        const saldoActualMap = this.buildSaldoActualMap(resultado.pagos);

        this.facturasPaginadas = await this.mapearCobrosDeuda(resultado.pagos);

        this.hasMore = resultado.hasMore;

      } else {
        // TODAS: cargar ambas fuentes
        const resultadoFacturas = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          filtroTipoFactura: 'TODAS',
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta,
          filtroMetodoPago: this.filtroMetodoPago
        });

        const resultadoPagos = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: null,
          direction: 'next',
          terminoBusqueda: this.term,
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta
        });

        const saldoActualMap = this.buildSaldoActualMap(resultadoPagos.pagos);

        const facturasNormales = resultadoFacturas.facturas.map(f => {
          const facturaId = f?.id;
          const total = Number(f?.total || 0);
          const saldoActual = Number((facturaId ? saldoActualMap.get(facturaId) : undefined) ?? f?.saldoPendiente ?? 0);
          const abonado = Number(f?.abonado || 0);

          return {
            ...f,
            total,
            saldoPendiente: saldoActual,
            abonado,
            tipoFactura: f.tipoFactura || 'NORMAL'
          };
        });

        const facturasDeudaConvertidas = await this.mapearCobrosDeuda(resultadoPagos.pagos);

        const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
        todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

        this.facturasPaginadas = todasFacturas.slice(0, this.facturasPorPagina);
        this.hasMore = resultadoFacturas.hasMore || resultadoPagos.hasMore;
      }

      if (this.filtroMetodoPago !== 'TODAS') {
        this.facturasPaginadas = this.facturasPaginadas.filter(
          f => this.normalizarMetodoPago(f?.metodoPago) === this.filtroMetodoPago
        );
      }

    } catch (error) {
      console.error('Error al cargar página con filtros:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar facturas',
        text: 'No se pudieron cargar las facturas. Por favor, intente nuevamente.'
      });
    } finally {
      this.isLoading = false;
    }
  }

  async filtrar(): Promise<void> {
    this.paginaActual = 1;
    this.paginasHistorial = [];
    this.lastVisible = null;
    this.firstVisible = null;
    this.lastVisibleDeuda = null;
    this.firstVisibleDeuda = null;
    await this.cargarPrimeraPage();
  }

  async paginaSiguiente(): Promise<void> {
    if (!this.hasMore || this.isLoading) return;

    this.isLoading = true;

    try {
 this.paginaActual++;

      const { startDate, endDate, fechaExacta } = this.obtenerFiltrosFecha();

      // 🔍 Según filtro activo, paginamos solo la fuente necesaria
      if (this.filtroTipoFactura === 'NORMALES') {
        const resultado = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.lastVisible,
          direction: 'next',
          terminoBusqueda: this.term,
          filtroTipoFactura: 'NORMALES',
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta,
          filtroMetodoPago: this.filtroMetodoPago
        });

        this.facturasPaginadas = resultado.facturas.map(f => {
          const total = Number(f?.total || 0);
          const saldoPendiente = Number(f?.saldoPendiente || 0);
          const abonado = Number(f?.abonado || 0);

          return {
            ...f,
            total,
            saldoPendiente,
            abonado,
            tipoFactura: f.tipoFactura || 'NORMAL'
          };
        });

        this.lastVisible = resultado.lastDoc;
        this.firstVisible = resultado.firstDoc;
        this.hasMore = resultado.hasMore;

        this.paginasHistorial.push({
          firstDoc: resultado.firstDoc,
          lastDoc: resultado.lastDoc,
          firstDocDeuda: null,
          lastDocDeuda: null,
          pageNumber: this.paginaActual
        });

      } else if (this.filtroTipoFactura === 'COBROS_DEUDA') {
        const resultado = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.lastVisibleDeuda,
          direction: 'next',
          terminoBusqueda: this.term,
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta
        });

        const saldoActualMap = this.buildSaldoActualMap(resultado.pagos);

        this.facturasPaginadas = await this.mapearCobrosDeuda(resultado.pagos);

        this.lastVisibleDeuda = resultado.lastDoc;
        this.firstVisibleDeuda = resultado.firstDoc;
        this.hasMore = resultado.hasMore;

        this.paginasHistorial.push({
          firstDoc: null,
          lastDoc: null,
          firstDocDeuda: resultado.firstDoc,
          lastDocDeuda: resultado.lastDoc,
          pageNumber: this.paginaActual
        });

      } else {
        // TODAS: cargamos ambas fuentes con sus respectivos cursores
        const resultadoFacturas = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.lastVisible,
          direction: 'next',
          terminoBusqueda: this.term,
          filtroTipoFactura: 'TODAS',
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta,
          filtroMetodoPago: this.filtroMetodoPago
        });

        const resultadoPagos = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.lastVisibleDeuda,
          direction: 'next',
          terminoBusqueda: this.term,
          currentPage: this.paginaActual,
          startDate,
          endDate,
          fechaExacta
        });

        const saldoActualMap = this.buildSaldoActualMap(resultadoPagos.pagos);

        const facturasNormales = resultadoFacturas.facturas.map(f => {
          const facturaId = f?.id;
          const total = Number(f?.total || 0);
          const saldoActual = Number((facturaId ? saldoActualMap.get(facturaId) : undefined) ?? f?.saldoPendiente ?? 0);
          const abonado = Number(f?.abonado || 0);

          return {
            ...f,
            total,
            saldoPendiente: saldoActual,
            abonado,
            tipoFactura: f.tipoFactura || 'NORMAL'
          };
        });

        const facturasDeudaConvertidas = await this.mapearCobrosDeuda(resultadoPagos.pagos);

        const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
        todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

        this.facturasPaginadas = todasFacturas.slice(0, this.facturasPorPagina);
        this.lastVisible = resultadoFacturas.lastDoc;
        this.firstVisible = resultadoFacturas.firstDoc;
        this.lastVisibleDeuda = resultadoPagos.lastDoc;
        this.firstVisibleDeuda = resultadoPagos.firstDoc;
        this.hasMore = resultadoFacturas.hasMore || resultadoPagos.hasMore;

        this.paginasHistorial.push({
          firstDoc: resultadoFacturas.firstDoc,
          lastDoc: resultadoFacturas.lastDoc,
          firstDocDeuda: resultadoPagos.firstDoc,
          lastDocDeuda: resultadoPagos.lastDoc,
          pageNumber: this.paginaActual
        });
      }

      if (this.filtroMetodoPago !== 'TODAS') {
        this.facturasPaginadas = this.facturasPaginadas.filter(
          f => this.normalizarMetodoPago(f?.metodoPago) === this.filtroMetodoPago
        );
      }

    } catch (error) {
      console.error('Error al cargar página siguiente:', error);
      Swal.fire('Error', 'No se pudo cargar la siguiente página', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async paginaAnterior(): Promise<void> {
    if (this.paginaActual <= 1 || this.isLoading) return;

    this.isLoading = true;

    try {
      this.paginasHistorial.pop();
      this.paginaActual--;

      const { startDate, endDate, fechaExacta } = this.obtenerFiltrosFecha();

      // 🔍 Si hay filtros activos (búsqueda o fechas), usar paginación en memoria
      const hayFiltrosActivos = this.term.trim() || startDate || endDate || fechaExacta || this.filtroMetodoPago !== 'TODAS';

      if (hayFiltrosActivos) {
        // Con filtros: simplemente recargar con el nuevo currentPage
        await this.cargarPaginaConFiltros();
        return;
      }

      // Sin filtros: usar cursores del historial
      const paginaAnterior = this.paginasHistorial[this.paginasHistorial.length - 1];

      if (!paginaAnterior || paginaAnterior.pageNumber === 1) {
        await this.cargarPrimeraPage();
        return;
      }

      // Restaurar cursores de la página anterior
      this.lastVisible = paginaAnterior.lastDoc;
      this.firstVisible = paginaAnterior.firstDoc;
      this.lastVisibleDeuda = paginaAnterior.lastDocDeuda;
      this.firstVisibleDeuda = paginaAnterior.firstDocDeuda;

      // 🔍 Según filtro activo, cargar la fuente correspondiente
      if (this.filtroTipoFactura === 'NORMALES') {
        const resultado = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.paginasHistorial[this.paginasHistorial.length - 2]?.lastDoc || null,
          direction: 'next',
          terminoBusqueda: '',
          filtroTipoFactura: 'NORMALES'
        });

        this.facturasPaginadas = resultado.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

        this.hasMore = true;

      } else if (this.filtroTipoFactura === 'COBROS_DEUDA') {
        const resultado = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.paginasHistorial[this.paginasHistorial.length - 2]?.lastDocDeuda || null,
          direction: 'next',
          terminoBusqueda: ''
        });

        const saldoActualMap = this.buildSaldoActualMap(resultado.pagos);

        this.facturasPaginadas = await this.mapearCobrosDeuda(resultado.pagos);

        this.hasMore = true;

      } else {
        // TODAS: cargar ambas fuentes
        const resultadoFacturas = await this.facturasSrv.getFacturasPaginadasReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.paginasHistorial[this.paginasHistorial.length - 2]?.lastDoc || null,
          direction: 'next',
          terminoBusqueda: '',
          filtroTipoFactura: 'TODAS'
        });

        const resultadoPagos = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: this.facturasPorPagina,
          lastVisible: this.paginasHistorial[this.paginasHistorial.length - 2]?.lastDocDeuda || null,
          direction: 'next',
          terminoBusqueda: ''
        });

        const saldoActualMap = this.buildSaldoActualMap(resultadoPagos.pagos);

        const facturasNormales = resultadoFacturas.facturas.map(f => {
          const facturaId = f?.id;
          const saldoActual = Number((facturaId ? saldoActualMap.get(facturaId) : undefined) ?? f?.saldoPendiente ?? 0);

          return {
            ...f,
            total: Number(f?.total || 0),
            saldoPendiente: saldoActual,
            tipoFactura: f.tipoFactura || 'NORMAL'
          };
        });

        const facturasDeudaConvertidas = await this.mapearCobrosDeuda(resultadoPagos.pagos);

        const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
        todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

        this.facturasPaginadas = todasFacturas.slice(0, this.facturasPorPagina);
        this.hasMore = true;
      }

      if (this.filtroMetodoPago !== 'TODAS') {
        this.facturasPaginadas = this.facturasPaginadas.filter(
          f => this.normalizarMetodoPago(f?.metodoPago) === this.filtroMetodoPago
        );
      }

    } catch (error) {
      console.error('Error al cargar página anterior:', error);
      Swal.fire('Error', 'No se pudo cargar la página anterior', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  ver(id: string) {
    this.router.navigate(['/facturas', id]);
  }

  cobrarDeuda(clienteId: string, ev?: Event) {
    ev?.stopPropagation();
    if (!clienteId) return;
    if (!this.cajaChicaAbiertaId) {
      Swal.fire({
        icon: 'warning',
        title: 'Caja chica cerrada',
        text: 'Abre una caja chica antes de cobrar una deuda.',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    this.router.navigate(['/ventas/deuda'], {
      queryParams: {
        clienteId,
        returnTo: this.router.url
      }
    });
  }

  nuevaVenta() {
    this.router.navigate(['/clientes/historial-clinico']);
  }

  // ─── ESCÁNER DE CÓDIGO DE BARRAS DE FACTURAS ─────────────────────────────

  /** Abre el diálogo de escaneo de código de barras y busca la factura en el periodo activo. */
  async abrirScannerFactura(): Promise<void> {
    const etiquetaPeriodo = this.fechaSeleccionada
      ? this.fechaSeleccionada
      : (this.periodoSeleccionado ?? 'periodo actual');

    const { value: rawCodigo, isConfirmed } = await Swal.fire({
      title: 'Buscar factura por código de barras',
      html: `<p style="margin:0 0 8px;font-size:0.9rem;color:#666">Periodo activo: <strong>${etiquetaPeriodo}</strong></p>
             <p style="margin:0;font-size:0.85rem;color:#999">Escanee el código o ingréselo manualmente y presione Enter o "Buscar".</p>`,
      input: 'text',
      inputPlaceholder: 'Escanee aquí el código de barras...',
      inputAttributes: { autocomplete: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Buscar',
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        const inputEl = Swal.getInput();
        if (inputEl) {
          inputEl.focus();
          // Auto-confirmar cuando el escáner envía Enter tras pegar el código rápido
          inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); Swal.clickConfirm(); }
          });
        }
      },
      preConfirm: (val: string) => {
        if (!val?.trim()) {
          Swal.showValidationMessage('Escanee o ingrese un código de barras');
          return false;
        }
        return val;
      }
    });

    if (!isConfirmed || !rawCodigo) return;

    await this.buscarFacturaPorCodigoBarras(rawCodigo);
  }

  /**
   * Busca la factura por código de barras SOLO dentro del periodo seleccionado.
   * Si no existe en el periodo pero sí globalmente, muestra mensaje específico.
   */
  async buscarFacturaPorCodigoBarras(rawCodigo: string): Promise<void> {
    const codigo = rawCodigo.replace(/[\r\n\t\x00-\x1F\x7F]/g, '').trim();
    if (!codigo) return;

    const soloDigitos = /^\d+$/.test(codigo);
    const idBusqueda = soloDigitos ? codigo.replace(/^0+/, '').padStart(10, '0') : codigo;

    const encontrarEnResultados = (facturas: any[], pagos: any[]) => {
      const universo = [...facturas, ...pagos];
      return universo.find((f: any) => {
        const idPers = String(f?.idPersonalizado || '').trim();
        const idDoc = String(f?.id || '').trim();
        return idPers === idBusqueda || idDoc === idBusqueda || idPers === codigo || idDoc === codigo;
      });
    };

    try {
      // 1️⃣ Buscar dentro del periodo activo
      const { startDate, endDate, fechaExacta } = this.obtenerFiltrosFecha();

      const [resFacturasPeriodo, resDeudaPeriodo] = await Promise.all([
        this.facturasSrv.getFacturasPaginadasReal({
          pageSize: 5000, lastVisible: null, direction: 'next',
          terminoBusqueda: idBusqueda, filtroTipoFactura: 'TODAS',
          currentPage: 1, startDate, endDate, fechaExacta
        }),
        this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: 5000, lastVisible: null, direction: 'next',
          terminoBusqueda: idBusqueda, currentPage: 1, startDate, endDate, fechaExacta
        })
      ]);

      const pagosPeriodo = await this.mapearCobrosDeuda(resDeudaPeriodo.pagos || []);
      const encontradaEnPeriodo = encontrarEnResultados(resFacturasPeriodo.facturas || [], pagosPeriodo);

      if (encontradaEnPeriodo?.id) {
        this.router.navigate(['/facturas', encontradaEnPeriodo.id]);
        return;
      }

      // 2️⃣ No encontrada en el periodo — buscar globalmente para dar mensaje preciso
      const [resFacturasGlobal, resDeudaGlobal] = await Promise.all([
        this.facturasSrv.getFacturasPaginadasReal({
          pageSize: 5000, lastVisible: null, direction: 'next',
          terminoBusqueda: idBusqueda, filtroTipoFactura: 'TODAS',
          currentPage: 1, startDate: null, endDate: null, fechaExacta: null
        }),
        this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
          pageSize: 5000, lastVisible: null, direction: 'next',
          terminoBusqueda: idBusqueda, currentPage: 1,
          startDate: null, endDate: null, fechaExacta: null
        })
      ]);

      const pagosGlobal = await this.mapearCobrosDeuda(resDeudaGlobal.pagos || []);
      const encontradaGlobal = encontrarEnResultados(resFacturasGlobal.facturas || [], pagosGlobal);

      const etiquetaPeriodo = this.fechaSeleccionada
        ? `la fecha ${this.fechaSeleccionada}`
        : (this.periodoSeleccionado ? `el periodo ${this.periodoSeleccionado}` : 'el periodo actual');

      if (encontradaGlobal?.id) {
        Swal.fire({
          icon: 'info',
          title: 'Factura no encontrada',
          text: `Esta factura no pertenece a ${etiquetaPeriodo}.`,
          timer: 3000,
          toast: true,
          position: 'top-end',
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Factura no encontrada',
          text: `No se encontró ninguna factura con el código '${codigo}'.`,
          timer: 3000,
          toast: true,
          position: 'top-end',
          showConfirmButton: false
        });
      }
    } catch (err) {
      console.error('[Facturas] Error buscando por código de barras:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al buscar la factura.', timer: 3000, toast: true, position: 'top-end', showConfirmButton: false });
    }
  }

  async eliminarFactura(factura: any, ev?: Event): Promise<void> {
    ev?.stopPropagation();

    // ⚠️ VALIDACIÓN 1: Solo permitir eliminar facturas de efectivo
    if (factura.metodoPago !== 'Efectivo') {
      Swal.fire({
        title: '❌ No Permitido',
        html: `
          <div style="text-align: left;">
            <p>Solo se pueden eliminar facturas pagadas en <strong>Efectivo</strong>.</p>
            <hr>
            <p><strong>Método de pago de esta factura:</strong> ${factura.metodoPago}</p>
            <p style="color: #666; font-size: 0.9rem;">Para facturas de Transferencia o Tarjeta, usa la función de edición.</p>
          </div>
        `,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // ⚠️ VALIDACIÓN 2: Verificar que haya una caja chica abierta
    try {
      const cajaAbierta = await this.cajaChicaSrv.getCajaAbierta();
      if (!cajaAbierta || !cajaAbierta.id) {
        Swal.fire({
          title: '❌ Caja Chica Cerrada',
          html: `
            <div style="text-align: left;">
              <p>No hay ninguna <strong>Caja Chica abierta</strong>.</p>
              <hr>
              <p>No se pueden eliminar facturas cuando la caja está cerrada, ya que los movimientos están consolidados.</p>
              <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">💡 Debes abrir una caja chica primero para poder eliminar facturas de efectivo.</p>
            </div>
          `,
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
        return;
      }
    } catch (error) {
      console.error('Error verificando caja chica:', error);
      Swal.fire({
        title: '❌ Error',
        text: 'No se pudo verificar el estado de la caja chica.',
        icon: 'error'
      });
      return;
    }

    const resultado = await Swal.fire({
      title: '¿Eliminar Factura?',
      html: `
        <div style="text-align: left;">
          <p><strong>ID:</strong> ${factura.idPersonalizado || factura.id}</p>
          <p><strong>Cliente:</strong> ${factura.clienteNombre || '-'}</p>
          <p><strong>Total:</strong> $${(Number(factura.total) || 0).toFixed(2)}</p>
          <p><strong>Método:</strong> ${factura.metodoPago}</p>
          <hr>
          <p style="color: red;"><strong>⚠️ Esta acción es PERMANENTE</strong></p>
          <p style="color: green; font-size: 0.9rem;">✅ Se revertirá automáticamente:</p>
          <ul style="text-align: left; font-size: 0.9rem;">
            <li>Stock de productos</li>
            <li>Movimiento de Caja Chica</li>
          </ul>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      try {
        const facturaId = factura.idPersonalizado || factura.id;

        // 1️⃣ ELIMINAR MOVIMIENTO DE CAJA CHICA (Solo efectivo)
        console.log('🔄 Eliminando movimiento de Caja Chica...');
        try {
          const caja = await this.cajaChicaSrv.getCajaAbierta();
          if (caja?.id) {
            await this.cajaChicaSrv.eliminarMovimientoPorFactura(caja.id, facturaId);
            console.log('✅ Movimiento eliminado de Caja Chica');
          }
        } catch (error) {
          console.error('Error eliminando movimiento de Caja Chica:', error);
        }

        // 2️⃣ ELIMINAR FACTURA (incluye reversión de stock + Kardex en servicio)
        console.log('🔄 Eliminando factura...');
        await this.facturasSrv.eliminarFactura(factura.id);
        console.log('✅ Factura eliminada');

        Swal.fire({
          title: '✅ Eliminada',
          html: `
            <div style="text-align: left;">
              <p>✅ Factura eliminada correctamente</p>
              <p>✅ Stock restaurado</p>
              <p>✅ Movimientos de caja revertidos</p>
            </div>
          `,
          icon: 'success',
          timer: 3000,
          showConfirmButton: false
        });
      } catch (error) {
        console.error('Error al eliminar factura:', error);
        Swal.fire({
          title: '❌ Error',
          text: error instanceof Error ? error.message : 'No se pudo eliminar la factura',
          icon: 'error'
        });
      }
    }
  }
  editarFactura(factura: any, ev?: Event): void {
    ev?.stopPropagation();

    // Navegar al componente de edición
    const facturaId = factura.idPersonalizado || factura.id;
    this.router.navigate(['/ventas/editar', facturaId]);
    // TODO: Implementar navegación a editar-factura
    // this.router.navigate(['/facturas/editar', factura.id]);
  }
}

