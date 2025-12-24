// Preload script
// Este archivo se ejecuta antes que el contenido web
// y tiene acceso limitado a APIs de Node.js

const { contextBridge } = require('electron');

// Exponer APIs seguras a la aplicación Angular
contextBridge.exposeInMainWorld('electron', {
  sucursal: 'PASAJE',
  version: '1.0.0', // Hardcoded para evitar errores al leer package.json en ASAR
});
