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

@Injectable({
  providedIn: 'root',
})
export class IngresosService {
  private firestore = inject(Firestore);
  private productosService = inject(ProductosService);
  
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
    const proveedorIngreso = (ingreso as any)?.proveedorId || ingreso?.proveedor || '';

    for (const detalle of detalles) {
      if (detalle.tipo === 'NUEVO') {
        // 🔸 Crear producto nuevo
        const productoId = await this.crearProductoDesdeIngreso(
          ingresoId,
          detalle
        );
        detalle.productoId = productoId;
      } else if (detalle.tipo === 'EXISTENTE' && detalle.productoId) {
        // 🔸 Verificar y actualizar proveedor si es diferente
        const productoDoc = doc(this.firestore, `productos/${detalle.productoId}`);
        const productoSnap = await getDoc(productoDoc);
        
        if (productoSnap.exists()) {
          const productoData = productoSnap.data() as Producto;
          
          // Si el proveedor del producto es diferente al del ingreso, actualizar
          if (productoData.proveedor !== proveedorIngreso) {
            batch.update(productoDoc, {
              proveedor: proveedorIngreso,
              updatedAt: new Date()
            });
          }
        }

        // 🔸 Actualizar stock de producto existente
        await this.actualizarStockProducto(
          detalle.productoId,
          detalle.cantidad,
          detalle.costoUnitario
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
      if (detalle.codigo) detalleData.codigo = detalle.codigo;
      if (detalle.observacion) detalleData.observacion = detalle.observacion;
      if (detalle.pvp1) detalleData.pvp1 = detalle.pvp1;
      if (detalle.iva) detalleData.iva = detalle.iva; // Agregar IVA del detalle
      if (detalle.stockInicial) detalleData.stockInicial = detalle.stockInicial;
      
      batch.set(detalleRef, detalleData);
    }

    // 🔸 Actualizar estado del ingreso (reusar la referencia ya obtenida)
    batch.update(ingresoDoc, {
      estado: 'FINALIZADO',
      total: totalFactura + (ingreso.flete || 0) + (ingreso.iva || 0) - (ingreso.descuento || 0),
      updatedAt: new Date(),
    });

    await batch.commit();
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
    const nuevoProducto: any = {
      idInterno: idInterno,
      codigo: detalle.codigo || `PROD-${idInterno}`,
      nombre: detalle.nombre,
      stock: esLunas ? 0 : detalle.cantidad,
      proveedor: (ingreso as any)?.proveedorId || ingreso?.proveedor || '',
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
    
    // Calcular precioConIVA si hay PVP e IVA
    if (detalle.pvp1 !== undefined && detalle.iva !== undefined && detalle.iva > 0) {
      nuevoProducto.iva = detalle.iva;
      // precioConIVA = pvp1 * (1 + iva/100)
      nuevoProducto.precioConIVA = detalle.pvp1 * (1 + detalle.iva / 100);
    } else if (detalle.iva !== undefined) {
      nuevoProducto.iva = detalle.iva;
    }
    
    if (detalle.observacion !== undefined && detalle.observacion !== null) nuevoProducto.observacion = detalle.observacion;

    const productoRef = await addDoc(this.productosRef, nuevoProducto as Producto);
    return productoRef.id;
  }

  // 🔹 Actualizar stock de producto existente
  private async actualizarStockProducto(
    productoId: string,
    cantidad: number,
    costoUnitario?: number
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

      await updateDoc(productoDoc, updateData);
    }
  }

  // 🔹 Registrar movimiento de stock
  private async registrarMovimiento(
    movimiento: MovimientoStock
  ): Promise<void> {
    // Obtener stock actual del producto
    const productoDoc = doc(this.firestore, `productos/${movimiento.productoId}`);
    const productoSnap = await getDoc(productoDoc);
    
    if (productoSnap.exists()) {
      const producto = productoSnap.data() as Producto;
      const stockAnterior = producto.stock || 0;
      const esLunas = (producto as any)?.grupo === 'LUNAS' || (producto as any)?.stockIlimitado === true;
      const stockNuevo = esLunas ? stockAnterior : stockAnterior + movimiento.cantidad;

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

  // 🔹 Buscar productos existentes
  buscarProductos(termino: string): Observable<Producto[]> {
    return this.productosService.getProductos();
    // TODO: Implementar búsqueda más específica si es necesario
  }

  // 🔹 Eliminar ingreso borrador
  async eliminarIngreso(id: string): Promise<void> {
    const ingresoDoc = doc(this.firestore, `ingresos/${id}`);
    await deleteDoc(ingresoDoc);
  }
}
