import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Silenciar logs en la app de escritorio en producción
const electronInfo: any = (window as any).electron;
if (electronInfo && electronInfo.isDev === false) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
