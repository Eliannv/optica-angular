/**
 * Script de administrador para cambiar la contraseña de un usuario en Firebase Auth
 * Uso:
 *   node admin-change-password.js <UID|email> <nuevaPassword>
 * Requiere: archivo de credenciales de servicio (JSON) y variables de entorno.
 */

const admin = require('firebase-admin');
const path = require('path');

// Cargar credenciales desde ruta ENV o por defecto ./serviceAccountKey.json
const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT || path.join(__dirname, 'serviceAccountKey.json');
try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
} catch (e) {
    console.error('No se pudo cargar el archivo de credenciales:', serviceAccountPath);
    console.error('Configura FIREBASE_SERVICE_ACCOUNT o coloca serviceAccountKey.json en la raíz.');
    process.exit(1);
}

async function main() {
    const target = process.argv[2];
    const newPassword = process.argv[3];

    if (!target || !newPassword) {
        console.error('Uso: node admin-change-password.js <UID|email> <nuevaPassword>');
        process.exit(1);
    }

    let uid = target;
    // Si se pasó un correo, obtener UID
    if (target.includes('@')) {
        const userRecord = await admin.auth().getUserByEmail(target);
        uid = userRecord.uid;
    }

    await admin.auth().updateUser(uid, { password: newPassword });
    console.log('Contraseña actualizada exitosamente para UID:', uid);
}

main().catch((err) => {
    console.error('Error al actualizar contraseña:', err.message);
    process.exit(1);
});