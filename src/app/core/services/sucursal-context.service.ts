/**
 * Servicio de Contexto de Sucursal
 * 
 * Gestiona la sucursal activa seleccionada por el usuario y proporciona
 * servicios de utilidad para filtrado de queries Firestore según sucursal.
 * 
 * Características:
 * - Para ADMINISTRADOR: permite seleccionar una sucursal específica o "TODAS"
 * - Para OPERADOR: asigna automáticamente su sucursal desde el perfil de usuario
 * - Persistencia en localStorage para mantener selección entre sesiones
 * - Emisión reactiva de cambios mediante BehaviorSubject
 * - Validación de permisos según rol
 */
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, switchMap, of } from 'rxjs';
import { AuthService } from './auth.service';
import { SucursalesService } from './sucursales.service';
import { RolUsuario } from '../models/usuario.model';
import { Sucursal } from '../models/sucursal.model';
import { 
  TODAS_LAS_SUCURSALES, 
  SucursalId, 
  SucursalSeleccionada 
} from '../models/sucursal-constants';

@Injectable({
  providedIn: 'root'
})
export class SucursalContextService {
  private readonly STORAGE_KEY = 'sucursalSeleccionada';
  
  private authService = inject(AuthService);
  private sucursalesService = inject(SucursalesService);

  // BehaviorSubject para emitir la sucursal seleccionada
  private sucursalSeleccionada$ = new BehaviorSubject<SucursalSeleccionada | null>(null);

  constructor() {
    this.inicializar();
  }

  /**
   * Inicializa el servicio cargando la sucursal según el rol del usuario
   */
  private inicializar(): void {
    this.authService.authState$.pipe(
      switchMap(firebaseUser => {
        if (!firebaseUser) {
          this.limpiarSeleccion();
          return of(null);
        }
        // Esperar a que los datos del usuario estén cargados antes de leer el rol/sucursal
        return this.authService.ensureUserData(firebaseUser.uid);
      })
    ).subscribe(async (usuario) => {
      if (!usuario) return;

      if (usuario.rol === RolUsuario.OPERADOR) {
        // OPERADOR: asignar automáticamente su sucursal
        // Preferir sucursalId (nuevo campo) sobre sucursal (campo legacy con nombre/código)
        await this.asignarSucursalOperador(usuario.sucursalId || usuario.sucursal);
      } else if (usuario.rol === RolUsuario.ADMINISTRADOR) {
        // ADMINISTRADOR: cargar desde localStorage o usar "TODAS"
        await this.cargarSeleccionAdmin();
      }
    });
  }

  /**
   * Asigna automáticamente la sucursal para un operador
   */
  private async asignarSucursalOperador(sucursalId?: string): Promise<void> {
    if (!sucursalId) {
      console.error('⚠️ Operador sin sucursal asignada');
      this.sucursalSeleccionada$.next(null);
      return;
    }

    // Obtener información de la sucursal
    const sucursales = await this.sucursalesService.getSucursales().toPromise();
    // Buscar por id, codigo o nombre para compatibilidad con datos existentes
    const sucursalIdNorm = sucursalId.trim().toUpperCase();
    const sucursal = sucursales?.find(s =>
      s.id === sucursalId ||
      (s.codigo || '').toUpperCase() === sucursalIdNorm ||
      (s.nombre || '').toUpperCase() === sucursalIdNorm
    );

    if (sucursal) {
      const seleccion: SucursalSeleccionada = {
        id: sucursal.id || sucursalId,
        nombre: sucursal.nombre,
        esTodas: false
      };
      this.sucursalSeleccionada$.next(seleccion);
    } else {
      console.warn(`⚠️ Sucursal ${sucursalId} no encontrada`);
      this.sucursalSeleccionada$.next(null);
    }
  }

  /**
   * Carga la selección guardada para administrador o usa "TODAS" por defecto
   */
  private async cargarSeleccionAdmin(): Promise<void> {
    const guardado = localStorage.getItem(this.STORAGE_KEY);
    
    if (guardado) {
      try {
        const seleccion: SucursalSeleccionada = JSON.parse(guardado);
        
        // Validar que la sucursal aún existe (si no es "TODAS")
        if (!seleccion.esTodas) {
          const sucursales = await this.sucursalesService.getSucursales().toPromise();
          const existe = sucursales?.some(s => s.id === seleccion.id);
          
          if (!existe) {
            console.warn(`⚠️ Sucursal guardada ${seleccion.id} ya no existe, usando TODAS`);
            this.seleccionarTodasSucursales();
            return;
          }
        }
        
        this.sucursalSeleccionada$.next(seleccion);
      } catch (error) {
        console.error('Error al parsear sucursal guardada:', error);
        this.seleccionarTodasSucursales();
      }
    } else {
      // Por defecto, seleccionar "TODAS"
      this.seleccionarTodasSucursales();
    }
  }

