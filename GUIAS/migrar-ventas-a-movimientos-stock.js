/**
 * ============================================================
 * SCRIPT DE MIGRACIÓN: Facturas → movimientos_stock (VENTA)
 * ============================================================
 *
 * PROPÓSITO:
 * Procesa todas las facturas históricas y crea documentos en
 * movimientos_stock de tipo "VENTA" para cada ítem vendido
 * que sea un producto físico (esServicio !== true).
 *
 * LÓGICA DE STOCK:
 * - Solo productos con tipo_control_stock = 'NORMAL' generan
 *   cambio de stock. Los ILIMITADO registran stockAnterior/stockNuevo = 0.
 * - Se procesa en orden descendente para calcular stockAnterior y stockNuevo
 *   correctamente: partimos del stock real actual y trabajamos hacia atrás.
 * - Al finalizar, se actualiza producto.stock con el valor real
 *   (ingresos acumulados - ventas acumuladas).
 *
 * IDEMPOTENTE:
 * - Lee todos los movimientos VENTA existentes y omite los que ya
 *   tienen el par (facturaId + productoId) registrado.
 * - Puede ejecutarse varias veces sin duplicar datos.
 *
 * NO modifica ni elimina movimientos existentes de tipo INGRESO.
 *
 * EJECUCIÓN:
 *   node GUIAS/migrar-ventas-a-movimientos-stock.js
 *
 * REQUISITOS:
 *   - serviceAccountKey.json en la raíz del proyecto
 *   - firebase-admin instalado (npm install firebase-admin)
 *
 * AUTOR: Migración Kardex v1.0
 * FECHA: 26 de febrero de 2026
 */

'use strict';

const admin = require('firebase-admin');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const BATCH_SIZE = 400; // Límite seguro por debajo de 500 (límite Firestore)
const DRY_RUN = false;  // Cambiar a true para simular sin escribir nada

admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un Firestore Timestamp (o Date) a un objeto Date JavaScript.
 */
function toDate(fecha) {
  if (!fecha) return new Date();
  if (fecha instanceof Date) return fecha;
  if (typeof fecha.toDate === 'function') return fecha.toDate();
  if (fecha._seconds !== undefined) return new Date(fecha._seconds * 1000);
  if (fecha.seconds !== undefined) return new Date(fecha.seconds * 1000);
  return new Date(fecha);
}

/**
 * Convierte cualquier fecha al Timestamp de Firestore Admin.
 */
function toTimestamp(fecha) {
  return admin.firestore.Timestamp.fromDate(toDate(fecha));
}

/**
 * Escribe un array de documentos {ref, data} en lotes de BATCH_SIZE.
 * Retorna la cantidad de documentos escritos.
 */
async function commitEnLotes(operaciones) {
  let escritos = 0;
  for (let i = 0; i < operaciones.length; i += BATCH_SIZE) {
    const lote = operaciones.slice(i, i + BATCH_SIZE);
    if (!DRY_RUN) {
      const batch = db.batch();
      lote.forEach(({ ref, data }) => batch.set(ref, data));
      await batch.commit();
    }
    escritos += lote.length;
    console.log(`  ✅ Escritos ${escritos} / ${operaciones.length} movimientos...`);
  }
  return escritos;
}

/**
 * Actualiza producto.stock en lotes.
 */
