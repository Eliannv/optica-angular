#!/usr/bin/env node

/**
 * 🔄 Script de Migración: Soft Delete para Productos, Proveedores, Clientes, Cajas
 * 
 * Este script:
 * 1. Elimina todos los datos existentes de clientes, proveedores, productos, cajas chicas y cajas banco
 * 2. Prepara la BD para el nuevo sistema de soft delete (campo 'activo')
 * 
 * Uso:
 * node migrate-soft-delete.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function limpiarColeccion(nombreColeccion) {
  console.log(`\n🗑️  Eliminando todos los documentos de: ${nombreColeccion}`);
  
  const coleccion = db.collection(nombreColeccion);
  const snapshot = await coleccion.get();
  
  if (snapshot.empty) {
    console.log(`   ✓ Colección ${nombreColeccion} ya está vacía`);
    return 0;
  }

  let contador = 0;
  const batch = db.batch();
  
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    contador++;
  });

  await batch.commit();
  console.log(`   ✓ Eliminados ${contador} documentos de ${nombreColeccion}`);
  return contador;
}

async function ejecutarMigracion() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔄 MIGRACIÓN A SOFT DELETE (Eliminación Lógica)            ║');
  console.log('║     Limpiando BD para nuevo sistema de 'activo: boolean'    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    const coleccionesAlimpiar = [
      'clientes',
      'proveedores',
      'productos',
      'cajaChica',
      'cajaBanco',
    ];

    let totalEliminados = 0;
    for (const coleccion of coleccionesAlimpiar) {
      const eliminados = await limpiarColeccion(coleccion);
      totalEliminados += eliminados;
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE                      ║');
    console.log(`║     Total de documentos eliminados: ${totalEliminados}`);
    console.log('║                                                            ║');
    console.log('║  📝 Próximos pasos:                                        ║');
    console.log('║     1. Los nuevos documentos se crearán con activo: true  ║');
    console.log('║     2. Al eliminar, se marca con activo: false            ║');
    console.log('║     3. Las consultas filtran por activo: true             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  ejecutarMigracion();
}

module.exports = { limpiarColeccion };
