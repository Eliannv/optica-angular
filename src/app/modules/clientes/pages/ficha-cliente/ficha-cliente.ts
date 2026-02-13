/**
 * Componente Ficha del Cliente - Vista completa de información clínica y financiera.
 *
 * Este componente centraliza toda la información relevante de un cliente mediante
 * un sistema de pestañas que organizan la información en secciones lógicas:
 *
 * 📋 Pestañas:
 * 1. Información - Datos personales y de contacto
 * 2. Historial Clínico - Historiales oftalmológicos (reutiliza componentes existentes)
 * 3. Facturación - Dashboard financiero completo con estadísticas y listado de facturas
 *
 * ⚠️ La pestaña "Cuentas" fue eliminada para centralizar TODO lo financiero en Facturación.
 *
 * Este componente reemplaza la antigua vista de "historial clínico" que mezclaba
 * gestión de clientes con atención clínica. Ahora solo se accede mediante búsqueda
 * previa del cliente, optimizando el rendimiento.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ClientesService } from '../../../../core/services/clientes';
import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { FacturasService } from '../../../../core/services/facturas';
import { FacturasDeudaService } from '../../../../core/services/facturas-deuda.service';
import { Cliente } from '../../../../core/models/cliente.model';
import { Factura } from '../../../../core/models/factura.model';

// Importar componentes reutilizables
import { SeleccionarHistorialComponent } from '../seleccionar-historial/seleccionar-historial';

@Component({
  imports: [CommonModule, FormsModule, SeleccionarHistorialComponent],
  standalone: true,
  selector: 'app-ficha-cliente',
  templateUrl: './ficha-cliente.html',
  styleUrl: './ficha-cliente.css'
})
export class FichaClienteComponent implements OnInit {

  clienteId: string | null = null;
  cliente: Cliente | null = null;
  cargando = true;
  returnTo = '';
  
  // Control de pestañas (Cuentas eliminada - todo en Facturación)
  tabActiva: 'informacion' | 'historial' | 'facturas' = 'informacion';

  // Datos de facturas
  facturas: Factura[] = []; // Todas las facturas del cliente (sin filtrar)
  facturasFiltradas: Factura[] = []; // Facturas después de aplicar filtros
  facturasPaginadas: Factura[] = []; // Facturas de la página actual (paginación)
  cargandoFacturas = false;

  // Resumen financiero (usado en alerta de header)
  resumenDeuda = {
    deudaTotal: 0,
    pendientes: 0,
    creditosActivos: 0,
    creditoPersonalActivo: false
  };

  // Dashboard financiero (ÚNICA FUENTE DE VERDAD)
  estadisticasFinancieras = {
    totalFacturado: 0,      // Suma de total de TODAS las facturas
    totalPagado: 0,         // Suma de montoPagado de todas las facturas y pagos de deuda
    totalPendiente: 0,      // Total facturado - Total pagado (solo facturas con saldo > 0)
    numeroFacturas: 0,      // Total de facturas del cliente
    promedioCompra: 0,      // Total facturado / número de facturas
    ultimaFactura: null as any // Factura más reciente
  };

  // Paginación
  paginaActual = 1;
  facturasPorPagina = 10;
  totalPaginas = 0;

  // Periodos disponibles (Mes/Año de las facturas)
  periodosDisponibles: Array<{mes: number, anio: number, label: string, value: string}> = [];

  // Filtros de facturación
  filtros = {
    busqueda: '',          // Búsqueda por número de factura
    periodo: 'todos',      // 'todos' o 'MM/YYYY' (ej: '01/2026')
    estado: 'todos',       // 'todos', 'PAGADA', 'PENDIENTE'
    tipo: 'todos'          // 'todos', 'NORMAL', 'COBRO_DEUDA'
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientesSrv: ClientesService,
    private readonly historialSrv: HistorialClinicoService,
    private readonly facturasSrv: FacturasService,
    private readonly facturasDeudaSrv: FacturasDeudaService
  ) {}

  async ngOnInit(): Promise<void> {
    // Obtener ID del cliente desde la ruta
    this.clienteId = this.route.snapshot.paramMap.get('id');
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '';
    console.log('🆔 Cliente ID desde ruta:', this.clienteId);
    
    if (!this.clienteId) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se especificó un cliente',
        confirmButtonText: 'Volver'
      });
      this.router.navigate(['/clientes/historial-clinico']);
      return;
    }

    await this.cargarCliente();
    this.cargando = false;
  }

  /**
   * Carga la información del cliente.
   */
  private async cargarCliente(): Promise<void> {
    try {
      if (!this.clienteId) return;
      
      this.cliente = await firstValueFrom(
        this.clientesSrv.getClienteById(this.clienteId)
      );

      // Cargar resumen de deuda
      await this.cargarResumenDeuda();

    } catch (error) {
      console.error('Error al cargar cliente:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la información del cliente',
        confirmButtonText: 'Volver'
      });
      this.router.navigate(['/clientes/historial-clinico']);
    }
  }

  /**
   * Carga el resumen de deuda del cliente.
   */
  private async cargarResumenDeuda(): Promise<void> {
    if (!this.clienteId) return;
    
    try {
      this.resumenDeuda = await this.facturasSrv.getResumenDeuda(this.clienteId);
    } catch (error) {
      console.error('Error al cargar resumen de deuda:', error);
    }
  }

  /**
   * Carga las facturas del cliente (normales y pagos de deuda).
   */
  private async cargarFacturas(): Promise<void> {
    if (!this.clienteId || this.facturas.length > 0) return;
    
    this.cargandoFacturas = true;
    try {
      console.log('🔍 Cargando facturas para clienteId:', this.clienteId);
      
      // Cargar facturas normales
      const facturasNormales = await firstValueFrom(
        this.facturasSrv.getFacturasPorCliente(this.clienteId)
      );
      console.log('📄 Facturas normales:', facturasNormales.length);
      
      // Cargar pagos de deuda
      const pagosDeuda = await firstValueFrom(
        this.facturasDeudaSrv.getPagosPorCliente(this.clienteId)
      );
      console.log('💰 Pagos de deuda:', pagosDeuda.length);
      
      // Transformar pagos de deuda a formato de factura
      const deudasTransformadas = await this.transformarPagosDeuda(pagosDeuda);
      
      // Combinar y ordenar por fecha descendente
      this.facturas = [...facturasNormales, ...deudasTransformadas]
        .sort((a, b) => {
          const fechaA = this.obtenerFechaComparable(a.fecha);
          const fechaB = this.obtenerFechaComparable(b.fecha);
          return fechaB.getTime() - fechaA.getTime();
        });
      
      console.log('✅ Total facturas (normales + deudas):', this.facturas.length);
      
      // Generar periodos disponibles
      this.generarPeriodosDisponibles();
      
      // Calcular estadísticas financieras
      this.calcularEstadisticasFinancieras();
      
      // Aplicar filtros iniciales
      this.aplicarFiltros();
    } catch (error) {
      console.error('❌ Error al cargar facturas:', error);
      this.facturas = [];
      this.facturasFiltradas = [];
      this.facturasPaginadas = [];
    } finally {
      this.cargandoFacturas = false;
    }
  }

  /**
   * Transforma pagos de deuda en formato compatible con facturas.
   */
  private async transformarPagosDeuda(pagos: any[]): Promise<any[]> {
    // Obtener facturas originales para cada pago
    const facturasOriginalesMap = new Map<string, any>();
    const facturasIds = [...new Set(pagos.map(p => p.facturaId).filter(Boolean))];
    
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
      const montoPagado = Number(deuda.montoPagado || 0);
      const saldoPendiente = facturaOriginal?.saldoPendiente ?? Number(deuda.saldoRestante || 0);
      const total = facturaOriginal?.total ?? Number(deuda.totalFactura || 0);

      return {
        id: deuda.id,
        facturaId: deuda.facturaId,
        idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
        clienteNombre: deuda.clienteNombre || '',
        clienteId: deuda.clienteId || '',
        fecha: deuda.fechaPago || new Date(),
        total,
        abonado: montoPagado,
        saldoPendiente,
        metodoPago: deuda.metodoPago || '',
        items: deuda.items || [],
        estadoPago: facturaOriginal?.estadoPago ?? 'PENDIENTE',
        tipoFactura: 'COBRO_DEUDA',
        usuarioId: deuda.usuarioId || ''
      };
    });
  }

  /**
   * Obtiene una fecha comparable desde cualquier formato.
   */
  private obtenerFechaComparable(fecha: any): Date {
    if (!fecha) return new Date(0);
    if (typeof fecha?.toDate === 'function') return fecha.toDate();
    if (fecha instanceof Date) return fecha;
    return new Date(fecha);
  }

  /**
   * Cambia la pestaña activa.
   */
  cambiarTab(tab: 'informacion' | 'historial' | 'facturas'): void {
    console.log('🔄 Cambiando a pestaña:', tab);
    this.tabActiva = tab;
    
    // Cargar datos de la pestaña según sea necesario
    if (tab === 'facturas' && this.facturas.length === 0) {
      console.log('📋 Cargando facturas (array vacío)...');
      this.cargarFacturas();
    } else if (tab === 'facturas') {
      console.log('📋 Ya hay facturas cargadas:', this.facturas.length);
    }
  }

  /**
   * Aplica los filtros a la lista de facturas.
   * ⚠️ Las estadísticas financieras NO se ven afectadas por filtros.
   */
  aplicarFiltros(): void {
    let resultado = [...this.facturas];

    // Filtro de búsqueda por número
    if (this.filtros.busqueda.trim()) {
      const busqueda = this.filtros.busqueda.toLowerCase().trim();
      resultado = resultado.filter(f => 
        (f.idPersonalizado || f.id || '').toLowerCase().includes(busqueda)
      );
    }

    // Filtro de periodo (Mes/Año)
    if (this.filtros.periodo !== 'todos') {
      const [mes, anio] = this.filtros.periodo.split('/').map(Number);
      resultado = resultado.filter(f => {
        const fecha = this.obtenerFechaComparable(f.fecha);
        return fecha.getMonth() === (mes - 1) && fecha.getFullYear() === anio;
      });
    }

    // Filtro de estado
    if (this.filtros.estado !== 'todos') {
      resultado = resultado.filter(f => f.estadoPago === this.filtros.estado);
    }

    // Filtro de tipo
    if (this.filtros.tipo !== 'todos') {
      if (this.filtros.tipo === 'NORMAL') {
        resultado = resultado.filter(f => f.tipoFactura !== 'COBRO_DEUDA');
      } else {
        resultado = resultado.filter(f => f.tipoFactura === this.filtros.tipo);
      }
    }

    this.facturasFiltradas = resultado;
    
    // Reiniciar a la primera página cuando cambian los filtros
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  /**
   * Resetea todos los filtros.
   */
  limpiarFiltros(): void {
    this.filtros = {
      busqueda: '',
      periodo: 'todos',
      estado: 'todos',
      tipo: 'todos'
    };
    this.aplicarFiltros();
  }

  /**
   * Actualiza la paginación según las facturas filtradas.
   */
  actualizarPaginacion(): void {
    this.totalPaginas = Math.ceil(this.facturasFiltradas.length / this.facturasPorPagina);
    const inicio = (this.paginaActual - 1) * this.facturasPorPagina;
    const fin = inicio + this.facturasPorPagina;
    this.facturasPaginadas = this.facturasFiltradas.slice(inicio, fin);
  }

  /**
   * Navega a la página siguiente.
   */
  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
      this.actualizarPaginacion();
    }
  }

  /**
   * Navega a la página anterior.
   */
  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.actualizarPaginacion();
    }
  }

  /**
   * Genera los periodos disponibles desde las facturas del cliente.
   */
  private generarPeriodosDisponibles(): void {
    const periodosMap = new Map<string, {mes: number, anio: number}>();
    
    this.facturas.forEach(factura => {
      const fecha = this.obtenerFechaComparable(factura.fecha);
      const mes = fecha.getMonth() + 1; // 1-12
      const anio = fecha.getFullYear();
      const key = `${mes}/${anio}`;
      
      if (!periodosMap.has(key)) {
        periodosMap.set(key, { mes, anio });
      }
    });

    // Convertir a array y ordenar por fecha descendente
    this.periodosDisponibles = Array.from(periodosMap.values())
      .sort((a, b) => {
        if (a.anio !== b.anio) return b.anio - a.anio;
        return b.mes - a.mes;
      })
      .map(p => ({
        mes: p.mes,
        anio: p.anio,
        label: this.obtenerNombrePeriodo(p.mes, p.anio),
        value: `${String(p.mes).padStart(2, '0')}/${p.anio}`
      }));
  }

  /**
   * Obtiene el nombre del periodo (ej: "Enero 2026").
   */
  private obtenerNombrePeriodo(mes: number, anio: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[mes - 1]} ${anio}`;
  }

  /**
   * Calcula las estadísticas financieras del cliente.
   * ⚠️ Estas estadísticas SIEMPRE usan TODAS las facturas, sin filtros.
   */
  private calcularEstadisticasFinancieras(): void {
    // Filtrar facturas normales (excluir cobros de deuda para totales)
    const facturasNormales = this.facturas.filter(f => f.tipoFactura !== 'COBRO_DEUDA');
    
    // Total facturado histórico
    this.estadisticasFinancieras.totalFacturado = facturasNormales.reduce(
      (sum, f) => sum + (f.total || this.calcularTotalFactura(f)),
      0
    );

    // Total pagado (sumar abonado de facturas normales)
    this.estadisticasFinancieras.totalPagado = facturasNormales.reduce(
      (sum, f) => sum + (f.abonado || 0),
      0
    );

    // Total pendiente (usar el cálculo de resumenDeuda que ya considera pagos)
    this.estadisticasFinancieras.totalPendiente = this.resumenDeuda.deudaTotal;

    // Número de facturas
    this.estadisticasFinancieras.numeroFacturas = facturasNormales.length;

    // Promedio de compra
    this.estadisticasFinancieras.promedioCompra = 
      this.estadisticasFinancieras.numeroFacturas > 0
        ? this.estadisticasFinancieras.totalFacturado / this.estadisticasFinancieras.numeroFacturas
        : 0;

    // Última factura (la primera en el array ya está ordenado por fecha desc)
    this.estadisticasFinancieras.ultimaFactura = facturasNormales.length > 0 
      ? facturasNormales[0] 
      : null;
  }

  /**
   * Navega al formulario de edición del cliente.
   */
  editarCliente(): void {
    if (!this.clienteId) return;
    
    this.router.navigate(['/clientes/crear'], {
      queryParams: {
        id: this.clienteId,
        returnTo: `/clientes/ficha/${this.clienteId}`
      }
    });
  }

  /**
   * Navega a cobrar deuda del cliente.
   */
  cobrarDeuda(): void {
    if (!this.clienteId) return;
    
    this.router.navigate(['/ventas/deuda'], {
      queryParams: { 
        clienteId: this.clienteId,
        returnTo: this.router.url
      }
    });
  }

  /**
   * Navega al buscador de clientes.
   */
  volverBuscador(): void {
    if (this.returnTo) {
      this.router.navigateByUrl(this.returnTo);
      return;
    }

    this.router.navigate(['/clientes/historial-clinico']);
  }

  /**
   * Formatea un valor de moneda.
   */
  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(valor);
  }

  /**
   * Calcula el total de una factura.
   */
  calcularTotalFactura(factura: Factura): number {
    // Si la factura tiene un campo 'total' directamente, usarlo
    if (factura.total !== undefined) {
      return factura.total;
    }
    
    // Si no, intentar calcular desde productos
    const productos = (factura as any).productos;
    if (Array.isArray(productos)) {
      return productos.reduce((sum: number, p: any) => sum + (p.total || 0), 0);
    }
    
    return 0;
  }

  /**
   * Formatea una fecha.
   */
  formatearFecha(fecha: any): string {
    try {
      if (!fecha) return '-';
      
      let dateObj: Date;
      if (typeof fecha?.toDate === 'function') {
        dateObj = fecha.toDate();
      } else if (fecha instanceof Date) {
        dateObj = fecha;
      } else {
        return '-';
      }
      
      return new Intl.DateTimeFormat('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(dateObj);
    } catch {
      return '-';
    }
  }

  /**
   * Abre el modal para ver el detalle de una factura.
   */
  verFactura(factura: Factura): void {
    this.router.navigate(['/facturas', factura.id]);
  }

  /**
   * Navega para cobrar una factura pendiente.
   */
  cobrarFactura(factura: Factura): void {
    this.router.navigate(['/ventas/deuda'], {
      queryParams: { 
        clienteId: this.clienteId,
        facturaId: factura.id,
        returnTo: this.router.url
      }
    });
  }
}
