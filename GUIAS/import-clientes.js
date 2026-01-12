import admin from "firebase-admin";
import fs from "fs";

// 🔐 CREDENCIAL FIREBASE
admin.initializeApp({
    credential: admin.credential.cert("./serviceAccountKey.json")
});

const db = admin.firestore();

// 📄 JSON exportado
const clientes = JSON.parse(
    fs.readFileSync("./clientesOptica.json", "utf8")
);

async function importar() {
    console.log(`Importando ${clientes.length} clientes...`);

    for (const c of clientes) {
        if (!c.cedula) continue;

        await db.collection("clientes").add({
            nombres: c.nombres ?? "",
            apellidos: c.apellidos ?? "",
            cedula: c.cedula ?? "",
            telefono: c.telefono ?? "",
            email: c.email ?? "",
            direccion: c.direccion ?? "",
            ciudad: c.ciudad ?? "",
            provincia: c.provincia ?? "",
            pais: c.pais ?? "Ecuador",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    console.log("✅ Importación de clientes completada");
    process.exit();
}

importar().catch(console.error);