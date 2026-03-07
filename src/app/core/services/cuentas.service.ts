/**
 * Servicio para gestionar cuentas por pagar y cuentas por cobrar.
 *
 * Este servicio maneja:
 * - Registro de nuevas cuentas (pagar/cobrar)
 * - Registro de abonos parciales
 * - Actualización de estados automática
 * - Integración con caja/banco para movimientos financieros
 * - Consulta y filtrado de cuentas
 *
 * FLUJO CUENTAS POR PAGAR (Deudas que tenemos):
 * - Al registrar: SUMA el monto a caja/banco (recibimos dinero prestado)
 * - Al pagar: DESCUENTA el monto de caja/banco (devolvemos dinero)
 *
 * FLUJO CUENTAS POR COBRAR (Deudas que nos deben):
 * - Al registrar: DESCUENTA el monto de caja/banco (prestamos dinero)
 * - Al cobrar: SUMA el monto a caja/banco (nos devuelven dinero)
 */

import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Cuenta, TipoCuenta, EstadoCuenta, TipoCuentaPorPagar, AbonoCuenta } from '../models/cuenta.model';
import { CajaBancoService } from './caja-banco.service';
import { AuthService } from './auth.service';
import { MovimientoCajaBanco } from '../models/caja-banco.model';

interface RegistrarAbonoOpciones {
  cajaBancoId?: string;
  proveedor?: string;
  referenciaCuenta?: string;
  descripcionMovimiento?: string;
  permitirCajaCerrada?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CuentasService {
  private readonly firestore = inject(Firestore);
  private readonly cajaBancoService = inject(CajaBancoService);
  private readonly authService = inject(AuthService);

  /**
   * Obtiene todas las cuentas del sistema.
   * 
   * @returns Observable con el listado de cuentas.
   */
  getCuentas(): Observable<Cuenta[]> {
    const cuentasRef = collection(this.firestore, 'cuentas');
    const q = query(cuentasRef, orderBy('fecha', 'desc'));
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(cuentas => cuentas.map(cuenta => ({
        ...cuenta,
        fecha: (cuenta['fecha'] as Timestamp).toDate(),
        fechaModificacion: cuenta['fechaModificacion'] 
          ? (cuenta['fechaModificacion'] as Timestamp).toDate() 
          : undefined,
        abonos: cuenta['abonos']?.map((abono: any) => ({
          ...abono,
          fecha: (abono.fecha as Timestamp).toDate()
        })) || []
      } as Cuenta)))
    );
  }

  /**
   * Obtiene cuentas filtradas por tipo.
   * 
   * @param tipo Tipo de cuenta (PAGAR o COBRAR).
   * @returns Observable con el listado de cuentas del tipo especificado.
   */
  getCuentasPorTipo(tipo: TipoCuenta): Observable<Cuenta[]> {
    const cuentasRef = collection(this.firestore, 'cuentas');
    const q = query(
      cuentasRef,
      where('tipo', '==', tipo),
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(cuentas => cuentas.map(cuenta => ({
        ...cuenta,
        fecha: (cuenta['fecha'] as Timestamp).toDate(),
        fechaModificacion: cuenta['fechaModificacion'] 
          ? (cuenta['fechaModificacion'] as Timestamp).toDate() 
          : undefined,
        abonos: cuenta['abonos']?.map((abono: any) => ({
          ...abono,
          fecha: (abono.fecha as Timestamp).toDate()
        })) || []
      } as Cuenta)))
    );
  }

  /**
   * Obtiene cuentas filtradas por estado.
   * 
   * @param tipo Tipo de cuenta (PAGAR o COBRAR).
   * @param estado Estado de la cuenta (ACTIVA o CANCELADA).
   * @returns Observable con el listado de cuentas filtradas.
   */
  getCuentasPorEstado(tipo: TipoCuenta, estado: EstadoCuenta): Observable<Cuenta[]> {
    const cuentasRef = collection(this.firestore, 'cuentas');
    const q = query(
      cuentasRef,
      where('tipo', '==', tipo),
      where('estado', '==', estado),
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(cuentas => cuentas.map(cuenta => ({
        ...cuenta,
        fecha: (cuenta['fecha'] as Timestamp).toDate(),
        fechaModificacion: cuenta['fechaModificacion'] 
          ? (cuenta['fechaModificacion'] as Timestamp).toDate() 
          : undefined,
        abonos: cuenta['abonos']?.map((abono: any) => ({
          ...abono,
          fecha: (abono.fecha as Timestamp).toDate()
        })) || []
      } as Cuenta)))
    );
  }

