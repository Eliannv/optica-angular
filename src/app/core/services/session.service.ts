import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { fromEvent, merge, Subject, takeUntil, throttleTime } from 'rxjs';
import Swal from 'sweetalert2';

/**
 * Servicio para gestionar la sesión del usuario y el auto-logout por inactividad
 */
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
   * Iniciar el monitoreo de inactividad
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
   * Detener el monitoreo de inactividad
   */
  stopInactivityMonitoring(): void {
    this.destroy$.next();
    // ❌ No completar el Subject; lo reinicializamos en startInactivityMonitoring
    // this.destroy$.complete();
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  /**
   * Reiniciar el temporizador de inactividad
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
   * Cerrar sesión por inactividad
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
   * Obtener el tiempo restante de sesión (en minutos)
   */
  getRemainingTime(): number {
    return Math.floor(this.INACTIVITY_TIMEOUT / 60000);
  }
}
