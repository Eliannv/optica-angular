import admin from "firebase-admin";

// 🔐 CREDENCIAL FIREBASE
admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
});

const db = admin.firestore();

/**
 * ✅ Script para agregar idInterno a productos que no lo tienen
 * Lee todos los productos y asigna un idInterno secuencial
 */
async function agregarIdInterno() {
  console.log("🔄 Iniciando migración de idInterno...");

  try {
    // 1. Obtener todos los productos
    const snapshot = await db.collection("productos").get();
    
    if (snapshot.empty) {
      console.log("❌ No hay productos en la base de datos");
      process.exit();
    }

    console.log(`📦 Total de productos: ${snapshot.size}`);

    // 2. Separar productos con y sin idInterno
    const conIdInterno = [];
    const sinIdInterno = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.idInterno !== undefined && data.idInterno !== null) {
        conIdInterno.push({ id: doc.id, ...data });
      } else {
        sinIdInterno.push({ id: doc.id, ...data });
      }
    });

    console.log(`✅ Productos con idInterno: ${conIdInterno.length}`);
    console.log(`❌ Productos sin idInterno: ${sinIdInterno.length}`);

    if (sinIdInterno.length === 0) {
      console.log("✨ Todos los productos ya tienen idInterno");
      process.exit();
    }

    // 3. Encontrar el máximo idInterno existente
    let idMaximo = 0;
    conIdInterno.forEach((p) => {
      if (p.idInterno > idMaximo) {
        idMaximo = p.idInterno;
      }
    });

    console.log(`📊 ID máximo existente: ${idMaximo}`);

    // 4. Asignar nuevos idInterno a los productos que no tienen
    let idProximo = idMaximo + 1;
    const batch = db.batch();
    let procesados = 0;

    sinIdInterno.forEach((producto) => {
      const ref = db.collection("productos").doc(producto.id);
      batch.update(ref, {
        idInterno: idProximo,
        updatedAt: new Date(),
      });
      console.log(`✅ [${procesados + 1}/${sinIdInterno.length}] "${producto.nombre}" → idInterno: ${idProximo}`);
      idProximo++;
      procesados++;

      // Firebase permite máximo 500 operaciones por batch
      if (procesados % 500 === 0) {
        batch.commit().then(() => {
          console.log(`💾 Batch guardado (${procesados} productos)`);
        });
      }
    });

    // Guardar el último batch
    if (procesados % 500 !== 0) {
      await batch.commit();
      console.log(`💾 Batch final guardado (${procesados} productos)`);
    }

    console.log(`\n✨ Migración completada exitosamente`);
    console.log(`📝 Productos actualizados: ${sinIdInterno.length}`);
    process.exit();
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    process.exit(1);
  }
}

agregarIdInterno();
