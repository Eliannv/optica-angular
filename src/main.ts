/**
 * Punto de entrada principal de la aplicación Angular.
 * 
 * Este archivo inicializa la aplicación mediante bootstrapApplication y configura
 * el comportamiento específico para el entorno de producción en Electron.
 * 
 * Funcionalidades:
 * - Bootstrap del componente raíz (App) con la configuración global (appConfig)
 * - Silenciamiento de logs de consola en builds de producción de Electron
 * - Manejo de errores durante el arranque de la aplicación
 * 
 * Nota: La detección de Electron se realiza mediante window.electron.isDev
 * inyectado por el proceso principal de Electron (preload.js).
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Configuración de logs para entorno Electron en producción.
 * Silencia console.log, console.info y console.warn para evitar
 * acumulación de logs en la app de escritorio.
 */
const electronInfo: any = (window as any).electron;
if (electronInfo && electronInfo.isDev === false) {
  const noop = (): void => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
}

/**
 * Inicializa la aplicación Angular.
 * En caso de error durante el bootstrap, lo registra en consola.
 */
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
