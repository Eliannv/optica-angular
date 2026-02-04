/**
 * 🎯 FASE 2 Optimización: LocalStorage Cache Service
 * 
 * Cachea datos que raramente cambian en localStorage para evitar lecturas
 * repetidas de Firestore. Ahorro estimado: ~500 reads/día
 * 
 * Datos cachéados:
 * - sucursales: Cambian solo cuando admin crea/edita (promedio: 0.5 veces/día)
 * - maquinas_autorizadas: Cambian solo cuando admin registra/desactiva (promedio: 0.5 veces/día)
 * 
 * TTL (Time To Live): 24 horas (configurable)
 */

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { Sucursal } from '../models/sucursal.model';
import { MaquinaAutorizada } from '../models/maquina-autorizada.model';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMinutos: number;
}

@Injectable({ providedIn: 'root' })
export class CacheLocalStorageService {
  private readonly PREFIX = 'optica_cache_';
  private readonly DEFAULT_TTL_MINUTOS = 24 * 60; // 24 horas

  // BehaviorSubjects para invalidación reactiva
  private sucursalesInvalidated$ = new BehaviorSubject<void>(undefined);
  private maquinasInvalidated$ = new BehaviorSubject<void>(undefined);

  /**
   * 📌 Getter de sucursales almacenadas
   * Observable para invalidación reactiva cuando admin las cambia
   */
  get sucursalesChanged$(): Observable<void> {
    return this.sucursalesInvalidated$.asObservable();
  }

  /**
   * 📌 Getter de máquinas almacenadas
   * Observable para invalidación reactiva cuando admin las cambia
   */
  get maquinasChanged$(): Observable<void> {
    return this.maquinasInvalidated$.asObservable();
  }

  /**
   * Guardar sucursales en localStorage con TTL
   * @param sucursales Array de sucursales
   * @param ttlMinutos Tiempo de vida en minutos (default: 24h)
   */
  guardarSucursales(sucursales: Sucursal[], ttlMinutos?: number): void {
    this.guardarEnCache('sucursales', sucursales, ttlMinutos);
  }

  /**
   * Obtener sucursales del cache local
   * @returns Array de sucursales o null si caché expiró/no existe
   */
  obtenerSucursales(): Sucursal[] | null {
    return this.obtenerDelCache('sucursales');
  }

  /**
   * Invalidar cache de sucursales (llamar cuando admin crea/edita)
   * Notifica a todos los subscribers que deben recargar de Firestore
   */
  invalidarSucursales(): void {
    this.eliminarDelCache('sucursales');
    this.sucursalesInvalidated$.next();
  }

  /**
   * Guardar máquinas autorizadas en localStorage con TTL
   * @param maquinas Array de máquinas
   * @param ttlMinutos Tiempo de vida en minutos (default: 24h)
   */
  guardarMaquinas(maquinas: MaquinaAutorizada[], ttlMinutos?: number): void {
    this.guardarEnCache('maquinas_autorizadas', maquinas, ttlMinutos);
  }

  /**
   * Obtener máquinas del cache local
   * @returns Array de máquinas o null si caché expiró/no existe
   */
  obtenerMaquinas(): MaquinaAutorizada[] | null {
    return this.obtenerDelCache('maquinas_autorizadas');
  }

  /**
   * Invalidar cache de máquinas (llamar cuando admin registra/desactiva)
   * Notifica a todos los subscribers que deben recargar de Firestore
   */
  invalidarMaquinas(): void {
    this.eliminarDelCache('maquinas_autorizadas');
    this.maquinasInvalidated$.next();
  }

  /**
   * Limpiar TODO el cache (logout, cambio de usuario, reset)
   */
  limpiarTodo(): void {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(this.PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    this.sucursalesInvalidated$.next();
    this.maquinasInvalidated$.next();
  }

  /**
   * Implementación privada: Guardar en cache
   */
  private guardarEnCache<T>(key: string, data: T, ttlMinutos?: number): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttlMinutos: ttlMinutos || this.DEFAULT_TTL_MINUTOS
      };
      localStorage.setItem(this.PREFIX + key, JSON.stringify(entry));
    } catch (error) {
      console.warn('⚠️ Error guardando en localStorage:', error);
    }
  }

  /**
   * Implementación privada: Obtener del cache
   */
  private obtenerDelCache<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(this.PREFIX + key);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      const ahora = Date.now();
      const tiempoTranscurrido = ahora - entry.timestamp;
      const ttlMs = entry.ttlMinutos * 60 * 1000;

      // Si el caché expiró, eliminarlo y retornar null
      if (tiempoTranscurrido > ttlMs) {
        this.eliminarDelCache(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('⚠️ Error leyendo del localStorage:', error);
      return null;
    }
  }

  /**
   * Implementación privada: Eliminar del cache
   */
  private eliminarDelCache(key: string): void {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (error) {
      console.warn('⚠️ Error eliminando de localStorage:', error);
    }
  }
}
