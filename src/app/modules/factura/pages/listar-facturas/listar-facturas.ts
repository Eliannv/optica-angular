import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FacturasService } from '../../../../core/services/facturas';
import { FacturasDeudaService } from '../../../../core/services/facturas-deuda.service';
import { ProductosService } from '../../../../core/services/productos';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { RolUsuario } from '../../../../core/models/usuario.model';
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

  /**
   * Referencia global a Math (para uso en template con operaciones matemáticas).
   * @type {typeof Math}
   */
  Math = Math;

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
    private productosSrv: ProductosService,
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
      return {
        startDate: null,
        endDate: null,
        fechaExacta: new Date(this.fechaSeleccionada)
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
          fechaExacta
        });

        this.facturasPaginadas = resultado.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

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

        this.facturasPaginadas = resultado.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

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
          fechaExacta
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

        const facturasNormales = resultadoFacturas.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

        const facturasDeudaConvertidas = resultadoPagos.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

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
      
      this.totalFacturas = this.facturasPaginadas.length;
      
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
          fechaExacta
        });

        this.facturasPaginadas = resultado.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

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

        this.facturasPaginadas = resultado.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

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
          fechaExacta
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

        const facturasNormales = resultadoFacturas.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

        const facturasDeudaConvertidas = resultadoPagos.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

        const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
        todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

        this.facturasPaginadas = todasFacturas.slice(0, this.facturasPorPagina);
        this.hasMore = resultadoFacturas.hasMore || resultadoPagos.hasMore;
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
          fechaExacta
        });

        this.facturasPaginadas = resultado.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

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

        this.facturasPaginadas = resultado.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

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
          fechaExacta
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

        const facturasNormales = resultadoFacturas.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

        const facturasDeudaConvertidas = resultadoPagos.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

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
      const hayFiltrosActivos = this.term.trim() || startDate || endDate || fechaExacta;
      
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

        this.facturasPaginadas = resultado.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

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

        const facturasNormales = resultadoFacturas.facturas.map(f => ({
          ...f,
          total: Number(f?.total || 0),
          saldoPendiente: Number(f?.saldoPendiente || 0),
          tipoFactura: f.tipoFactura || 'NORMAL'
        }));

        const facturasDeudaConvertidas = resultadoPagos.pagos.map((deuda: any) => ({
          id: deuda.facturaIdPersonalizado || deuda.id,
          idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
          clienteNombre: deuda.clienteNombre || '',
          clienteTelefono: deuda.clienteTelefono || '',
          clienteId: deuda.clienteId || '',
          fecha: deuda.fechaPago || new Date(),
          total: Number(deuda.totalFactura || 0),
          abonado: Number(deuda.abonadoNuevo || 0),
          saldoPendiente: Number(deuda.saldoNuevo || 0),
          metodoPago: deuda.metodoPago || '',
          items: deuda.items || [],
          esCredito: deuda.esCreditoPersonal || false,
          estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
          tipoFactura: 'COBRO_DEUDA',
          usuarioId: deuda.usuarioId || '',
          usuarioNombre: deuda.usuarioNombre || '',
          createdAt: deuda.createdAt || new Date(),
          updatedAt: deuda.updatedAt || new Date(),
          origenCaja: deuda.origenCaja || '',
          cajaChicaId: deuda.cajaChicaId || ''
        }));

        const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
        todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

        this.facturasPaginadas = todasFacturas.slice(0, this.facturasPorPagina);
        this.hasMore = true;
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
      queryParams: { clienteId }
    });
  }

  nuevaVenta() {
    this.router.navigate(['/clientes/historial-clinico']);
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
        
        // 1️⃣ REVERTIR STOCK DE PRODUCTOS
        console.log('🔄 Revirtiendo stock de productos...');
        for (const item of factura.items || []) {
          // Saltar servicios (no afectan inventario)
          if (item.esServicio) {
            console.log(`⏭️ Saltando servicio: "${item.nombre}"`);
            continue;
          }
          
          if (item.productoId && item.cantidad > 0) {
            try {
              await this.productosSrv.incrementarStock(item.productoId, item.cantidad);
              console.log(`✅ Stock restaurado: ${item.nombre} (+${item.cantidad})`);
            } catch (error) {
              console.error(`Error restaurando stock de "${item.nombre}":`, error);
              // Continuar con otros productos aunque falle uno
            }
          }
        }
        
        // 2️⃣ ELIMINAR MOVIMIENTO DE CAJA CHICA (Solo efectivo)
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
        
        // 3️⃣ ELIMINAR FACTURA
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

