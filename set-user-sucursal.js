// Script para asignar sucursal PASAJE a usuarios de Firebase
// Ejecuta con: node set-user-sucursal.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // ← Descarga esto de Firebase Console

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

/**
 * PASO 1: Descarga la clave de servicio
 *
 * 1. Ve a Firebase Console → Configuración del proyecto (⚙️)
 * 2. Cuentas de servicio
 * 3. "Generar nueva clave privada"
 * 4. Guarda el archivo como "serviceAccountKey.json" en la raíz del proyecto
 */

/**
 * PASO 2: Configura los usuarios que tendrán acceso
 *
 * Agrega los emails o UIDs de los usuarios autorizados:
 */
const USUARIOS_AUTORIZADOS = [
    // Opción 1: Por email
    { email: 'kevin.valarezo.1848@gmail.com' },
];

/**
 * Función principal
 */
async function configurarUsuariosSucursal() {
    console.log('🔐 Configurando usuarios para sucursal PASAJE...\n');

    for (const usuario of USUARIOS_AUTORIZADOS) {
        try {
            let userRecord;

            // Buscar usuario por email o UID
            if (usuario.email) {
                userRecord = await admin.auth().getUserByEmail(usuario.email);
                console.log(`📧 Usuario encontrado: ${usuario.email}`);
            } else if (usuario.uid) {
                userRecord = await admin.auth().getUser(usuario.uid);
                console.log(`🆔 Usuario encontrado: ${usuario.uid}`);
            }

            // Asignar custom claim de sucursal
            await admin.auth().setCustomUserClaims(userRecord.uid, {
                sucursal: 'PASAJE',
            });

            console.log(`✅ Sucursal "PASAJE" asignada a ${userRecord.email || userRecord.uid}`);
            console.log(`   UID: ${userRecord.uid}\n`);
        } catch (error) {
            console.error(`❌ Error con usuario ${usuario.email || usuario.uid}:`, error.message);
            console.log('');
        }
    }

    console.log('✅ Proceso completado!\n');
    console.log(
        '📝 Los usuarios ahora pueden acceder al sistema con las reglas de Firestore configuradas.'
    );
    process.exit(0);
}

// Ejecutar
configurarUsuariosSucursal();