/**
 * 📊 Script para Generar Resúmenes Mensuales en Firestore
 * 
 * **Propósito:**
 * Este script genera documentos de resumen pre-calculados en Firestore
 * para optimizar consultas de dashboards y reportes.
 * 
 * **Uso:**
 * 1. Ejecutar manualmente: `node generar-resumenes-mensuales.js`
 * 2. Programar ejecución automática (mensual/semanal) con:
 *    - Cloud Scheduler + Cloud Functions
 *    - Tarea programada del sistema
 *    - Cron job
 * 
 * **Beneficios:**
 * - Reduce cientos de lecturas a solo 1 lectura por consulta de dashboard
 * - Acelera carga de reportes históricos
 * - Optimiza rendimiento y costos de Firestore
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Genera resumen mensual para un mes específico
 */
async function generarResumenMensual(año, mes) {
  console.log(`\n📊 Generando resumen para ${año}-${String(mes).padStart(2, '0')}...`);
  
  // Calcular rango de fechas del mes
  const fechaDesde = new Date(año, mes - 1, 1, 0, 0, 0);
  const fechaHasta = new Date(año, mes, 0, 23, 59, 59);
  
  console.log(`📅 Rango: ${fechaDesde.toISOString()} - ${fechaHasta.toISOString()}`);
  
  try {
    // Consultar datos del mes
    console.log('🔍 Consultando facturas...');
    const facturasSnap = await db.collection('facturas')
      .where('fecha', '>=', fechaDesde)
      .where('fecha', '<=', fechaHasta)
      .get();
    
    console.log('🔍 Consultando pagos de deuda...');
    const pagosDeudaSnap = await db.collection('facturas_deudas')
      .where('fechaPago', '>=', fechaDesde)
      .where('fechaPago', '<=', fechaHasta)
      .get();
    
    console.log('🔍 Consultando movimientos caja chica...');
    const movimientosChicaSnap = await db.collection('movimientos_cajas_chicas')
      .where('fecha', '>=', fechaDesde)
      .where('fecha', '<=', fechaHasta)
      .get();
    
    // Procesar datos
    const facturas = [];
    facturasSnap.forEach(doc => {
      facturas.push({ id: doc.id, ...doc.data() });
    });
    
    const pagosDeuda = [];
    pagosDeudaSnap.forEach(doc => {
      pagosDeuda.push({ id: doc.id, ...doc.data() });
    });
    
    const movimientosChica = [];
    movimientosChicaSnap.forEach(doc => {
      movimientosChica.push({ id: doc.id, ...doc.data() });
    });
    
    // Calcular totales
    const totalVentas = facturas.reduce((sum, f) => sum + (f.total || 0), 0);
    const totalPagosDeuda = pagosDeuda.reduce((sum, p) => sum + (p.montoPagado || 0), 0);
    
    const egresos = movimientosChica.filter(m => m.tipo === 'EGRESO');
    const totalEgresos = egresos.reduce((sum, e) => sum + (e.monto || 0), 0);
    
    const ingresos = movimientosChica.filter(m => m.tipo === 'INGRESO');
    const totalIngresos = ingresos.reduce((sum, i) => sum + (i.monto || 0), 0);
    
    // Agrupar por método de pago
    const totalesPorMetodo = {};
    facturas.forEach(f => {
      const metodo = f.metodoPago || 'Sin Método';
      totalesPorMetodo[metodo] = (totalesPorMetodo[metodo] || 0) + f.total;
    });
    
    // Calcular venta por día (opcional)
    const ventaPorDia = {};
    facturas.forEach(f => {
      const fecha = f.fecha.toDate ? f.fecha.toDate() : new Date(f.fecha);
      const dia = fecha.getDate();
      ventaPorDia[dia] = (ventaPorDia[dia] || 0) + f.total;
    });
    
    // Crear documento de resumen
    const resumenId = `${año}-${String(mes).padStart(2, '0')}`;
    const resumenData = {
      año,
      mes,
      totalVentas,
      totalPagosDeuda,
      totalEgresos,
      totalIngresos,
      totalesPorMetodo,
      cantidadFacturas: facturas.length,
      cantidadPagosDeuda: pagosDeuda.length,
      cantidadEgresos: egresos.length,
      cantidadIngresos: ingresos.length,
      fechaGeneracion: admin.firestore.FieldValue.serverTimestamp(),
      rangoDesde: fechaDesde,
      rangoHasta: fechaHasta,
      ventaPorDia // Estadística adicional
    };
    
    // Guardar en Firestore
    await db.collection('resumenes').doc(resumenId).set(resumenData, { merge: true });
    
    console.log('✅ Resumen generado exitosamente:');
    console.log(`   - Total Ventas: $${totalVentas.toFixed(2)} (${facturas.length} facturas)`);
    console.log(`   - Total Pagos Deuda: $${totalPagosDeuda.toFixed(2)} (${pagosDeuda.length} pagos)`);
    console.log(`   - Total Egresos: $${totalEgresos.toFixed(2)} (${egresos.length} egresos)`);
    console.log(`   - Total Ingresos: $${totalIngresos.toFixed(2)} (${ingresos.length} ingresos)`);
    console.log(`   - Totales por método:`, totalesPorMetodo);
    
    return resumenData;
    
  } catch (error) {
    console.error(`❌ Error generando resumen para ${año}-${mes}:`, error);
    throw error;
  }
}

