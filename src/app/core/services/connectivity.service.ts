/**
 * Gestiona el monitoreo en tiempo real de la conectividad a internet de la aplicación.
 * Detecta automáticamente cambios en el estado de conexión mediante eventos del navegador
 * y proporciona un Observable reactivo para que otros componentes y servicios puedan
 * suscribirse a cambios de conectividad.
 *
 * Este servicio es fundamental para funcionalidades offline-first y manejo de errores
 * relacionados con pérdida de conexión, especialmente en operaciones con Firestore.
 *
 * Forma parte del módulo core y se inyecta globalmente en toda la aplicación.
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, merge, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  private onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public online$ = this.onlineSubject.asObservable();

  constructor() {
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).subscribe(status => {
      this.onlineSubject.next(status);
    });
  }

  /**
   * Verifica el estado actual de la conexión a internet de forma síncrona.
   * Consulta directamente la propiedad navigator.onLine del navegador.
   *
   * @returns true si hay conexión, false si está offline.
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Proporciona un Observable que emite cambios en el estado de conectividad.
   * Los suscriptores recibirán true cuando haya conexión y false cuando se pierda.
   *
   * @returns Observable<boolean> Stream reactivo del estado de conexión.
   */
  getOnlineStatus(): Observable<boolean> {
    return this.online$;
  }
}
