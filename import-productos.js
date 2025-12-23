import admin from "firebase-admin";
import fs from "fs";

// 🔐 CREDENCIAL FIREBASE
admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
});

const db = admin.firestore();

// 📄 JSON de productos
const productos = JSON.parse(fs.readFileSync("./productosOptica.json", "utf8"));

async function importar() {
  console.log(`Importando ${productos.length} productos...`);

  for (const p of productos) {
    await db.collection("productos").add({
      codigo: p.codigo,
      nombre: p.nombre,
      modelo: p.modelo,
      color: p.color,
      grupo: p.grupo,
      proveedor: p.proveedor,
      costo: Number(p.costo) || 0,
      pvp1: Number(p.pvp1) || 0,
      stock: Number(p.stock) || 0,
      idInterno: Number(p.idInterno) || 0,
      observacion: p.observacion || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log("✅ Importación de productos completada");
  process.exit();
}

importar().catch(console.error);
