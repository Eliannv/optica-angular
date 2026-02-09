/**
 * Script de migración para actualizar el campo `tieneHistorialClinico`
 * en todos los documentos de clientes existentes.
 * 
 * Este script:
 * 1. Lee todos los clientes de la colección `clientes`
 * 2. Para cada cliente, verifica si tiene documentos en la subcolección `historialClinico`
 * 3. Actualiza el campo `tieneHistorialClinico` a true/false según corresponda
 * 
 * Ejecutar con: node GUIAS/actualizar-flag-historial-clinico.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function actualizarFlagHistorialClinico() {
  console.log('🚀 Iniciando actualización de campo tieneHistorialClinico...\n');

  try {
    // 1. Obtener todos los clientes
    const clientesSnapshot = await db.collection('clientes').get();
    const totalClientes = clientesSnapshot.size;
    console.log(`📊 Total de clientes encontrados: ${totalClientes}\n`);

    let procesados = 0;
    let conHistorial = 0;
    let sinHistorial = 0;
    let errores = 0;

    // 2. Procesar cada cliente
    for (const clienteDoc of clientesSnapshot.docs) {
      const clienteId = clienteDoc.id;
      const clienteData = clienteDoc.data();
      
      try {
        // 3. Contar documentos en la subcolección historialClinico
        const historialSnapshot = await db
          .collection(`clientes/${clienteId}/historialClinico`)
          .count()
          .get();
        
        const totalHistoriales = historialSnapshot.data().count;
        const tieneHistorial = totalHistoriales > 0;

        // 4. Actualizar el campo en el cliente
        await db.collection('clientes').doc(clienteId).update({
          tieneHistorialClinico: tieneHistorial,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        procesados++;
        if (tieneHistorial) {
          conHistorial++;
          console.log(`✅ ${procesados}/${totalClientes} - Cliente: ${clienteData.nombres} ${clienteData.apellidos} (${clienteId}) - ${totalHistoriales} historial(es) → TRUE`);
        } else {
          sinHistorial++;
          console.log(`⚪ ${procesados}/${totalClientes} - Cliente: ${clienteData.nombres} ${clienteData.apellidos} (${clienteId}) - Sin historiales → FALSE`);
        }

      } catch (error) {
        errores++;
        console.error(`❌ Error procesando cliente ${clienteId}:`, error.message);
      }
    }

    // 5. Resumen final
    console.log('\n' + '═'.repeat(60));
    console.log('📋 RESUMEN DE MIGRACIÓN');
    console.log('═'.repeat(60));
    console.log(`Total de clientes procesados: ${procesados}`);
    console.log(`  ✅ Con historial clínico:    ${conHistorial}`);
    console.log(`  ⚪ Sin historial clínico:    ${sinHistorial}`);
    console.log(`  ❌ Errores:                  ${errores}`);
    console.log('═'.repeat(60));
    console.log('\n✨ Migración completada exitosamente\n');

  } catch (error) {
    console.error('❌ Error fatal durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
actualizarFlagHistorialClinico()
  .then(() => {
    console.log('👋 Proceso finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error inesperado:', error);
    process.exit(1);
  });
