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
 * Además, implementa renovación automática del token JWT de Firebase basada en
 * actividad del usuario, extendiendo la sesión mientras haya interacción activa.
 *
 * Forma parte del módulo core y se activa automáticamente tras el login exitoso.
 */
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { AuthService } from './auth.service';
import { fromEvent, merge, Subject, takeUntil, throttleTime } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private router = inject(Router);
  private authService = inject(AuthService);
  private auth = inject(Auth);
  
  // Tiempo de inactividad en milisegundos (9 horas)
  private readonly INACTIVITY_TIMEOUT = 9 * 60 * 60 * 1000; 
  
  // Renovar token cada 8 horas de actividad (antes de que expire el de 9 horas)
  private readonly TOKEN_REFRESH_INTERVAL = 8 * 60 * 60 * 1000;
  
  private inactivityTimer: any;
  private tokenRefreshTimer: any;
  private lastActivityTime: number = Date.now();
  private destroy$ = new Subject<void>();

  constructor() {}

  /**
   * Inicia el monitoreo de actividad del usuario.
   * Escucha eventos del DOM (mouse, teclado, táctiles) para detectar interacción.
   * Cada evento detectado reinicia el temporizador de inactividad y marca actividad
   * para renovación de token.
   *
   * Los eventos se procesan con throttle de 1 segundo para optimizar rendimiento.
   */
  startInactivityMonitoring(): void {
    // 🔄 Reinicializar el Subject en caso de que haya sido completado
    if (this.destroy$.closed) {
      this.destroy$ = new Subject<void>();
    }

    // Registrar tiempo de inicio de sesión
    this.lastActivityTime = Date.now();

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
      this.lastActivityTime = Date.now();
      this.resetInactivityTimer();
    });

    // Iniciar el timer de inactividad
    this.resetInactivityTimer();
    
    // Iniciar renovación periódica de token
    this.startTokenRefresh();
  }

  /**
   * Detiene el monitoreo de inactividad y limpia los listeners de eventos.
   * Debe llamarse al cerrar sesión o al navegar fuera de áreas protegidas.
   */
  stopInactivityMonitoring(): void {
    this.destroy$.next();
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
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

    const remainingSeconds = Math.floor(this.INACTIVITY_TIMEOUT / 1000);
    console.log(`🔄 Timer de inactividad reiniciado - Cierre en ${remainingSeconds}s si no hay actividad`);

    this.inactivityTimer = setTimeout(() => {
      console.log('⏰ Timer expiró - Cerrando sesión por inactividad');
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
   * Inicia la renovación periódica del token JWT de Firebase.
   * Renueva el token cada 25 minutos si hay actividad reciente del usuario.
   * Esto mantiene la sesión activa mientras el usuario interactúa con la app.
   */
  private startTokenRefresh(): void {
    // Limpiar timer existente si hay uno
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
    }

    // Configurar renovación periódica
    this.tokenRefreshTimer = setInterval(async () => {
      const currentTime = Date.now();
      const timeSinceLastActivity = currentTime - this.lastActivityTime;

      // Solo renovar si ha habido actividad en los últimos 25 minutos
      if (timeSinceLastActivity < this.TOKEN_REFRESH_INTERVAL) {
        await this.refreshAuthToken();
      }
    }, this.TOKEN_REFRESH_INTERVAL);

    // También hacer una renovación inicial (útil al restaurar sesión)
    this.refreshAuthToken();
  }

  /**
   * Renueva el token de autenticación de Firebase para extender la sesión.
   * Se llama automáticamente cuando hay actividad del usuario.
   */
  private async refreshAuthToken(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        console.warn('⚠️ No hay usuario autenticado para renovar token');
        return;
      }

      // Forzar renovación del token (force refresh = true)
      const token = await user.getIdToken(true);
      
      console.log('✅ Token JWT renovado exitosamente');
      
      // Opcional: mostrar en consola el tiempo de expiración del token
      const tokenResult = await user.getIdTokenResult();
      const expirationTime = new Date(tokenResult.expirationTime);
      console.log(`📅 Token expira en: ${expirationTime.toLocaleString()}`);
      
    } catch (error) {
      console.error('❌ Error al renovar token:', error);
      // No hacer logout automáticamente, Firebase puede tener un token en caché válido
    }
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