  /**
   * Obtiene cuentas filtradas por tipo y cuenta banco (período).
   * 
   * @param tipo Tipo de cuenta (PAGAR o COBRAR).
   * @param cuentaBancoId ID de la cuenta banco para filtrar.
   * @returns Observable con el listado de cuentas del período especificado.
   */
  getCuentasPorTipoYCajaBanco(tipo: TipoCuenta, cuentaBancoId: string): Observable<Cuenta[]> {
    const cuentasRef = collection(this.firestore, 'cuentas');
    const q = query(
      cuentasRef,
      where('tipo', '==', tipo),
      where('cuentaBancoId', '==', cuentaBancoId),
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(cuentas => cuentas.map(cuenta => ({
        ...cuenta,
        fecha: (cuenta['fecha'] as Timestamp).toDate(),
        fechaModificacion: cuenta['fechaModificacion'] 
          ? (cuenta['fechaModificacion'] as Timestamp).toDate() 
          : undefined,
        abonos: cuenta['abonos']?.map((abono: any) => ({
          ...abono,
          fecha: (abono.fecha as Timestamp).toDate()
        })) || []
      } as Cuenta)))
    );
  }

  /**
   * Obtiene una cuenta por su ID.
   * 
   * @param id ID de la cuenta.
   * @returns Observable con los datos de la cuenta.
   */
  getCuenta(id: string): Observable<Cuenta | undefined> {
    const cuentaDocRef = doc(this.firestore, `cuentas/${id}`);
    
    return collectionData(query(collection(this.firestore, 'cuentas')), { idField: 'id' }).pipe(
      map(cuentas => {
        const cuenta = cuentas.find(c => c['id'] === id);
        if (!cuenta) return undefined;
        
        return {
          ...cuenta,
          fecha: (cuenta['fecha'] as Timestamp).toDate(),
          fechaModificacion: cuenta['fechaModificacion'] 
            ? (cuenta['fechaModificacion'] as Timestamp).toDate() 
            : undefined,
          abonos: cuenta['abonos']?.map((abono: any) => ({
            ...abono,
            fecha: (abono.fecha as Timestamp).toDate()
          })) || []
        } as Cuenta;
      })
    );
  }

