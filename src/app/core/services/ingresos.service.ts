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

@Injectable({
  providedIn: 'root',
})
export class IngresosService {
  private firestore = inject(Firestore);
  private productosService = inject(ProductosService);
  private proveedoresService = inject(ProveedoresService);
  
  private ingresosRef = collection(this.firestore, 'ingresos');
  private movimientosRef = collection(this.firestore, 'movimientos_stock');
  private productosRef = collection(this.firestore, 'productos');

  // 🔹 Almacenamiento temporal de ingreso (antes de crear en BD)
  private ingresoTemporal: Ingreso | null = null;
  private ingresoTemporalId: string | null = null;

  // 🔹 Guardar ingreso temporalmente (sin crear en BD)
  guardarIngresoTemporal(ingreso: Ingreso): string {
    this.ingresoTemporal = ingreso;
    // Generar un ID temporal para usarlo durante la navegación
    this.ingresoTemporalId = 'temp_' + Date.now();
    return this.ingresoTemporalId;
  }

  // 🔹 Obtener ingreso temporal
  obtenerIngresoTemporal(): Ingreso | null {
    return this.ingresoTemporal;
  }

  // 🔹 Limpiar ingreso temporal
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

  // 🔹 Obtener todos los ingresos
  getIngresos(): Observable<Ingreso[]> {
    const q = query(this.ingresosRef, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Ingreso[]>;
  }

  // 🔹 Obtener un ingreso por ID
  getIngresoById(id: string): Observable<Ingreso> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    return docData(ingresoDoc, { idField: 'id' }) as Observable<Ingreso>;
  }

  // 🔹 Obtener detalles de un ingreso
  getDetallesIngreso(ingresoId: string): Observable<DetalleIngreso[]> {
    const detallesRef = collection(this.firestore, `ingresos/${ingresoId}/detalles`);
    return collectionData(detallesRef, { idField: 'id' }) as Observable<DetalleIngreso[]>;
  }

  // 🔹 Crear ingreso (solo datos básicos - PASO 1)
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

