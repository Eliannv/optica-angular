/**
 * Servicio para la gestión completa del ciclo de vida de clientes en el sistema.
 *
 * Este servicio se encarga de las operaciones CRUD (Crear, Leer, Actualizar, Eliminar)
 * sobre la colección 'clientes' en Firestore. Implementa un patrón de soft-delete
 * donde los clientes se marcan como inactivos en lugar de eliminarse físicamente,
 * y garantiza la unicidad de cédulas y correos electrónicos tanto en la colección
 * de clientes como en la colección de usuarios del sistema.
 *
 * Forma parte del módulo de clientes de la aplicación de gestión de óptica.
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
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from '@angular/fire/firestore';
import { Observable, shareReplay, map } from 'rxjs';
import { Cliente } from '../models/cliente.model';
import { FacturasService } from './facturas';

@Injectable({
  providedIn: 'root',
})
export class ClientesService {
  private readonly firestore = inject(Firestore);
  private readonly facturasSrv = inject(FacturasService);

  // 🎯 Getter lazy para clientesRef
  private get clientesRef() {
    return collection(this.firestore, 'clientes');
  }

  // 🎯 CACHÉ con shareReplay
  private cachedClientes$: Observable<Cliente[]> | null = null;

  /**
   * Recupera todos los clientes activos del sistema.
   * 🎯 ACTUALIZADO: Con caché compartido
   *
   * Este método filtra automáticamente los clientes desactivados (soft-delete),
   * retornando únicamente aquellos cuyo campo 'activo' es diferente de false.
   * Los resultados se emiten en tiempo real a través de un Observable.
   *
   * @returns Observable<Cliente[]> Stream reactivo con la lista de clientes activos.
   */
  getClientes(): Observable<Cliente[]> {
    if (!this.cachedClientes$) {
      const q = query(this.clientesRef, where('activo', '!=', false));
      this.cachedClientes$ = collectionData(q, {
        idField: 'id',
      }).pipe(
        map(data => data as Cliente[]),
        shareReplay(1) // 🎯 Compartir resultado entre suscriptores
      );
    }
    return this.cachedClientes$;
  }

  // 🎯 Recargar caché
  reloadClientes() {
    this.cachedClientes$ = null;
    return this.getClientes();
  }

  /**
   * Obtiene TODOS los clientes activos directamente desde Firestore (sin caché Observable).
   * Útil para búsquedas donde se necesitan datos frescos garantizados.
   * 
   * @returns Promise<Cliente[]> Array con todos los clientes activos.
   */
  async getAllClientesDirect(): Promise<Cliente[]> {
    const q = query(this.clientesRef, where('activo', '!=', false));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
  }

  /**
   * Obtiene un cliente específico por su identificador único.
   *
   * Retorna un Observable que emite los cambios en tiempo real del documento
   * del cliente, permitiendo reactividad automática ante actualizaciones.
   *
   * @param id Identificador único del cliente en Firestore.
   * @returns Observable<Cliente> Stream reactivo con los datos del cliente.
   */
  getClienteById(id: string): Observable<Cliente> {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return docData(clienteDoc, {
      idField: 'id',
    }) as Observable<Cliente>;
  }

  /**
   * Registra un nuevo cliente en el sistema.
   *
   * El cliente se crea con estado activo por defecto y se añaden automáticamente
   * las marcas de tiempo de creación y última actualización. El ID es generado
   * automáticamente por Firestore.
   *
   * @param cliente Datos del cliente a registrar (sin id, createdAt ni updatedAt).
   * @returns Promise con la referencia del documento creado.
   */
  createCliente(cliente: Cliente) {
    return addDoc(this.clientesRef, {
      ...cliente,
      activo: true, // 🔹 Nuevo cliente siempre activo
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Actualiza parcialmente los datos de un cliente existente.
   *
   * Permite modificar uno o más campos del cliente sin necesidad de enviar
   * el objeto completo. La fecha de última actualización se actualiza automáticamente.
   *
   * @param id Identificador del cliente a actualizar.
   * @param cliente Objeto con los campos a modificar (puede ser parcial).
   * @returns Promise que se resuelve cuando la actualización se completa.
   */
  updateCliente(id: string, cliente: Partial<Cliente>) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      ...cliente,
      updatedAt: new Date(),
    });
  }

  /**
   * Desactiva un cliente mediante soft-delete.
   *
   * En lugar de eliminar físicamente el registro, marca el cliente como inactivo
   * mediante el campo 'activo'. Esto permite preservar el historial y la
   * posibilidad de reactivación futura.
   *
   * @param id Identificador del cliente a desactivar.
   * @returns Promise que se resuelve cuando la desactivación se completa.
   */
  desactivarCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      activo: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Reactiva un cliente previamente desactivado.
   *
   * Revierte la operación de soft-delete, permitiendo que el cliente vuelva
   * a aparecer en las consultas de clientes activos.
   *
   * @param id Identificador del cliente a reactivar.
   * @returns Promise que se resuelve cuando la reactivación se completa.
   */
  activarCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return updateDoc(clienteDoc, {
      activo: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Elimina permanentemente un cliente del sistema (hard-delete).
   *
   * ADVERTENCIA: Esta operación es irreversible y elimina el documento
   * físicamente de Firestore. Solo debe usarse en entornos de desarrollo/testing
   * o en casos excepcionales. Para operaciones normales, usar desactivarCliente().
   *
   * @param id Identificador del cliente a eliminar permanentemente.
   * @returns Promise que se resuelve cuando la eliminación se completa.
   */
  deleteCliente(id: string) {
    const clienteDoc = doc(this.firestore, `clientes/${id}`);
    return deleteDoc(clienteDoc);
  }

  /**
   * Verifica la unicidad global de una cédula en el sistema.
   *
   * Consulta tanto la colección de clientes activos como la de usuarios para
   * garantizar que la cédula no esté duplicada en ninguna parte del sistema.
   * Útil para validaciones en formularios de creación y edición.
   *
   * @param cedula Número de cédula a verificar.
   * @param excluirClienteId ID del cliente a excluir de la búsqueda (usado en edición).
   * @returns Promise<boolean> true si la cédula ya existe, false si está disponible.
   */
  async existeCedula(cedula: string, excluirClienteId?: string): Promise<boolean> {
    console.log('🔍 existeCedula - Buscando:', cedula, 'Excluir ID:', excluirClienteId);
    
    // Buscar en clientes (query simple sin índice compuesto)
    const qClientes = query(
      this.clientesRef,
      where('cedula', '==', cedula)
    );
    const snapClientes = await getDocs(qClientes);
    
    // Filtrar manualmente los clientes activos y excluir el actual
    const clientesActivos = snapClientes.docs.filter(d => 
      d.data()['activo'] !== false && d.id !== excluirClienteId
    );
    
    console.log('📋 Clientes encontrados:', snapClientes.docs.length, 'Activos (excluido el actual):', clientesActivos.length);
    
    if (clientesActivos.length > 0) return true;

    // Buscar en usuarios
    const usuariosRef = collection(this.firestore, 'usuarios');
    const qUsuarios = query(usuariosRef, where('cedula', '==', cedula));
    const snapUsuarios = await getDocs(qUsuarios);
    console.log('👤 Usuarios encontrados:', snapUsuarios.docs.length);
    
    const existeEnUsuarios = !snapUsuarios.empty;
    console.log('✅ Resultado final:', existeEnUsuarios);
    return existeEnUsuarios;
  }

  /**
   * Verifica la unicidad global de un correo electrónico en el sistema.
   *
   * Realiza búsquedas tanto en la colección de clientes activos como en usuarios,
   * considerando variaciones en mayúsculas/minúsculas y compatibilidad con el
   * campo legacy 'correo'. Esto garantiza que no haya duplicados de email en el sistema.
   *
   * @param email Correo electrónico a verificar.
   * @param excluirClienteId ID del cliente a excluir de la búsqueda (usado en edición).
   * @returns Promise<boolean> true si el email ya existe, false si está disponible.
   */
  async existeEmail(email: string, excluirClienteId?: string): Promise<boolean> {
    console.log('🔍 existeEmail - Buscando:', email, 'Excluir ID:', excluirClienteId);
    
    const emailLower = email.toLowerCase();
    
    // Buscar en clientes (queries simples sin índices compuestos)
    const qClientesEmail = query(
      this.clientesRef,
      where('email', '==', email)
    );
    const qClientesEmailLower = query(
      this.clientesRef,
      where('email', '==', emailLower)
    );
    const qClientesCorreo = query(
      this.clientesRef,
      where('correo', '==', email)
    );
    const qClientesCorreoLower = query(
      this.clientesRef,
      where('correo', '==', emailLower)
    );
    
    const [snapClientesEmail, snapClientesEmailLower, snapClientesCorreo, snapClientesCorreoLower] = await Promise.all([
      getDocs(qClientesEmail),
      getDocs(qClientesEmailLower),
      getDocs(qClientesCorreo),
      getDocs(qClientesCorreoLower)
    ]);

    // Filtrar manualmente clientes activos y excluir el actual
    const clientesEncontrados = [
      ...snapClientesEmail.docs, 
      ...snapClientesEmailLower.docs,
      ...snapClientesCorreo.docs,
      ...snapClientesCorreoLower.docs
    ].filter(d => d.data()['activo'] !== false && d.id !== excluirClienteId);

    console.log('📧 Clientes con email encontrados:', clientesEncontrados.length);
    
    if (clientesEncontrados.length > 0) return true;

    // Buscar en usuarios (campo estándar 'email')
    const usuariosRef = collection(this.firestore, 'usuarios');
    const qUsuarios = query(usuariosRef, where('email', '==', email));
    const qUsuariosLower = query(usuariosRef, where('email', '==', emailLower));
    const [snapUsuarios, snapUsuariosLower] = await Promise.all([
      getDocs(qUsuarios),
      getDocs(qUsuariosLower)
    ]);
    
    console.log('👤 Usuarios con email encontrados:', snapUsuarios.docs.length + snapUsuariosLower.docs.length);
    
    const existeEnUsuarios = !snapUsuarios.empty || !snapUsuariosLower.empty;
    console.log('✅ Resultado final:', existeEnUsuarios);
    return existeEnUsuarios;
  }

  /**
   * 🚀 PAGINACIÓN REAL DESDE FIRESTORE
   * 
   * Obtiene clientes con paginación real usando cursores de Firestore.
   * Solo carga 10 clientes por consulta, reduciendo uso de memoria y lecturas.
   * 
   * @param options - Opciones de paginación
   * @param options.pageSize - Cantidad de clientes por página (default: 10)
   * @param options.lastVisible - Snapshot del último documento visible (para "siguiente")
   * @param options.firstVisible - Snapshot del primer documento visible (para "anterior")
   * @param options.direction - Dirección de navegación: 'next' | 'prev' (default: 'next')
   * @param options.ordenamiento - Campo para ordenar: 'reciente' | 'nombre' (default: 'reciente')
   * @param options.terminoBusqueda - Término para buscar en nombre, cédula, teléfono
   * 
   * @returns Promise con productos, cursores y flag hasMore
   * 
   * @example
   * // Primera carga
   * const result = await getClientesPaginadosReal({ pageSize: 10 });
   * 
   * // Página siguiente
   * const nextPage = await getClientesPaginadosReal({ 
   *   pageSize: 10, 
   *   lastVisible: result.lastDoc, 
   *   direction: 'next' 
   * });
   */
  async getClientesPaginadosReal(options: {
    pageSize?: number;
    lastVisible?: DocumentSnapshot | null;
    firstVisible?: DocumentSnapshot | null;
    direction?: 'next' | 'prev';
    ordenamiento?: 'reciente' | 'nombre';
    terminoBusqueda?: string;
    filtroEstado?: 'todos' | 'conHistorial' | 'sinHistorial';
    filtroCredito?: 'todos' | 'conCredito' | 'sinCredito';
    filtroDeuda?: 'todos' | 'conDeuda' | 'sinDeuda';
  }): Promise<{
    clientes: Cliente[];
    lastDoc: DocumentSnapshot | null;
    firstDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    const {
      pageSize = 10,
      lastVisible = null,
      firstVisible = null,
      direction = 'next',
      ordenamiento = 'reciente',
      terminoBusqueda = '',
      filtroEstado = 'todos',
      filtroCredito = 'todos',
      filtroDeuda = 'todos'
    } = options;

    // 🔍 SI HAY BÚSQUEDA ACTIVA, traer TODOS los clientes y filtrar
    if (terminoBusqueda.trim()) {
      return this.buscarClientesSinPaginacion(
        terminoBusqueda,
        ordenamiento,
        pageSize,
        filtroEstado,
        filtroCredito,
        filtroDeuda
      );
    }

    // ✅ Construir query base con ordenamiento y filtro de historial
    let q;
    
    // 🎯 Aplicar filtro de historial clínico si existe
    const hasHistorialFilter = filtroEstado !== 'todos';
    const hasCreditoFilter = filtroCredito !== 'todos';
    const hasDeudaFilter = filtroDeuda !== 'todos';

    const baseFilters: any[] = [where('activo', '!=', false)];
    const baseOrderBy: any[] = [orderBy('activo')];

    if (hasHistorialFilter) {
      baseFilters.push(where('tieneHistorialClinico', '==', filtroEstado === 'conHistorial'));
      baseOrderBy.push(orderBy('tieneHistorialClinico'));
    }

    if (hasCreditoFilter) {
      baseFilters.push(where('tieneCredito', '==', filtroCredito === 'conCredito'));
      baseOrderBy.push(orderBy('tieneCredito'));
    }

    if (hasDeudaFilter) {
      baseFilters.push(where('tieneDeuda', '==', filtroDeuda === 'conDeuda'));
      baseOrderBy.push(orderBy('tieneDeuda'));
    }
    
    if (ordenamiento === 'reciente') {
      // Ordenar por fecha de creación descendente
      if (direction === 'prev' && firstVisible) {
        q = query(
          this.clientesRef,
          ...baseFilters,
          ...baseOrderBy,
          orderBy('createdAt', 'desc'),
          endBefore(firstVisible),
          limitToLast(pageSize + 1)
        );
      } else if (direction === 'next' && lastVisible) {
        q = query(
          this.clientesRef,
          ...baseFilters,
          ...baseOrderBy,
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(pageSize + 1)
        );
      } else {
        // Primera carga
        q = query(
          this.clientesRef,
          ...baseFilters,
          ...baseOrderBy,
          orderBy('createdAt', 'desc'),
          limit(pageSize + 1)
        );
      }
    } else {
      // Ordenar por nombre ascendente
      if (direction === 'prev' && firstVisible) {
        q = query(
          this.clientesRef,
          ...baseFilters,
          ...baseOrderBy,
          orderBy('nombres', 'asc'),
          endBefore(firstVisible),
          limitToLast(pageSize + 1)
        );
      } else if (direction === 'next' && lastVisible) {
        q = query(
          this.clientesRef,
          ...baseFilters,
          ...baseOrderBy,
          orderBy('nombres', 'asc'),
          startAfter(lastVisible),
          limit(pageSize + 1)
        );
      } else {
        // Primera carga
        q = query(
          this.clientesRef,
          ...baseFilters,
          ...baseOrderBy,
          orderBy('nombres', 'asc'),
          limit(pageSize + 1)
        );
      }
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;

    // ✅ Determinar si hay más páginas
    const hasMore = docs.length > pageSize;
    const clientesFinales = docs.slice(0, pageSize);

    return {
      clientes: clientesFinales.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[],
      lastDoc: clientesFinales.length > 0 ? clientesFinales[clientesFinales.length - 1] : null,
      firstDoc: clientesFinales.length > 0 ? clientesFinales[0] : null,
      hasMore
    };
  }

  /**
   * 🔍 Buscar clientes SIN paginación (trae todos y filtra en cliente)
   * Se usa cuando hay un término de búsqueda activo
   */
  private async buscarClientesSinPaginacion(
    terminoBusqueda: string,
    ordenamiento: 'reciente' | 'nombre',
    pageSize: number,
    filtroEstado: 'todos' | 'conHistorial' | 'sinHistorial' = 'todos',
    filtroCredito: 'todos' | 'conCredito' | 'sinCredito' = 'todos',
    filtroDeuda: 'todos' | 'conDeuda' | 'sinDeuda' = 'todos'
  ): Promise<{
    clientes: Cliente[];
    lastDoc: DocumentSnapshot | null;
    firstDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    // Traer TODOS los clientes activos (con filtros si aplican)
    let q;
    const hasHistorialFilter = filtroEstado !== 'todos';
    const hasCreditoFilter = filtroCredito !== 'todos';
    const hasDeudaFilter = filtroDeuda !== 'todos';

    const baseFilters: any[] = [where('activo', '!=', false)];
    const baseOrderBy: any[] = [orderBy('activo')];

    if (hasHistorialFilter) {
      baseFilters.push(where('tieneHistorialClinico', '==', filtroEstado === 'conHistorial'));
      baseOrderBy.push(orderBy('tieneHistorialClinico'));
    }

    if (hasCreditoFilter) {
      baseFilters.push(where('tieneCredito', '==', filtroCredito === 'conCredito'));
      baseOrderBy.push(orderBy('tieneCredito'));
    }

    if (hasDeudaFilter) {
      baseFilters.push(where('tieneDeuda', '==', filtroDeuda === 'conDeuda'));
      baseOrderBy.push(orderBy('tieneDeuda'));
    }
    
    if (ordenamiento === 'reciente') {
      q = query(
        this.clientesRef,
        ...baseFilters,
        ...baseOrderBy,
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        this.clientesRef,
        ...baseFilters,
        ...baseOrderBy,
        orderBy('nombres', 'asc')
      );
    }

    const snapshot = await getDocs(q);
    let clientes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Cliente[];

    // Aplicar búsqueda en múltiples campos
    const termino = terminoBusqueda.toLowerCase().trim();
    clientes = clientes.filter(c => {
      const nombre = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.toLowerCase();
      const cedula = (c.cedula ?? '').toLowerCase();
      const telefono = (c.telefono ?? '').toLowerCase();
      return nombre.includes(termino) || cedula.includes(termino) || telefono.includes(termino);
    });

    // Aplicar paginación manual (en memoria)
    const hasMore = clientes.length > pageSize;
    const clientesFinales = clientes.slice(0, pageSize);

    return {
      clientes: clientesFinales,
      lastDoc: null,
      firstDoc: null,
      hasMore
    };
  }

  /**
   * 💳💰 ACTUALIZA CAMPOS DE DEUDA Y CRÉDITO EN DOC DEL CLIENTE
   * 
   * Calcula automáticamente los campos tieneCredito, tieneDeuda, _deudaCalculada, _facturasPendientes
   * y los actualiza en el documento del cliente. Esto permite filtros eficientes a nivel de Firestore.
   * 
   * USAR DESPUÉS DE:
   * - Crear/editar una venta (crear-venta)
   * - Registrar un abono/pago (cobrar-deuda)
   * - Cualquier operación que modifique el estado de facturas del cliente
   * 
   * @param clienteId ID del cliente a actualizar
   * @returns Promise que se resuelve cuando la actualización se completa
   */
  async actualizarCamposDeudaCredito(clienteId: string): Promise<void> {
    try {
      console.log('💳 Actualizando campos de deuda/crédito para cliente:', clienteId);
      
      // Obtener resumen de deuda actual usando el servicio de facturas
      const resumen = await this.facturasSrv.getResumenDeuda(clienteId);
      
      console.log('📊 Resumen de deuda obtenido:', resumen);
      
      // Preparar campos a actualizar
      const camposActualizar = {
        tieneCredito: resumen.creditoPersonalActivo, // true si tiene al menos 1 crédito personal activo
        tieneDeuda: resumen.deudaTotal > 0, // true si debe más de 0
        _deudaCalculada: resumen.deudaTotal, // monto total de deuda
        _facturasPendientes: resumen.pendientes, // cantidad de facturas pendientes
        ultimaActualizacionDeuda: new Date(), // timestamp de actualización
        updatedAt: new Date()
      };
      
      console.log('✅ Campos a actualizar:', camposActualizar);
      
      // Actualizar documento del cliente
      const clienteDoc = doc(this.firestore, `clientes/${clienteId}`);
      await updateDoc(clienteDoc, camposActualizar);
      
      console.log('✅ Campos de deuda/crédito actualizados correctamente');
    } catch (error) {
      console.error('❌ Error actualizando campos de deuda/crédito:', error);
      // No lanzar error para que no bloquee el flujo principal
      // Solo loguear para debugging
    }
  }}