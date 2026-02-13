/**
 * Script de Actualización: Campos de Crédito y Deuda en Clientes
 * 
 * PROPÓSITO:
 * Calcular y agregar campos `tieneCredito` y `tieneDeuda` a todos los clientes existentes
 * basándose en sus facturas pendientes y créditos activos.
 * 
 * ESTRUCTURA NUEVA EN CLIENTES:
 * {
 *   ...campos existentes,
 *   tieneCredito: boolean,    // true si tiene crédito personal activo
 *   tieneDeuda: boolean,      // true si tiene deuda pendiente > 0
 *   ultimaActualizacionDeuda: timestamp  // fecha de última actualización
 * }
 * 
 * BENEFICIOS:
 * ✅ Permite filtrar en Firestore directamente por crédito/deuda
 * ✅ Mejora el rendimiento de paginación (queries más eficientes)
 * ✅ Reduce lecturas de facturas innecesarias
 * ✅ Consistente con el patrón de `tieneHistorialClinico`
 * 
 * IMPORTANTE:
 * - Ejecutar después de crear los campos en el modelo
 * - Puede ejecutarse múltiples veces (es idempotente)
 * - NO modifica facturas, solo actualiza clientes
 * - Recomendable ejecutar periódicamente o mediante Cloud Function
 * 
 * AUTOR: Sistema de Optimización de Lecturas
 * FECHA: 13 de febrero de 2026
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
// LÓGICA DE CÁLCULO DE DEUDA
// ========================================

/**
 * Calcula el resumen de deuda de un cliente (réplica de FacturasService.getResumenDeuda)
 * @param {string} clienteId - ID del cliente
 * @returns {Promise<{deudaTotal: number, pendientes: number, creditosActivos: number, creditoPersonalActivo: boolean}>}
 */
async function calcularResumenDeuda(clienteId) {
  try {
    // 1. Obtener facturas pendientes (estado !== 'pagada')
    const facturasSnap = await db.collection('facturas')
      .where('clienteId', '==', clienteId)
      .where('estado', '!=', 'pagada')
      .get();

    let deudaTotal = 0;
    let pendientes = 0;
    let creditosActivos = 0;
    let creditoPersonalActivo = false;

    // 2. Procesar cada factura pendiente
    facturasSnap.forEach(doc => {
      const factura = doc.data();
      
      // Calcular deuda de esta factura
      const total = factura.total || 0;
      const pagos = factura.pagos || 0;
      const deuda = Math.max(0, total - pagos);
      
      deudaTotal += deuda;
      
      if (deuda > 0) {
        pendientes++;
      }

      // Verificar si es crédito personal activo
      if (factura.metodoPago === 'credito') {
        creditosActivos++;
        creditoPersonalActivo = true;
      }
    });

    return {
      deudaTotal: parseFloat(deudaTotal.toFixed(2)),
      pendientes,
      creditosActivos,
      creditoPersonalActivo
    };

  } catch (error) {
    console.error(`   ⚠️ Error calculando deuda del cliente ${clienteId}:`, error.message);
    return {
      deudaTotal: 0,
      pendientes: 0,
      creditosActivos: 0,
      creditoPersonalActivo: false
    };
  }
}

/**
 * Actualiza los campos de crédito y deuda de un cliente
 * @param {string} clienteId - ID del cliente
 * @returns {Promise<{success: boolean, cambios?: object, error?: string}>}
 */
