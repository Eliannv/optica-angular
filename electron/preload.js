// Preload script
// Este archivo se ejecuta antes que el contenido web
// y tiene acceso limitado a APIs de Node.js

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const crypto = require('crypto');

/**
 * Genera el mismo ID de máquina que en main.js
 */
function generarIdMaquina() {
  const hostname = os.hostname();
  const platform = os.platform();
  const cpus = os.cpus()[0].model;
  const machineInfo = `${hostname}-${platform}-${cpus}`;
  return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
}

// Exponer APIs seguras a la aplicación Angular
contextBridge.exposeInMainWorld('electronAPI', {
  descargarPlantilla: () => ipcRenderer.invoke('descargar-plantilla'),
});

contextBridge.exposeInMainWorld('electron', {
  sucursal: 'PASAJE',
  version: '1.0.0',
  machineId: generarIdMaquina(), // Exponer machine ID para validación
  // Flag para saber si estamos en desarrollo o producción
  isDev: process.env.NODE_ENV !== 'production',
});
