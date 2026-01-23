/**
 * Configuración global de la aplicación Angular.
 * 
 * Define todos los providers necesarios para el funcionamiento de la app:
 * - Listeners globales de errores no capturados
 * - Detección de cambios con coalescing para optimizar rendimiento
 * - Router con configuración de rutas lazy-loaded
 * - Animaciones del navegador
 * - Firebase App, Firestore y Authentication
 * 
 * Esta configuración se utiliza en el bootstrap de la aplicación (main.ts).
 * Cualquier provider global debe agregarse aquí para estar disponible en toda la app.
 */

import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
  ]
};