  /**
   * Registra una nueva cuenta por pagar o cobrar.
   * 
   * CUENTAS POR PAGAR:
   * - Tipo "Deuda": Solo registra la cuenta, NO genera movimiento en caja/banco
   * - Tipo "Préstamo": Suma el monto a caja/banco (recibimos dinero prestado)
   * 
   * CUENTAS POR COBRAR: Descuenta el monto de caja/banco (prestamos dinero).
   * 
   * @param cuenta Datos de la cuenta a registrar.
   * @returns Promise con el ID de la cuenta creada.
   */
  async registrarCuenta(cuenta: Omit<Cuenta, 'id' | 'montoAbonado' | 'saldo' | 'estado' | 'abonos'>): Promise<string> {
    try {
      // Obtener el usuario actual
      const usuarioActual = this.authService.getCurrentUser();
      const nombreUsuario = usuarioActual?.nombre || 'desconocido';
      const idUsuario = usuarioActual?.id || '';

      // ✅ NUEVO: Variable para controlar si se debe registrar movimiento
      let debeRegistrarMovimiento = false;
      let tipoMovimiento: 'INGRESO' | 'EGRESO' = 'INGRESO';
      let categoriaMovimiento: 'CIERRE_CAJA_CHICA' | 'TRANSFERENCIA_CLIENTE' | 'PAGO_TRABAJADOR' | 'OTRO_INGRESO' | 'OTRO_EGRESO' = 'OTRO_INGRESO';
      let descripcion: string = '';

      if (cuenta.tipo === TipoCuenta.PAGAR) {
        // ✅ Diferenciar entre Deuda y Préstamo
        if (cuenta.tipoCuentaPorPagar === TipoCuentaPorPagar.DEUDA) {
          // Deuda normal: NO registrar movimiento en caja banco
          debeRegistrarMovimiento = false;
          descripcion = 'Deuda registrada';
        } else if (cuenta.tipoCuentaPorPagar === TipoCuentaPorPagar.PRESTAMO) {
          // Préstamo: Registrar INGRESO a caja (recibimos dinero prestado)
          debeRegistrarMovimiento = true;
          tipoMovimiento = 'INGRESO';
          categoriaMovimiento = 'OTRO_INGRESO';
          descripcion = 'Ingreso por Préstamo';
        } else {
          // Default (por compatibilidad con datos anteriores): Registrar como préstamo
          debeRegistrarMovimiento = true;
          tipoMovimiento = 'INGRESO';
          categoriaMovimiento = 'OTRO_INGRESO';
          descripcion = 'Ingreso por Préstamo';
        }
      } else {
        // Al registrar cuenta por COBRAR: EGRESO de caja (prestamos dinero)
        debeRegistrarMovimiento = true;
        tipoMovimiento = 'EGRESO';
        categoriaMovimiento = 'OTRO_EGRESO';
        descripcion = 'Cuenta por cobrar registrada';
      }

      // ✅ NUEVO: Solo registrar movimiento si es necesario
      if (debeRegistrarMovimiento) {
        // Registrar movimiento en caja/banco del periodo de la cuenta
        const year = cuenta.fecha.getFullYear();
        const monthIndex0 = cuenta.fecha.getMonth();
        
        const caja = await this.cajaBancoService.getCajaBancoPorPeriodo(year, monthIndex0);
        if (!caja) {
          const nombreMes = new Date(year, monthIndex0).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          throw new Error(`No hay una caja banco abierta para el periodo ${nombreMes}. Debe abrir una caja para ese mes primero.`);
        }

        const movimiento: MovimientoCajaBanco = {
          caja_banco_id: caja.id!,
          tipo: tipoMovimiento,
          categoria: categoriaMovimiento,
          monto: cuenta.montoTotal,
          descripcion: descripcion,
          referencia: cuenta.observacion,
          usuario_nombre: nombreUsuario,
          usuario_id: idUsuario,
          fecha: cuenta.fecha
        };

        await this.cajaBancoService.registrarMovimiento(movimiento);
      }

      // Preparar la cuenta con valores iniciales, cuentaBancoId (si aplica) y datos del usuario
      let cuentaBancoId: string | undefined;
      
      if (debeRegistrarMovimiento) {
        const year = cuenta.fecha.getFullYear();
        const monthIndex0 = cuenta.fecha.getMonth();
        const caja = await this.cajaBancoService.getCajaBancoPorPeriodo(year, monthIndex0);
        cuentaBancoId = caja?.id;
      }

      const nuevaCuenta: Omit<Cuenta, 'id'> = {
        ...cuenta,
        cuentaBancoId: cuentaBancoId,
        usuario_nombre: nombreUsuario,
        usuario_id: idUsuario,
        createdAt: new Date(),
        montoAbonado: 0,
        saldo: cuenta.montoTotal,
        estado: EstadoCuenta.ACTIVA,
        abonos: [],
        fechaModificacion: new Date()
      };

      // Guardar la cuenta en Firestore
      const cuentasRef = collection(this.firestore, 'cuentas');
      const docRef = await addDoc(cuentasRef, {
        ...nuevaCuenta,
        fecha: Timestamp.fromDate(nuevaCuenta.fecha),
        createdAt: Timestamp.fromDate(nuevaCuenta.createdAt!),
        fechaModificacion: Timestamp.fromDate(nuevaCuenta.fechaModificacion!)
      });

      return docRef.id;
    } catch (error) {
      console.error('Error al registrar cuenta:', error);
      throw error;
    }
  }

