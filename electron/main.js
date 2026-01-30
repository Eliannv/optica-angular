const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');

// 🔐 CONFIGURACIÓN DE SUCURSAL
const SUCURSAL_PERMITIDA = 'PASAJE';

// Flag de entorno para controlar logs y DevTools
const IS_DEV = !app.isPackaged;

// Propagar entorno al renderer
process.env.NODE_ENV = IS_DEV ? 'development' : 'production';

// Log seguro: solo muestra mensajes en desarrollo
function devLog(...args) {
  if (IS_DEV) {
    console.log(...args);
  }
}

/**
 * OPCIÓN A: Verificación por nombre de máquina o usuario
 * Puedes verificar el nombre de la PC o el nombre de usuario del sistema
 */
function verificarSucursal() {
  const hostname = os.hostname().toUpperCase();
  const username = os.userInfo().username.toUpperCase();

  // Opción 1: Por nombre de PC (ejemplo: PC-PASAJE, PASAJE-01, etc.)
  // Descomenta y ajusta según tus necesidades:
  // if (!hostname.includes('PASAJE')) {
  //   return false;
  // }

  // Opción 2: Por ID único de máquina (más seguro)
  const machineId = generarIdMaquina();
  const idsPermitidos = [
    '858744ddedd2fca1', // PC (desarrollo)
    'e1561953fadb3e82', // PC 2 (desarrollo)
    '0de9527eff37b967', //Pasaje
    '45dfe499c7a935ed', //Pasaje 2
    'd87cced3d5d6611b' //Machala
    // Agrega aquí el Machine ID de la PC de PASAJE cuando lo obtengas
  ];

  devLog('🔐 Verificación de sucursal:');
  devLog('  - Hostname:', hostname);
  devLog('  - Username:', username);
  devLog('  - Machine ID:', machineId);

  // ✅ VALIDACIÓN ACTIVA - Solo permite PCs autorizadas
  if (!idsPermitidos.includes(machineId)) {
    console.error('❌ Machine ID no autorizado:', machineId);
    return false;
  }

  devLog('✅ Machine ID autorizado');
  return true;
}

/**
 * Genera un ID único de la máquina basado en características del sistema
 */
function generarIdMaquina() {
  const hostname = os.hostname();
  const platform = os.platform();
  const cpus = os.cpus()[0].model;

  // Combina información del sistema para crear un ID único
  const machineInfo = `${hostname}-${platform}-${cpus}`;
  return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
}

function createWindow() {
  // 🔐 Verificar sucursal ANTES de crear la ventana
  if (!verificarSucursal()) {
    dialog.showErrorBox(
      'Acceso Denegado - Sistema Óptica',
      `Este sistema está autorizado SOLO para la sucursal ${SUCURSAL_PERMITIDA}.\n\n` +
        `No se puede ejecutar en esta ubicación.\n\n` +
        `Contacte al administrador del sistema.`
    );
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icono/icon.ico'),
    title: `Sistema Óptica - ${SUCURSAL_PERMITIDA}`,
    // Deshabilitar DevTools en producción
    devTools: IS_DEV,
  });

  // En producción carga la app compilada, en desarrollo el servidor local
  if (app.isPackaged) {
    // Cuando está empaquetado, los archivos están en resources/app.asar/dist
    const indexPath = path.join(__dirname, '../dist/optica-angular/browser/index.html');
    devLog('📂 Intentando cargar desde:', indexPath);
    devLog('📂 __dirname:', __dirname);
    devLog('📂 Ruta completa:', path.resolve(indexPath));

    // Cargar con loadFile para que use rutas relativas correctas
    win.loadFile(indexPath).catch((err) => {
      console.error('❌ Error al cargar archivo:', err);
      dialog.showErrorBox(
        'Error de carga',
        'No se pudo cargar la aplicación. Error: ' + err.message
      );
    });

    // Mostrar errores de carga (solo se loguean en desarrollo)
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (IS_DEV) {
        console.error('❌ Error cargando la aplicación:', errorCode, errorDescription);
      }
    });

    // Log de consola del renderer (solo en desarrollo)
    if (IS_DEV) {
      win.webContents.on('console-message', (event, level, message) => {
        console.log('🖥️ Renderer console:', message);
      });
    }
  } else {
    win.loadURL('http://localhost:4200');
  }

  // Abrir DevTools solo en desarrollo
  if (IS_DEV) {
    win.webContents.openDevTools();
  }
}

/**
 * IPC Handlers para servir archivos desde Electron
 */
ipcMain.handle('descargar-plantilla', async () => {
  try {
    // Rutas posibles donde podría estar el archivo
    const rutasPosibles = [
      // En desarrollo
      path.join(process.cwd(), 'plantilla_importacion_productos.xlsx'),
      path.join(process.cwd(), 'public', 'plantilla_importacion_productos.xlsx'),

      // En empaquetado (dentro del app.asar)
      path.join(__dirname, '../plantilla_importacion_productos.xlsx'),
      path.join(__dirname, '../public/plantilla_importacion_productos.xlsx'),
      path.join(__dirname, '../../plantilla_importacion_productos.xlsx'),

      // Alternativas de empaquetado
      path.join(process.resourcesPath, 'plantilla_importacion_productos.xlsx'),
    ];

    devLog('🔍 Buscando plantilla en:', rutasPosibles);

    // Intentar leer desde cada ruta
    for (const ruta of rutasPosibles) {
      try {
        if (fs.existsSync(ruta)) {
          devLog(`✅ Plantilla encontrada en: ${ruta}`);
          const buffer = fs.readFileSync(ruta);
          return {
            success: true,
            data: buffer.toString('base64'),
            mensaje: `Archivo encontrado en: ${ruta}`,
          };
        }
      } catch (error) {
        devLog(`❌ Error intentando ${ruta}:`, error.message);
      }
    }

    // Si no se encontró en ningún lado
    throw new Error('Archivo plantilla_importacion_productos.xlsx no encontrado');
  } catch (error) {
    console.error('Error en IPC descargar-plantilla:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
