/**
 * Servicio para manejar ventas con tarjeta como cuentas por cobrar al banco.
 * - Registra la venta (sin afectar caja banco al momento de la venta)
 * - Registra ingresos del banco (sumando a caja banco del periodo de la venta)
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { CajaBancoService } from './caja-banco.service';
import { MovimientoCajaBanco } from '../models/caja-banco.model';
import { AbonoVentaTarjeta, VentaTarjeta } from '../models/venta-tarjeta.model';

@Injectable({ providedIn: 'root' })
export class VentasTarjetaService {
  private fs = inject(Firestore);
  private authService = inject(AuthService);
  private cajaBancoService = inject(CajaBancoService);
  private ventasTarjetaRef = collection(this.fs, 'ventas_tarjeta');

  /**
   * Registra la venta con tarjeta como cuenta por cobrar al banco.
   * Si ya existe el documento para la factura, no se modifica.
   */
  async crearVentaTarjeta(venta: Omit<VentaTarjeta, 'id' | 'montoRecibido' | 'saldoPendiente' | 'estado' | 'abonos' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = doc(this.fs, `ventas_tarjeta/${venta.facturaId}`);
    const existente = await getDoc(docRef);

    if (existente.exists()) {
      return docRef.id;
    }

    const fechaVenta = venta.fechaVenta instanceof Date
      ? venta.fechaVenta
      : new Date(venta.fechaVenta);

    const cuentaBancoId = await this.obtenerCajaBancoIdPorFecha(fechaVenta);

    const ventaParaGuardar: any = {
      ...venta,
      fechaVenta: Timestamp.fromDate(fechaVenta),
      montoRecibido: 0,
      saldoPendiente: venta.montoTotal,
      estado: 'PENDIENTE',
      abonos: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (cuentaBancoId) {
      ventaParaGuardar.cuentaBancoId = cuentaBancoId;
    }

    await setDoc(docRef, ventaParaGuardar);
    return docRef.id;
  }

  /**
   * Obtiene todas las ventas con tarjeta.
   */
  getVentasTarjeta(): Observable<VentaTarjeta[]> {
    const q = query(this.ventasTarjetaRef, orderBy('fechaVenta', 'desc'));

    return collectionData(q, { idField: 'id' }).pipe(
      map((ventas: any[]) =>
        (ventas || []).map(v => ({
          ...v,
          fechaVenta: v.fechaVenta?.toDate ? v.fechaVenta.toDate() : new Date(v.fechaVenta),
          abonos: (v.abonos || []).map((a: any) => ({
            ...a,
            fecha: a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha)
          }))
        }))
      )
    ) as Observable<VentaTarjeta[]>;
  }

  /**
   * Registra un ingreso del banco para una venta con tarjeta.
   * Actualiza saldo y agrega movimiento en caja banco del periodo de la venta (aunque este cerrada).
   */
  async registrarIngresoBanco(ventaId: string, abono: Omit<AbonoVentaTarjeta, 'saldoRestante'>): Promise<void> {
    const docRef = doc(this.fs, `ventas_tarjeta/${ventaId}`);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      throw new Error('No se encontro la venta con tarjeta.');
    }

    const data: any = snap.data();
    const montoTotal = Number(data.montoTotal || 0);
    const montoRecibidoActual = Number(data.montoRecibido || 0);
    const saldoPendienteActual = Number(data.saldoPendiente || 0);

    const montoAbono = Number(abono.monto || 0);
    if (montoAbono <= 0) {
      throw new Error('El monto del ingreso debe ser mayor a 0.');
    }

    if (montoAbono > saldoPendienteActual) {
      throw new Error('El monto del ingreso no puede superar el saldo pendiente.');
    }

    const nuevoMontoRecibido = +(montoRecibidoActual + montoAbono).toFixed(2);
    const nuevoSaldoPendiente = +(montoTotal - nuevoMontoRecibido).toFixed(2);
    const estado = nuevoSaldoPendiente <= 0 ? 'LIQUIDADA' : 'PENDIENTE';

    const fechaAbono = abono.fecha instanceof Date ? abono.fecha : new Date(abono.fecha);
    const abonoConSaldo: AbonoVentaTarjeta = {
      ...abono,
      fecha: fechaAbono,
      saldoRestante: Math.max(0, nuevoSaldoPendiente)
    };

    const abonosActuales = Array.isArray(data.abonos) ? data.abonos : [];
    const abonosActualizados = [...abonosActuales, {
      ...abonoConSaldo,
      fecha: Timestamp.fromDate(fechaAbono)
    }];

    const cuentaBancoId = data.cuentaBancoId || await this.obtenerCajaBancoIdPorFecha(
      data.fechaVenta?.toDate ? data.fechaVenta.toDate() : new Date(data.fechaVenta)
    );

    await updateDoc(docRef, {
      montoRecibido: nuevoMontoRecibido,
      saldoPendiente: Math.max(0, nuevoSaldoPendiente),
      estado,
      abonos: abonosActualizados,
      cuentaBancoId: cuentaBancoId || undefined,
      updatedAt: serverTimestamp()
    } as any);

    if (!cuentaBancoId) {
      throw new Error('No existe caja banco para el periodo de la venta.');
    }

    const usuario = this.authService.getCurrentUser();
    const descripcionFactura = data.facturaIdPersonalizado || data.facturaId || ventaId;

    const movimiento: MovimientoCajaBanco = {
      caja_banco_id: cuentaBancoId,
      fecha: fechaAbono,
      tipo: 'INGRESO',
      categoria: 'OTRO_INGRESO',
      descripcion: `Venta Tarjeta - Factura ${descripcionFactura}`,
      monto: montoAbono,
      referencia: abono.numeroLote || abono.banco || '',
      venta_id: data.facturaId || ventaId,
      observacion: abono.observacion,
      usuario_id: usuario?.id,
      usuario_nombre: usuario?.nombre || 'Usuario'
    };

    await this.cajaBancoService.registrarMovimientoIgnorarCierre(movimiento);
  }

  private async obtenerCajaBancoIdPorFecha(fecha: Date): Promise<string | null> {
    const year = fecha.getFullYear();
    const monthIndex0 = fecha.getMonth();
    const caja = await this.cajaBancoService.getCajaBancoPorPeriodoSinEstado(year, monthIndex0);
    return caja?.id || null;
  }
}