async function actualizarStocksEnLotes(actualizaciones) {
  let actualizados = 0;
  for (let i = 0; i < actualizaciones.length; i += BATCH_SIZE) {
    const lote = actualizaciones.slice(i, i + BATCH_SIZE);
    if (!DRY_RUN) {
      const batch = db.batch();
      lote.forEach(({ ref, stock }) => {
        batch.update(ref, { stock, updatedAt: new Date() });
      });
      await batch.commit();
    }
    actualizados += lote.length;
  }
  return actualizados;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function migrar() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MIGRACIÓN: facturas → movimientos_stock (VENTA)');
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY RUN (solo lectura)' : '✍️  ESCRITURA REAL'}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // ── 1. Cargar productos ─────────────────────────────────────────────────
  console.log('📦 Cargando productos...');
  const productosSnap = await db.collection('productos').get();

  /** @type {Map<string, {stock: number, tipoControl: string, costo: number, nombre: string, grupo: string, idInterno: number|null, ref: FirebaseFirestore.DocumentReference}>} */
  const productos = new Map();
  productosSnap.forEach(doc => {
    const d = doc.data();
    productos.set(doc.id, {
      stock: d.stock ?? 0,
      tipoControl: d.tipo_control_stock ?? 'NORMAL',
      costo: d.costo ?? 0,
      nombre: d.nombre ?? '',
      grupo: d.grupo ?? '',
      idInterno: d.idInterno ?? null,
      ref: doc.ref
    });
  });
  console.log(`  → ${productos.size} productos cargados.`);

  // ── 2. Cargar movimientos VENTA existentes (para no duplicar) ───────────
  console.log('📋 Cargando movimientos VENTA existentes...');
  const movExistentesSnap = await db.collection('movimientos_stock')
    .where('tipo', '==', 'VENTA')
    .get();

  /** @type {Set<string>} Claves "facturaId_productoId" ya registradas */
  const movExistentesSet = new Set();
  movExistentesSnap.forEach(doc => {
    const d = doc.data();
    if (d.facturaId && d.productoId) {
      // Puede haber varios movimientos por (facturaId, productoId) si se ajustó;
      // usamos la clave para detectar si la factura ya fue migrada
      movExistentesSet.add(`${d.facturaId}_${d.productoId}`);
    }
  });
  console.log(`  → ${movExistentesSet.size} pares factura/producto ya migrados.`);

  // ── 3. Cargar facturas ordenadas por fecha ascendente ───────────────────
  console.log('🧾 Cargando facturas...');
  const facturasSnap = await db.collection('facturas')
    .orderBy('fecha', 'asc')
    .get();

  const facturas = [];
  facturasSnap.forEach(doc => {
    facturas.push({ id: doc.id, ...doc.data() });
  });
  console.log(`  → ${facturas.length} facturas cargadas.`);

  // ── 4. Primera pasada: acumular total vendido por producto (NORMAL) ─────
  console.log('🔢 Calculando stock real por producto...');

  /** @type {Map<string, number>} Total de unidades vendidas por producto */
  const totalVendido = new Map();

  for (const factura of facturas) {
    const items = factura.items ?? [];
    for (const item of items) {
      if (item.esServicio === true) continue;
      if (!item.productoId) continue;
      const prod = productos.get(item.productoId);
      if (!prod || prod.tipoControl !== 'NORMAL') continue;
      totalVendido.set(
        item.productoId,
        (totalVendido.get(item.productoId) ?? 0) + (item.cantidad ?? 0)
      );
    }
  }

  /**
   * Stock REAL actual para cada producto NORMAL:
   * trueStock = stock almacenado (solo ingresos) - total vendido en facturas
   * Usamos Math.max(0, ...) para evitar negativos por datos inconsistentes.
   *
   * @type {Map<string, number>}
   */
  const trueCurrentStock = new Map();
  totalVendido.forEach((vendido, productoId) => {
    const prod = productos.get(productoId);
    const stockActual = prod ? prod.stock : 0;
    trueCurrentStock.set(productoId, Math.max(0, stockActual - vendido));
  });

  // ── 5. Segunda pasada: calcular stockAnterior/stockNuevo históricos ──────
  // Procesamos en orden DESCENDENTE (de más nueva a más antigua) para poder
  // trabajar "hacia atrás" desde el stock real actual.
  console.log('📈 Calculando valores históricos de Kardex...');

  /**
   * Stock "actual" mientras procesamos hacia atrás.
   * Empieza en trueCurrentStock y va sumando las cantidades vendidas.
   * @type {Map<string, number>}
   */
  const running = new Map(trueCurrentStock);

  /**
   * Registros de movimientos a crear.
   * @type {Array<{facturaId: string, productoId: string, stockAnterior: number, stockNuevo: number, item: any, factura: any}>}
   */
  const movimientosACrear = [];

  // Recorremos en orden descendente
  for (let i = facturas.length - 1; i >= 0; i--) {
    const factura = facturas[i];
    const items = factura.items ?? [];

    for (const item of items) {
      if (item.esServicio === true) continue;
      if (!item.productoId) continue;

      const prod = productos.get(item.productoId);
      const tipoControl = prod ? prod.tipoControl : 'NORMAL';
      const clave = `${factura.id}_${item.productoId}`;

      // Omitir si ya existe movimiento para este par
      if (movExistentesSet.has(clave)) continue;

      let stockAnterior = 0;
      let stockNuevo = 0;

      if (tipoControl === 'NORMAL') {
        // stockNuevo es el running actual (saldo después de esta venta)
        stockNuevo = running.get(item.productoId) ?? 0;
        // stockAnterior es stockNuevo + lo que se vendió (antes de esta venta)
        stockAnterior = stockNuevo + (item.cantidad ?? 0);
        // Retroceder: el stock antes de esta venta es stockAnterior
        running.set(item.productoId, stockAnterior);
      }
      // ILIMITADO: stockAnterior = 0, stockNuevo = 0 (sin cambio real)

      movimientosACrear.push({ factura, item, stockAnterior, stockNuevo, tipoControl });
    }
  }

  console.log(`  → ${movimientosACrear.length} movimientos pendientes de crear.`);

  if (movimientosACrear.length === 0) {
    console.log('');
    console.log('✅ No hay movimientos nuevos que crear. La base de datos ya está al día.');
    return;
  }

  // ── 6. Preparar operaciones de escritura (movimientos_stock) ─────────────
  console.log('💾 Preparando documentos de movimientos_stock...');

  const operaciones = movimientosACrear.map(({ factura, item, stockAnterior, stockNuevo }) => {
    const ref = db.collection('movimientos_stock').doc(); // auto-ID
    const prod = productos.get(item.productoId);

    const data = {
      productoId: item.productoId,
      productoNombre: prod?.nombre ?? item.nombre ?? '',
      grupoProducto: prod?.grupo ?? item.tipo ?? '',
      sucursalId: factura.sucursalId || 'PASJO01',
      tipo: 'VENTA',
      cantidad: item.cantidad ?? 0,
      costoUnitario: prod?.costo ?? 0,
      precioVenta: item.precioUnitario ?? 0,
      stockAnterior,
      stockNuevo,
      referenciaId: factura.id,
      referenciaTipo: (factura.metodoPago ?? '').toUpperCase(),
      usuarioId: factura.usuarioId ?? '',
      createdAt: toTimestamp(factura.fecha),
    };

    return { ref, data };
  });

  // ── 7. Escribir movimientos en lotes ─────────────────────────────────────
  console.log('');
  console.log(`💾 Escribiendo ${operaciones.length} movimientos en lotes de ${BATCH_SIZE}...`);
  const escritos = await commitEnLotes(operaciones);

  // ── 8. Actualizar producto.stock al valor real ────────────────────────────
  console.log('');
  console.log('🔄 Actualizando producto.stock con valores reales...');

  const actualizaciones = [];
  trueCurrentStock.forEach((stock, productoId) => {
    const prod = productos.get(productoId);
    if (prod && prod.tipoControl === 'NORMAL') {
      actualizaciones.push({ ref: prod.ref, stock });
    }
  });

  const actualizados = await actualizarStocksEnLotes(actualizaciones);

  // ── 9. Resumen ────────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RESUMEN DE MIGRACIÓN');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Facturas procesadas:          ${facturas.length}`);
  console.log(`  Movimientos ya existentes:    ${movExistentesSet.size}`);
  console.log(`  Movimientos creados:          ${escritos}`);
  console.log(`  Productos con stock corregido: ${actualizados}`);
  if (DRY_RUN) {
    console.log('');
    console.log('  ⚠️  DRY RUN: Ningún dato fue modificado en Firestore.');
    console.log('  Para ejecutar en producción establece DRY_RUN = false.');
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────────────────────

migrar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error durante la migración:', err);
    process.exit(1);
  });
