/**
 * Script para eliminar el campo legacy 'stockIlimitado' de todos los productos
 * 
 * Este script limpia los productos en Firestore eliminando el campo stockIlimitado
 * ya que ahora solo usamos tipo_control_stock
 * 
 * USO:
 *   node eliminar-stock-ilimitado.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function eliminarStockIlimitado() {
  console.log('🚀 Iniciando limpieza del campo legacy "stockIlimitado"...\n');

  try {
    const productosRef = db.collection('productos');
    const snapshot = await productosRef.get();

    if (snapshot.empty) {
      console.log('⚠️  No se encontraron productos en la base de datos.');
      return;
    }

    let eliminados = 0;
    let sinCampo = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const id = doc.id;

      // Verificar si el producto tiene el campo stockIlimitado
      if (data.hasOwnProperty('stockIlimitado')) {
        // Eliminar el campo
        batch.update(doc.ref, {
          stockIlimitado: FieldValue.delete(),
          updatedAt: new Date()
        });
        
        console.log(`✅ ${data.nombre || id} (${data.tipo_control_stock || 'NORMAL'})`);
        eliminados++;
      } else {
        sinCampo++;
      }
    }

    if (eliminados > 0) {
      await batch.commit();
      console.log(`\n✨ Limpieza completada:`);
      console.log(`   🗑️  Productos con campo eliminado: ${eliminados}`);
      console.log(`   ✓ Productos sin el campo: ${sinCampo}`);
      console.log(`   📊 Total procesados: ${snapshot.size}`);
    } else {
      console.log('✨ Ningún producto tenía el campo "stockIlimitado".');
      console.log(`   📊 Total revisados: ${snapshot.size}`);
    }

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  }
}

// Ejecutar limpieza
eliminarStockIlimitado()
  .then(() => {
    console.log('\n🎉 Proceso terminado exitosamente.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
