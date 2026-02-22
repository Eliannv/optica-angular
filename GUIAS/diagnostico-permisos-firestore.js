/**
 * DIAGNÓSTICO DE PERMISOS DE FIRESTORE
 * 
 * Copia y pega este código en la Consola del navegador (F12 → Console)
 * mientras estás en la aplicación con el módulo de empleados abierto.
 * 
 * Esto te ayudará a identificar exactamente por qué fallan las queries.
 */

(async function diagnosticarPermisos() {
  console.clear();
  console.log('🔍 INICIANDO DIAGNÓSTICO DE PERMISOS\n');
  
  // 1. Verificar Firebase Auth
  console.log('═══ 1. FIREBASE AUTH ═══');
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    console.error('❌ NO HAY USUARIO AUTENTICADO');
    console.log('\n⚠️  SOLUCIÓN: Inicia sesión primero');
    return;
  }
  
  console.log('✅ Usuario autenticado:', currentUser.email);
  console.log('   UID:', currentUser.uid);
  
  try {
    const token = await currentUser.getIdTokenResult();
    console.log('✅ Token válido');
    console.log('   Expira:', new Date(token.expirationTime));
  } catch (error) {
    console.error('❌ Error obteniendo token:', error.message);
    console.log('⚠️  SOLUCIÓN: El token ha expirado. Recarga la página (F5)');
    return;
  }
  
  // 2. Verificar documento de usuario
  console.log('\n═══ 2. DOCUMENTO USUARIO ═══');
  const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  const db = getFirestore();
  
  try {
    const userDocRef = doc(db, 'usuarios', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      console.error('❌ Documento de usuario no existe en Firestore');
      console.log('⚠️  SOLUCIÓN: Verifica que exista usuarios/' + currentUser.uid);
      return;
    }
    
    const userData = userDocSnap.data();
    console.log('✅ Documento encontrado');
    console.log('   Nombre:', userData.nombre);
    console.log('   Activo:', userData.activo);
    console.log('   Rol:', userData.rol);
    console.log('   Sucursal:', userData.sucursal || '(sin asignar)');
    
  } catch (error) {
    console.error('❌ Error leyendo documento usuario:', error.code, error.message);
  }
  
  // 3. Probar lectura de facturas
  console.log('\n═══ 3. PRUEBA DE LECTURA: facturas ═══');
  const { collection, query, where, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  
  try {
    const facturasRef = collection(db, 'facturas');
    const q = query(facturasRef, limit(1));
    const snapshot = await getDocs(q);
    console.log('✅ Lectura exitosa de facturas');
    console.log('   Documentos leídos:', snapshot.size);
  } catch (error) {
    console.error('❌ Error leyendo facturas:', error.code);
    console.error('   Mensaje:', error.message);
    console.log('\n⚠️  SOLUCIÓN:');
    console.log('   1. Verifica que las reglas estén desplegadas:');
    console.log('      firebase deploy --only firestore:rules');
    console.log('   2. Espera 1-2 minutos para que se apliquen');
    console.log('   3. Recarga la página (Ctrl+F5)');
    return;
  }
  
  // 4. Probar lectura de facturas_deudas
  console.log('\n═══ 4. PRUEBA DE LECTURA: facturas_deudas ═══');
  try {
    const deudasRef = collection(db, 'facturas_deudas');
    const q = query(deudasRef, limit(1));
    const snapshot = await getDocs(q);
    console.log('✅ Lectura exitosa de facturas_deudas');
    console.log('   Documentos leídos:', snapshot.size);
  } catch (error) {
    console.error('❌ Error leyendo facturas_deudas:', error.code);
    console.error('   Mensaje:', error.message);
    return;
  }
  
  // 5. Probar lectura de movimientos_cajas_banco
  console.log('\n═══ 5. PRUEBA DE LECTURA: movimientos_cajas_banco ═══');
  try {
    const movRef = collection(db, 'movimientos_cajas_banco');
    const q = query(movRef, limit(1));
    const snapshot = await getDocs(q);
    console.log('✅ Lectura exitosa de movimientos_cajas_banco');
    console.log('   Documentos leídos:', snapshot.size);
  } catch (error) {
    console.error('❌ Error leyendo movimientos_cajas_banco:', error.code);
    console.error('   Mensaje:', error.message);
    return;
  }
  
  // 6. Resumen
  console.log('\n═══ ✅ DIAGNÓSTICO COMPLETADO ═══');
  console.log('Todas las pruebas pasaron exitosamente.');
  console.log('El error puede estar en:');
  console.log('  - Queries específicas con filtros (where)');
  console.log('  - Problema de cache del navegador');
  console.log('\nPróximos pasos:');
  console.log('  1. Recarga con Ctrl+F5 para limpiar cache');
  console.log('  2. Revisa la consola al cargar el módulo de empleados');
  console.log('  3. Busca mensajes que empiecen con [MetricasService]');
  
})().catch(error => {
  console.error('💥 Error en diagnóstico:', error);
});