  /**
   * Registra un abono/pago a una cuenta existente.
   * 
   * PAGAR: Descuenta el abono de caja/banco (pagamos deuda).
   * COBRAR: Suma el abono a caja/banco (cobramos deuda).
   * 
   * @param cuentaId ID de la cuenta.
   * @param monto Monto del abono.
   * @param fechaAbono Fecha del abono (opcional, por defecto: hoy).
   * @param observacion Observación del abono (opcional).
   * @returns Promise que se resuelve cuando el abono se registra correctamente.
   */
  async registrarAbono(
    cuentaId: string,
    monto: number,
    fechaAbono?: Date,
    observacion?: string,
    opciones?: RegistrarAbonoOpciones
  ): Promise<void> {
    try {
      // Obtener el usuario actual
      const usuarioActual = this.authService.getCurrentUser();
      const nombreUsuario = usuarioActual?.nombre || 'desconocido';
      const idUsuario = usuarioActual?.id || '';

      // Obtener la cuenta actual
      const cuentaDocRef = doc(this.firestore, `cuentas/${cuentaId}`);
      const cuentaSnapshot = await getDoc(cuentaDocRef);
      
      if (!cuentaSnapshot.exists()) {
        throw new Error('La cuenta no existe');
      }

      const cuentaData = cuentaSnapshot.data();
      const cuenta: Cuenta = {
        id: cuentaSnapshot.id,
        fecha: (cuentaData['fecha'] as Timestamp).toDate(),
        tipo: cuentaData['tipo'] as TipoCuenta,
        tipoCuentaPorPagar: cuentaData['tipoCuentaPorPagar'] as TipoCuentaPorPagar | undefined,
        montoTotal: cuentaData['montoTotal'],
        montoAbonado: cuentaData['montoAbonado'],
        saldo: cuentaData['saldo'],
        estado: cuentaData['estado'] as EstadoCuenta,
        observacion: cuentaData['observacion'],
        proveedor: cuentaData['proveedor'],
        cuentaBancoId: cuentaData['cuentaBancoId'],
        abonos: cuentaData['abonos']?.map((abono: any) => ({
          ...abono,
          fecha: (abono.fecha as Timestamp).toDate()
        })) || [],
        fechaModificacion: cuentaData['fechaModificacion'] 
          ? (cuentaData['fechaModificacion'] as Timestamp).toDate() 
          : undefined
      };

      // Validar que la cuenta esté activa
      if (cuenta.estado !== EstadoCuenta.ACTIVA) {
        throw new Error('No se pueden registrar abonos a una cuenta cancelada');
      }

      // Validar que el abono no exceda el saldo
      if (monto > cuenta.saldo) {
        throw new Error(`El abono de $${monto} excede el saldo pendiente de $${cuenta.saldo}`);
      }

      // Calcular nuevo saldo
      const nuevoSaldo = cuenta.saldo - monto;
      const nuevoMontoAbonado = cuenta.montoAbonado + monto;
      const nuevoEstado = nuevoSaldo === 0 ? EstadoCuenta.CANCELADA : EstadoCuenta.ACTIVA;

      // Usar la fecha proporcionada o la fecha actual
      const fechaDelAbono = fechaAbono || new Date();

      const referenciaCuenta = (
        opciones?.referenciaCuenta
        || `CPP-${(cuenta.id || cuentaId).slice(0, 8).toUpperCase()}`
      ).trim();

      const proveedorAbono = (
        opciones?.proveedor
        || cuenta.proveedor
        || 'Proveedor no especificado'
      ).trim();

      // Determinar el tipo de movimiento en caja/banco
      let tipoMovimiento: 'INGRESO' | 'EGRESO';
      let categoriaMovimiento: 'CIERRE_CAJA_CHICA' | 'TRANSFERENCIA_CLIENTE' | 'PAGO_TRABAJADOR' | 'PAGO_PROVEEDORES' | 'OTRO_INGRESO' | 'OTRO_EGRESO';
      let descripcion: string;

      if (cuenta.tipo === TipoCuenta.PAGAR) {
        // Al pagar cuenta por PAGAR: EGRESO de caja (devolvemos dinero)
        tipoMovimiento = 'EGRESO';
        categoriaMovimiento = 'PAGO_PROVEEDORES';
        descripcion = opciones?.descripcionMovimiento || `Pago de Cuenta por Pagar N° ${referenciaCuenta}`;
      } else {
        // Al cobrar cuenta por COBRAR: INGRESO a caja (nos devuelven dinero)
        tipoMovimiento = 'INGRESO';
        categoriaMovimiento = 'OTRO_INGRESO';
        descripcion = 'Cobro de cuenta por cobrar';
      }

      // Resolver caja destino: si viene explícita (flujo CxP), usarla aunque esté cerrada.
      let cajaIdDestino: string;
      let permitirCajaCerrada = false;

      if (opciones?.cajaBancoId) {
        const cajaDocRef = doc(this.firestore, `cajas_banco/${opciones.cajaBancoId}`);
        const cajaDoc = await getDoc(cajaDocRef);
        const cajaData = cajaDoc.data() as any;

        if (!cajaDoc.exists() || !cajaData || cajaData.activo === false) {
          throw new Error('La caja banco seleccionada no existe o está desactivada.');
        }

        cajaIdDestino = cajaDoc.id;
        permitirCajaCerrada = !!opciones.permitirCajaCerrada;
      } else {
        const year = fechaDelAbono.getFullYear();
        const monthIndex0 = fechaDelAbono.getMonth();
        const caja = await this.cajaBancoService.getCajaBancoPorPeriodo(year, monthIndex0);

        if (!caja?.id) {
          const nombreMes = new Date(year, monthIndex0).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          throw new Error(`No hay una caja banco abierta para el periodo ${nombreMes}. Debe abrir una caja para ese mes primero.`);
        }

        cajaIdDestino = caja.id;
      }

      const observacionMovimiento = [
        `Proveedor: ${proveedorAbono}`,
        observacion ? `Detalle pago: ${observacion}` : ''
      ].filter(Boolean).join(' | ');

      const movimiento: MovimientoCajaBanco = {
        caja_banco_id: cajaIdDestino,
        tipo: tipoMovimiento,
        categoria: categoriaMovimiento,
        monto: monto,
        descripcion: descripcion,
        referencia: referenciaCuenta,
        observacion: observacionMovimiento,
        cuenta_id: cuenta.id,
        cuenta_tipo: cuenta.tipo,
        cuenta_referencia: referenciaCuenta,
        proveedor: cuenta.tipo === TipoCuenta.PAGAR ? proveedorAbono : undefined,
        usuario_nombre: nombreUsuario,
        usuario_id: idUsuario,
        fecha: fechaDelAbono
      };

      const movimientoId = (cuenta.tipo === TipoCuenta.PAGAR && permitirCajaCerrada)
        ? await this.cajaBancoService.registrarMovimientoIgnorarCierre(movimiento)
        : await this.cajaBancoService.registrarMovimiento(movimiento);

      // Crear registro del abono con trazabilidad hacia caja/banco
      const nuevoAbono: AbonoCuenta = {
        fecha: fechaDelAbono,
        monto: monto,
        observacion: observacion,
        saldoRestante: nuevoSaldo,
        movimientoCajaBancoId: movimientoId,
        cajaBancoId: cajaIdDestino,
        referenciaCuenta: referenciaCuenta,
        proveedor: cuenta.tipo === TipoCuenta.PAGAR ? proveedorAbono : undefined
      };

      const abonosActualizados = [...(cuenta.abonos || []), nuevoAbono];

      // Actualizar la cuenta en Firestore
      await updateDoc(cuentaDocRef, {
        montoAbonado: nuevoMontoAbonado,
        saldo: nuevoSaldo,
        estado: nuevoEstado,
        ...(cuenta.tipo === TipoCuenta.PAGAR && !cuenta.proveedor ? { proveedor: proveedorAbono } : {}),
        abonos: abonosActualizados.map(abono => ({
          ...abono,
          fecha: Timestamp.fromDate(abono.fecha)
        })),
        fechaModificacion: Timestamp.now()
      });

    } catch (error) {
      console.error('Error al registrar abono:', error);
      throw error;
    }
  }

  /**
   * Calcula el total de cuentas activas por tipo.
   * 
   * @param tipo Tipo de cuenta (PAGAR o COBRAR).
   * @returns Observable con el total de saldo pendiente.
   */
  getTotalCuentasActivas(tipo: TipoCuenta): Observable<number> {
    return this.getCuentasPorEstado(tipo, EstadoCuenta.ACTIVA).pipe(
      map(cuentas => cuentas.reduce((total, cuenta) => total + cuenta.saldo, 0))
    );
  }
}
