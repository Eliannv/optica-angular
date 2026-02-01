/**
 * Script para registrar las sucursales iniciales en Firestore
 * Ejecutar: node registrar-sucursales-iniciales.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const sucursalesIniciales = [
  {
    id: 'MACH001',
    codigo: 'MACH001',
    nombre: 'MACHALA CENTRO',
    activo: true,
    direccion: 'Av. 25 de Junio y Rocafuerte',
    telefono: '07-2930000',
    fechaCreacion: admin.firestore.Timestamp.now(),
    creadoPor: 'system'
  },
  {
    id: 'PASJ001',
    codigo: 'PASJ001',
    nombre: 'PASAJE',
    activo: true,
    direccion: 'Calle Principal',
    telefono: '07-2910000',
    fechaCreacion: admin.firestore.Timestamp.now(),
    creadoPor: 'system'
  },
  {
    id: 'DEV001',
    codigo: 'DEV001',
    nombre: 'DESARROLLO 1',
    activo: true,
    direccion: 'Entorno de desarrollo',
    telefono: '',
    fechaCreacion: admin.firestore.Timestamp.now(),
    creadoPor: 'system'
  },
  {
    id: 'DEV002',
    codigo: 'DEV002',
    nombre: 'DESARROLLO 2',
    activo: true,
    direccion: 'Entorno de desarrollo',
    telefono: '',
    fechaCreacion: admin.firestore.Timestamp.now(),
    creadoPor: 'system'
  }
];

async function registrarSucursales() {
  console.log('🏢 Registrando sucursales iniciales...\n');

  for (const sucursal of sucursalesIniciales) {
    try {
      const { id, ...data } = sucursal;
      await db.collection('sucursales').doc(id).set(data);
      console.log(`✅ Sucursal registrada: ${sucursal.nombre} (${sucursal.codigo})`);
    } catch (error) {
      console.error(`❌ Error registrando ${sucursal.nombre}:`, error.message);
    }
  }

  console.log('\n✨ Proceso completado');
  process.exit(0);
}

registrarSucursales().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
