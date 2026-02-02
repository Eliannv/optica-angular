const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');

// Firebase Admin SDK para verificación de máquinas
const admin = require('firebase-admin');

// 🔐 CONFIGURACIÓN - Ya no se usa una sola sucursal, se verifica contra Firestore
// Cada máquina autorizada está registrada en la colección 'maquinas_autorizadas'

// Flag de entorno para controlar logs y DevTools
const IS_DEV = !app.isPackaged;

// Propagar entorno al renderer
process.env.NODE_ENV = IS_DEV ? 'development' : 'production';

// Inicializar Firebase Admin
let db = null;
try {
  // Cargar credenciales de Firebase Admin
  const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    
    db = admin.firestore();
    devLog('✅ Firebase Admin inicializado correctamente');
  } else {
    console.error('❌ No se encontró serviceAccountKey.json');
  }
} catch (error) {
  console.error('❌ Error inicializando Firebase Admin:', error.message);
}

// Log seguro: solo muestra mensajes en desarrollo
function devLog(...args) {
  if (IS_DEV) {
    console.log(...args);
  }
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

/**
 * Verificar si la máquina está autorizada consultando Firestore
 */
async function verificarSucursal() {
  const hostname = os.hostname().toUpperCase();
  const username = os.userInfo().username.toUpperCase();
  const machineId = generarIdMaquina();

  devLog('🔐 Verificación de sucursal:');
  devLog('  - Hostname:', hostname);
  devLog('  - Username:', username);
  devLog('  - Machine ID:', machineId);

  // Si no hay conexión a Firestore, permitir acceso en desarrollo
  if (!db) {
    console.error('❌ No se pudo conectar a Firestore');
    if (IS_DEV) {
      console.warn('⚠️ MODO DESARROLLO: Permitiendo acceso sin verificación');
      return { autorizado: true, sucursal: 'DESARROLLO_2', machineId };
    }
    return { autorizado: false, sucursal: null, machineId };
  }

  try {
    // Consultar en Firestore si este machineId está autorizado
    const maquinasRef = db.collection('maquinas_autorizadas');
    const snapshot = await maquinasRef
      .where('machineId', '==', machineId)
      .where('activo', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.error('❌ Machine ID no autorizado:', machineId);
      console.error('   Esta máquina no está registrada en el sistema.');
      console.error('   Contacte al administrador para autorizarla.');
      return { autorizado: false, sucursal: null, machineId };
    }

    const maquinaDoc = snapshot.docs[0];
    const maquina = maquinaDoc.data();

    // DEBUGGING: Mostrar SIEMPRE qué documento se está usando
    console.log('🔍 DOCUMENTO CONSULTADO:');
    console.log('   ID del documento:', maquinaDoc.id);
    console.log('   Machine ID:', maquina.machineId);
    console.log('   Sucursal:', maquina.sucursal);
    console.log('   Nombre:', maquina.nombreMaquina);
    console.log('   Activo:', maquina.activo);

    // Actualizar último acceso
    await maquinasRef.doc(maquinaDoc.id).update({
      ultimoAcceso: admin.firestore.FieldValue.serverTimestamp(),
    });

    devLog('✅ Máquina autorizada:');
    devLog('   - Sucursal:', maquina.sucursal);
    devLog('   - Nombre:', maquina.nombreMaquina);

    return { autorizado: true, sucursal: maquina.sucursal, machineId };
  } catch (error) {
    console.error('❌ Error verificando autorización:', error.message);
    return { autorizado: false, sucursal: null, machineId };
  }
}

async function createWindow() {
  // 🔐 Verificar sucursal ANTES de crear la ventana
  const verificacion = await verificarSucursal();
  
  if (!verificacion.autorizado) {
    dialog.showErrorBox(
      'Acceso Denegado - Sistema Óptica',
      `Esta máquina NO está autorizada para acceder al sistema.\n\n` +
        `Machine ID: ${verificacion.machineId}\n\n` +
        `Por favor, contacte al administrador para:\n` +
        `1. Registrar esta máquina en el sistema\n` +
        `2. Asignarle una sucursal\n` +
        `3. Activar su acceso`
    );
    app.quit();
    return;
  }

  // Guardar información de la máquina para usarla en IPC
  global.machineInfo = {
    sucursal: verificacion.sucursal,
    machineId: verificacion.machineId
  };

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
    title: `Sistema Óptica - ${verificacion.sucursal}`,
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

// Handler para obtener información de la máquina
ipcMain.handle('get-machine-info', async () => {
  return global.machineInfo || {
    sucursal: 'DESCONOCIDA',
    machineId: generarIdMaquina()
  };
});

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
