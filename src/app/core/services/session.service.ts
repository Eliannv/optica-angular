/**
 * Gestiona el ciclo de vida de la sesión del usuario implementando un sistema de
 * auto-logout por inactividad. Monitorea eventos de interacción del usuario con la
 * aplicación y cierra automáticamente la sesión después de un período configurable
 * de inactividad (30 minutos por defecto).
 *
 * Este servicio mejora la seguridad de la aplicación evitando que sesiones
 * abandonadas permanezcan abiertas indefinidamente, especialmente importante
 * en entornos de uso compartido.
 *
 * Forma parte del módulo core y se activa automáticamente tras el login exitoso.
 */
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { fromEvent, merge, Subject, takeUntil, throttleTime } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private router = inject(Router);
  private authService = inject(AuthService);
  
  // Tiempo de inactividad en milisegundos (30 minutos por defecto)
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; 
  
  private inactivityTimer: any;
  private destroy$ = new Subject<void>();

  constructor() {}

  /**
   * Inicia el monitoreo de actividad del usuario.
   * Escucha eventos del DOM (mouse, teclado, táctiles) para detectar interacción.
   * Cada evento detectado reinicia el temporizador de inactividad.
   *
   * Los eventos se procesan con throttle de 1 segundo para optimizar rendimiento.
   */
  startInactivityMonitoring(): void {
    // 🔄 Reinicializar el Subject en caso de que haya sido completado
    if (this.destroy$.closed) {
      this.destroy$ = new Subject<void>();
    }

    // Eventos que indican actividad del usuario
    const events$ = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'mousedown'),
      fromEvent(document, 'keypress'),
      fromEvent(document, 'scroll'),
      fromEvent(document, 'touchstart'),
      fromEvent(document, 'click')
    );

    // Throttle para no procesar cada evento (solo 1 por segundo)
    events$.pipe(
      throttleTime(1000),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.resetInactivityTimer();
    });

    // Iniciar el timer
    this.resetInactivityTimer();
  }

  /**
   * Detiene el monitoreo de inactividad y limpia los listeners de eventos.
   * Debe llamarse al cerrar sesión o al navegar fuera de áreas protegidas.
   */
  stopInactivityMonitoring(): void {
    this.destroy$.next();
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  /**
   * Reinicia el temporizador de inactividad cada vez que se detecta actividad del usuario.
   * Cancela el temporizador anterior y crea uno nuevo con el tiempo completo.
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.handleInactivityLogout();
    }, this.INACTIVITY_TIMEOUT);
  }

  /**
   * Gestiona el cierre de sesión automático por inactividad.
   * Muestra un diálogo informativo al usuario antes de realizar el logout.
   */
  private handleInactivityLogout(): void {
    this.stopInactivityMonitoring();
    
    Swal.fire({
      icon: 'warning',
      title: 'Sesión expirada',
      text: 'Tu sesión ha expirado por inactividad. Por favor, vuelve a iniciar sesión.',
      confirmButtonColor: '#1E3A5F',
      allowOutsideClick: false
    }).then(() => {
      this.authService.logout().subscribe();
    });
  }

  /**
   * Retorna el tiempo configurado de inactividad antes del logout automático.
   *
   * @returns Tiempo en minutos (30 por defecto).
   */
  getRemainingTime(): number {
    return Math.floor(this.INACTIVITY_TIMEOUT / 60000);
  }
}
