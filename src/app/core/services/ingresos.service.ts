/**
 * Gestiona el sistema completo de ingresos (compras) de inventario.
 * Maneja el flujo de borrador → detalle → finalización con creación automática de productos,
 * actualización de stocks, registro de movimientos de trazabilidad y cálculo de saldos de proveedores.
 *
 * Este servicio implementa:
 * - Sistema de borrador temporal en memoria (antes de persistir en BD)
 * - Generación automática de ID secuencial para número de factura
 * - Creación automática de productos desde detalles de ingreso
 * - Actualización atómica de stock vía transacciones Firestore
 * - Registro de movimientos de stock para trazabilidad completa
 * - Validación de duplicación de número de factura
 * - Integración con proveedores para actualización de saldos
 * - Importación masiva desde Excel (productos + ingresos)
 *
 * Los datos se persisten en 'ingresos', 'productos' y 'movimientos_stock' de Firestore.
 * Se integra estrechamente con ProductosService y ProveedoresService.
 *
 * Forma parte del módulo de inventario del sistema de gestión de la óptica.
 */
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  docData,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  runTransaction,
  orderBy,
  writeBatch,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Ingreso, DetalleIngreso } from '../models/ingreso.model';
import { MovimientoStock } from '../models/movimiento-stock.model';
import { Producto } from '../models/producto.model';
import { ProductosService } from './productos';
import { ProveedoresService } from './proveedores';
import { MovimientoStockService } from './movimiento-stock.service';

@Injectable({
  providedIn: 'root',
})
export class IngresosService {
  private firestore = inject(Firestore);
  private productosService = inject(ProductosService);
  private proveedoresService = inject(ProveedoresService);
  private movimientoStockSrv = inject(MovimientoStockService);

  private ingresosRef = collection(this.firestore, 'ingresos');
  private movimientosRef = collection(this.firestore, 'movimientos_stock');
  private productosRef = collection(this.firestore, 'productos');

  // 🔹 Almacenamiento temporal de ingreso (antes de crear en BD)
  private ingresoTemporal: Ingreso | null = null;
  private ingresoTemporalId: string | null = null;

  /**
   * Guarda un ingreso temporalmente en memoria (sin persistir en BD).
   * Utilizado en el flujo de creación de ingresos antes de agregar detalles.
   *
   * @param ingreso Datos del ingreso a guardar temporalmente.
   * @returns string ID temporal generado (formato: 'temp_timestamp').
   */
  guardarIngresoTemporal(ingreso: Ingreso): string {
    this.ingresoTemporal = ingreso;
    // Generar un ID temporal para usarlo durante la navegación
    this.ingresoTemporalId = 'temp_' + Date.now();
    return this.ingresoTemporalId;
  }

  /**
   * Recupera el ingreso guardado temporalmente en memoria.
   *
   * @returns Ingreso | null Ingreso temporal o null si no hay ninguno guardado.
   */
  obtenerIngresoTemporal(): Ingreso | null {
    return this.ingresoTemporal;
  }

  /**
   * Limpia el ingreso temporal de la memoria.
   * Debe llamarse después de finalizar o cancelar la creación del ingreso.
   */
  limpiarIngresoTemporal(): void {
    this.ingresoTemporal = null;
    this.ingresoTemporalId = null;
  }

  /**
   * Genera un ID secuencial de 10 dígitos para ingresos (0000000001, 0000000002, etc.)
   * Obtiene el número más alto actual y suma 1
   */
  private async generarIdSecuencial(): Promise<string> {
    // Obtener todos los ingresos
    const snap = await getDocs(this.ingresosRef);
    let maxNumero = 0;

    // Recorrer y buscar el número más alto
    snap.forEach(docSnap => {
      const data: any = docSnap.data();
      const idPersonalizado = data?.idPersonalizado;
      if (idPersonalizado) {
        const num = parseInt(idPersonalizado, 10);
        if (!isNaN(num) && num > maxNumero) {
          maxNumero = num;
        }
      }
    });

    // El siguiente ID es maxNumero + 1, con padding a 10 dígitos
    const nuevoNumero = maxNumero + 1;
    return nuevoNumero.toString().padStart(10, '0');
  }

