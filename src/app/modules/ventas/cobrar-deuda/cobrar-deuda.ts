import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ClientesService } from '../../../core/services/clientes';
import { FacturasService } from '../../../core/services/facturas';
import { ProductosService } from '../../../core/services/productos';
import { CajaChicaService } from '../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../core/services/caja-banco.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-cobrar-deuda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobrar-deuda.html',
  styleUrls: ['./cobrar-deuda.css'], // aquí copiamos el CSS de crear-venta
})
export class CobrarDeudaComponent implements OnInit, OnDestroy {
  loading = true;

  clienteId = '';
  clienteNombre = '';

  pendientes: any[] = [];
  deudaTotal = 0;

  facturaSeleccionada: any = null;

  metodoPago = 'Efectivo';
  codigoTransferencia = ''; // Código de transferencia bancaria
  ultimosCuatroTarjeta = ''; // Últimos 4 dígitos de la tarjeta
  abono = 0;
  saldoNuevo = 0;

  // ✅ CONTROL DE CRÉDITO PERSONAL
  esCreditoPersonal = false; // Checkbox para marcar si es crédito personal

  pagando = false;
  sub?: Subscription;

  // ✅ ticket
  ticketPago: any = null;

  // ✅ FILTROS Y BÚSQUEDA
  filtroFactura = ''; // Búsqueda por número de factura
  filtroFecha = ''; // Filtro por fecha (YYYY-MM-DD)
  filtroCredito: 'todos' | 'conCredito' | 'sinCredito' = 'todos'; // Filtro por tipo de crédito
  selectedIndex = -1; // Índice de factura seleccionada con teclado

