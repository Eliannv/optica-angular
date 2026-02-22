/**
 * Script de verificación para revisar movimientos PAGO_TRABAJADOR
 * 
 * Muestra los primeros 10 movimientos de tipo PAGO_TRABAJADOR
 * con sus campos relevantes para debugging.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verificarPagosTrabajadores() {
  try {
    console.log('🔍 Verificando movimientos PAGO_TRABAJADOR...\n');

    // Obtener movimientos de PAGO_TRABAJADOR
    const movimientosSnapshot = await db.collection('movimientos_cajas_banco')
      .where('categoria', '==', 'PAGO_TRABAJADOR')
      .limit(20)
      .get();

    console.log(`📊 Total movimientos encontrados: ${movimientosSnapshot.size}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let conEmpleadoId = 0;
    let sinEmpleadoId = 0;

    movimientosSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const tieneEmpleadoId = !!data.empleado_usuario_id;
      
      if (tieneEmpleadoId) conEmpleadoId++;
      else sinEmpleadoId++;

      console.log(`${index + 1}. Movimiento ID: ${doc.id}`);
      console.log(`   📅 Fecha: ${data.fecha?.toDate?.() || data.fecha}`);
      console.log(`   💰 Monto: ${data.monto}`);
      console.log(`   👤 Persona: ${data.persona_nombre} (${data.persona_cedula})`);
      console.log(`   🆔 empleado_usuario_id: ${data.empleado_usuario_id || '❌ NO EXISTE'}`);
      console.log(`   ✍️  Registrado por: ${data.usuario_nombre} (${data.usuario_id})`);
      console.log(`   ${tieneEmpleadoId ? '✅' : '❌'} ${tieneEmpleadoId ? 'TIENE empleado_usuario_id' : 'FALTA empleado_usuario_id'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    console.log('\n📈 RESUMEN:');
    console.log(`✅ CON empleado_usuario_id: ${conEmpleadoId}`);
    console.log(`❌ SIN empleado_usuario_id: ${sinEmpleadoId}`);
    console.log(`📊 Total: ${movimientosSnapshot.size}`);

    // Obtener lista de empleados para verificar IDs
    console.log('\n👥 Empleados registrados:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const empleadosSnapshot = await db.collection('usuarios').get();
    empleadosSnapshot.docs.forEach(doc => {
      const emp = doc.data();
      if (emp.cedula) {
        console.log(`ID: ${doc.id} | Cédula: ${emp.cedula} | Nombre: ${emp.nombre}`);
      }
    });

  } catch (error) {
    console.error('💥 Error:', error);
    throw error;
  }
}

// Ejecutar
verificarPagosTrabajadores()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error durante verificación:', error);
    process.exit(1);
  });
