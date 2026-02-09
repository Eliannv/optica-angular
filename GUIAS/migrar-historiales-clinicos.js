/**
 * Script de Migración: Historiales Clínicos de documento único a múltiples documentos
 * 
 * PROPÓSITO:
 * Migrar los historiales clínicos almacenados en un documento fijo 'main' por cliente
 * a un sistema de múltiples documentos con IDs auto-generados.
 * 
 * ESTRUCTURA ANTES:
 * clientes/{clienteId}/historialClinico/main
 * 
 * ESTRUCTURA DESPUÉS:
 * clientes/{clienteId}/historialClinico/{auto-id}
 * 
 * CARACTERÍSTICAS:
 * ✅ Preserva TODOS los datos originales
 * ✅ Mantiene el timestamp de creación original (createdAt)
 * ✅ Añade metadatos de migración (migratedFrom, migratedAt)
 * ✅ Elimina el documento 'main' solo después de migración exitosa
 * ✅ Manejo robusto de errores (continúa con siguiente cliente si uno falla)
 * ✅ Logging detallado de cada operación
 * ✅ Resumen final con estadísticas
 * 
 * IMPORTANTE:
 * - Ejecutar SOLO UNA VEZ en producción
 * - Hacer BACKUP completo de Firestore antes de ejecutar
 * - Verificar resultados manualmente después de la migración
 * 
 * AUTOR: Arquitecto de Software Senior
 * FECHA: 8 de febrero de 2026
 */

const admin = require('firebase-admin');
const path = require('path');

// ========================================
// CONFIGURACIÓN
// ========================================

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

// Inicializar Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
});

const db = admin.firestore();

// ========================================
// UTILIDADES
// ========================================

/**
 * Convierte un timestamp de Firestore a Date
 */
function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000);
  }
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  return timestamp;
}

/**
 * Crea una pausa asíncrona (para rate limiting)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

/**
 * Migra el historial clínico de un cliente desde 'main' a un nuevo documento
 * @param {string} clienteId - ID del cliente
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function migrarHistorialCliente(clienteId) {
  const mainDocRef = db.doc(`clientes/${clienteId}/historialClinico/main`);
  
  try {
    // 1. Verificar si existe el documento 'main'
    const mainSnap = await mainDocRef.get();
    
    if (!mainSnap.exists) {
      return {
        success: false,
        error: 'Sin historial (no existe documento main)'
      };
    }

    // 2. Obtener datos del documento 'main'
    const datosOriginales = mainSnap.data();
    
    if (!datosOriginales) {
      return {
        success: false,
        error: 'Documento main existe pero está vacío'
      };
    }

    // 3. Preparar datos para el nuevo documento
    const nuevoHistorial = {
      ...datosOriginales,
      // Preservar el createdAt original (convertir Timestamp a Date si es necesario)
      createdAt: datosOriginales.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      // Actualizar updatedAt
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Metadatos de migración
      migratedFrom: 'main',
      migratedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 4. Crear nuevo documento con ID auto-generado
    const historialColRef = db.collection(`clientes/${clienteId}/historialClinico`);
    const nuevoDocRef = await historialColRef.add(nuevoHistorial);

    console.log(`   ✅ Nuevo historial creado con ID: ${nuevoDocRef.id}`);

    // 5. Verificar que el nuevo documento se creó correctamente
    const verificacionSnap = await nuevoDocRef.get();
    if (!verificacionSnap.exists) {
      throw new Error('El nuevo documento no se creó correctamente');
    }

    // 6. Eliminar el documento 'main' solo después de verificar que la migración fue exitosa
    await mainDocRef.delete();
    console.log(`   🗑️  Documento 'main' eliminado`);

    return { success: true };

  } catch (error) {
    console.error(`   ❌ Error migrando cliente ${clienteId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Función principal que ejecuta la migración completa
 */