/**
 * Genera resúmenes para un rango de meses
 */
async function generarResumenesRango(añoInicio, mesInicio, añoFin, mesFin) {
  console.log('🚀 Iniciando generación de resúmenes...');
  console.log(`📅 Rango: ${añoInicio}-${mesInicio} hasta ${añoFin}-${mesFin}`);
  
  let año = añoInicio;
  let mes = mesInicio;
  const resumenes = [];
  
  while (año < añoFin || (año === añoFin && mes <= mesFin)) {
    try {
      const resumen = await generarResumenMensual(año, mes);
      resumenes.push(resumen);
      
      // Avanzar al siguiente mes
      mes++;
      if (mes > 12) {
        mes = 1;
        año++;
      }
      
      // Pequeña pausa para no saturar Firestore
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`⚠️ Error en ${año}-${mes}, continuando...`);
    }
  }
  
  console.log(`\n✅ Generación completada. Total de resúmenes: ${resumenes.length}`);
  return resumenes;
}

/**
 * Generar resumen del mes anterior (útil para ejecución automática mensual)
 */
async function generarResumenMesAnterior() {
  const hoy = new Date();
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  
  const año = mesAnterior.getFullYear();
  const mes = mesAnterior.getMonth() + 1;
  
  console.log('📊 Generando resumen del mes anterior...');
  return await generarResumenMensual(año, mes);
}

/**
 * Generar resumen del mes actual (útil para dashboards en tiempo real)
 */
async function generarResumenMesActual() {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  
  console.log('📊 Generando resumen del mes actual...');
  return await generarResumenMensual(año, mes);
}

// ========== EJECUCIÓN DEL SCRIPT ==========

/**
 * Configurar aquí qué resúmenes generar
 */
async function main() {
  console.log('🔧 Script de Generación de Resúmenes Mensuales');
  console.log('================================================\n');
  
  // Opción 1: Generar resumen del mes anterior
  // await generarResumenMesAnterior();
  
  // Opción 2: Generar resumen del mes actual
  // await generarResumenMesActual();
  
  // Opción 3: Generar resúmenes para un rango de meses
  // Ejemplo: Generar resúmenes desde enero 2024 hasta diciembre 2024
  await generarResumenesRango(2024, 1, 2024, 12);
  
  // Opción 4: Generar solo un mes específico
  // await generarResumenMensual(2024, 11); // Noviembre 2024
  
  console.log('\n✅ Script finalizado exitosamente!');
  process.exit(0);
}

// Ejecutar script
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

/**
 * 📝 NOTAS DE USO:
 * 
 * 1. **Ejecución manual:**
 *    ```bash
 *    node generar-resumenes-mensuales.js
 *    ```
 * 
 * 2. **Programar ejecución automática (Cloud Functions):**
 *    ```javascript
 *    exports.generarResumenMensual = functions.pubsub
 *      .schedule('0 0 1 * *') // Primer día de cada mes a medianoche
 *      .onRun(async (context) => {
 *        await generarResumenMesAnterior();
 *      });
 *    ```
 * 
 * 3. **Índices necesarios en Firestore:**
 *    - facturas: fecha (ASC)
 *    - facturas_deudas: fechaPago (ASC)
 *    - movimientos_cajas_chicas: fecha (ASC), tipo (ASC)
 * 
 * 4. **Verificar resúmenes generados:**
 *    - Ir a Firestore Console
 *    - Buscar colección 'resumenes'
 *    - Verificar documentos con ID formato 'YYYY-MM'
 */
