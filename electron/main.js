const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// 🔐 CONFIGURACIÓN DE SUCURSAL
const SUCURSAL_PERMITIDA = 'PASAJE';

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
    '858744ddedd2fca1', // Esta PC (desarrollo)
    // Agrega aquí el Machine ID de la PC de PASAJE cuando lo obtengas
  ];

  console.log('🔐 Verificación de sucursal:');
  console.log('  - Hostname:', hostname);
  console.log('  - Username:', username);
  console.log('  - Machine ID:', machineId);

  // ⚠️ DESHABILITADO TEMPORALMENTE - El sistema funcionará en cualquier PC
  // La protección REAL está en las reglas de Firebase (requiere auth con sucursal PASAJE)
  // Para activar validación por PC, descomenta las líneas siguientes:

  // if (!idsPermitidos.includes(machineId)) {
  //     return false;
  // }

  return true; // Por ahora permite todas las PCs
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
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icono/icon.png'),
    title: `Sistema Óptica - ${SUCURSAL_PERMITIDA}`,
  });

  // En producción carga la app compilada, en desarrollo el servidor local
  if (app.isPackaged) {
    // Cuando está empaquetado, los archivos están en resources/app.asar/dist
    const indexPath = path.join(__dirname, '../dist/optica-angular/browser/index.html');
    console.log('📂 Intentando cargar desde:', indexPath);
    console.log('📂 __dirname:', __dirname);

    win.loadFile(indexPath);

    // Abrir DevTools para depurar (quitar después)
    win.webContents.openDevTools();

    // Mostrar errores de carga
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('❌ Error cargando la aplicación:', errorCode, errorDescription);
    });

    // Log de consola del renderer
    win.webContents.on('console-message', (event, level, message) => {
      console.log('🖥️ Renderer console:', message);
    });
  } else {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools(); // Solo en desarrollo
  }
}

app.whenReady().then(createWindow);

// Cerrar cuando todas las ventanas estén cerradas (excepto en macOS)
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
