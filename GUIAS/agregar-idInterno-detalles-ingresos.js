import admin from "firebase-admin";

// 🔐 CREDENCIAL FIREBASE
admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
});

const db = admin.firestore();

/**
 * ✅ Script para agregar idInterno a detalles de ingresos que no lo tienen
 * Lee todos los ingresos, obtiene sus detalles, carga el producto y agrega idInterno
 */
async function agregarIdInternoDetalles() {
  console.log("🔄 Iniciando migración de idInterno en detalles de ingresos...");

  try {
    // 1. Obtener todos los ingresos
    const ingresosSnapshot = await db.collection("ingresos").get();

    if (ingresosSnapshot.empty) {
      console.log("❌ No hay ingresos en la base de datos");
      process.exit();
    }

    console.log(`📦 Total de ingresos: ${ingresosSnapshot.size}`);

    let detallesActualizados = 0;
    let detallesYaTenian = 0;
    let detallesNoEncontrados = 0;

    // 2. Para cada ingreso, procesar sus detalles
    for (const ingresoDoc of ingresosSnapshot.docs) {
      const ingresoId = ingresoDoc.id;
      const ingreso = ingresoDoc.data();

      // Obtener detalles del ingreso
      const detallesSnapshot = await db.collection(`ingresos/${ingresoId}/detalles`).get();

      if (detallesSnapshot.empty) {
        console.log(`⏭️  Ingreso ${ingresoId} no tiene detalles`);
        continue;
      }

      console.log(`\n📋 Procesando ingreso ${ingresoId} (${detallesSnapshot.size} detalles)`);

      // 3. Para cada detalle, agregar idInterno si no lo tiene
      for (const detalleDoc of detallesSnapshot.docs) {
        const detalleData = detalleDoc.data();
        const detalleId = detalleDoc.id;

        // Si ya tiene idInterno, saltar
        if (detalleData.idInterno !== undefined && detalleData.idInterno !== null) {
          detallesYaTenian++;
          continue;
        }

        // Si no tiene productoId, no podemos obtener el idInterno
        if (!detalleData.productoId) {
          console.log(`  ❌ Detalle ${detalleId} no tiene productoId, no se puede actualizar`);
          detallesNoEncontrados++;
          continue;
        }

        // Obtener el producto para extraer idInterno
        const productoDoc = await db.collection("productos").doc(detalleData.productoId).get();

        if (!productoDoc.exists) {
          console.log(
            `  ❌ Producto ${detalleData.productoId} del detalle ${detalleId} no existe`
          );
          detallesNoEncontrados++;
          continue;
        }

        const producto = productoDoc.data();
        const idInterno = producto.idInterno;

        if (idInterno === undefined || idInterno === null) {
          console.log(
            `  ❌ Producto ${detalleData.productoId} no tiene idInterno`
          );
          detallesNoEncontrados++;
          continue;
        }

        // Actualizar el detalle con el idInterno
        const detalleRef = db.collection(`ingresos/${ingresoId}/detalles`).doc(detalleId);
        await detalleRef.update({
          idInterno: idInterno,
          updatedAt: new Date(),
        });

        console.log(
          `  ✅ Detalle ${detalleId} actualizado con idInterno: ${idInterno}`
        );
        detallesActualizados++;
      }
    }

    console.log(`\n✨ Migración completada`);
    console.log(`✅ Detalles actualizados: ${detallesActualizados}`);
    console.log(`⏭️  Detalles que ya tenían idInterno: ${detallesYaTenian}`);
    console.log(`❌ Detalles que no se pudieron actualizar: ${detallesNoEncontrados}`);
    process.exit();
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    process.exit(1);
  }
}

agregarIdInternoDetalles();
