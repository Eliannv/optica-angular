/**
 * Gestiona el catálogo completo de productos del sistema de inventario.
 * Maneja operaciones CRUD con validaciones de unicidad, generación automática de IDs
 * internos secuenciales, actualizaciones de stock mediante transacciones Firestore
 * y soft delete para preservar historial.
 *
 * Este servicio implementa:
 * - Generación automática de idInterno (secuencial numérico)
 * - Descuento de stock con transacciones atómicas (evita condiciones de carrera)
 * - Soft delete (campo activo) para mantener trazabilidad
 * - Validación de códigos duplicados (opcional según validaciones del modelo)
 * - Filtrado automático de productos desactivados en consultas
 *
 * Los datos se persisten en 'productos' de Firestore.
 * Se integra con ingreso.service.ts para actualizaciones de stock y movimientos.service.ts para trazabilidad.
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
  limit,
  startAfter,
  QueryDocumentSnapshot,
  orderBy,
  limitToLast,
  endBefore,
  DocumentSnapshot
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, shareReplay, forkJoin, map, of, tap, switchMap } from 'rxjs';
import { Producto } from '../models/producto.model';
import { PaginationResult } from '../models/pagination.model';

@Injectable({
  providedIn: 'root',
})
export class ProductosService {
  private firestore = inject(Firestore);
  private productosRef = collection(this.firestore, 'productos');

  // 🎯 CACHÉ con shareReplay
  private cachedProductos$: Observable<Producto[]> | null = null;
  private cachedProductosTodos$: Observable<Producto[]> | null = null;
  private productosCache$ = new BehaviorSubject<Producto[]>([]);

  /**
   * Recupera todos los productos activos del sistema.
   * Incluye productos con activo:true O sin el campo (compatibilidad con datos legacy).
   * Filtra en el cliente para evitar requerimiento de índice Firestore.
   * 🎯 ACTUALIZADO: Con caché compartido
   *
   * @returns Observable<Producto[]> Stream reactivo con los productos activos.
   */
  getProductos(): Observable<Producto[]> {
    if (!this.cachedProductos$) {
      this.cachedProductos$ = collectionData(this.productosRef, {
        idField: 'id',
      }).pipe(
        map((productos: any[]) =>
          productos.filter((p) => p.activo !== false) as Producto[]
        ),
        tap(productos => this.productosCache$.next(productos)),
        shareReplay(1) // 🎯 Compartir resultado
      );
    }
    return this.cachedProductos$;
  }

  /**
   * 🆕 Obtener productos activos con paginación
   */
  getProductosPaginadas(
    pageSize: number = 50,
    startAfterDoc?: QueryDocumentSnapshot<any>
  ): Observable<PaginationResult<Producto>> {
    let q: any;

    if (startAfterDoc) {
      q = query(
        this.productosRef,
        where('activo', '!=', false),
        orderBy('activo'),
        orderBy('nombre'),
        startAfter(startAfterDoc),
        limit(pageSize + 1)
      );
    } else {
      q = query(
        this.productosRef,
        where('activo', '!=', false),
        orderBy('activo'),
        orderBy('nombre'),
        limit(pageSize + 1)
      );
    }

    return collectionData(q, { idField: 'id' }).pipe(
      map((productos: any[]) => {
        const hasNextPage = productos.length > pageSize;
        const items = productos.slice(0, pageSize);
        const lastDoc = items.length > 0 ? items[items.length - 1] : null;

        return {
          items: items as Producto[],
          pageSize,
          hasNextPage,
          cursor: {
            next: hasNextPage ? lastDoc : undefined
          }
        };
      })
    );
  }

  /**
   * Recupera TODOS los productos incluyendo los desactivados.
   * 🎯 ACTUALIZADO: Con caché compartido
   *
   * @returns Observable<Producto[]> Stream con todos los productos sin filtrar.
   */
  getProductosTodosInclusoInactivos(): Observable<Producto[]> {
    if (!this.cachedProductosTodos$) {
      this.cachedProductosTodos$ = collectionData(this.productosRef, {
        idField: 'id',
      }).pipe(
        map(data => data as Producto[]),
        shareReplay(1) // 🎯 Compartir resultado
      );
    }
    return this.cachedProductosTodos$;
  }

  // 🎯 Recargar caché
  reloadProductos() {
    this.cachedProductos$ = null;
    this.cachedProductosTodos$ = null;
    return this.getProductos();
  }

  /**
   * 🚀 OPTIMIZADO: Cargar productos limitados para POS (crear venta)
   * Carga inicial de máximo 10-20 productos para reducir memoria y lecturas
   *
   * @param limitCount Número máximo de productos a cargar (default: 10)
   * @param orderByField Campo por el que ordenar (default: 'idInterno')
   * @returns Observable<Producto[]> Stream con productos limitados
   */
  getProductosLimitados(limitCount: number = 10, orderByField: string = 'idInterno'): Observable<Producto[]> {
    const q = query(
      this.productosRef,
      where('activo', '!=', false),
      orderBy('activo'),
      orderBy(orderByField),
      limit(limitCount)
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((productos: any[]) => productos as Producto[])
    );
  }

  /**
   * � Obtener producto(s) por código de barras/identificador único (exacto)
   * @param codigo Código a buscar en el campo `codigo`
   */
  getProductoPorCodigo(codigo: string): Observable<Producto[]> {
    const valorOriginal = (codigo || '').trim();
    const valor = valorOriginal.replace(/\s+/g, '').toUpperCase();
    if (!valor) {
      return of([]);
    }

    // Consulta exacta del campo `codigo` con posibles variaciones de mayúsculas/minúsculas
    const qExact = query(this.productosRef, where('codigo', '==', valorOriginal));
    const qUpper = query(this.productosRef, where('codigo', '==', valor));
    const qLower = query(this.productosRef, where('codigo', '==', valor.toLowerCase()));

    // Consulta por campo `modelo` para armazones sin código
    const qModelo = query(this.productosRef, where('modelo', '==', valorOriginal));
    const qModeloUpper = query(this.productosRef, where('modelo', '==', valor));
    const qModeloLower = query(this.productosRef, where('modelo', '==', valor.toLowerCase()));

    // Si no se encuentra con código, buscar por idInterno si el valor es numérico
    const idInternoNum = Number(valor);
    const qIdInterno = !isNaN(idInternoNum)
      ? query(this.productosRef, where('idInterno', '==', idInternoNum))
      : null;

    const filtrarActivos = (productos: any[]) =>
      (productos || [])
        .filter((p: any) => p.activo !== false)
        .map((p: any) => p as Producto);

    return collectionData(qExact, { idField: 'id' }).pipe(
      switchMap((productos: any[]) => {
        const activos = filtrarActivos(productos);
        if (activos.length > 0) return of(activos);

        return collectionData(qUpper, { idField: 'id' }).pipe(
          switchMap((productos2: any[]) => {
            const activos2 = filtrarActivos(productos2);
            if (activos2.length > 0) return of(activos2);

            return collectionData(qLower, { idField: 'id' }).pipe(
              switchMap((productos3: any[]) => {
                const activos3 = filtrarActivos(productos3);
                if (activos3.length > 0) return of(activos3);

                return collectionData(qModelo, { idField: 'id' }).pipe(
                  switchMap((productos4: any[]) => {
                    const activos4 = filtrarActivos(productos4);
                    if (activos4.length > 0) return of(activos4);

                    return collectionData(qModeloUpper, { idField: 'id' }).pipe(
                      switchMap((productos5: any[]) => {
                        const activos5 = filtrarActivos(productos5);
                        if (activos5.length > 0) return of(activos5);

                        return collectionData(qModeloLower, { idField: 'id' }).pipe(
                          switchMap((productos6: any[]) => {
                            const activos6 = filtrarActivos(productos6);
                            if (activos6.length > 0) return of(activos6);

                            if (qIdInterno) {
                              return collectionData(qIdInterno, { idField: 'id' }).pipe(
                                map((productos7: any[]) => filtrarActivos(productos7))
                              );
                            }

                            return of([]);
                          })
                        );
                      })
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  /**
   * �🚀 OPTIMIZADO: Búsqueda de productos con límite y prefijo
   * Busca por nombre, código, modelo, etc. con límite de resultados
   *
   * @param searchTerm Término de búsqueda
   * @param limitCount Número máximo de resultados (default: 20)
   * @returns Observable<Producto[]> Productos que coinciden con la búsqueda
   */
  buscarProductosLimitado(searchTerm: string, limitCount: number = 20): Observable<Producto[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getProductosLimitados(limitCount);
    }

    const term = searchTerm.toLowerCase().trim();

    // 🔍 Búsqueda mejorada sin límite inicial (para encontrar todos los productos)
    const q = query(
      this.productosRef,
      where('activo', '!=', false),
      orderBy('activo'),
      orderBy('nombre')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((productos: any[]) => {
        // Filtrar en cliente por múltiples campos
        const filtrados = productos.filter((p: any) => {
          const nombre = (p.nombre || '').toLowerCase();
          const tipo = (p.tipo || p.categoria || '').toLowerCase();
          const modelo = (p.modelo || '').toLowerCase();
          const color = (p.color || '').toLowerCase();
          const codigo = (p.codigo || '').toLowerCase();
          const idInterno = (p.idInterno || '').toString().toLowerCase();

          return nombre.includes(term) ||
                 tipo.includes(term) ||
                 modelo.includes(term) ||
                 color.includes(term) ||
                 codigo.includes(term) ||
                 idInterno.includes(term);
        });

        // Limitar resultados finales
        return filtrados.slice(0, limitCount) as Producto[];
      })
    );
  }

  /**
   * 🚀 OPTIMIZADO: Búsqueda con filtros avanzados y límite
   * Permite filtrar por grupo, proveedor y tipo de stock
   *
   * @param options Opciones de búsqueda y filtrado
   * @returns Observable<Producto[]> Productos filtrados
   */
  buscarProductosConFiltros(options: {
    searchTerm?: string;
    grupo?: string;
    proveedor?: string;
    tipoStock?: string;
    limitCount?: number;
  }): Observable<Producto[]> {
    const { searchTerm = '', grupo = '', proveedor = '', tipoStock = '', limitCount = 20 } = options;

    // Query base - SIN LÍMITE para poder buscar en todos los productos
    let q = query(
      this.productosRef,
      where('activo', '!=', false),
      orderBy('activo'),
      orderBy('nombre')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((productos: any[]) => {
        let filtrados = productos;

        // Filtrar por grupo
        if (grupo) {
          filtrados = filtrados.filter(p =>
            (p.grupo || '').toUpperCase() === grupo.toUpperCase()
          );
        }

        // Filtrar por proveedor
        if (proveedor) {
          filtrados = filtrados.filter(p =>
            (p.proveedor || '').toUpperCase() === proveedor.toUpperCase()
          );
        }

        // Filtrar por tipo de stock
        if (tipoStock) {
          filtrados = filtrados.filter(p => {
            const tipoControl = (p as any).tipo_control_stock || 'NORMAL';
            return tipoControl === tipoStock;
          });
        }

        // Filtrar por término de búsqueda
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          filtrados = filtrados.filter(p => {
            const nombre = (p.nombre || '').toLowerCase();
            const tipo = (p.tipo || p.categoria || '').toLowerCase();
            const modelo = (p.modelo || '').toLowerCase();
            const color = (p.color || '').toLowerCase();
            const codigo = (p.codigo || '').toLowerCase();
            const idInterno = (p.idInterno || '').toString().toLowerCase();

            return nombre.includes(term) ||
                   tipo.includes(term) ||
                   modelo.includes(term) ||
                   color.includes(term) ||
                   codigo.includes(term) ||
                   idInterno.includes(term);
          });
        }

        // Limitar resultados
        return filtrados.slice(0, limitCount) as Producto[];
      })
    );
  }

  /**
   * 🚀 PAGINACIÓN REAL DESDE FIRESTORE
   *
   * Obtiene productos con paginación real usando cursores de Firestore.
   * Solo carga 10 productos por consulta, reduciendo uso de memoria y lecturas.
   *
   * @param options - Opciones de paginación
   * @param options.pageSize - Cantidad de productos por página (default: 10)
   * @param options.lastVisible - Snapshot del último documento visible (para "siguiente")
   * @param options.firstVisible - Snapshot del primer documento visible (para "anterior")
   * @param options.direction - Dirección de navegación: 'next' | 'prev' (default: 'next')
   * @param options.ordenamiento - Campo para ordenar: 'reciente' | 'codigo' (default: 'codigo')
   * @param options.terminoBusqueda - Término para buscar en múltiples campos
   * @param options.grupoSeleccionado - Filtro por grupo/categoría
   *
   * @returns Promise<{ productos: Producto[], lastDoc: DocumentSnapshot | null, firstDoc: DocumentSnapshot | null }>
   *
   * @example
   * // Primera carga
   * const result = await getProductosPaginadosReal({ pageSize: 10 });
   *
   * // Página siguiente
   * const nextPage = await getProductosPaginadosReal({
   *   pageSize: 10,
   *   lastVisible: result.lastDoc,
   *   direction: 'next'
   * });
   *
   * // Página anterior
   * const prevPage = await getProductosPaginadosReal({
   *   pageSize: 10,
   *   firstVisible: result.firstDoc,
   *   direction: 'prev'
   * });
   */

  /**
   * 🔍 Buscar productos SIN paginación (trae todos y filtra en cliente)
   * Se usa cuando hay un término de búsqueda o un grupo seleccionado activo
   */
  private async buscarProductosSinPaginacion(
    terminoBusqueda: string,
    grupoSeleccionado: string,
    ordenamiento: 'reciente' | 'codigo',
    pageSize: number
  ): Promise<{
    productos: Producto[];
    lastDoc: DocumentSnapshot | null;
    firstDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    // Traer TODOS los productos activos
    let q;
    if (ordenamiento === 'reciente') {
      q = query(
        this.productosRef,
        orderBy('createdAt', 'desc'),
        orderBy('idInterno', 'desc')
      );
    } else {
      q = query(
        this.productosRef,
        orderBy('idInterno', 'asc')
      );
    }

    const snapshot = await getDocs(q);
    let productos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Producto[];

    // Filtrar productos inactivos
    productos = productos.filter(p => p.activo !== false);

    // Aplicar filtro de grupo si existe
    if (grupoSeleccionado) {
      productos = productos.filter(p =>
        p.grupo?.toUpperCase() === grupoSeleccionado.toUpperCase()
      );
    }

    // Aplicar búsqueda en múltiples campos (solo si hay término de búsqueda)
    if (terminoBusqueda.trim()) {
      const termino = terminoBusqueda.toLowerCase().trim();
      productos = productos.filter(p => {
        const nombre = p.nombre?.toLowerCase() || '';
        const modelo = p.modelo?.toLowerCase() || '';
        const color = p.color?.toLowerCase() || '';
        const grupo = p.grupo?.toLowerCase() || '';
        const proveedor = p.proveedor?.toLowerCase() || '';
        const idInterno = p.idInterno?.toString() || '';

        return nombre.includes(termino) ||
               modelo.includes(termino) ||
               color.includes(termino) ||
               grupo.includes(termino) ||
               proveedor.includes(termino) ||
               idInterno.includes(termino);
      });
    }

    // Aplicar paginación manual (en memoria)
    const hasMore = productos.length > pageSize;
    const productosFinales = productos.slice(0, pageSize);

    return {
      productos: productosFinales,
      lastDoc: null,
      firstDoc: null,
      hasMore
    };
  }

  async getProductosPaginadosReal(options: {
    pageSize?: number;
    lastVisible?: DocumentSnapshot | null;
    firstVisible?: DocumentSnapshot | null;
    direction?: 'next' | 'prev';
    ordenamiento?: 'reciente' | 'codigo';
    terminoBusqueda?: string;
    grupoSeleccionado?: string;
  }): Promise<{
    productos: Producto[];
    lastDoc: DocumentSnapshot | null;
    firstDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    const {
      pageSize = 10,
      lastVisible = null,
      firstVisible = null,
      direction = 'next',
      ordenamiento = 'codigo',
      terminoBusqueda = '',
      grupoSeleccionado = ''
    } = options;

    // 🔍 SI HAY BÚSQUEDA O GRUPO SELECCIONADO, traer TODOS los productos y filtrar
    if (terminoBusqueda.trim() || grupoSeleccionado.trim()) {
      return this.buscarProductosSinPaginacion(terminoBusqueda, grupoSeleccionado, ordenamiento, pageSize);
    }

    // ✅ Construir query base con ordenamiento
    let q;

    if (ordenamiento === 'reciente') {
      // Ordenar por fecha de creación descendente
      if (direction === 'prev' && firstVisible) {
        q = query(
          this.productosRef,
          orderBy('createdAt', 'desc'),
          orderBy('idInterno', 'desc'),
          endBefore(firstVisible),
          limitToLast(pageSize + 1) // +1 para detectar si hay más páginas
        );
      } else if (direction === 'next' && lastVisible) {
        q = query(
          this.productosRef,
          orderBy('createdAt', 'desc'),
          orderBy('idInterno', 'desc'),
          startAfter(lastVisible),
          limit(pageSize + 1)
        );
      } else {
        // Primera carga
        q = query(
          this.productosRef,
          orderBy('createdAt', 'desc'),
          orderBy('idInterno', 'desc'),
          limit(pageSize + 1)
        );
      }
    } else {
      // Ordenar por idInterno ascendente (default)
      if (direction === 'prev' && firstVisible) {
        q = query(
          this.productosRef,
          orderBy('idInterno', 'asc'),
          endBefore(firstVisible),
          limitToLast(pageSize + 1)
        );
      } else if (direction === 'next' && lastVisible) {
        q = query(
          this.productosRef,
          orderBy('idInterno', 'asc'),
          startAfter(lastVisible),
          limit(pageSize + 1)
        );
      } else {
        // Primera carga
        q = query(
          this.productosRef,
          orderBy('idInterno', 'asc'),
          limit(pageSize + 1)
        );
      }
    }

    // ✅ Ejecutar query
    const snapshot = await getDocs(q);
    let productos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Producto[];

    // ✅ Filtrar productos inactivos (soft delete)
    productos = productos.filter(p => p.activo !== false);

    // ✅ Aplicar filtro de grupo si existe
    if (grupoSeleccionado) {
      productos = productos.filter(p =>
        p.grupo?.toUpperCase() === grupoSeleccionado.toUpperCase()
      );
    }

    // ✅ Detectar si hay más páginas
    const hasMore = productos.length > pageSize;

    // ✅ Limitar a pageSize
    const productosFinales = productos.slice(0, pageSize);

    // ✅ Obtener referencias de documentos
    const firstDoc = snapshot.docs[0] || null;
    const lastDoc = snapshot.docs[Math.min(pageSize - 1, snapshot.docs.length - 1)] || null;

    return {
      productos: productosFinales,
      lastDoc,
      firstDoc,
      hasMore
    };
  }

  /**
   * 🆕 OPTIMIZADO: Cargar múltiples productos por IDs en batch
   * Evita N+1 problem cargando hasta 10 productos en una sola query
   *
   * @param ids Array de IDs de productos
   * @returns Observable con mapa de ID → Producto
   */
  getProductosPorIdsOptimizado(ids: string[]): Observable<Map<string, Producto>> {
    if (!ids || ids.length === 0) {
      return new Observable(observer => {
        observer.next(new Map());
        observer.complete();
      });
    }

    // Dividir en batches de 10 (límite de Firestore "in" queries)
    const batches: Observable<Producto[]>[] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const q = query(
        this.productosRef,
        where('__name__' as any, 'in', batch)  // Buscar por ID del documento
      );
      batches.push(
        collectionData(q, { idField: 'id' }) as Observable<Producto[]>
      );
    }

    // Combinar resultados
    return forkJoin(batches).pipe(
      map(results => {
        const mapa = new Map<string, Producto>();
        results.forEach(batch => {
          batch.forEach(producto => {
            mapa.set(producto.id!, producto);
          });
        });
        return mapa;
      })
    );
  }

  /**
   * Recupera un producto específico por su ID de Firestore.
   *
   * @param id ID del producto.
   * @returns Observable<Producto> Stream con los datos del producto.
   */
  getProductoById(id: string): Observable<Producto> {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return docData(productoDoc, {
      idField: 'id',
    }) as Observable<Producto>;
  }

  /**
   * Recupera todos los productos asociados a un ingreso específico.
   *
   * @param ingresoId ID del ingreso.
   * @returns Observable<Producto[]> Stream con los productos del ingreso.
   */
  getProductosPorIngreso(ingresoId: string): Observable<Producto[]> {
    const q = query(this.productosRef, where('ingresoId', '==', ingresoId));
    return collectionData(q, { idField: 'id' }) as Observable<Producto[]>;
  }

  /**
   * Obtiene el último ID del contador de productos sin incrementarlo.
   * Valida si existen productos en la colección y retorna el siguiente ID disponible.
   *
   * @returns Promise<number | null> Último ID usado o 1 si no hay productos, null si no existe contador.
   */
  async getCounterDoc(): Promise<number | null> {
    const counterDoc = doc(this.firestore, 'counters/productos');
    const counterSnapshot = await getDoc(counterDoc);

    // Verificar si existen productos en la colección
    const productosSnapshot = await getDocs(this.productosRef);
    const hayProductos = !productosSnapshot.empty;

    if (!hayProductos) {
      // Si no hay productos, el próximo será 1
      return 1;
    }

    if (counterSnapshot.exists()) {
      return counterSnapshot.data()['lastId'] || null;
    }

    return null;
  }

  /**
   * Genera el siguiente ID interno secuencial usando un documento contador atómico.
   * Utiliza transacción Firestore para evitar duplicados en operaciones concurrentes.
   *
   * @returns Promise<number> Siguiente ID interno disponible (mínimo 1).
   */
  async getNextIdInterno(): Promise<number> {
    const counterDoc = doc(this.firestore, 'counters/productos');

    // 1. Obtener todos los productos para encontrar el máximo idInterno real
    const productosSnapshot = await getDocs(this.productosRef);
    let maxIdInterno = 0;

    productosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data['idInterno'] && typeof data['idInterno'] === 'number') {
        if (data['idInterno'] > maxIdInterno) {
          maxIdInterno = data['idInterno'];
        }
      }
    });

    // 2. El siguiente ID será el máximo + 1, o 1 si no hay productos
    const nextId = maxIdInterno > 0 ? maxIdInterno + 1 : 1;

    // 3. Actualizar el contador para futuras referencias
    try {
      await setDoc(counterDoc, { lastId: nextId }, { merge: true });
    } catch (error) {
      console.warn('⚠️ No se pudo actualizar el contador, pero se usará el ID:', nextId);
    }

    return nextId;
  }

  /**
   * Verifica si un código de armazón ya existe en otro producto.
   * Permite excluir un ID específico (para validaciones en edición).
   *
   * @param codigo Código de armazón a verificar.
   * @param excludeId ID del producto a excluir de la búsqueda (opcional).
   * @returns Promise<boolean> True si el código ya existe en otro producto.
   */
  async codigoArmazonExists(codigo: string, excludeId?: string): Promise<boolean> {
    const q = query(
      this.productosRef,
      where('codigo', '==', codigo)
    );

    const snapshot = await getDocs(q);

    // Si hay documentos con ese código
    if (snapshot.empty) {
      return false;
    }

    // Si estamos editando, excluir el propio documento
    if (excludeId) {
      return snapshot.docs.some(doc => doc.id !== excludeId);
    }

    return true;
  }

  /**
   * Crea un nuevo producto con generación automática de ID interno secuencial.
   * Aplica lógica especial para productos del grupo LUNAS (stock ilimitado).
   *
   * @param producto Datos del producto a crear (sin idInterno).
   * @returns Promise con DocumentReference del producto creado.
   */
  async createProducto(producto: Producto) {
    // Generar ID interno automáticamente
    const idInterno = await this.getNextIdInterno();

    // Stock control: NORMAL ONLY para ARMAZONES y GAFAS
    // ILIMITADO para todos los demás (LUNAS, SERVICIOS, ACCESORIOS, etc.)
    const grupo = (producto as any)?.grupo || '';
    const esControlNormal = grupo === 'ARMAZONES' || grupo === 'GAFAS';
    const tipoControlStock = esControlNormal ? 'NORMAL' : 'ILIMITADO';

    return addDoc(this.productosRef, {
      ...producto,
      idInterno,
      tipo_control_stock: tipoControlStock,
      activo: true, // 🔹 Nuevo producto siempre activo
      createdAt: new Date(),
      updatedAt: new Date(),
      stock: esControlNormal ? (producto.stock || 0) : 0,
    });
  }

  /**
   * Busca un producto por su código de armazón.
   * Retorna el primer producto que coincida con el código.
   *
   * @param codigo Código de armazón a buscar.
   * @returns Promise<Producto | null> Producto encontrado o null.
   */
  async getProductoByCodigo(codigo: string): Promise<Producto | null> {
    const q = query(
      this.productosRef,
      where('codigo', '==', codigo)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Producto;
  }

  /**
   * Actualiza los datos de un producto existente.
   * Actualiza automáticamente el campo updatedAt.
   *
   * @param id ID del producto.
   * @param producto Datos parciales a actualizar.
   * @returns Promise<void> Se resuelve cuando la actualización se completa.
   */
  updateProducto(id: string, producto: Partial<Producto>) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      ...producto,
      updatedAt: new Date(),
    });
  }

  /**
   * Descuenta stock de un producto usando transacción atómica de Firestore.
   * No aplica descuento a productos con tipo_control_stock ILIMITADO.
   *
   * @param id ID del producto.
   * @param cantidad Cantidad a descontar (positivo).
   * @returns Promise<void> Se resuelve cuando la transacción se completa.
   * @throws Error si el producto no existe o no hay stock suficiente.
   */
  async descontarStock(id: string, cantidad: number): Promise<void> {
    if (!id || !isFinite(cantidad) || cantidad <= 0) return;
    const productoDoc = doc(this.firestore, `productos/${id}`);

    await runTransaction(this.firestore, async (t) => {
      const snap = await t.get(productoDoc);
      if (!snap.exists()) {
        throw new Error('Producto no encontrado');
      }
      const data = snap.data() as any;

      // No descontar stock si es tipo_control_stock ILIMITADO
      const tipoControl = data?.tipo_control_stock || 'NORMAL';
      if (tipoControl === 'ILIMITADO') {
        // Productos con stock ilimitado no descuentan
        return;
      }
      const stockActual = Number(data?.stock || 0);
      if (stockActual < cantidad) {
        throw new Error(`Stock insuficiente. Disponible: ${stockActual}, requerido: ${cantidad}`);
      }
      t.update(productoDoc, {
        stock: stockActual - cantidad,
        updatedAt: new Date(),
      });
    });
  }

  /**
   * Incrementa stock de un producto usando transacción atómica de Firestore.
   * No aplica incremento a productos con tipo_control_stock ILIMITADO.
   * Se usa principalmente para revertir ventas editadas o eliminadas.
   *
   * @param id ID del producto.
   * @param cantidad Cantidad a incrementar (positivo).
   * @returns Promise<void> Se resuelve cuando la transacción se completa.
   * @throws Error si el producto no existe.
   */
  async incrementarStock(id: string, cantidad: number): Promise<void> {
    if (!id || !isFinite(cantidad) || cantidad <= 0) return;
    const productoDoc = doc(this.firestore, `productos/${id}`);

    await runTransaction(this.firestore, async (t) => {
      const snap = await t.get(productoDoc);
      if (!snap.exists()) {
        throw new Error('Producto no encontrado');
      }
      const data = snap.data() as any;

      // No incrementar stock si es tipo_control_stock ILIMITADO
      const tipoControl = data?.tipo_control_stock || 'NORMAL';
      if (tipoControl === 'ILIMITADO') {
        // Productos con stock ilimitado no incrementan
        return;
      }
      const stockActual = Number(data?.stock || 0);
      t.update(productoDoc, {
        stock: stockActual + cantidad,
        updatedAt: new Date(),
      });
    });
  }

  /**
   * Desactiva un producto (soft delete) cambiando su campo activo a false.
   * El producto se mantiene en la base de datos pero se oculta de las consultas principales.
   *
   * @param id ID del producto a desactivar.
   * @returns Promise<void> Se resuelve cuando la actualización se completa.
   */
  desactivarProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Reactiva un producto desactivado cambiando su campo activo a true.
   * Permite revertir un soft delete.
   *
   * @param id ID del producto a reactivar.
   * @returns Promise<void> Se resuelve cuando la actualización se completa.
   */
  activarProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return updateDoc(productoDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  // Eliminar producto (HARD DELETE: para desarrollo/test)
  deleteProducto(id: string) {
    const productoDoc = doc(this.firestore, `productos/${id}`);
    return deleteDoc(productoDoc);
  }
}