async function actualizarCamposCliente(clienteId) {
  const clienteRef = db.doc(`clientes/${clienteId}`);
  
  try {
    // 1. Verificar que el cliente existe
    const clienteSnap = await clienteRef.get();
    
    if (!clienteSnap.exists) {
      return {
        success: false,
        error: 'Cliente no existe'
      };
    }

    // 2. Calcular resumen de deuda
    const resumen = await calcularResumenDeuda(clienteId);

    // 3. Determinar valores de los nuevos campos
    const tieneCredito = resumen.creditoPersonalActivo;
    const tieneDeuda = resumen.deudaTotal > 0;

    // 4. Preparar actualización
    const datosActualizacion = {
      tieneCredito,
      tieneDeuda,
      ultimaActualizacionDeuda: admin.firestore.FieldValue.serverTimestamp(),
      // Campos informativos opcionales (para debugging/reportes)
      _deudaCalculada: resumen.deudaTotal,
      _facturasPendientes: resumen.pendientes
    };

    // 5. Actualizar documento
    await clienteRef.update(datosActualizacion);

    return {
      success: true,
      cambios: {
        tieneCredito,
        tieneDeuda,
        deudaTotal: resumen.deudaTotal,
        pendientes: resumen.pendientes
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ========================================
// UTILIDADES
// ========================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// FUNCIÓN PRINCIPAL
// ========================================

async function ejecutarActualizacion() {
  console.log('\n========================================');
  console.log('🚀 ACTUALIZACIÓN DE CAMPOS CRÉDITO/DEUDA EN CLIENTES');
  console.log('========================================\n');
  console.log('⏰ Fecha/Hora:', new Date().toLocaleString('es-ES'));
  console.log('\n');

  let totalClientes = 0;
  let clientesActualizados = 0;
  let clientesConCredito = 0;
  let clientesConDeuda = 0;
  let clientesConError = 0;
  const errores = [];
  const estadisticas = {
    conCreditoYDeuda: 0,
    conCreditoSinDeuda: 0,
    sinCreditoConDeuda: 0,
    sinCreditoSinDeuda: 0
  };

  try {
    // 1. Obtener TODOS los clientes activos
    console.log('📋 Obteniendo lista de clientes activos...\n');
    const clientesSnap = await db.collection('clientes')
      .where('activo', '!=', false)
      .get();

    totalClientes = clientesSnap.size;
    console.log(`✅ Total de clientes encontrados: ${totalClientes}\n`);

    if (totalClientes === 0) {
      console.log('⚠️  No hay clientes para actualizar.\n');
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

      // Actualizar campos
      const resultado = await actualizarCamposCliente(clienteId);

      if (resultado.success) {
        clientesActualizados++;
        
        const { tieneCredito, tieneDeuda, deudaTotal, pendientes } = resultado.cambios;
        
        // Contadores
        if (tieneCredito) clientesConCredito++;
        if (tieneDeuda) clientesConDeuda++;

        // Estadísticas combinadas
        if (tieneCredito && tieneDeuda) estadisticas.conCreditoYDeuda++;
        else if (tieneCredito && !tieneDeuda) estadisticas.conCreditoSinDeuda++;
        else if (!tieneCredito && tieneDeuda) estadisticas.sinCreditoConDeuda++;
        else estadisticas.sinCreditoSinDeuda++;

        // Mostrar resultado
        const creditoBadge = tieneCredito ? '💳 Con crédito' : '   Sin crédito';
        const deudaBadge = tieneDeuda ? `💰 Deuda: $${deudaTotal.toFixed(2)} (${pendientes} fact.)` : '✅ Al día';
        console.log(`   ${creditoBadge} | ${deudaBadge}`);
        console.log(`   ✅ Actualizado\n`);

      } else {
        clientesConError++;
        errores.push({
          clienteId,
          nombre: nombreCliente,
          error: resultado.error
        });
        console.log(`   ❌ Error: ${resultado.error}\n`);
      }

      // Pausa para evitar sobrecarga
      await sleep(100);
    }

    // 3. Resumen final
    console.log('\n========================================');
    console.log('📊 RESUMEN DE ACTUALIZACIÓN');
    console.log('========================================\n');
    console.log(`Total de clientes procesados:      ${totalClientes}`);
    console.log(`✅ Clientes actualizados:             ${clientesActualizados}`);
    console.log(`❌ Clientes con error:                ${clientesConError}\n`);

    console.log('--- Distribución ---');
    console.log(`💳 Clientes con crédito activo:       ${clientesConCredito} (${((clientesConCredito/totalClientes)*100).toFixed(1)}%)`);
    console.log(`💰 Clientes con deuda pendiente:      ${clientesConDeuda} (${((clientesConDeuda/totalClientes)*100).toFixed(1)}%)\n`);

    console.log('--- Combinaciones ---');
    console.log(`💳💰 Con crédito Y con deuda:          ${estadisticas.conCreditoYDeuda}`);
    console.log(`💳✅ Con crédito SIN deuda:            ${estadisticas.conCreditoSinDeuda}`);
    console.log(`  💰 Sin crédito CON deuda:           ${estadisticas.sinCreditoConDeuda}`);
    console.log(`  ✅ Sin crédito SIN deuda:           ${estadisticas.sinCreditoSinDeuda}\n`);

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

    // 5. Recomendaciones post-actualización
    console.log('========================================');
    console.log('📝 PRÓXIMOS PASOS');
    console.log('========================================\n');
    console.log('1. ✅ HABILITAR FILTROS en lista-clientes.html');
    console.log('   - Restaurar los selects de filtroCredito y filtroDeuda');
    console.log('');
    console.log('2. ✅ ACTUALIZAR SERVICIO ClientesService');
    console.log('   - Usar where("tieneCredito", "==", true/false)');
    console.log('   - Usar where("tieneDeuda", "==", true/false)');
    console.log('');
    console.log('3. ⚙️ AUTOMATIZAR actualizaciones futuras:');
    console.log('   - Al crear factura → actualizar cliente');
    console.log('   - Al pagar factura → actualizar cliente');
    console.log('   - Al cambiar estado factura → actualizar cliente');
    console.log('');
    console.log('4. 🔍 CREAR ÍNDICES en Firestore Console:');
    console.log('   - Índice compuesto: activo, tieneCredito, nombres');
    console.log('   - Índice compuesto: activo, tieneDeuda, nombres');
    console.log('   - Índice compuesto: activo, tieneHistorialClinico, tieneDeuda');
    console.log('');

    console.log('✅ ACTUALIZACIÓN COMPLETADA\n');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO EN LA ACTUALIZACIÓN:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await admin.app().delete();
    console.log('🔌 Conexión con Firebase cerrada.\n');
  }
}

// ========================================
// VALIDACIÓN PREVIA
// ========================================

async function validarPrerequisitos() {
  console.log('\n========================================');
  console.log('🔍 VALIDACIÓN DE PREREQUISITOS');
  console.log('========================================\n');

  let todoOk = true;

  try {
    require(SERVICE_ACCOUNT_PATH);
    console.log('✅ Archivo de credenciales encontrado');
  } catch (error) {
    console.error('❌ No se encontró serviceAccountKey.json');
    todoOk = false;
  }

  try {
    await db.collection('clientes').limit(1).get();
    console.log('✅ Conexión con Firestore establecida');
  } catch (error) {
    console.error('❌ Error conectando con Firestore:', error.message);
    todoOk = false;
  }

  try {
    await db.collection('facturas').limit(1).get();
    console.log('✅ Colección de facturas accesible');
  } catch (error) {
    console.error('❌ Error accediendo a facturas:', error.message);
    todoOk = false;
  }

  console.log('\n');

  if (!todoOk) {
    console.log('❌ NO SE PUEDE EJECUTAR LA ACTUALIZACIÓN\n');
    process.exit(1);
  }
}

// ========================================
// CONFIRMACIÓN
// ========================================

async function confirmarEjecucion() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n========================================');
    console.log('ℹ️  INFORMACIÓN');
    console.log('========================================\n');
    console.log('Esta actualización:');
    console.log('1. Leerá todas las facturas de cada cliente');
    console.log('2. Calculará si tiene crédito y deuda');
    console.log('3. Actualizará el documento del cliente con los nuevos campos');
    console.log('4. Es seguro ejecutar múltiples veces (idempotente)\n');

    readline.question('¿Deseas continuar? (escribe SI para confirmar): ', (respuesta) => {
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
    await validarPrerequisitos();
    const confirmado = await confirmarEjecucion();

    if (!confirmado) {
      console.log('\n❌ Actualización cancelada.\n');
      await admin.app().delete();
      process.exit(0);
    }

    await ejecutarActualizacion();

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
})();
