/**
 * Script de migración para agregar campo empleado_usuario_id a movimientos de PAGO_TRABAJADOR
 * 
 * CONTEXTO:
 * Los movimientos de tipo PAGO_TRABAJADOR tenían persona_cedula pero no empleado_usuario_id.
 * El servicio de métricas necesita empleado_usuario_id para calcular pagos a empleados.
 * 
 * Este script:
 * 1. Lee todos los movimientos con categoria = PAGO_TRABAJADOR
 * 2. Para cada uno, busca el empleado por persona_cedula
 * 3. Actualiza el documento con empleado_usuario_id = ID del empleado
 * 
 * IMPORTANTE: Ejecutar UNA SOLA VEZ
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrarPagosTrabajadores() {
  try {
    console.log('🚀 Iniciando migración de pagos a trabajadores...\n');

    // 1. Obtener todos los movimientos de PAGO_TRABAJADOR
    const movimientosSnapshot = await db.collection('movimientos_cajas_banco')
      .where('categoria', '==', 'PAGO_TRABAJADOR')
      .get();

    console.log(`📊 Total movimientos PAGO_TRABAJADOR: ${movimientosSnapshot.size}\n`);

    // 2. Obtener todos los usuarios/empleados
    const usuariosSnapshot = await db.collection('usuarios').get();
    const empleadosPorCedula = new Map();
    
    usuariosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.cedula) {
        empleadosPorCedula.set(data.cedula, doc.id);
      }
    });

    console.log(`👥 Total empleados con cédula: ${empleadosPorCedula.size}\n`);

    // 3. Procesar cada movimiento
    let actualizados = 0;
    let noEncontrados = 0;
    let yaTienen = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const movDoc of movimientosSnapshot.docs) {
      const movData = movDoc.data();
      const personaCedula = movData.persona_cedula;

      // Si ya tiene empleado_usuario_id, saltar
      if (movData.empleado_usuario_id) {
        yaTienen++;
        continue;
      }

      if (!personaCedula) {
        console.warn(`⚠️  Movimiento ${movDoc.id} sin persona_cedula`);
        noEncontrados++;
        continue;
      }

      // Buscar empleado por cédula
      const empleadoId = empleadosPorCedula.get(personaCedula.toString());

      if (empleadoId) {
        batch.update(movDoc.ref, {
          empleado_usuario_id: empleadoId
        });
        actualizados++;
        batchCount++;

        console.log(`✅ Movimiento ${movDoc.id}: ${movData.persona_nombre} (${personaCedula}) → ${empleadoId}`);

        // Firestore batch limit es 500
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`\n💾 Guardados ${batchCount} cambios en batch\n`);
          batchCount = 0;
        }
      } else {
        console.warn(`❌ No se encontró empleado con cédula: ${personaCedula} (${movData.persona_nombre})`);
        noEncontrados++;
      }
    }

    // Commit final
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Guardados ${batchCount} cambios finales\n`);
    }

    // Resumen
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 RESUMEN DE MIGRACIÓN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Actualizados:        ${actualizados}`);
    console.log(`⏭️  Ya tenían campo:     ${yaTienen}`);
    console.log(`❌ No encontrados:      ${noEncontrados}`);
    console.log(`📊 Total procesados:    ${movimientosSnapshot.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Migración completada exitosamente');

  } catch (error) {
    console.error('💥 Error durante la migración:', error);
    throw error;
  }
}

// Ejecutar migración
migrarPagosTrabajadores()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script fallido:', error);
    process.exit(1);
  });