  // Getters para facturas filtradas
  get facturasFiltradas(): any[] {
    return this.pendientes.filter(f => {
      // Filtro por número de factura
      if (this.filtroFactura.trim()) {
        const numero = f.id?.toString().toLowerCase() || '';
        if (!numero.includes(this.filtroFactura.toLowerCase())) {
          return false;
        }
      }

      // Filtro por fecha
      if (this.filtroFecha.trim()) {
        const fechaFactura = f.fecha?.toDate ? f.fecha.toDate() : new Date(f.fecha);
        // Convertir ambas fechas a YYYY-MM-DD para comparar sin timezone
        const facturaIso = fechaFactura.getFullYear().toString().padStart(4, '0') + '-' +
                          (fechaFactura.getMonth() + 1).toString().padStart(2, '0') + '-' +
                          fechaFactura.getDate().toString().padStart(2, '0');
        const filtroIso = this.filtroFecha.trim(); // Ya viene en formato YYYY-MM-DD
        if (facturaIso !== filtroIso) {
          return false;
        }
      }

      // Filtro por crédito
      if (this.filtroCredito === 'conCredito' && !f.esCredito) {
        return false;
      }
      if (this.filtroCredito === 'sinCredito' && f.esCredito) {
        return false;
      }

      return true;
    });
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientesSrv: ClientesService,
    private facturasSrv: FacturasService,
    private productosSrv: ProductosService,
    private cajaChicaService: CajaChicaService,
    private cajaBancoService: CajaBancoService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // 🔒 VALIDACIÓN CRÍTICA: Verificar estado detallado de caja chica para hoy
    try {
      const validacion = await this.cajaChicaService.validarCajaChicaHoy();
      
      // ✅ Caja ABIERTA - Permitir entrada
      if (validacion.valida && validacion.tipo === 'ABIERTA') {
        // Continuamos con la carga normal
      } 
      // ❌ Caja CERRADA - Bloquear con mensaje específico
      else if (validacion.tipo === 'CERRADA') {
        let fechaDisplay = 'hoy';
        if (validacion.caja?.fecha) {
          try {
            const fecha = validacion.caja.fecha instanceof Date ? validacion.caja.fecha : (validacion.caja.fecha as any).toDate?.() || new Date(validacion.caja.fecha);
            if (!isNaN(fecha.getTime())) {
              fechaDisplay = fecha.toLocaleDateString('es-ES');
            }
          } catch (e) {
            fechaDisplay = 'hoy';
          }
        }
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica Cerrada',
          text: `La caja chica de ${fechaDisplay} ya fue cerrada. No se pueden registrar abonos con una caja cerrada.`,
          confirmButtonText: 'Abrir Nueva Caja Chica',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/caja-chica']);
        });
        return;
      }
      // ❌ NO EXISTE caja para hoy - Bloquear con indicación de crear
      else {
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica No Encontrada',
          text: 'No hay una caja chica abierta para hoy. Debe crear una caja chica antes de poder registrar abonos.',
          confirmButtonText: 'Crear Caja Chica',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/caja-chica']);
        });
        return;
      }
    } catch (error) {
      console.error('Error al validar caja chica:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al verificar la caja chica. Intente nuevamente.',
        confirmButtonText: 'Volver'
      }).then(() => {
        this.router.navigate(['/caja-chica']);
      });
      return;
    }

    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';
    if (!this.clienteId) {
      this.router.navigate(['/clientes/historial-clinico']);
      return;
    }

    try {
      const cli = await firstValueFrom(this.clientesSrv.getClienteById(this.clienteId));
      this.clienteNombre = `${cli?.nombres || ''} ${cli?.apellidos || ''}`.trim();

      this.sub = this.facturasSrv.getPendientesPorCliente(this.clienteId).subscribe(list => {
        this.pendientes = list || [];
        this.deudaTotal = +this.pendientes.reduce((acc, f) => acc + Number(f?.saldoPendiente || 0), 0).toFixed(2);

        // si la seleccionada ya no existe (pagada), limpiar
        if (this.facturaSeleccionada) {
          const still = this.pendientes.find(x => x.id === this.facturaSeleccionada.id);
          if (!still) {
            this.facturaSeleccionada = null;
            this.abono = 0;
            this.saldoNuevo = 0;
          } else {
            // refrescar datos en pantalla
            this.facturaSeleccionada = still;
            this.recalcularSaldoNuevo();
          }
        }
      });
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // ✅ BÚSQUEDA Y FILTROS
  limpiarFiltros() {
    this.filtroFactura = '';
    this.filtroFecha = '';
    this.filtroCredito = 'todos';
    this.selectedIndex = -1;
    this.facturaSeleccionada = null;
  }

  // ✅ NAVEGACIÓN CON TECLADO (como en crear-venta)
  onSearchKeydown(event: KeyboardEvent) {
    const filtradas = this.facturasFiltradas;
    if (filtradas.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, filtradas.length - 1);
      this.scrollToSelectedFactura();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.scrollToSelectedFactura();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Si no hay selección, seleccionar la primera
      if (this.selectedIndex < 0 && filtradas.length > 0) {
        this.selectedIndex = 0;
      }
      // Seleccionar la factura en el índice actual
      if (this.selectedIndex >= 0 && this.selectedIndex < filtradas.length) {
        const f = filtradas[this.selectedIndex];
        if (f) {
          this.facturaSeleccionada = f;
          this.abono = 0;
          this.metodoPago = 'Efectivo';
          this.codigoTransferencia = '';
          this.ultimosCuatroTarjeta = '';
          this.esCreditoPersonal = f?.esCredito || false;
          this.recalcularSaldoNuevo();
        }
      }
    }
  }

  // ✅ NAVEGACIÓN GLOBAL CON TECLADO
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    // Solo si el usuario está en el componente
    const filtradas = this.facturasFiltradas;
    if (!filtradas || filtradas.length === 0) return;

    // ArrowDown y ArrowUp funcionan en cualquier parte
    if (event.key === 'ArrowDown' && (event.target as HTMLElement)?.tagName !== 'TEXTAREA') {
      if ((event.target as HTMLElement)?.tagName !== 'INPUT' || (event.target as any)?.type === 'date' || (event.target as any)?.type === 'select-one') {
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, filtradas.length - 1);
        this.scrollToSelectedFactura();
      }
    } else if (event.key === 'ArrowUp' && (event.target as HTMLElement)?.tagName !== 'TEXTAREA') {
      if ((event.target as HTMLElement)?.tagName !== 'INPUT' || (event.target as any)?.type === 'date' || (event.target as any)?.type === 'select-one') {
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollToSelectedFactura();
      }
    }
  }

  // ✅ AUTO-SCROLL A LA FACTURA SELECCIONADA
  private scrollToSelectedFactura() {
    setTimeout(() => {
      const elementos = document.querySelectorAll('.producto-item');
      if (this.selectedIndex >= 0 && this.selectedIndex < elementos.length) {
        const elemento = elementos[this.selectedIndex] as HTMLElement;
        elemento.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 0);
  }

  seleccionarFactura(f: any, desdeKeyboard = false) {
    this.facturaSeleccionada = f;
    this.abono = 0;
    this.metodoPago = 'Efectivo';
    this.codigoTransferencia = '';
    this.ultimosCuatroTarjeta = '';
    // ✅ Cargar estado de crédito personal si aplica
    this.esCreditoPersonal = f?.esCredito || false;
    this.recalcularSaldoNuevo();
    // Solo recalcular índice si se hizo click (no desde keyboard)
    if (!desdeKeyboard) {
      this.selectedIndex = this.facturasFiltradas.findIndex(x => x.id === f.id);
    }
  }

  onChangeAbono(value: any) {
    const saldo = Number(this.facturaSeleccionada?.saldoPendiente || 0);
    const n = Math.max(0, Number(value || 0));
    this.abono = Math.min(n, saldo);
    this.recalcularSaldoNuevo();
  }

  private recalcularSaldoNuevo() {
    const saldo = Number(this.facturaSeleccionada?.saldoPendiente || 0);
    this.saldoNuevo = +(saldo - this.abono).toFixed(2);
    if (this.saldoNuevo < 0) this.saldoNuevo = 0;
  }

  async registrarAbono() {
    if (!this.facturaSeleccionada || this.abono <= 0 || this.pagando) return;

    this.pagando = true;

    try {
      const f = this.facturaSeleccionada;

      const total = Number(f?.total || 0);
      const abonadoAnterior = Number(f?.abonado || 0);
      const saldoAnterior = Number(f?.saldoPendiente || 0);

      const abonoReal = Math.min(this.abono, saldoAnterior);

      const abonadoNuevo = +(abonadoAnterior + abonoReal).toFixed(2);
      const saldoNuevo = +(total - abonadoNuevo).toFixed(2);
      const estadoPago = saldoNuevo <= 0 ? 'PAGADA' : 'PENDIENTE';

      // ✅ ACTUALIZAR ESTADO DEL CRÉDITO Y OTROS CAMPOS
      const actualizacion: any = {
        abonado: abonadoNuevo,
        saldoPendiente: Math.max(0, saldoNuevo),
        estadoPago,
        metodoPago: this.metodoPago,
      };

      // ✅ SI EL USUARIO MARCÓ CRÉDITO PERSONAL, GUARDAR ESE ESTADO
      if (this.esCreditoPersonal) {
        actualizacion.esCredito = true;
        // Si es crédito personal y el saldo se cancela completamente
        if (saldoNuevo <= 0) {
          actualizacion.estadoCredito = 'CANCELADO';
        } else {
          actualizacion.estadoCredito = 'ACTIVO';
        }
      } else {
        // Si el usuario NO marca crédito, asegurar que se registre como normal
        actualizacion.esCredito = false;
        actualizacion.estadoCredito = 'CANCELADO'; // No aplica estado de crédito
      }

      await this.facturasSrv.actualizarPagoFactura(f.id, actualizacion);

      // ✅ enriquecer ítems con código real si falta
      const items = Array.isArray(f.items) ? [...f.items] : [];
      for (const it of items) {
        if (!it.codigo && it.productoId) {
          try {
            const prod: any = await firstValueFrom(this.productosSrv.getProductoById(it.productoId));
            it.codigo = prod?.codigo || it.productoId;
          } catch (err) {
            it.codigo = it.productoId;
          }
        }
      }

      // ✅ ticket con tu estilo + ítems
      this.ticketPago = {
        facturaId: f.id,
        fecha: new Date(),
        clienteNombre: this.clienteNombre,
        metodoPago: this.metodoPago,
        totalFactura: total,
        abonadoAnterior,
        abonoRealizado: abonoReal,
        abonadoNuevo,
        saldoNuevo: Math.max(0, saldoNuevo),
        esCreditoPersonal: this.esCreditoPersonal, // ✅ Usar lo que el usuario seleccionó
        items,
      };

      // ✅ Imprimir con ventana dedicada (mismo patrón que factura/pos)
      setTimeout(() => {
        const ticketEl = document.querySelector('.ticket') as HTMLElement | null;
        if (!ticketEl) return;

        const w = window.open('', 'PRINT', 'height=600,width=380');
        if (!w) return;

        const styles = `
          html, body { margin: 0; padding: 0; width: 80mm; background: #fff; font-family: monospace; }
          .ticket { padding: 6px 4px; font-size: 12px; line-height: 1.2; width: 80mm; box-sizing: border-box; }
          .t-center { text-align: center; }
          .t-right { text-align: right; }
          .t-bold { font-weight: 700; }
          .t-hr { border-top: 1px dashed #000; margin: 6px 0; }
          .t-kv { display: flex; justify-content: space-between; gap: 4px; }
          .t-kv span:first-child { width: 32mm; }
          .t-kv span:last-child { flex: 1; text-align: right; }
          .t-table-head, .t-table-row { display: grid; grid-template-columns: 8mm 30mm 8mm 12mm 12mm; column-gap: 2mm; row-gap: 0; align-items: center; }
          .t-table-head { font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 4px; }
          .t-table-row { margin: 0 0 2px 0; }
          .t-cell { display: block; }
          .t-cut { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .t-small { font-size: 11px; }
          @media print { @page { size: 80mm auto; margin: 0; } html, body { width: 80mm; margin: 0; padding: 0; } .ticket { width: 80mm; } }
        `;

        w.document.write(`
          <html>
            <head>
              <title>Comprobante de Abono</title>
              <style>${styles}</style>
            </head>
            <body>
              ${ticketEl.outerHTML}
            </body>
          </html>
        `);
        w.document.close();

        const triggerPrint = () => {
          let closed = false;
          const safeClose = () => { if (closed) return; closed = true; w.close(); };
          try {
            w.focus();
            w.addEventListener('afterprint', safeClose, { once: true });
            w.print();
            setTimeout(safeClose, 2000);
          } catch {
            safeClose();
          }
        };

        if (w.document.readyState === 'complete') {
          setTimeout(triggerPrint, 150);
        } else {
          w.onload = () => setTimeout(triggerPrint, 150);
        }
      }, 0);

      // limpiar campos
      this.abono = 0;
      this.saldoNuevo = 0;

      // 💰 Registrar automáticamente en Caja Chica si el pago es en efectivo
      if (this.metodoPago === 'Efectivo' && abonoReal > 0) {
        try {
          const cajaAbiertaId = localStorage.getItem('cajaChicaAbierta');
          if (cajaAbiertaId) {
            const usuario = this.authService.getCurrentUser();
            const movimiento = {
              caja_chica_id: cajaAbiertaId,
              fecha: new Date(),
              tipo: 'INGRESO' as const,
              descripcion: `Pago de deuda - ${this.clienteNombre} - Factura #${f.id}`,
              monto: abonoReal,
              comprobante: f.id,
            };
            if (usuario?.id) {
              (movimiento as any).usuario_id = usuario.id;
              (movimiento as any).usuario_nombre = usuario.nombre || 'Usuario';
            }
            await this.cajaChicaService.registrarMovimiento(cajaAbiertaId, movimiento);
            console.log('✅ Pago de deuda registrado en Caja Chica:', abonoReal);
          }
        } catch (err) {
          console.warn('No se pudo registrar el pago en Caja Chica:', err);
          // No fallar la operación si hay error en Caja Chica
        }
      } else if (this.metodoPago === 'Transferencia' && this.codigoTransferencia.trim() && abonoReal > 0) {
        // 🏦 Pago por TRANSFERENCIA → Registrar en Caja Banco
        try {
          const usuario = this.authService.getCurrentUser();
          await this.cajaBancoService.registrarTransferenciaCliente(
            abonoReal,
            this.codigoTransferencia,
            f.id,
            usuario?.id || '',
            usuario?.nombre || 'Usuario'
          );
          console.log('✅ Pago de deuda registrado en Caja Banco');
        } catch (err) {
          console.error('❌ Error registrando transferencia en Caja Banco:', err);
          // Mostrar advertencia pero no fallar la operación
          Swal.fire({
            icon: 'warning',
            title: 'Advertencia',
            text: `El pago se registró pero hubo un error al registrar la transferencia en caja banco: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            confirmButtonText: 'Aceptar'
          });
        }
      } else if (this.metodoPago === 'Tarjeta' && this.ultimosCuatroTarjeta.trim() && abonoReal > 0) {
        // 💳 Pago por TARJETA → Registrar en Caja Banco
        try {
          const usuario = this.authService.getCurrentUser();
          await this.cajaBancoService.registrarPagoTarjeta(
            abonoReal,
            this.ultimosCuatroTarjeta,
            f.id,
            usuario?.id || '',
            usuario?.nombre || 'Usuario'
          );
          console.log('✅ Pago por tarjeta registrado en Caja Banco');
        } catch (err) {
          console.error('❌ Error registrando pago por tarjeta en Caja Banco:', err);
          // Mostrar advertencia pero no fallar la operación
          Swal.fire({
            icon: 'warning',
            title: 'Advertencia',
            text: `El pago se registró pero hubo un error al registrar el pago por tarjeta en caja banco: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            confirmButtonText: 'Aceptar'
          });
        }
      }

      // ✅ MOSTRAR SWAL DE ÉXITO Y REGRESAR A HISTORIAL
      await Swal.fire({
        icon: 'success',
        title: '¡Deuda Cobrada!',
        text: `Se registró el abono de $${abonoReal.toFixed(2)} correctamente.`,
        confirmButtonText: 'Aceptar'
      });

      // Regresar a historial-clinico
      this.router.navigate(['/clientes/historial-clinico']);

    } catch (e: any) {
      console.error(e);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el abono',
        confirmButtonText: 'Entendido'
      });
    } finally {
      this.pagando = false;
    }
  }

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}
