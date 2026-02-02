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

// Variable para almacenar la información de la máquina
let machineInfoCache = null;

// Función async para obtener la información
async function getMachineInfo() {
  if (!machineInfoCache) {
    machineInfoCache = await ipcRenderer.invoke('get-machine-info');
  }
  return machineInfoCache;
}

// Exponer APIs seguras a la aplicación Angular
contextBridge.exposeInMainWorld('electronAPI', {
  descargarPlantilla: () => ipcRenderer.invoke('descargar-plantilla'),
  getMachineInfo: () => ipcRenderer.invoke('get-machine-info'),
});

// Inicializar y exponer electron con valores por defecto
// Los valores reales se obtendrán vía electronAPI.getMachineInfo()
contextBridge.exposeInMainWorld('electron', {
  sucursal: 'CARGANDO...', // Se actualizará desde Angular
  version: '1.0.0',
  machineId: generarIdMaquina(), // Machine ID local
  isDev: process.env.NODE_ENV !== 'production',
});
