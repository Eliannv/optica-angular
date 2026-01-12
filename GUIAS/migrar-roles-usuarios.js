/**
 * Script para migrar usuarios existentes al nuevo sistema de roles
 *
 * Convierte:
 * - 'admin' -> RolUsuario.ADMINISTRADOR (1)
 * - 'empleado' -> RolUsuario.OPERADOR (2)
 *
 * IMPORTANTE: Ejecutar solo una vez después de desplegar la actualización
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Enum de roles (debe coincidir con usuario.model.ts)
const RolUsuario = {
  ADMINISTRADOR: 1,
  OPERADOR: 2,
};

async function migrarRolesUsuarios() {
  try {
    console.log('🚀 Iniciando migración de roles de usuarios...\n');

    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef.get();

    if (snapshot.empty) {
      console.log('⚠️  No se encontraron usuarios para migrar.');
      return;
    }

    console.log(`📊 Total de usuarios encontrados: ${snapshot.size}\n`);

    let migradosAdmin = 0;
    let migradosOperador = 0;
    let yaMigrados = 0;
    let errores = 0;

    const batch = db.batch();

    snapshot.forEach((doc) => {
      const usuario = doc.data();
      const uid = doc.id;

      // Si ya tiene un rol numérico, no migrar
      if (typeof usuario.rol === 'number') {
        console.log(`✓ ${usuario.email || uid} - Ya migrado (rol: ${usuario.rol})`);
        yaMigrados++;
        return;
      }

      let nuevoRol;

      // Convertir rol de texto a numérico
      if (usuario.rol === 'admin') {
        nuevoRol = RolUsuario.ADMINISTRADOR;
        migradosAdmin++;
        console.log(`🔄 ${usuario.email || uid} - admin → ADMINISTRADOR (1)`);
      } else if (usuario.rol === 'empleado') {
        nuevoRol = RolUsuario.OPERADOR;
        migradosOperador++;
        console.log(`🔄 ${usuario.email || uid} - empleado → OPERADOR (2)`);
      } else {
        // Rol desconocido, asignar OPERADOR por defecto
        nuevoRol = RolUsuario.OPERADOR;
        migradosOperador++;
        console.log(
          `⚠️  ${usuario.email || uid} - rol desconocido (${usuario.rol}) → OPERADOR (2)`
        );
      }

      // Actualizar en batch
      batch.update(doc.ref, { rol: nuevoRol });
    });

    // Ejecutar todas las actualizaciones
    await batch.commit();

    console.log('\n✅ Migración completada exitosamente!\n');
    console.log('📈 Resumen:');
    console.log(`   - Migrados a ADMINISTRADOR (1): ${migradosAdmin}`);
    console.log(`   - Migrados a OPERADOR (2): ${migradosOperador}`);
    console.log(`   - Ya migrados previamente: ${yaMigrados}`);
    console.log(`   - Errores: ${errores}`);
    console.log(`   - Total procesados: ${snapshot.size}\n`);
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    // Cerrar conexión
    admin.app().delete();
  }
}

// Ejecutar migración
migrarRolesUsuarios();
