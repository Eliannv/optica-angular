/**
 * Script para actualizar el cliente CONSUMIDOR FINAL existente
 * Agrega el campo esConsumidorFinal = true al cliente existente
 * 
 * Ejecutar con: node actualizar-consumidor-final-existente.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin (solo si no está inicializado)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function actualizarConsumidorFinal() {
  try {
    console.log('🔍 Buscando cliente CONSUMIDOR FINAL existente...');

    // Buscar por nombres "CONSUMIDOR" y apellidos "FINAL"
    const clientesRef = db.collection('clientes');
    const snapshot = await clientesRef
      .where('nombres', '==', 'CONSUMIDOR ')
      .where('apellidos', '==', 'FINAL')
      .get();

    if (snapshot.empty) {
      console.log('❌ No se encontró ningún cliente con nombres "CONSUMIDOR " y apellidos "FINAL"');
      console.log('📝 Ejecuta el script crear-cliente-consumidor-final.js para crear uno nuevo');
      return;
    }

    console.log(`✅ Se encontraron ${snapshot.size} cliente(s) que coinciden`);

    // Actualizar todos los clientes encontrados
    for (const doc of snapshot.docs) {
      console.log(`\n📄 Actualizando cliente ID: ${doc.id}`);
      console.log('Datos actuales:', doc.data());

      await doc.ref.update({
        esConsumidorFinal: true,
        activo: true,
        tieneHistorialClinico: false,
        tieneCredito: false,
        tieneDeuda: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Cliente actualizado exitosamente!');
      console.log(`🔑 ID del cliente: ${doc.id}`);
    }

    console.log('\n📌 IMPORTANTE:');
    console.log('   El campo esConsumidorFinal = true ha sido agregado');
    console.log('   Este cliente ahora será reconocido automáticamente por el sistema');
    console.log('   No aparecerá en listados normales de clientes');
    console.log('   No permite crédito ni historial clínico');

  } catch (error) {
    console.error('❌ Error al actualizar cliente CONSUMIDOR FINAL:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar el script
actualizarConsumidorFinal();
