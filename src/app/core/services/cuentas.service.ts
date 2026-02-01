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
import { Cuenta, TipoCuenta, EstadoCuenta, AbonoCuenta } from '../models/cuenta.model';
import { CajaBancoService } from './caja-banco.service';
import { MovimientoCajaBanco } from '../models/caja-banco.model';

@Injectable({
  providedIn: 'root'
})
export class CuentasService {
  private readonly firestore = inject(Firestore);
  private readonly cajaBancoService = inject(CajaBancoService);

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
   * CUENTAS POR PAGAR: Suma el monto a caja/banco (recibimos dinero prestado).
   * CUENTAS POR COBRAR: Descuenta el monto de caja/banco (prestamos dinero).
   * 
   * @param cuenta Datos de la cuenta a registrar.
   * @returns Promise con el ID de la cuenta creada.
   */
  async registrarCuenta(cuenta: Omit<Cuenta, 'id' | 'montoAbonado' | 'saldo' | 'estado' | 'abonos'>): Promise<string> {
    try {
      // Preparar la cuenta con valores iniciales
      const nuevaCuenta: Omit<Cuenta, 'id'> = {
        ...cuenta,
        montoAbonado: 0,
        saldo: cuenta.montoTotal,
        estado: EstadoCuenta.ACTIVA,
        abonos: [],
        fechaModificacion: new Date()
      };

      // Determinar el tipo de movimiento en caja/banco
      let tipoMovimiento: 'INGRESO' | 'EGRESO';
      let categoriaMovimiento: 'CIERRE_CAJA_CHICA' | 'TRANSFERENCIA_CLIENTE' | 'PAGO_TRABAJADOR' | 'OTRO_INGRESO' | 'OTRO_EGRESO';
      let descripcion: string;

      if (cuenta.tipo === TipoCuenta.PAGAR) {
        // Al registrar cuenta por PAGAR: INGRESO a caja (recibimos dinero prestado)
        tipoMovimiento = 'INGRESO';
        categoriaMovimiento = 'OTRO_INGRESO';
        descripcion = `Cuenta por pagar registrada: ${cuenta.observacion}`;
      } else {
        // Al registrar cuenta por COBRAR: EGRESO de caja (prestamos dinero)
        tipoMovimiento = 'EGRESO';
        categoriaMovimiento = 'OTRO_EGRESO';
        descripcion = `Cuenta por cobrar registrada: ${cuenta.observacion}`;
      }

      // Registrar movimiento en caja/banco
      const caja = await this.cajaBancoService.getCajaBancoActivaMes();
      if (!caja) {
        throw new Error('No hay una caja banco abierta para registrar el movimiento');
      }

      const movimiento: MovimientoCajaBanco = {
        caja_banco_id: caja.id!,
        tipo: tipoMovimiento,
        categoria: categoriaMovimiento,
        monto: cuenta.montoTotal,
        descripcion: descripcion,
        fecha: cuenta.fecha
      };

      await this.cajaBancoService.registrarMovimiento(movimiento);

      // Guardar la cuenta en Firestore
      const cuentasRef = collection(this.firestore, 'cuentas');
      const docRef = await addDoc(cuentasRef, {
        ...nuevaCuenta,
        fecha: Timestamp.fromDate(nuevaCuenta.fecha),
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
   * @param observacion Observación del abono (opcional).
   * @returns Promise que se resuelve cuando el abono se registra correctamente.
   */
  async registrarAbono(cuentaId: string, monto: number, observacion?: string): Promise<void> {
    try {
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
        montoTotal: cuentaData['montoTotal'],
        montoAbonado: cuentaData['montoAbonado'],
        saldo: cuentaData['saldo'],
        estado: cuentaData['estado'] as EstadoCuenta,
        observacion: cuentaData['observacion'],
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

      // Crear registro del abono
      const nuevoAbono: AbonoCuenta = {
        fecha: new Date(),
        monto: monto,
        observacion: observacion,
        saldoRestante: nuevoSaldo
      };

      const abonosActualizados = [...(cuenta.abonos || []), nuevoAbono];

      // Determinar el tipo de movimiento en caja/banco
      let tipoMovimiento: 'INGRESO' | 'EGRESO';
      let categoriaMovimiento: 'CIERRE_CAJA_CHICA' | 'TRANSFERENCIA_CLIENTE' | 'PAGO_TRABAJADOR' | 'OTRO_INGRESO' | 'OTRO_EGRESO';
      let descripcion: string;

      if (cuenta.tipo === TipoCuenta.PAGAR) {
        // Al pagar cuenta por PAGAR: EGRESO de caja (devolvemos dinero)
        tipoMovimiento = 'EGRESO';
        categoriaMovimiento = 'OTRO_EGRESO';
        descripcion = `Pago de cuenta por pagar: ${cuenta.observacion}`;
        if (observacion) {
          descripcion += ` - ${observacion}`;
        }
      } else {
        // Al cobrar cuenta por COBRAR: INGRESO a caja (nos devuelven dinero)
        tipoMovimiento = 'INGRESO';
        categoriaMovimiento = 'OTRO_INGRESO';
        descripcion = `Cobro de cuenta por cobrar: ${cuenta.observacion}`;
        if (observacion) {
          descripcion += ` - ${observacion}`;
        }
      }

      // Registrar movimiento en caja/banco
      const caja = await this.cajaBancoService.getCajaBancoActivaMes();
      if (!caja) {
        throw new Error('No hay una caja banco abierta para registrar el movimiento');
      }

      const movimiento: MovimientoCajaBanco = {
        caja_banco_id: caja.id!,
        tipo: tipoMovimiento,
        categoria: categoriaMovimiento,
        monto: monto,
        descripcion: descripcion,
        fecha: new Date()
      };

      await this.cajaBancoService.registrarMovimiento(movimiento);

      // Actualizar la cuenta en Firestore
      await updateDoc(cuentaDocRef, {
        montoAbonado: nuevoMontoAbonado,
        saldo: nuevoSaldo,
        estado: nuevoEstado,
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
