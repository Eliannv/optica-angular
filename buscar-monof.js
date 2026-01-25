/**
 * Script para buscar y verificar el producto "MONOF BALCO TERMINADO"
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function buscarProducto() {
  console.log('🔍 Buscando producto "MONOF BALCO TERMINADO"...\n');

  try {
    const productosRef = db.collection('productos');
    const snapshot = await productosRef.get();

    const resultados = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const nombre = (data.nombre || '').toLowerCase();
      
      if (nombre.includes('monof') || nombre.includes('balco')) {
        resultados.push({
          id: doc.id,
          ...data
        });
      }
    });

    if (resultados.length === 0) {
      console.log('❌ No se encontró ningún producto con "MONOF" o "BALCO" en el nombre.');
    } else {
      console.log(`✅ Se encontraron ${resultados.length} producto(s):\n`);
      
      resultados.forEach((prod, idx) => {
        console.log(`━━━ Producto ${idx + 1} ━━━`);
        console.log(`ID: ${prod.id}`);
        console.log(`Nombre: ${prod.nombre}`);
        console.log(`Grupo: ${prod.grupo || 'N/A'}`);
        console.log(`Stock: ${prod.stock !== undefined ? prod.stock : 'N/A'}`);
        console.log(`tipo_control_stock: ${prod.tipo_control_stock || 'undefined'}`);
        console.log(`stockIlimitado: ${prod.stockIlimitado || 'undefined'}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('❌ Error durante la búsqueda:', error);
    throw error;
  }
}

buscarProducto()
  .then(() => {
    console.log('🎉 Búsqueda completada.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
