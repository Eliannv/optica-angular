/**
 * Script para crear el cliente especial "CONSUMIDOR FINAL"
 * Este cliente se usa para ventas sin cliente registrado
 * 
 * Ejecutar con: node crear-cliente-consumidor-final.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * ID fijo para el cliente CONSUMIDOR FINAL
 * Este ID debe usarse en todo el sistema para referirse a este cliente especial
 */
const CONSUMIDOR_FINAL_ID = 'CONSUMIDOR_FINAL_SYSTEM';

async function crearClienteConsumidorFinal() {
  try {
    console.log('🔍 Verificando si existe el cliente CONSUMIDOR FINAL...');

    const clienteRef = db.collection('clientes').doc(CONSUMIDOR_FINAL_ID);
    const clienteDoc = await clienteRef.get();

    if (clienteDoc.exists) {
      console.log('✅ El cliente CONSUMIDOR FINAL ya existe en la base de datos.');
      console.log('📄 Datos actuales:', clienteDoc.data());
      
      // Actualizar solo los campos necesarios sin sobreescribir createdAt
      await clienteRef.update({
        activo: true,
        esConsumidorFinal: true,
        tieneHistorialClinico: false,
        tieneCredito: false,
        tieneDeuda: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Cliente CONSUMIDOR FINAL actualizado correctamente.');
    } else {
      console.log('📝 Creando nuevo cliente CONSUMIDOR FINAL...');

      const clienteData = {
        nombres: 'CONSUMIDOR',
        apellidos: 'FINAL',
        cedula: '9999999999', // Cédula especial que no se usará
        telefono: '',
        email: '',
        direccion: '',
        pais: '',
        provincia: '',
        ciudad: '',
        activo: true,
        esConsumidorFinal: true, // ⭐ Campo especial que identifica este cliente
        tieneHistorialClinico: false,
        tieneCredito: false,
        tieneDeuda: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await clienteRef.set(clienteData);

      console.log('✅ Cliente CONSUMIDOR FINAL creado exitosamente!');
      console.log('🔑 ID del cliente:', CONSUMIDOR_FINAL_ID);
      console.log('📄 Datos:', clienteData);
    }

    console.log('\n📌 IMPORTANTE:');
    console.log(`   El ID del cliente CONSUMIDOR FINAL es: ${CONSUMIDOR_FINAL_ID}`);
    console.log('   Este ID debe usarse en el código del POS para ventas a consumidor final.');
    console.log('   Este cliente NO debe aparecer en listados normales de clientes.');
    console.log('   Este cliente NO permite crédito ni historial clínico.');

  } catch (error) {
    console.error('❌ Error al crear/verificar cliente CONSUMIDOR FINAL:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar el script
crearClienteConsumidorFinal();
