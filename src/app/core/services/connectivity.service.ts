import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, merge, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Servicio para monitorear la conectividad a internet
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  private onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public online$ = this.onlineSubject.asObservable();

  constructor() {
    // Escuchar eventos de conexión/desconexión
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).subscribe(status => {
      this.onlineSubject.next(status);
    });
  }

  /**
   * Verificar si hay conexión a internet
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Observable del estado de conexión
   */
  getOnlineStatus(): Observable<boolean> {
    return this.online$;
  }
}
