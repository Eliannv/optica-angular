/**
 * Script de migración para asignar IDs internos a productos existentes
 *
 * IMPORTANTE: Ejecutar UNA SOLA VEZ después de implementar el sistema de IDs
 *
 * Requisitos:
 * - Node.js instalado
 * - firebase-admin configurado
 * - serviceAccountKey.json en la raíz del proyecto
 *
 * Uso:
 *   node migrar-ids-productos.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrarProductos() {
  console.log('🚀 Iniciando migración de IDs internos para productos...\n');

  try {
    // Obtener todos los productos
    const productosRef = db.collection('productos');
    const snapshot = await productosRef.get();

    if (snapshot.empty) {
      console.log('❌ No se encontraron productos en la base de datos.');
      process.exit(0);
    }

    console.log(`📦 Encontrados ${snapshot.size} productos\n`);

    // Obtener el contador actual (si existe)
    const counterRef = db.doc('counters/productos');
    const counterDoc = await counterRef.get();

    let idActual = 1001; // Valor inicial por defecto

    if (counterDoc.exists()) {
      const lastId = counterDoc.data().lastId;
      console.log(`ℹ️  Contador existente encontrado: ${lastId}`);
      const respuesta = require('readline-sync').question(
        `¿Continuar desde ${lastId + 1}? (s/n): `
      );
      if (respuesta.toLowerCase() === 's') {
        idActual = lastId + 1;
      }
    } else {
      console.log('ℹ️  No existe contador. Iniciando desde 1001');
    }

    console.log(`\n🔢 Iniciando asignación desde ID: ${idActual}\n`);

    let procesados = 0;
    let actualizados = 0;
    let omitidos = 0;

    // Procesar cada producto
    for (const doc of snapshot.docs) {
      procesados++;
      const data = doc.data();

      // Si el producto ya tiene idInterno, omitir
      if (data.idInterno) {
        console.log(
          `⏭️  [${procesados}/${snapshot.size}] Producto "${doc.id}" ya tiene idInterno: ${data.idInterno} - OMITIDO`
        );
        omitidos++;

        // Actualizar idActual si es mayor
        if (data.idInterno >= idActual) {
          idActual = data.idInterno + 1;
        }
        continue;
      }

      // Asignar nuevo ID interno
      await doc.ref.update({
        idInterno: idActual,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `✅ [${procesados}/${snapshot.size}] Producto "${
          data.codigo || doc.id
        }" → idInterno: ${idActual}`
      );

      actualizados++;
      idActual++;

      // Pequeña pausa para evitar sobrecargar Firestore
      if (procesados % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Actualizar el contador con el último ID usado
    const lastIdUsed = idActual - 1;
    await counterRef.set({
      lastId: lastIdUsed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('\n' + '='.repeat(60));
    console.log('✨ Migración completada exitosamente\n');
    console.log(`📊 Resumen:`);
    console.log(`   - Total procesados: ${procesados}`);
    console.log(`   - Actualizados: ${actualizados}`);
    console.log(`   - Omitidos (ya tenían ID): ${omitidos}`);
    console.log(`   - Último ID asignado: ${lastIdUsed}`);
    console.log(`   - Próximo ID disponible: ${idActual}`);
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    // Terminar la app
    await admin.app().delete();
    process.exit(0);
  }
}

// Confirmación antes de ejecutar
console.log('⚠️  ADVERTENCIA: Este script modificará todos los productos en Firestore\n');
console.log('   - Asignará IDs internos a productos que no los tengan');
console.log('   - Actualizará el contador de productos');
console.log('   - Este proceso es irreversible\n');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question('¿Desea continuar? (escriba "SI" para confirmar): ', (respuesta) => {
  readline.close();

  if (respuesta.trim().toUpperCase() === 'SI') {
    migrarProductos();
  } else {
    console.log('\n❌ Migración cancelada por el usuario.');
    process.exit(0);
  }
});
