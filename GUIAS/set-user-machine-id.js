/**
 * Script para configurar Machine ID y Sucursal en usuarios de Firebase
 *
 * Este script permite asignar el machine ID y sucursal a un usuario específico
 * en la base de datos de Firebase Firestore.
 *
 * Uso:
 * node set-user-machine-id.js <email-usuario> <machine-id> [sucursal]
 *
 * Ejemplos:
 * node set-user-machine-id.js admin@optica.com 858744ddedd2fca1 PASAJE
 * node set-user-machine-id.js operador@optica.com abc123def456 CENTRO
 */

const admin = require('firebase-admin');
const os = require('os');
const crypto = require('crypto');

// ⚠️ IMPORTANTE: Necesitas el archivo de credenciales de Firebase Admin
// Descárgalo desde: Firebase Console > Project Settings > Service Accounts
const serviceAccount = require('./firebase-admin-key.json');

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Genera el mismo ID de máquina que en main.js
 */
function generarIdMaquina() {
    const hostname = os.hostname();
    const platform = os.platform();
    const cpus = os.cpus()[0].model;
    const machineInfo = `${hostname}-${platform}-${cpus}`;
    return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
}

/**
 * Buscar usuario por email
 */
async function buscarUsuarioPorEmail(email) {
    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef.where('email', '==', email).get();

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

/**
 * Actualizar machine ID y sucursal del usuario
 */
async function configurarUsuario(email, machineId, sucursal = 'PASAJE') {
    try {
        console.log('\n🔍 Buscando usuario:', email);

        const usuario = await buscarUsuarioPorEmail(email);

        if (!usuario) {
            console.error('❌ Error: Usuario no encontrado');
            return;
        }

        console.log('✅ Usuario encontrado:', usuario.nombre);
        console.log('📋 Datos actuales:');
        console.log('  - Sucursal:', usuario.sucursal || '(sin asignar)');
        console.log('  - Machine ID:', usuario.machineId || '(sin asignar)');

        // Actualizar datos
        await db.collection('usuarios').doc(usuario.id).update({
            machineId: machineId,
            sucursal: sucursal,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('\n✅ Usuario actualizado correctamente:');
        console.log('  - Sucursal:', sucursal);
        console.log('  - Machine ID:', machineId);
        console.log(
            '\n⚠️  IMPORTANTE: Este usuario solo podrá iniciar sesión desde la PC con este Machine ID'
        );
    } catch (error) {
        console.error('❌ Error al configurar usuario:', error.message);
    } finally {
        // Cerrar la conexión
        await admin.app().delete();
    }
}

// Main
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('\n❌ Uso incorrecto\n');
        console.log('Uso:');
        console.log('  node set-user-machine-id.js <email> <machine-id> [sucursal]\n');
        console.log('Ejemplos:');
        console.log('  node set-user-machine-id.js admin@optica.com 858744ddedd2fca1 PASAJE');
        console.log('  node set-user-machine-id.js operador@optica.com abc123def456 CENTRO\n');
        console.log('💡 Para obtener el Machine ID de esta PC, ejecuta:');
        console.log('  node get-machine-id.js\n');
        console.log('📋 Machine ID de esta PC:', generarIdMaquina(), '\n');
        process.exit(1);
    }

    const email = args[0];
    const machineId = args[1];
    const sucursal = args[2] || 'PASAJE';

    await configurarUsuario(email, machineId, sucursal);
}

main();