  /**
   * Recupera todos los ingresos ordenados por fecha de creación descendente.
   *
   * @returns Observable<Ingreso[]> Stream reactivo con todos los ingresos.
   */
  getIngresos(): Observable<Ingreso[]> {
    const q = query(this.ingresosRef, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Ingreso[]>;
  }

  /**
   * Recupera un ingreso específico por su ID de Firestore.
   *
   * @param id ID del ingreso.
   * @returns Observable<Ingreso> Stream con los datos del ingreso.
   */
  getIngresoById(id: string): Observable<Ingreso> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    return docData(ingresoDoc, { idField: 'id' }) as Observable<Ingreso>;
  }

  /**   * Recupera un ingreso por su ID con consulta directa (sin caché Observable).
   *
   * @param id ID del ingreso.
   * @returns Promise<Ingreso | null> Datos del ingreso o null si no existe.
   */
  async getIngresoByIdDirect(id: string): Promise<Ingreso | null> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    const snapshot = await getDoc(ingresoDoc);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as Ingreso;
    }
    return null;
  }

  /**   * Recupera todos los detalles (items) de un ingreso específico.
   *
   * @param ingresoId ID del ingreso.
   * @returns Observable<DetalleIngreso[]> Stream con los detalles del ingreso.
   */
  getDetallesIngreso(ingresoId: string): Observable<DetalleIngreso[]> {
    const detallesRef = collection(this.firestore, `ingresos/${ingresoId}/detalles`);
    return collectionData(detallesRef, { idField: 'id' }) as Observable<DetalleIngreso[]>;
  }

  /**
   * Crea un ingreso en estado BORRADOR (PASO 1 del flujo de ingreso).
   * Genera automáticamente un ID secuencial de 10 dígitos y normaliza la fecha.
   *
   * @param ingreso Datos básicos del ingreso.
   * @returns Promise<string> ID del ingreso creado.
   */
  async crearIngresoBorrador(ingreso: Ingreso): Promise<string> {
    const fechaSolo = ingreso.fecha ? new Date(ingreso.fecha) : new Date();
    fechaSolo.setHours(0, 0, 0, 0);

    // Generar ID secuencial personalizado
    const idPersonalizado = await this.generarIdSecuencial();

    const nuevoIngreso = {
      ...ingreso,
      idPersonalizado,
      fecha: fechaSolo,
      estado: 'BORRADOR',
      total: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Usar setDoc con el ID personalizado en lugar de addDoc
    const docRef = doc(this.ingresosRef, idPersonalizado);
    await setDoc(docRef, nuevoIngreso);
    return docRef.id;
  }

  /**
   * Actualiza los datos de un ingreso existente.
   * Actualiza automáticamente el campo updatedAt.
   *
   * @param id ID del ingreso.
   * @param datos Datos parciales a actualizar.
   * @returns Promise<void> Se resuelve cuando la actualización se completa.
   */
  async actualizarIngreso(id: string, datos: Partial<Ingreso>): Promise<void> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    await updateDoc(ingresoDoc, {
      ...datos,
      updatedAt: new Date(),
    });
  }

  /**
   * Finaliza el ingreso procesando todos los detalles (PASO 4 del flujo).
   * Crea nuevos productos, actualiza existentes, incrementa stocks y registra movimientos.
   *
   * Proceso:
   * 1. Para cada detalle tipo NUEVO: crea producto automáticamente
   * 2. Para cada detalle tipo EXISTENTE: actualiza datos del producto (proveedor, PVP, costo, etc.)
   * 3. Reactiva productos desactivados si es necesario
   * 4. Incrementa stock del producto
   * 5. Registra movimiento de stock para trazabilidad
   * 6. Actualiza estado del ingreso a FINALIZADO
   * 7. Calcula total de la factura
   * 8. Actualiza saldo del proveedor
   *
   * @param ingresoId ID del ingreso a finalizar.
   * @param detalles Array con todos los detalles del ingreso.
   * @returns Promise<void> Se resuelve cuando el proceso se completa.
   */
  async finalizarIngreso(
    ingresoId: string,
    detalles: DetalleIngreso[]
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    let totalFactura = 0;

    // Obtener el ingreso para extraer el proveedor
    const ingresoDoc = doc(this.firestore, `ingresos/${ingresoId}`);
    const ingresoSnap = await getDoc(ingresoDoc);
    const ingreso = ingresoSnap.data() as Ingreso;
    const referenciaTipo: 'IMPORT_EXCEL' | 'INGRESO_MANUAL' =
      (ingreso?.observacion || '').toUpperCase().includes('IMPORTADO DESDE EXCEL')
        ? 'IMPORT_EXCEL'
        : 'INGRESO_MANUAL';
    // IMPORTANTE: Siempre usar ingreso.proveedor (el nombre), NO el proveedorId
    const proveedorIngreso = ingreso?.proveedor || '';

    // 🔹 NUEVO: Rastrear IDs asignados en este lote para evitar colisiones
    const idsAsignadosEnEsteLote = new Set<number>();

    // PASO 1: Crear productos nuevos y asignar productoId a TODOS los detalles
    for (const detalle of detalles) {
      if (detalle.tipo === 'NUEVO') {
        // Crear producto nuevo y asignar el productoId al detalle
        const productoId = await this.crearProductoDesdeIngreso(
          ingresoId,
          detalle,
          idsAsignadosEnEsteLote
        );
        detalle.productoId = productoId;
        console.log('✅ Producto nuevo creado con ID:', productoId, 'para:', detalle.nombre);
      } else if (detalle.tipo === 'EXISTENTE' && detalle.productoId) {
        console.log('✅ Producto existente con ID:', detalle.productoId, 'para:', detalle.nombre);
      }
    }

    // PASO 2: Actualizar productos existentes y registrar movimientos
    for (const detalle of detalles) {
      if (detalle.tipo === 'EXISTENTE' && detalle.productoId) {
        // Actualizar datos del producto existente si es necesario
        const productoDoc = doc(this.firestore, `productos/${detalle.productoId}`);
        const productoSnap = await getDoc(productoDoc);

        if (productoSnap.exists()) {
          const productoData = productoSnap.data() as Producto;
          const actualizaciones: any = { updatedAt: new Date() };

          // SI el producto estaba desactivado, reactivarlo
          if (detalle.estaDesactivado) {
            actualizaciones.activo = true;
            console.log('🔄 Reactivando producto desactivado:', detalle.nombre);
          }

          // SIEMPRE actualizar el proveedor al del Excel (se reemplaza)
          actualizaciones.proveedor = proveedorIngreso;

          // Actualizar PVP1 si viene en el detalle y es diferente
          if (detalle.pvp1 !== undefined && detalle.pvp1 > 0) {
            actualizaciones.pvp1 = detalle.pvp1;
          }

          // Actualizar costo si viene en el detalle y es diferente
          if (detalle.costoUnitario !== undefined && detalle.costoUnitario > 0) {
            actualizaciones.costo = detalle.costoUnitario;
          }

          // Actualizar otros datos del producto desde la importación
          if (detalle.modelo && detalle.modelo !== productoData.modelo) {
            actualizaciones.modelo = detalle.modelo;
          }
          if (detalle.color && detalle.color !== productoData.color) {
            actualizaciones.color = detalle.color;
          }
          if (detalle.grupo && detalle.grupo !== productoData.grupo) {
            actualizaciones.grupo = detalle.grupo;
          }

          // Actualizar observación: CONCATENAR con el anterior, NO reemplazar
          if (detalle.observacion !== undefined && detalle.observacion !== null && detalle.observacion !== '') {
            const observacionAnterior = productoData.observacion || '';
            // Concatenar si hay observación anterior, sino solo usar la nueva
            actualizaciones.observacion = observacionAnterior
              ? `${observacionAnterior} | ${detalle.observacion}`
              : detalle.observacion;
          }

          // Hacer el update con todos los cambios en batch
          batch.update(productoDoc, actualizaciones);
        }
      }

      // Calcular total
      totalFactura += (detalle.costoUnitario || 0) * detalle.cantidad;
    }

    // PASO 3: Guardar detalles en subcolección (ahora todos tienen productoId asignado)
    for (const detalle of detalles) {
      const detalleRef = doc(collection(this.firestore, `ingresos/${ingresoId}/detalles`));

      // Filtrar valores undefined para Firestore
      const detalleData: any = {
        tipo: detalle.tipo,
        nombre: detalle.nombre,
        cantidad: detalle.cantidad,
        costoUnitario: detalle.costoUnitario || 0,
        createdAt: new Date(),
      };

      // Añadir campos opcionales solo si tienen valor
      // CRÍTICO: Ahora SIEMPRE debe haber productoId (ya sea de producto nuevo o existente)
      if (detalle.productoId) {
        detalleData.productoId = detalle.productoId;
      } else {
        console.warn('⚠️ Detalle sin productoId:', detalle.nombre);
      }

      if (detalle.modelo) detalleData.modelo = detalle.modelo;
      if (detalle.color) detalleData.color = detalle.color;
      if (detalle.grupo) detalleData.grupo = detalle.grupo;
      if (detalle.idInterno) detalleData.idInterno = detalle.idInterno;
      // IMPORTANTE: SIEMPRE guardar observación
      if (detalle.observacion !== undefined && detalle.observacion !== null) {
        detalleData.observacion = detalle.observacion;
      }
      if (detalle.pvp1) detalleData.pvp1 = detalle.pvp1;
      if (detalle.iva) detalleData.iva = detalle.iva; // Agregar IVA del detalle
      if (detalle.stockInicial) detalleData.stockInicial = detalle.stockInicial;

      console.log('💾 Guardando detalle con ID:', detalleData.productoId, '| nombre:', detalle.nombre);
      batch.set(detalleRef, detalleData);
    }

    // Actualizar estado del ingreso (reusar la referencia ya obtenida)
    batch.update(ingresoDoc, {
      estado: 'FINALIZADO',
      total: totalFactura + (ingreso.flete || 0) + (ingreso.iva || 0) - (ingreso.descuento || 0),
      updatedAt: new Date(),
    });

    await batch.commit();

    for (const detalle of detalles) {
      if (!detalle.productoId || Number(detalle.cantidad || 0) <= 0) {
        continue;
      }

      if (detalle.tipo === 'NUEVO') {
        await this.movimientoStockSrv.registrarMovimientoIngresoSinActualizarStock({
          productoId: detalle.productoId,
          cantidad: detalle.cantidad,
          referenciaId: ingresoId,
          referenciaTipo,
          usuarioId: '',
          sucursalId: 'PASJO01',
        });
      } else {
        await this.movimientoStockSrv.registrarMovimientoIngreso({
          productoId: detalle.productoId,
          cantidad: detalle.cantidad,
          referenciaId: ingresoId,
          referenciaTipo,
          usuarioId: '',
          sucursalId: 'PASJO01',
        });
      }
    }

    // Actualizar saldo del proveedor en Firestore (después de finalizar ingreso)
    const proveedorNombre = ingreso?.proveedor || '';
    const proveedorIdCampo = (ingreso as any)?.proveedorId || '';
    if (proveedorNombre) {
      // Si tenemos proveedorId directo, usarlo; sino buscar por nombre
      if (proveedorIdCampo) {
        await this.proveedoresService.actualizarSaldoProveedor(proveedorNombre, proveedorIdCampo);
      } else {
        // Buscar el ID del proveedor por nombre
        const proveedoresRef = collection(this.firestore, 'proveedores');
        const qProv = query(proveedoresRef, where('nombre', '==', proveedorNombre));
        const snapProv = await getDocs(qProv);
        if (!snapProv.empty) {
          const provId = snapProv.docs[0].id;
          await this.proveedoresService.actualizarSaldoProveedor(proveedorNombre, provId);
        }
      }
    }
  }

  /**
   * Crea un nuevo producto automáticamente desde un detalle de ingreso.
   * Genera ID interno, asigna proveedor del ingreso y establece valores iniciales.
   * Productos del grupo LUNAS se marcan con tipo_control_stock='ILIMITADO'.
   *
   * @param ingresoId ID del ingreso origen.
   * @param detalle Datos del detalle que contiene la información del producto.
   * @returns Promise<string> ID de Firestore del producto creado.
   */
  private async crearProductoDesdeIngreso(
    ingresoId: string,
    detalle: DetalleIngreso,
    idsAsignadosEnEsteLote?: Set<number>
  ): Promise<string> {
    // 🔹 NUEVO: Si no hay Set, crear uno vacío (compatibilidad hacia atrás)
    if (!idsAsignadosEnEsteLote) {
      idsAsignadosEnEsteLote = new Set();
    }

    let idInterno: number;

    if (detalle.idInterno && detalle.idInterno > 0) {
      // Usar idInterno del Excel si existe y NO está duplicado en este lote
      if (!idsAsignadosEnEsteLote.has(detalle.idInterno)) {
        idInterno = detalle.idInterno;
        idsAsignadosEnEsteLote.add(idInterno);
      } else {
        // 🔹 COLISIÓN: El idInterno ya se usó en este lote, asignar uno nuevo del contador
        idInterno = await this.productosService.getNextIdInterno();
        // Asegurar que el nuevo ID tampoco esté en el lote
        while (idsAsignadosEnEsteLote.has(idInterno)) {
          idInterno = await this.productosService.getNextIdInterno();
        }
        idsAsignadosEnEsteLote.add(idInterno);
        console.log(`⚠️ Colisión de ID ${detalle.idInterno} en lote. Asignando ${idInterno}`);
      }
    } else {
      // Sin idInterno en detalle, asignar del contador
      idInterno = await this.productosService.getNextIdInterno();
      // Asegurar que no esté en el lote
      while (idsAsignadosEnEsteLote.has(idInterno)) {
        idInterno = await this.productosService.getNextIdInterno();
      }
      idsAsignadosEnEsteLote.add(idInterno);
    }

    // Obtener el ingreso para extraer el proveedor
    const ingresoDoc = doc(this.firestore, `ingresos/${ingresoId}`);
    const ingresoSnap = await getDoc(ingresoDoc);
    const ingreso = ingresoSnap.data() as Ingreso;

    // Construir objeto sin valores undefined (Firestore no admite undefined)
    // Stock control: NORMAL ONLY para ARMAZONES y GAFAS
    // ILIMITADO para todos los demás (LUNAS, SERVICIOS, ACCESORIOS, etc.)
    const grupo = detalle.grupo || '';
    const esControlNormal = grupo === 'ARMAZONES' || grupo === 'GAFAS';
    const tipoControlStock = esControlNormal ? 'NORMAL' : 'ILIMITADO';

    const nuevoProducto: any = {
      idInterno: idInterno,
      nombre: detalle.nombre,
      stock: esControlNormal ? detalle.cantidad : 0,
      tipo_control_stock: tipoControlStock,
      proveedor: ingreso?.proveedor || '', // 🔹 Usar proveedor (nombre), NO proveedorId
      ingresoId: ingresoId,
      activo: true, // 🔹 Producto siempre activo al crearse desde ingreso
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Campos opcionales sólo si tienen valor definido
    if (detalle.modelo) nuevoProducto.modelo = detalle.modelo;
    if (detalle.color) nuevoProducto.color = detalle.color;
    if (detalle.grupo) nuevoProducto.grupo = detalle.grupo;
    if (detalle.costoUnitario !== undefined) nuevoProducto.costo = detalle.costoUnitario;
    if (detalle.pvp1 !== undefined) nuevoProducto.pvp1 = detalle.pvp1;

    if (detalle.observacion !== undefined && detalle.observacion !== null) nuevoProducto.observacion = detalle.observacion;

    const productoRef = await addDoc(this.productosRef, nuevoProducto as Producto);

    // 🔹 IMPORTANTE: Actualizar el counter después de crear el producto
    try {
      const counterDoc = doc(this.firestore, 'counters/productos');
      await setDoc(counterDoc, { lastId: idInterno + 1 }, { merge: true });
    } catch (error) {
      console.warn('⚠️ No se pudo actualizar el contador, pero el producto fue creado:', productoRef.id);
    }

    return productoRef.id;
  }

  /**
   * Actualiza el stock de un producto existente.
   * Solo suma stock si tipo_control_stock es NORMAL.
   * Para productos ILIMITADOS (ej: LUNAS), solo actualiza costo sin modificar stock.
   */
  private async actualizarStockProducto(
    productoId: string,
    cantidad: number,
    costoUnitario?: number,
    observacion?: string
  ): Promise<void> {
    const productoDoc = doc(this.firestore, `productos/${productoId}`);
    const productoSnap = await getDoc(productoDoc);

    if (productoSnap.exists()) {
      const producto = productoSnap.data() as Producto;
      // Determinar tipo de control: usar tipo_control_stock
      const tipoControl = producto.tipo_control_stock || 'NORMAL';

      const updateData: any = { updatedAt: new Date() };

      // Solo actualizar stock si el control es NORMAL
      if (tipoControl === 'NORMAL') {
        const nuevoStock = (producto.stock || 0) + cantidad;
        updateData.stock = nuevoStock;
      }
      // Para productos ILIMITADOS: cantidad se usa SOLO para calcular costo total, NO para stock

      if (costoUnitario !== undefined) {
        updateData.costo = costoUnitario;
      }
      // IMPORTANTE: Guardar observación si viene en el detalle
      if (observacion !== undefined && observacion !== null && observacion !== '') {
        updateData.observacion = observacion;
      }

      await updateDoc(productoDoc, updateData);
    }
  }

  // Registrar movimiento de stock
  private async registrarMovimiento(
    movimiento: MovimientoStock
  ): Promise<void> {
    // Obtener stock ACTUAL del producto (después de haber sido actualizado)
    const productoDoc = doc(this.firestore, `productos/${movimiento.productoId}`);
    const productoSnap = await getDoc(productoDoc);

    if (productoSnap.exists()) {
      const producto = productoSnap.data() as Producto;
      // El stock ya fue actualizado en actualizarStockProducto
      // Solo registramos el estado actual, no volvemos a sumar
      const stockNuevo = producto.stock || 0;
      // stockAnterior = stockNuevo - cantidad (para casos INGRESO)
      const stockAnterior = movimiento.tipo === 'INGRESO'
        ? (stockNuevo - movimiento.cantidad)
        : (movimiento.stockAnterior || 0);

      // Ensamblar movimiento evitando campos undefined
      const nuevoMovimiento: any = {
        productoId: movimiento.productoId,
        productoNombre: producto.nombre ?? '',
        grupoProducto: (producto as any).grupo ?? '',
        sucursalId: 'PASJO01',
        referenciaId: movimiento.referenciaId ?? '',
        tipo: movimiento.tipo,
        cantidad: movimiento.cantidad,
        costoUnitario: movimiento.costoUnitario ?? 0,
        stockAnterior,
        stockNuevo,
        createdAt: new Date(),
      };

      if (movimiento.observacion !== undefined && movimiento.observacion !== null) {
        nuevoMovimiento.observacion = movimiento.observacion;
      }
      if (movimiento.usuarioId !== undefined) {
        nuevoMovimiento.usuarioId = movimiento.usuarioId;
      }

      await addDoc(this.movimientosRef, nuevoMovimiento as MovimientoStock);
    }
  }

  // Validar número de factura único
  async numeroFacturaExists(numero: string): Promise<boolean> {
    const numeroNormalizado = (numero || '').trim();
    if (!numeroNormalizado) return false;
    const qNum = query(this.ingresosRef, where('numeroFactura', '==', numeroNormalizado));
    const snap = await getDocs(qNum);
    return !snap.empty;
  }

  // Obtener movimientos de un producto
  getMovimientosProducto(productoId: string): Observable<MovimientoStock[]> {
    const q = query(
      this.movimientosRef,
      where('productoId', '==', productoId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  // Obtener movimientos de un ingreso
  getMovimientosIngreso(ingresoId: string): Observable<MovimientoStock[]> {
    const q = query(
      this.movimientosRef,
      where('ingresoId', '==', ingresoId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  // Obtener ingresos por nombre de proveedor (deprecated - usar getIngresosPorProveedorCodigo)
  getIngresosPorProveedor(proveedorNombre: string): Observable<Ingreso[]> {
    const q = query(
      this.ingresosRef,
      where('proveedor', '==', proveedorNombre),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Ingreso[]>;
  }

  // Obtener ingresos por código de proveedor (evita problemas al editar nombre)
  getIngresosPorProveedorCodigo(proveedorCodigo: string): Observable<Ingreso[]> {
    const q = query(
      this.ingresosRef,
      where('proveedorCodigo', '==', proveedorCodigo),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Ingreso[]>;
  }

  // Obtener ingresos por código de proveedor con consulta directa (sin caché Observable)
  async getIngresosPorProveedorCodigoDirect(proveedorCodigo: string): Promise<Ingreso[]> {
    const q = query(
      this.ingresosRef,
      where('proveedorCodigo', '==', proveedorCodigo),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingreso));
  }

  // Eliminar ingreso borrador
  async eliminarIngreso(id: string): Promise<void> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    const ingresoSnap = await getDoc(ingresoDoc);

    if (ingresoSnap.exists()) {
      const ingreso = ingresoSnap.data() as Ingreso;
      const proveedorNombre = ingreso?.proveedor || '';
      const proveedorIdCampo = (ingreso as any)?.proveedorId || '';

      // Eliminar el ingreso
      await deleteDoc(ingresoDoc);

      // Recalcular y actualizar saldo del proveedor
      if (proveedorNombre) {
        // Si tenemos proveedorId directo, usarlo; sino buscar por nombre
        if (proveedorIdCampo) {
          await this.proveedoresService.actualizarSaldoProveedor(proveedorNombre, proveedorIdCampo);
        } else {
          // Buscar el ID del proveedor por nombre
          const proveedoresRef = collection(this.firestore, 'proveedores');
          const qProv = query(proveedoresRef, where('nombre', '==', proveedorNombre));
          const snapProv = await getDocs(qProv);
          if (!snapProv.empty) {
            const provId = snapProv.docs[0].id;
            await this.proveedoresService.actualizarSaldoProveedor(proveedorNombre, provId);
          }
        }
      }
    }
  }

  // Calcular deuda total de la sucursal (suma de todos los saldos de proveedores)
  async calcularDeudaSucursal(): Promise<number> {
    try {
      const proveedoresRef = collection(this.firestore, 'proveedores');
      const snap = await getDocs(proveedoresRef);

      let totalDeuda = 0;
      snap.forEach(docSnap => {
        const proveedor: any = docSnap.data();
        totalDeuda += proveedor.saldo || 0;
      });

      return totalDeuda;
    } catch (error) {
      console.error('Error al calcular deuda de sucursal:', error);
      return 0;
    }
  }
}