async function ejecutarMigracion() {
  console.log('\n========================================');
  console.log('🚀 INICIO DE MIGRACIÓN DE HISTORIALES CLÍNICOS');
  console.log('========================================\n');
  console.log('⏰ Fecha/Hora:', new Date().toLocaleString('es-ES'));
  console.log('\n');

  let totalClientes = 0;
  let clientesMigrados = 0;
  let clientesSinHistorial = 0;
  let clientesConError = 0;
  const errores = [];

  try {
    // 1. Obtener TODOS los clientes (activos e inactivos)
    console.log('📋 Obteniendo lista de clientes...\n');
    const clientesSnap = await db.collection('clientes').get();

    totalClientes = clientesSnap.size;
    console.log(`✅ Total de clientes encontrados: ${totalClientes}\n`);

    if (totalClientes === 0) {
      console.log('⚠️  No hay clientes para migrar.\n');
      return;
    }

    // 2. Iterar sobre cada cliente
    let contador = 0;
    for (const clienteDoc of clientesSnap.docs) {
      contador++;
      const clienteId = clienteDoc.id;
      const clienteData = clienteDoc.data();
      const nombreCliente = `${clienteData.nombres || ''} ${clienteData.apellidos || ''}`.trim() || 'Sin nombre';

      console.log(`[${contador}/${totalClientes}] Procesando: ${nombreCliente} (ID: ${clienteId})`);

      // Migrar historial
      const resultado = await migrarHistorialCliente(clienteId);

      if (resultado.success) {
        clientesMigrados++;
        console.log(`   ✅ Migración exitosa\n`);
      } else if (resultado.error?.includes('Sin historial')) {
        clientesSinHistorial++;
        console.log(`   ℹ️  ${resultado.error}\n`);
      } else {
        clientesConError++;
        errores.push({
          clienteId,
          nombre: nombreCliente,
          error: resultado.error
        });
        console.log(`   ❌ Error: ${resultado.error}\n`);
      }

      // Pausa pequeña para evitar sobrecarga (rate limiting)
      await sleep(100);
    }

    // 3. Resumen final
    console.log('\n========================================');
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('========================================\n');
    console.log(`Total de clientes procesados:     ${totalClientes}`);
    console.log(`✅ Historiales migrados exitosamente: ${clientesMigrados}`);
    console.log(`ℹ️  Clientes sin historial:           ${clientesSinHistorial}`);
    console.log(`❌ Clientes con error:                ${clientesConError}\n`);

    // 4. Detallar errores si los hay
    if (errores.length > 0) {
      console.log('========================================');
      console.log('❌ DETALLES DE ERRORES');
      console.log('========================================\n');
      errores.forEach((err, index) => {
        console.log(`${index + 1}. Cliente: ${err.nombre} (ID: ${err.clienteId})`);
        console.log(`   Error: ${err.error}\n`);
      });
    }

    // 5. Recomendaciones post-migración
    console.log('========================================');
    console.log('📝 RECOMENDACIONES POST-MIGRACIÓN');
    console.log('========================================\n');
    console.log('1. Verificar manualmente algunos clientes en Firestore Console');
    console.log('2. Confirmar que NO existen documentos "main" en la base de datos');
    console.log('3. Probar crear nuevo historial clínico desde la aplicación');
    console.log('4. Probar crear venta con historial seleccionado');
    console.log('5. Revisar reportes y facturas existentes\n');

    console.log('✅ MIGRACIÓN COMPLETADA\n');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO EN LA MIGRACIÓN:', error);
    console.error('Stack trace:', error.stack);
    
    console.log('\n⚠️  ACCIÓN REQUERIDA:');
    console.log('1. Revisar el error detallado arriba');
    console.log('2. Si es necesario, restaurar desde el backup de Firestore');
    console.log('3. Corregir el problema en el script');
    console.log('4. Reintentar la migración\n');
  } finally {
    // Cerrar la conexión
    await admin.app().delete();
    console.log('🔌 Conexión con Firebase cerrada.\n');
  }
}

// ========================================
// VALIDACIÓN PREVIA A EJECUCIÓN
// ========================================

async function validarPrerequisitos() {
  console.log('\n========================================');
  console.log('🔍 VALIDACIÓN DE PREREQUISITOS');
  console.log('========================================\n');

  let todoOk = true;

  // 1. Verificar que existe el archivo de credenciales
  try {
    require(SERVICE_ACCOUNT_PATH);
    console.log('✅ Archivo de credenciales encontrado');
  } catch (error) {
    console.error('❌ No se encontró el archivo serviceAccountKey.json');
    console.error(`   Ruta esperada: ${SERVICE_ACCOUNT_PATH}`);
    todoOk = false;
  }

  // 2. Verificar conexión con Firestore
  try {
    const testDoc = await db.collection('_test_').limit(1).get();
    console.log('✅ Conexión con Firestore establecida');
  } catch (error) {
    console.error('❌ Error conectando con Firestore:', error.message);
    todoOk = false;
  }

  // 3. Verificar que existen clientes
  try {
    const clientesSnap = await db.collection('clientes').limit(1).get();
    if (clientesSnap.empty) {
      console.warn('⚠️  No se encontraron clientes en la base de datos');
    } else {
      console.log('✅ Base de datos contiene clientes');
    }
  } catch (error) {
    console.error('❌ Error accediendo a la colección de clientes:', error.message);
    todoOk = false;
  }

  console.log('\n');

  if (!todoOk) {
    console.log('❌ NO SE PUEDE EJECUTAR LA MIGRACIÓN');
    console.log('   Corrige los errores anteriores antes de continuar.\n');
    process.exit(1);
  }
}

// ========================================
// CONFIRMACIÓN DEL USUARIO
// ========================================

async function confirmarEjecucion() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n========================================');
    console.log('⚠️  ADVERTENCIA IMPORTANTE');
    console.log('========================================\n');
    console.log('Esta migración:');
    console.log('1. Modificará TODOS los historiales clínicos');
    console.log('2. Eliminará los documentos "main" existentes');
    console.log('3. Es un proceso IRREVERSIBLE sin backup\n');
    console.log('ANTES DE CONTINUAR:');
    console.log('✅ Asegúrate de haber hecho un BACKUP completo de Firestore');
    console.log('✅ Verifica que estás ejecutando en el ambiente correcto');
    console.log('✅ Lee la documentación completa de migración\n');

    readline.question('¿Deseas continuar con la migración? (escribe SI para confirmar): ', (respuesta) => {
      readline.close();
      resolve(respuesta.trim().toUpperCase() === 'SI');
    });
  });
}

// ========================================
// PUNTO DE ENTRADA
// ========================================

(async () => {
  try {
    // 1. Validar prerequisitos
    await validarPrerequisitos();

    // 2. Solicitar confirmación del usuario
    const confirmado = await confirmarEjecucion();

    if (!confirmado) {
      console.log('\n❌ Migración cancelada por el usuario.\n');
      await admin.app().delete();
      process.exit(0);
    }

    // 3. Ejecutar migración
    await ejecutarMigracion();

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
})();
