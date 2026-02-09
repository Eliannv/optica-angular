/**
 * Script para limpiar cajas banco duplicadas y cajas creadas automáticamente en cascada.
 * 
 * Problemas:
 * 1. Se crearon múltiples cajas banco para el mismo mes/año (duplicados por doble clic)
 * 2. El cierre automático creó cajas en cascada (oct, nov, dic, ene 2026)
 * 
 * Solución: 
 * - Mantener solo UNA caja por periodo
 * - Preferir cajas creadas manualmente (sin observación de auto-creación)
 * - Si todas son auto-creadas, mantener la primera
 * - Desactivar las demás (soft delete)
 * 
 * USO:
 * node limpiar-cajas-duplicadas.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Obtiene el periodo (año + mes) de una fecha.
 */
function obtenerPeriodo(fecha) {
  const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
  const year = date.getFullYear();
  const month = date.getMonth();
  return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * Limpia cajas banco duplicadas del mismo periodo.
 * Mantiene la más antigua (primera createdAt) y desactiva las demás.
 */
async function limpiarCajasBancoDuplicadas() {
  try {
    console.log('🔍 Buscando cajas banco duplicadas...\n');

    // Obtener todas las cajas banco activas
    const snapshot = await db.collection('cajas_banco')
      .where('activo', '!=', false)
      .get();

    if (snapshot.empty) {
      console.log('No hay cajas banco en el sistema.');
      return;
    }

    // Agrupar por periodo
    const cajasPorPeriodo = new Map();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const periodo = obtenerPeriodo(data.fecha);
      
      if (!cajasPorPeriodo.has(periodo)) {
        cajasPorPeriodo.set(periodo, []);
      }
      
      cajasPorPeriodo.get(periodo).push({
        id: doc.id,
        ...data
      });
    });

    // Encontrar periodos con duplicados
    let totalDuplicados = 0;
    let totalProcesados = 0;

    for (const [periodo, cajas] of cajasPorPeriodo.entries()) {
      if (cajas.length > 1) {
        console.log(`\n📅 Periodo: ${periodo}`);
        console.log(`   Cajas encontradas: ${cajas.length}`);
        
        // Prioridad para mantener:
        // 1. Cajas NO auto-creadas (sin "automáticamente" en observación)
        // 2. Si todas son auto-creadas, mantener la primera (más antigua)
        
        const cajasNoAuto = cajas.filter(c => 
          !c.observacion || !c.observacion.includes('automáticamente')
        );
        
        let cajaAMantener;
        if (cajasNoAuto.length > 0) {
          // Preferir cajas creadas manualmente
          cajasNoAuto.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeA - timeB;
          });
          cajaAMantener = cajasNoAuto[0];
          console.log(`   ✅ Manteniendo (manual): ${cajaAMantener.id}`);
        } else {
          // Todas son auto-creadas, mantener la primera
          cajas.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeA - timeB;
          });
          cajaAMantener = cajas[0];
          console.log(`   ✅ Manteniendo (auto, primera): ${cajaAMantener.id}`);
        }
        
        console.log(`      Fecha: ${cajaAMantener.fecha?.toDate?.().toLocaleDateString('es-ES')}`);
        console.log(`      Creada: ${cajaAMantener.createdAt?.toDate?.().toLocaleString('es-ES')}`);
        console.log(`      Estado: ${cajaAMantener.estado}`);

        // Desactivar las demás (soft delete)
        for (const caja of cajas) {
          if (caja.id !== cajaAMantener.id) {
            const esAuto = caja.observacion && caja.observacion.includes('automáticamente');
            const tipo = esAuto ? 'AUTO' : 'DUPLICADO';
            
            console.log(`   ❌ Desactivando (${tipo}): ${caja.id}`);
            console.log(`      Fecha: ${caja.fecha?.toDate?.().toLocaleDateString('es-ES')}`);
            console.log(`      Creada: ${caja.createdAt?.toDate?.().toLocaleString('es-ES')}`);
            
            await db.collection('cajas_banco').doc(caja.id).update({
              activo: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              observacion: (caja.observacion || '') + ` [${tipo} - Desactivado automáticamente el 29/01/2026]`
            });
            
            totalDuplicados++;
          }
        }
        
        totalProcesados++;
      }
    }

    console.log(`\n\n✅ Proceso completado:`);
    console.log(`   - Periodos con duplicados: ${totalProcesados}`);
    console.log(`   - Cajas duplicadas desactivadas: ${totalDuplicados}`);
    console.log(`   - Total cajas revisadas: ${snapshot.size}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar
console.log('🚀 Iniciando limpieza de cajas banco duplicadas...\n');
limpiarCajasBancoDuplicadas();
