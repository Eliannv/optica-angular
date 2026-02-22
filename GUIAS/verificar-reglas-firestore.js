#!/usr/bin/env node

/**
 * Script para verificar el estado de las reglas de Firestore
 * y validar que estén sincronizadas con Firebase.
 * 
 * Ejecutar: node GUIAS/verificar-reglas-firestore.js
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 VERIFICANDO REGLAS DE FIRESTORE\n');

// 1. Verificar archivo local
console.log('📄 Archivo local: firestore.rules');
try {
  const localRules = fs.readFileSync('firestore.rules', 'utf8');
  const canReadMetricsMatch = localRules.match(/function canReadMetrics\(\)\s*\{[\s\S]*?\}/);
  
  if (canReadMetricsMatch) {
    console.log('✅ Función canReadMetrics encontrada:');
    console.log(canReadMetricsMatch[0]);
  }
  
  // Verificar reglas de facturas
  const facturasMatch = localRules.match(/match \/facturas\/\{facturaId\}[\s\S]*?allow read:[^\n]+/);
  if (facturasMatch) {
    console.log('\n✅ Regla de facturas:');
    console.log(facturasMatch[0]);
  }
  
  console.log('\n');
} catch (error) {
  console.error('❌ Error leyendo archivo local:', error.message);
}

// 2. Instrucciones para verificar en Firebase Console
console.log('📋 PASOS PARA VERIFICAR EN FIREBASE CONSOLE:\n');
console.log('1. Ve a: https://console.firebase.google.com');
console.log('2. Selecciona tu proyecto');
console.log('3. Ve a Firestore Database → Rules');
console.log('4. Verifica que las reglas publicadas incluyan:\n');
console.log('   function canReadMetrics() {');
console.log('     return isSignedIn();');
console.log('   }\n');
console.log('   match /facturas/{facturaId} {');
console.log('     allow read: if isSignedIn();');
console.log('     allow write: if isAdmin() || isAuthorizedOperator();');
console.log('   }\n');

console.log('📤 PARA DESPLEGAR LAS REGLAS:\n');
console.log('   firebase deploy --only firestore:rules\n');

console.log('⚠️  IMPORTANTE:');
console.log('   - Las reglas en Firebase Console deben coincidir con firestore.rules');
console.log('   - Los cambios tardan ~1 minuto en aplicarse después del deploy');
console.log('   - Recarga la aplicación (Ctrl+F5) después de desplegar\n');
