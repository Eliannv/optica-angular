// 🔐 CONFIGURACIÓN DE AUTENTICACIÓN CON CUSTOM CLAIMS
// Este archivo es solo de referencia - NO lo uses en producción directamente

/**
 * PASO 1: Configurar Custom Claims en Firebase
 *
 * Debes ejecutar esto en Firebase Functions o con el Admin SDK
 * para asignar la sucursal "PASAJE" a los usuarios autorizados
 */

// Ejemplo usando Firebase Admin SDK (Node.js)
const admin = require('firebase-admin');

// Inicializar Admin SDK (solo una vez)
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

/**
 * Función para asignar sucursal a un usuario
 */
async function asignarSucursalAUsuario(uid, sucursal) {
  try {
    await admin.auth().setCustomUserClaims(uid, { sucursal: sucursal });
    console.log(`✅ Sucursal "${sucursal}" asignada al usuario ${uid}`);
  } catch (error) {
    console.error('❌ Error asignando sucursal:', error);
  }
}

/**
 * EJEMPLO DE USO:
 *
 * 1. Obtén el UID del usuario desde Firebase Console → Authentication
 * 2. Ejecuta esta función con el UID y la sucursal:
 */
// asignarSucursalAUsuario('UID-DEL-USUARIO-AQUI', 'PASAJE');

/**
 * PASO 2: Verificar en la aplicación Angular
 *
 * En tu AuthService, después del login, verifica el token:
 */
/*
async verificarSucursal() {
  const user = await this.auth.currentUser;
  if (user) {
    const tokenResult = await user.getIdTokenResult();
    const sucursal = tokenResult.claims['sucursal'];
    
    if (sucursal !== 'PASAJE') {
      console.error('❌ Usuario no autorizado para esta sucursal');
      await this.auth.signOut();
      throw new Error('Acceso denegado - sucursal no autorizada');
    }
    
    console.log('✅ Usuario autorizado para sucursal:', sucursal);
    return sucursal;
  }
}
*/

/**
 * PASO 3: Reforzar en el login
 *
 * Modifica tu método de login para verificar la sucursal:
 */
/*
async login(email: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    
    // Verificar sucursal
    const tokenResult = await credential.user.getIdTokenResult();
    const sucursal = tokenResult.claims['sucursal'];
    
    if (!sucursal || sucursal !== 'PASAJE') {
      await this.auth.signOut();
      throw new Error('Usuario no autorizado para la sucursal PASAJE');
    }
    
    return credential.user;
  } catch (error) {
    console.error('Error en login:', error);
    throw error;
  }
}
*/

/**
 * ALTERNATIVA: Usar Cloud Functions
 *
 * Crea una función que asigne automáticamente la sucursal al crear usuarios:
 */
/*
// En Firebase Functions (functions/index.js)
exports.asignarSucursalNuevoUsuario = functions.auth.user().onCreate(async (user) => {
  // Solo si el email contiene "pasaje" o según tu lógica
  if (user.email && user.email.includes('pasaje')) {
    await admin.auth().setCustomUserClaims(user.uid, { 
      sucursal: 'PASAJE' 
    });
  }
});
*/

module.exports = { asignarSucursalAUsuario };