  /**
   * Selecciona "TODAS" las sucursales (solo para ADMINISTRADOR)
   */
  private seleccionarTodasSucursales(): void {
    const seleccion: SucursalSeleccionada = {
      id: TODAS_LAS_SUCURSALES,
      nombre: 'Todas las Sucursales',
      esTodas: true
    };
    this.sucursalSeleccionada$.next(seleccion);
    this.guardarEnLocalStorage(seleccion);
  }

  /**
   * Obtiene la sucursal actualmente seleccionada como Observable
   */
  getSucursalSeleccionada(): Observable<SucursalSeleccionada | null> {
    return this.sucursalSeleccionada$.asObservable();
  }

  /**
   * Obtiene el valor actual de la sucursal seleccionada (síncrono)
   */
  getSucursalActual(): SucursalSeleccionada | null {
    return this.sucursalSeleccionada$.value;
  }

  /**
   * Obtiene solo el ID de la sucursal actual (útil para queries)
   */
  getSucursalIdActual(): SucursalId | null {
    return this.sucursalSeleccionada$.value?.id || null;
  }

  /**
   * Cambia la sucursal seleccionada (solo para ADMINISTRADOR)
   * @param sucursalId ID de la sucursal o TODAS_LAS_SUCURSALES
   */
  async cambiarSucursal(sucursalId: SucursalId): Promise<void> {
    const usuario = this.authService.getCurrentUser();
    
    if (!usuario) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    if (usuario.rol !== RolUsuario.ADMINISTRADOR) {
      console.error('❌ Solo ADMINISTRADOR puede cambiar de sucursal');
      return;
    }

    let seleccion: SucursalSeleccionada;

    if (sucursalId === TODAS_LAS_SUCURSALES) {
      seleccion = {
        id: TODAS_LAS_SUCURSALES,
        nombre: 'Todas las Sucursales',
        esTodas: true
      };
    } else {
      // Buscar la sucursal
      const sucursales = await this.sucursalesService.getSucursales().toPromise();
      const sucursal = sucursales?.find(s => s.id === sucursalId || s.codigo === sucursalId);

      if (!sucursal) {
        console.error(`❌ Sucursal ${sucursalId} no encontrada`);
        return;
      }

      seleccion = {
        id: sucursal.id || sucursalId,
        nombre: sucursal.nombre,
        esTodas: false
      };
    }

    this.sucursalSeleccionada$.next(seleccion);
    this.guardarEnLocalStorage(seleccion);
    
    console.log('✅ Sucursal cambiada a:', seleccion.nombre);
  }

  /**
   * Verifica si el usuario puede cambiar de sucursal
   */
  puedeSeleccionarSucursal(): boolean {
    const usuario = this.authService.getCurrentUser();
    return usuario?.rol === RolUsuario.ADMINISTRADOR;
  }

  /**
   * Verifica si actualmente está seleccionada "TODAS"
   */
  esTodasSucursales(): boolean {
    return this.sucursalSeleccionada$.value?.esTodas || false;
  }

  /**
   * Obtiene un Observable combinado con información de sucursal y usuario
   */
  getContextoCompleto(): Observable<{
    sucursal: SucursalSeleccionada | null;
    esAdmin: boolean;
    puedeSeleccionar: boolean;
  }> {
    return combineLatest([
      this.sucursalSeleccionada$,
      this.authService.authState$
    ]).pipe(
      map(([sucursal, _]) => ({
        sucursal,
        esAdmin: this.puedeSeleccionarSucursal(),
        puedeSeleccionar: this.puedeSeleccionarSucursal()
      }))
    );
  }

  /**
   * Guarda la selección en localStorage
   */
  private guardarEnLocalStorage(seleccion: SucursalSeleccionada): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seleccion));
  }

  /**
   * Limpia la selección (al cerrar sesión)
   */
  private limpiarSeleccion(): void {
    this.sucursalSeleccionada$.next(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Obtiene el ID de sucursal para usar en operaciones CREATE
   * Si no hay sucursal seleccionada, lanza error
   */
  getSucursalIdParaCrear(): string {
    const seleccion = this.sucursalSeleccionada$.value;
    
    if (!seleccion) {
      throw new Error('No hay sucursal seleccionada');
    }

    if (seleccion.esTodas) {
      throw new Error('No se puede crear documento sin especificar una sucursal. Seleccione una sucursal específica.');
    }

    return seleccion.id;
  }

  /**
   * Obtiene el nombre de la sucursal actual
   */
  getSucursalNombreParaCrear(): string {
    const seleccion = this.sucursalSeleccionada$.value;
    
    if (!seleccion || seleccion.esTodas) {
      throw new Error('No hay sucursal específica seleccionada');
    }

    return seleccion.nombre;
  }
}
