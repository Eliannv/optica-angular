/**
 * 📦 Script para medir el tamaño real de una colección de Firestore
 * 
 * Uso:
 *   node !! clientes
 *   node !! facturas
 *   node !! productos
 *   node !! cajas_chicas
 */

const admin = require('firebase-admin');
const fs = require('fs');

// 🔐 Credenciales Firebase Admin
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Colección desde consola
const collectionName = process.argv[2];

if (!collectionName) {
    console.log('\n❌ Debes indicar una colección');
    console.log('Ejemplo: node medir-coleccion.js clientes\n');
    process.exit(1);
}

function getSizeKB(obj) {
    const json = JSON.stringify(obj);
    return Buffer.byteLength(json, 'utf8') / 1024;
}

async function medir() {
    console.log(`\n📦 Midiendo peso de la colección: ${collectionName}\n`);

    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
        console.log('⚠️ La colección está vacía');
        process.exit();
    }

    let totalKB = 0;
    let count = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        const size = getSizeKB(data);
        totalKB += size;
        count++;

        console.log(`📄 ${doc.id} → ${size.toFixed(2)} KB`);
    });

    const avg = totalKB / count;

    console.log('\n──────────────────────────────────');
    console.log(`📊 Documentos analizados: ${count}`);
    console.log(`📦 Tamaño total: ${totalKB.toFixed(2)} KB`);
    console.log(`📏 Promedio por documento: ${avg.toFixed(2)} KB`);

    console.log('\n📈 Proyección de almacenamiento:');
    console.log(`10,000 documentos ≈ ${(avg * 10000 / 1024).toFixed(2)} MB`);
    console.log(`100,000 documentos ≈ ${(avg * 100000 / 1024).toFixed(2)} MB`);
    console.log(`1,000,000 documentos ≈ ${(avg * 1000000 / 1024).toFixed(2)} MB`);

    console.log('\n🔥 Plan gratis Firestore = 1024 MB');
    console.log(`💡 Esta colección puede crecer aprox hasta: ${(1024 * 1024 / avg).toFixed(0)} documentos\n`);

    process.exit();
}

medir().catch(err => {
    console.error('❌ Error:', err);
});
