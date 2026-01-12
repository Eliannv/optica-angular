/**
 * Script para crear usuarios iniciales en Firebase
 *
 * IMPORTANTE: Este script debe ejecutarse desde un entorno Node.js con firebase-admin
 *
 * Pasos:
 * 1. Descarga tu clave privada de Firebase Admin SDK desde la consola de Firebase
 * 2. Guárdala como 'serviceAccountKey.json' en la raíz del proyecto
 * 3. Ejecuta: node crear-usuarios-iniciales.js
 */

const admin = require('firebase-admin');

// Importa tu archivo de credenciales
// Descárgalo desde: Firebase Console > Project Settings > Service Accounts > Generate new private key
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

/**
 * Crear un empleado en Firebase Auth + Firestore
 */
async function crearEmpleado(email, password, nombre, rol = 'empleado') {
  try {
    // 1. Crear usuario en Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: nombre,
    });

    console.log(`✅ Usuario creado en Auth: ${userRecord.uid}`);

    // 2. Crear documento en Firestore
    await db.collection('usuarios').doc(userRecord.uid).set({
      nombre: nombre,
      email: email,
      rol: rol,
      activo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Documento creado en Firestore para: ${nombre} (${email})`);
    console.log('');

    return userRecord.uid;
  } catch (error) {
    console.error(`❌ Error al crear ${email}:`, error.message);
    return null;
  }
}

/**
 * Función principal para crear todos los usuarios iniciales
 */
async function crearUsuariosIniciales() {
  console.log('🚀 Iniciando creación de usuarios para la óptica...\n');

  // ADMINISTRADOR
  await crearEmpleado('admin@optica.com', 'Admin123!', 'Administrador Principal', 'admin');

  // EMPLEADOS DE EJEMPLO
  await crearEmpleado('vendedor1@optica.com', 'Vendedor123!', 'Juan Pérez', 'empleado');

  await crearEmpleado('vendedor2@optica.com', 'Vendedor123!', 'María García', 'empleado');

  await crearEmpleado('optometrista@optica.com', 'Opto123!', 'Dr. Carlos Rodríguez', 'empleado');

  console.log('✅ ¡Proceso completado! Usuarios creados con éxito.');
  console.log('\n📝 Credenciales de acceso:');
  console.log('━'.repeat(60));
  console.log('ADMINISTRADOR:');
  console.log('  Email: admin@optica.com');
  console.log('  Contraseña: Admin123!');
  console.log('━'.repeat(60));
  console.log('VENDEDOR 1:');
  console.log('  Email: vendedor1@optica.com');
  console.log('  Contraseña: Vendedor123!');
  console.log('━'.repeat(60));
  console.log('VENDEDOR 2:');
  console.log('  Email: vendedor2@optica.com');
  console.log('  Contraseña: Vendedor123!');
  console.log('━'.repeat(60));
  console.log('OPTOMETRISTA:');
  console.log('  Email: optometrista@optica.com');
  console.log('  Contraseña: Opto123!');
  console.log('━'.repeat(60));

  process.exit(0);
}

// Ejecutar el script
crearUsuariosIniciales().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
