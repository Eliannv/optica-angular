/**
 * Script para registrar las máquinas iniciales en Firestore
 * 
 * Uso:
 *   node registrar-maquinas-iniciales.js
 * 
 * Este script registra las 4 máquinas conocidas en la colección maquinas_autorizadas.
 * Solo ejecutar UNA VEZ durante la migración inicial.
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const maquinasIniciales = [
  {
    machineId: '858744ddedd2fca1',
    sucursal: 'DESARROLLO_1',
    nombreMaquina: 'PC Desarrollo 1',
    activo: true,
    observaciones: 'Máquina de desarrollo principal'
  },
  {
    machineId: 'e1561953fadb3e82',
    sucursal: 'DESARROLLO_2',
    nombreMaquina: 'PC Desarrollo 2',
    activo: true,
    observaciones: 'Máquina de desarrollo secundaria'
  },
  {
    machineId: '45dfe499c7a935ed',
    sucursal: 'PASAJE',
    nombreMaquina: 'PC Sucursal Pasaje',
    activo: true,
    observaciones: 'Sucursal Pasaje'
  },
  {
    machineId: 'd87cced3d5d6611b',
    sucursal: 'MACHALA',
    nombreMaquina: 'PC Sede Principal Machala',
    activo: true,
    observaciones: 'Sede principal - Administración'
  }
];

async function registrarMaquinas() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     REGISTRANDO MÁQUINAS INICIALES EN FIRESTORE               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const batch = db.batch();

  for (const maquina of maquinasIniciales) {
    const docRef = db.collection('maquinas_autorizadas').doc(maquina.machineId);
    
    console.log(`  ✅ Registrando: ${maquina.nombreMaquina}`);
    console.log(`     Sucursal:   ${maquina.sucursal}`);
    console.log(`     Machine ID: ${maquina.machineId}`);
    console.log(`     Estado:     ${maquina.activo ? 'ACTIVA' : 'INACTIVA'}`);
    console.log('');

    batch.set(docRef, {
      ...maquina,
      fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
      autorizadoPor: 'system'
    });
  }

  try {
    await batch.commit();
    console.log('────────────────────────────────────────────────────────────────');
    console.log('\n  🎉 ¡Máquinas registradas exitosamente!\n');
    console.log('  Puedes verificarlas en:');
    console.log('  - Firebase Console → Firestore → maquinas_autorizadas');
    console.log('  - O desde la app web → Gestionar Máquinas\n');
  } catch (error) {
    console.error('\n  ❌ Error registrando máquinas:', error);
  } finally {
    process.exit();
  }
}

// Ejecutar
registrarMaquinas();