  // 🔹 Actualizar ingreso
  async actualizarIngreso(id: string, datos: Partial<Ingreso>): Promise<void> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    await updateDoc(ingresoDoc, {
      ...datos,
      updatedAt: new Date(),
    });
  }

  // 🔹 Finalizar ingreso y procesar productos (PASO 4)
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
    // 🔹 IMPORTANTE: Siempre usar ingreso.proveedor (el nombre), NO el proveedorId
    const proveedorIngreso = ingreso?.proveedor || '';

    for (const detalle of detalles) {
      if (detalle.tipo === 'NUEVO') {
        // 🔸 Crear producto nuevo
        const productoId = await this.crearProductoDesdeIngreso(
          ingresoId,
          detalle
        );
        detalle.productoId = productoId;
      } else if (detalle.tipo === 'EXISTENTE' && detalle.productoId) {
        // 🔸 Actualizar datos del producto existente si es necesario
        const productoDoc = doc(this.firestore, `productos/${detalle.productoId}`);
        const productoSnap = await getDoc(productoDoc);
        
        if (productoSnap.exists()) {
          const productoData = productoSnap.data() as Producto;
          const actualizaciones: any = { updatedAt: new Date() };
          
          // Actualizar proveedor si es diferente
          if (productoData.proveedor !== proveedorIngreso) {
            actualizaciones.proveedor = proveedorIngreso;
          }
          
          // NUEVO: Actualizar PVP1 si viene en el detalle
          if (detalle.pvp1 !== undefined && detalle.pvp1 > 0) {
            actualizaciones.pvp1 = detalle.pvp1;
          }
          
          // Solo hacer update si hay cambios
          if (Object.keys(actualizaciones).length > 1) { // > 1 porque siempre tiene updatedAt
            batch.update(productoDoc, actualizaciones);
          }
        }

        // 🔸 Actualizar stock de producto existente
        await this.actualizarStockProducto(
          detalle.productoId,
          detalle.cantidad,
          detalle.costoUnitario,
          detalle.observacion
        );
      }

      // 🔸 Registrar movimiento de stock
      if (detalle.productoId) {
        await this.registrarMovimiento({
          productoId: detalle.productoId,
          ingresoId: ingresoId,
          tipo: 'INGRESO',
          cantidad: detalle.cantidad,
          costoUnitario: detalle.costoUnitario,
          stockAnterior: 0, // Se actualizará en el método
          stockNuevo: 0, // Se actualizará en el método
          observacion: detalle.observacion,
        });
      }

      // Calcular total
      totalFactura += (detalle.costoUnitario || 0) * detalle.cantidad;
    }

    // 🔸 Guardar detalles en subcolección
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
      if (detalle.productoId) detalleData.productoId = detalle.productoId;
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
      
      console.log('💾 Guardando detalle:', { nombre: detalle.nombre, observacion: detalle.observacion, detalleData });
      batch.set(detalleRef, detalleData);
    }

    // 🔸 Actualizar estado del ingreso (reusar la referencia ya obtenida)
    batch.update(ingresoDoc, {
      estado: 'FINALIZADO',
      total: totalFactura + (ingreso.flete || 0) + (ingreso.iva || 0) - (ingreso.descuento || 0),
      updatedAt: new Date(),
    });

    await batch.commit();

    // 🔸 Actualizar saldo del proveedor en Firestore (después de finalizar ingreso)
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

  // 🔹 Crear producto desde ingreso
  private async crearProductoDesdeIngreso(
    ingresoId: string,
    detalle: DetalleIngreso
  ): Promise<string> {
    const idInterno = await this.productosService.getNextIdInterno();
    
    // Obtener el ingreso para extraer el proveedor
    const ingresoDoc = doc(this.firestore, `ingresos/${ingresoId}`);
    const ingresoSnap = await getDoc(ingresoDoc);
    const ingreso = ingresoSnap.data() as Ingreso;

    // Construir objeto sin valores undefined (Firestore no admite undefined)
    const esLunas = (detalle.grupo === 'LUNAS');
    
    // Usar idInterno del detalle si viene del Excel, sino generar automáticamente
    const productoIdInterno = detalle.idInterno || idInterno;
    
    const nuevoProducto: any = {
      idInterno: productoIdInterno,
      nombre: detalle.nombre,
      stock: esLunas ? 0 : detalle.cantidad,
      proveedor: ingreso?.proveedor || '', // 🔹 Usar proveedor (nombre), NO proveedorId
      ingresoId: ingresoId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Campos opcionales sólo si tienen valor definido
    if (detalle.modelo) nuevoProducto.modelo = detalle.modelo;
    if (detalle.color) nuevoProducto.color = detalle.color;
    if (detalle.grupo) nuevoProducto.grupo = detalle.grupo;
    if (esLunas) nuevoProducto.stockIlimitado = true;
    if (detalle.costoUnitario !== undefined) nuevoProducto.costo = detalle.costoUnitario;
    if (detalle.pvp1 !== undefined) nuevoProducto.pvp1 = detalle.pvp1;
    
    if (detalle.observacion !== undefined && detalle.observacion !== null) nuevoProducto.observacion = detalle.observacion;

    const productoRef = await addDoc(this.productosRef, nuevoProducto as Producto);
    return productoRef.id;
  }

  // 🔹 Actualizar stock de producto existente
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
      const esLunas = (producto as any)?.grupo === 'LUNAS' || (producto as any)?.stockIlimitado === true;

      // Si es LUNAS, no modificar stock; solo actualizar costo si aplica
      const updateData: any = { updatedAt: new Date() };
      if (!esLunas) {
        const nuevoStock = (producto.stock || 0) + cantidad;
        updateData.stock = nuevoStock;
      }
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

  // 🔹 Registrar movimiento de stock
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
        ingresoId: movimiento.ingresoId,
        tipo: movimiento.tipo,
        cantidad: movimiento.cantidad,
        costoUnitario: movimiento.costoUnitario,
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

  // 🔹 Validar número de factura único
  async numeroFacturaExists(numero: string): Promise<boolean> {
    const numeroNormalizado = (numero || '').trim();
    if (!numeroNormalizado) return false;
    const qNum = query(this.ingresosRef, where('numeroFactura', '==', numeroNormalizado));
    const snap = await getDocs(qNum);
    return !snap.empty;
  }

  // 🔹 Obtener movimientos de un producto
  getMovimientosProducto(productoId: string): Observable<MovimientoStock[]> {
    const q = query(
      this.movimientosRef,
      where('productoId', '==', productoId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  // 🔹 Obtener movimientos de un ingreso
  getMovimientosIngreso(ingresoId: string): Observable<MovimientoStock[]> {
    const q = query(
      this.movimientosRef,
      where('ingresoId', '==', ingresoId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoStock[]>;
  }

  // 🔹 Obtener ingresos por nombre de proveedor
  getIngresosPorProveedor(proveedorNombre: string): Observable<Ingreso[]> {
    const q = query(
      this.ingresosRef,
      where('proveedor', '==', proveedorNombre),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Ingreso[]>;
  }

  // 🔹 Eliminar ingreso borrador
  async eliminarIngreso(id: string): Promise<void> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    const ingresoSnap = await getDoc(ingresoDoc);
    
    if (ingresoSnap.exists()) {
      const ingreso = ingresoSnap.data() as Ingreso;
      const proveedorNombre = ingreso?.proveedor || '';
      const proveedorIdCampo = (ingreso as any)?.proveedorId || '';
      
      // Eliminar el ingreso
      await deleteDoc(ingresoDoc);
      
      // 🔸 Recalcular y actualizar saldo del proveedor
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

  // 🔹 Calcular deuda total de la sucursal (suma de todos los saldos de proveedores)
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
