import admin from "firebase-admin";
import fs from "fs";

// 🔐 CREDENCIAL FIREBASE
admin.initializeApp({
    credential: admin.credential.cert("./serviceAccountKey.json")
});

const db = admin.firestore();

// 📄 JSON exportado
const proveedores = JSON.parse(
    fs.readFileSync("./proveedoresOptica.json", "utf8")
);

async function importar() {
    console.log(`Importando ${proveedores.length} proveedores...`);

    for (const p of proveedores) {
        if (!p.Cod_Prov) continue;

        await db.collection("proveedores").add({
            codigo: p.Cod_Prov,
            nombre: p.Nom_Prov ?? "",
            representante: p.Rep_Prov ?? "",
            ruc: p.Ruc_Prov ?? "",
            telefonos: {
                principal: p.Tel_Prov ?? "",
                secundario: p.Tel_Prov2 ?? ""
            },
            direccion: {
                codigoLugar: p.Cod_Luga ?? "",
                direccion: p.Dir_Prov ?? ""
            },
            fechaIngreso: p.Fec_Ing ? new Date(p.Fec_Ing) : null,
            saldo: Number(p.Saldo) || 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    console.log("✅ Importación de proveedores completada");
    process.exit();
}

importar().catch(console.error);