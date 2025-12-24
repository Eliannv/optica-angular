// Script simple para obtener el Machine ID
// Ejecuta con: node get-machine-id.js

const os = require('os');
const crypto = require('crypto');

function generarIdMaquina() {
  const hostname = os.hostname();
  const platform = os.platform();
  const cpus = os.cpus()[0].model;

  const machineInfo = `${hostname}-${platform}-${cpus}`;
  return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
}

console.log('\n🔐 INFORMACIÓN DE ESTA PC:\n');
console.log('  Hostname:', os.hostname());
console.log('  Usuario:', os.userInfo().username);
console.log('  Sistema:', os.platform());
console.log('  CPU:', os.cpus()[0].model);
console.log('\n  ✅ MACHINE ID:', generarIdMaquina());
console.log('\n📋 Copia el Machine ID y pégalo en electron/main.js línea 27\n');
