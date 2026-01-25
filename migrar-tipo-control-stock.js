/**
 * Script para migrar productos y establecer tipo_control_stock
 * 
 * Este script actualiza todos los productos en Firestore:
 * - Si grupo === 'LUNAS' → tipo_control_stock = 'ILIMITADO'
 * - Otros productos → tipo_control_stock = 'NORMAL'
 * 
 * USO:
 *   node migrar-tipo-control-stock.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrarTipoControlStock() {
  console.log('🚀 Iniciando migración de tipo_control_stock...\n');

  try {
    const productosRef = db.collection('productos');
    const snapshot = await productosRef.get();

    if (snapshot.empty) {
      console.log('⚠️  No se encontraron productos en la base de datos.');
      return;
    }

    let actualizados = 0;
    let sinCambios = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const id = doc.id;

      // Determinar el tipo de control de stock correcto
      const esIlimitado = data.grupo === 'LUNAS';
      
      const tipoControlDeseado = esIlimitado ? 'ILIMITADO' : 'NORMAL';
      
      // Solo actualizar si no tiene el campo o está incorrecto
      if (data.tipo_control_stock !== tipoControlDeseado) {
        batch.update(doc.ref, {
          tipo_control_stock: tipoControlDeseado,
          updatedAt: new Date()
        });
        
        console.log(`✅ ${data.nombre || id}`);
        console.log(`   Grupo: ${data.grupo || 'N/A'}`);
        console.log(`   tipo_control_stock: ${data.tipo_control_stock || 'undefined'} → ${tipoControlDeseado}`);
        console.log();
        
        actualizados++;
      } else {
        sinCambios++;
      }
    }

    if (actualizados > 0) {
      await batch.commit();
      console.log(`\n✨ Migración completada:`);
      console.log(`   📦 Productos actualizados: ${actualizados}`);
      console.log(`   ✓ Productos sin cambios: ${sinCambios}`);
      console.log(`   📊 Total procesados: ${snapshot.size}`);
    } else {
      console.log('✨ Todos los productos ya tienen tipo_control_stock correcto.');
      console.log(`   📊 Total revisados: ${snapshot.size}`);
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

// Ejecutar migración
migrarTipoControlStock()
  .then(() => {
    console.log('\n🎉 Proceso terminado exitosamente.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
