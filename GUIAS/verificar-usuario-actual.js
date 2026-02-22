/**
 * Verificar Usuario Actual - Estado de Autenticación y Permisos
 * 
 * Ejecuta este código en la consola del navegador (DevTools) cuando estés
 * logueado en la aplicación para verificar el estado de tu usuario.
 */

// 1. Verificar autenticación de Firebase Auth
console.log('=== AUTENTICACIÓN ===');
const auth = getAuth();
const currentUser = auth.currentUser;
if (currentUser) {
  console.log('✅ Usuario autenticado:');
  console.log('  UID:', currentUser.uid);
  console.log('  Email:', currentUser.email);
} else {
  console.log('❌ No hay usuario autenticado');
}

// 2. Verificar documento en Firestore
console.log('\n=== DOCUMENTO FIRESTORE ===');
if (currentUser) {
  const firestore = getFirestore();
  const userDocRef = doc(firestore, 'usuarios', currentUser.uid);
  
  getDoc(userDocRef).then((docSnap) => {
    if (docSnap.exists()) {
      const userData = docSnap.data();
      console.log('✅ Documento encontrado:');
      console.log('  Nombre:', userData.nombre);
      console.log('  Email:', userData.email);
      console.log('  Rol:', userData.rol, getRolTexto(userData.rol));
      console.log('  Sucursal:', userData.sucursal || '❌ NO ASIGNADA');
      console.log('  Activo:', userData.activo);
      console.log('  Created At:', userData.createdAt);
      
      console.log('\n=== VALIDACIÓN DE PERMISOS ===');
      const isAdmin = userData.rol === 1;
      const hasSucursal = userData.sucursal != null && userData.sucursal !== '';
      const isActive = userData.activo === true;
      const isAuthorizedOperator = hasSucursal && isActive;
      
      console.log('  Es Admin:', isAdmin ? '✅ SÍ' : '❌ NO');
      console.log('  Tiene Sucursal Válida:', hasSucursal ? '✅ SÍ' : '❌ NO');
      console.log('  Está Activo:', isActive ? '✅ SÍ' : '❌ NO');
      console.log('  Es Operador Autorizado:', isAuthorizedOperator ? '✅ SÍ' : '❌ NO');
      
      if (isAdmin || isAuthorizedOperator) {
        console.log('\n✅ USUARIO TIENE PERMISOS PARA LEER MÉTRICAS');
      } else {
        console.log('\n❌ USUARIO NO TIENE PERMISOS SUFICIENTES');
        console.log('Solución:');
        if (!hasSucursal) console.log('  - Asignar sucursal al usuario');
        if (!isActive) console.log('  - Activar al usuario (activo: true)');
      }
    } else {
      console.log('❌ Documento de usuario no existe en Firestore');
    }
  }).catch((error) => {
    console.error('Error obteniendo documento:', error);
  });
}

function getRolTexto(rol) {
  switch(rol) {
    case 1: return '(ADMINISTRADOR)';
    case 2: return '(VENDEDOR)';
    case 3: return '(OPERADOR)';
    default: return '(DESCONOCIDO)';
  }
}
