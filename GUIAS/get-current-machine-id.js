/**
 * Script para obtener el Machine ID de la máquina actual
 * 
 * Uso:
 *   node get-machine-id.js
 * 
 * Este script genera el mismo ID que usa Electron para verificar la máquina.
 * Úsalo para obtener el Machine ID de una nueva PC y registrarla en el sistema.
 */

const os = require('os');
const crypto = require('crypto');

function generarIdMaquina() {
  const hostname = os.hostname();
  const platform = os.platform();
  const cpus = os.cpus()[0].model;

  // Combina información del sistema para crear un ID único
  const machineInfo = `${hostname}-${platform}-${cpus}`;
  return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
}

function obtenerInfoSistema() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           INFORMACIÓN DE LA MÁQUINA ACTUAL                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const hostname = os.hostname();
  const username = os.userInfo().username;
  const platform = os.platform();
  const cpuModel = os.cpus()[0].model;
  const machineId = generarIdMaquina();

  console.log('  📌 Hostname:       ', hostname);
  console.log('  👤 Username:       ', username);
  console.log('  💻 Platform:       ', platform);
  console.log('  🔧 CPU:            ', cpuModel);
  console.log('\n  🔐 MACHINE ID:     ', machineId);
  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('\n  ℹ️  Copia el Machine ID de arriba para registrar esta máquina');
  console.log('     en el panel de administración.\n');
}

// Ejecutar
obtenerInfoSistema();
