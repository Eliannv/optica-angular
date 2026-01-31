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
import { obtenerPeriodo } from '../../../core/utils/fecha-helpers';

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
  clienteTelefono = '';

  pendientes: any[] = [];
  deudaTotal = 0;

  facturaSeleccionada: any = null;

  metodoPago = 'Efectivo';
  codigoTransferencia = ''; // Código de transferencia bancaria
  ultimosCuatroTarjeta = ''; // Últimos 4 dígitos de la tarjeta
  montoRecibido = 0; // 💵 Cuánto dinero entrega el cliente (solo visual)
  abono = 0;
  saldoNuevo = 0;

  // 🕐 FECHA Y HORA DE PAGO
  horaPago = ''; // Hora del pago (HH:mm)
  fechaPago = ''; // Fecha del pago (YYYY-MM-DD) - solo para transferencia/tarjeta
  fechaMinima = ''; // Fecha mínima permitida (inicio del periodo de caja banco)
  fechaMaxima = ''; // Fecha máxima permitida (fin del periodo de caja banco o hoy)
  periodoNombre = ''; // Nombre del periodo para mostrar (ej: "Diciembre 2025")

  // ✅ CONTROL DE CRÉDITO PERSONAL
  esCreditoPersonal = false; // Checkbox para marcar si es crédito personal

  pagando = false;
  sub?: Subscription;

  // ✅ ticket
  ticketPago: any = null;

  // ✅ FILTROS Y BÚSQUEDA
  filtroFactura = ''; // Búsqueda por número de factura

  /**
   * Calcula el vuelto automáticamente
   * Vuelto = Abono - Saldo Pendiente (solo si abono es mayor)
   */
  get vuelto(): number {
    if (this.metodoPago !== 'Efectivo') return 0;
    const abonoActual = Number(this.abono || 0);
    const saldoActual = this.facturaSeleccionada?.saldoPendiente || 0;
    return Math.max(0, abonoActual - saldoActual);
  }

  /**
   * Verifica si el usuario es administrador
   * Solo los administradores pueden modificar fecha y hora manualmente
   */
  get esAdmin(): boolean {
    return this.authService.isAdmin();
  }
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
    // � Inicializar fecha y hora por defecto
    this.inicializarFechaHora();
    
    // �🔒 VALIDACIÓN CRÍTICA: Verificar que exista alguna caja chica ABIERTA
    try {
      const validacion = await this.cajaChicaService.validarCajaAbierta();
      
      // ✅ Caja ABIERTA - Permitir entrada
      if (validacion.valida) {
        // Continuamos con la carga normal
      } 
      // ❌ NO existe caja ABIERTA
      else {
        await Swal.fire({
          icon: 'error',
          title: 'Caja Chica Requerida',
          text: 'Debe tener al menos una caja chica ABIERTA para cobrar deudas (puede ser de cualquier fecha).',
          confirmButtonText: 'Ir a Caja Chica',
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
      this.clienteTelefono = cli?.telefono || '';

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
    const n = Math.max(0, Number(value || 0));
    this.abono = n; // Permitir cualquier cantidad en todos los métodos de pago
    this.recalcularSaldoNuevo();
  }

  private recalcularSaldoNuevo() {
    const saldo = Number(this.facturaSeleccionada?.saldoPendiente || 0);
    // ✅ Saldo nuevo nunca debe ser negativo (si abono > saldo, saldo nuevo = 0)
    this.saldoNuevo = Math.max(0, +(saldo - this.abono).toFixed(2));
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

      // 🕐 CONSTRUIR FECHA FINAL CON HORA
      let fechaFinal: Date;
      if (this.metodoPago === 'Efectivo') {
        // Para efectivo: usar fecha de caja chica + hora seleccionada
        try {
          const cajaAbierta = await this.cajaChicaService.getCajaAbierta();
          console.log('📅 Caja abierta obtenida:', cajaAbierta);
          
          if (cajaAbierta?.fecha) {
            // Convertir correctamente Timestamp de Firestore a Date
            let fechaCaja: Date;
            if ((cajaAbierta.fecha as any).toDate) {
              // Es un Timestamp de Firestore
              fechaCaja = (cajaAbierta.fecha as any).toDate();
            } else if (cajaAbierta.fecha instanceof Date) {
              fechaCaja = cajaAbierta.fecha;
            } else {
              fechaCaja = new Date(cajaAbierta.fecha);
            }
            
            console.log('📅 Fecha de caja convertida:', fechaCaja);
            console.log('🕐 Hora de pago seleccionada:', this.horaPago);
            
            fechaFinal = this.combinarFechaHora(fechaCaja, this.horaPago);
            console.log('✅ Fecha final combinada:', fechaFinal);
          } else {
            console.warn('⚠️ No hay fecha en caja, usando fecha actual');
            fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
          }
        } catch (err) {
          console.error('❌ Error obteniendo fecha de caja chica:', err);
          fechaFinal = this.combinarFechaHora(new Date(), this.horaPago);
        }
      } else {
        // Para transferencia/tarjeta: usar fecha y hora seleccionadas
        
        // ✅ VALIDAR QUE LA FECHA ESTÉ DENTRO DEL PERIODO DE LA CAJA BANCO
        if (this.fechaMinima && this.fechaMaxima) {
          if (this.fechaPago < this.fechaMinima || this.fechaPago > this.fechaMaxima) {
            Swal.fire({
              icon: 'error',
              title: 'Fecha Inválida',
              text: `La fecha debe estar dentro del periodo de la caja banco: ${this.periodoNombre}. Seleccione una fecha entre ${this.fechaMinima} y ${this.fechaMaxima}.`,
              confirmButtonText: 'Entendido'
            });
            this.pagando = false;
            return;
          }
        }
        
        // ✅ VALIDAR QUE LA CAJA BANCO DEL PERÍODO ESTÉ ABIERTA
        const cajaAbierta = await this.cajaBancoService.verificarCajaAbiertaPorFecha(this.fechaPago);
        if (!cajaAbierta) {
          const fechaObj = new Date(this.fechaPago);
          const mesNombre = fechaObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          Swal.fire({
            icon: 'error',
            title: 'Caja Banco Cerrada',
            text: `La caja banco del período ${mesNombre} está cerrada. No se pueden registrar movimientos en ese período.`,
            confirmButtonText: 'Entendido'
          });
          this.pagando = false;
          return;
        }
        
        fechaFinal = this.combinarFechaHora(this.fechaPago, this.horaPago);
      }

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
        fecha: fechaFinal,  // Date - Firestore lo convertirá automáticamente
        clienteNombre: this.clienteNombre,
        clienteTelefono: this.clienteTelefono,
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
          // Buscar cualquier caja ABIERTA (histórica o actual)
          const caja = await this.cajaChicaService.getCajaAbierta();
          if (caja?.id) {
            const usuario = this.authService.getCurrentUser();
            const movimiento = {
              caja_chica_id: caja.id,
              fecha: fechaFinal,  // Mantener como Date para el servicio de caja chica
              tipo: 'INGRESO' as const,
              descripcion: `Pago de deuda - ${this.clienteNombre} - Factura #${f.id}`,
              monto: abonoReal,
              comprobante: f.id,
            };
            if (usuario?.id) {
              (movimiento as any).usuario_id = usuario.id;
              (movimiento as any).usuario_nombre = usuario.nombre || 'Usuario';
            }
            await this.cajaChicaService.registrarMovimiento(caja.id, movimiento);
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
            usuario?.nombre || 'Usuario',
            fechaFinal  // Pasar la fecha seleccionada por el usuario
          );
          console.log('✅ Pago de deuda registrado en Caja Banco con fecha', fechaFinal);
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
            usuario?.nombre || 'Usuario',
            fechaFinal  // Pasar la fecha seleccionada por el usuario
          );
          console.log('✅ Pago por tarjeta registrado en Caja Banco con fecha', fechaFinal);
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

  /**
   * Inicializa los campos de fecha y hora con valores actuales
   * Si es operador, actualiza continuamente la hora cada segundo
   */
  inicializarFechaHora(): void {
    this.actualizarFechaHoraActual();
    
    // Si es operador, actualizar fecha/hora cada segundo
    if (!this.esAdmin) {
      setInterval(() => {
        this.actualizarFechaHoraActual();
      }, 1000);
    }
    
    // Cargar restricciones de fecha según caja banco abierta (solo para admin)
    if (this.esAdmin) {
      this.cargarRestriccionesFechaCajaBanco();
    }
  }

  /**
   * Actualiza fecha y hora con valores actuales
   */
  private actualizarFechaHoraActual(): void {
    const ahora = new Date();
    
    // Formato HH:mm:ss para hora
    const horas = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    this.horaPago = `${horas}:${minutos}:${segundos}`;
    
    // Formato YYYY-MM-DD para fecha
    const año = ahora.getFullYear();
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dia = ahora.getDate().toString().padStart(2, '0');
    this.fechaPago = `${año}-${mes}-${dia}`;
    this.fechaMaxima = `${año}-${mes}-${dia}`; // Límite máximo: hoy
  }
  
  /**
   * Carga las restricciones de fecha min/max basadas en el periodo de la caja banco abierta.
   * Limita la selección de fecha al mes de la caja banco activa.
   */
  async cargarRestriccionesFechaCajaBanco(): Promise<void> {
    try {
      const caja = await this.cajaBancoService.getCajaBancoAbierta();
      
      if (!caja?.fecha) {
        console.warn('⚠️ No hay caja banco abierta');
        return;
      }

      // Convertir fecha de Firestore a Date
      let fechaCaja: Date;
      if ((caja.fecha as any)?.toDate) {
        fechaCaja = (caja.fecha as any).toDate();
      } else if (caja.fecha instanceof Date) {
        fechaCaja = caja.fecha;
      } else {
        fechaCaja = new Date(caja.fecha);
      }

      // Obtener periodo de la caja
      const periodo = obtenerPeriodo(fechaCaja);
      const year = periodo.year;
      const month = periodo.monthIndex0; // Base 0

      // Calcular primer y último día del mes
      const primerDia = new Date(year, month, 1);
      const ultimoDia = new Date(year, month + 1, 0); // Día 0 del mes siguiente = último día del mes actual
      const hoy = new Date();

      // Formatear para input[type="date"] (YYYY-MM-DD)
      this.fechaMinima = this.formatearFecha(primerDia);
      // La fecha máxima es el menor entre el último día del mes y hoy
      const fechaMax = ultimoDia < hoy ? ultimoDia : hoy;
      this.fechaMaxima = this.formatearFecha(fechaMax);
      
      // Nombre del periodo para mostrar
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      this.periodoNombre = `${meses[month]} ${year}`;

      console.log(`📅 Restricciones de fecha establecidas: ${this.fechaMinima} a ${this.fechaMaxima} (${this.periodoNombre})`);
    } catch (error) {
      console.error('❌ Error cargando restricciones de fecha:', error);
    }
  }

  /**
   * Formatea una fecha a string YYYY-MM-DD para input[type="date"]
   */
  private formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Combina una fecha con una hora para crear un Date válido
   * @param fecha - Fecha como string (YYYY-MM-DD) o Date
   * @param hora - Hora como string (HH:mm:ss)
   * @returns Date con fecha y hora combinadas
   */
  combinarFechaHora(fecha: string | Date, hora: string): Date {
    let fechaBase: Date;
    
    if (typeof fecha === 'string') {
      // Parsear string YYYY-MM-DD y crear Date con hora 00:00:00 local
      const partes = fecha.split('-');
      const año = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1; // Meses 0-indexed en Date
      const dia = parseInt(partes[2]);
      fechaBase = new Date(año, mes, dia, 0, 0, 0, 0);
    } else {
      // Clonar Date y resetear hora a 00:00:00
      fechaBase = new Date(fecha);
      fechaBase.setHours(0, 0, 0, 0);
    }
    
    // Parsear hora HH:mm:ss
    const partesHora = hora.split(':');
    const horas = parseInt(partesHora[0] || '0');
    const minutos = parseInt(partesHora[1] || '0');
    const segundos = parseInt(partesHora[2] || '0');
    
    // Establecer la hora específica (esto NO causa conversión de zona horaria)
    fechaBase.setHours(horas, minutos, segundos, 0);
    
    console.log(`🔧 combinarFechaHora entrada: fecha=${fecha}, hora=${hora}`);
    console.log(`🔧 combinarFechaHora resultado: ${fechaBase.toLocaleString()} (${fechaBase.toISOString()})`);
    
    return fechaBase;
  }

  volver() {
    this.router.navigate(['/clientes/historial-clinico']);
  }
}
