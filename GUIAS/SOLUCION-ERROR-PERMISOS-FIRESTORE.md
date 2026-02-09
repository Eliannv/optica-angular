# 🔧 Solución: Error de Permisos en Firestore

## ❌ Problema Detectado

### Errores que aparecen:
```
1. UNAUTHORIZED: Tu cuenta aún no ha sido autorizada por el administrador
2. RESTRICTED: Acceso restringido. Tu cuenta está asignada a la sucursal DEV001. 
   No puedes iniciar sesión desde PASAJE
3. FirebaseError: Missing or insufficient permissions
```

---

## 🔍 Causas del Problema

### **Causa 1: Reglas de Firestore Restrictivas**
Las reglas de Firestore estaban limitadas a solo 4 sucursales hardcodeadas:
```javascript
// ❌ ANTES (muy restrictivo)
function hasValidSucursal() {
  return isSignedIn() && 
         userDoc().data.sucursal in ['MACHALA', 'PASAJE', 'DESARROLLO_1', 'DESARROLLO_2'];
}
```

Si creabas una sucursal llamada "DEV001", Firestore bloqueaba el acceso.

### **Causa 2: Sesión Cacheada**
Cuando desbloqueas un usuario:
1. Se actualiza `activo: true` en Firestore ✅
2. Pero el usuario **ya tiene sesión iniciada** con datos antiguos (`activo: false`) ❌
3. Firebase Auth no refresca automáticamente los datos de Firestore

### **Causa 3: Sucursal No Coincide**
- Usuario asignado a máquina con sucursal "DEV001"
- PC actual está en sucursal "PASAJE"
- Las sucursales deben coincidir exactamente

---

## ✅ Solución Implementada

### **1. Actualizar Reglas de Firestore**

**Cambio aplicado en `firestore.rules`:**
```javascript
// ✅ AHORA (flexible)
function hasValidSucursal() {
  return isSignedIn() && 
         userDoc().data.sucursal != null &&
         userDoc().data.sucursal != '';
}
```

**Ahora acepta CUALQUIER sucursal** mientras tenga un valor asignado.

---

### **2. Desplegar las Nuevas Reglas**

**IMPORTANTE:** Debes desplegar las reglas actualizadas a Firebase:

```bash
# Desde la raíz del proyecto
firebase deploy --only firestore:rules
```

**Verificar en Firebase Console:**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** → **Reglas**
4. Verifica que la función `hasValidSucursal()` tenga el código actualizado

---

### **3. Flujo Correcto para Desbloquear**

#### **Paso a Paso:**

1. **Admin desbloquea al empleado:**
   - Va a **Empleados**
   - Click en "Desbloquear"
   - Selecciona la máquina (ej: "PC PASAJE - PASAJE")
   - Confirma

2. **Datos actualizados en Firestore:**
   ```typescript
   {
     activo: true,
     machineId: "abc123def456",
     sucursal: "PASAJE"
   }
   ```

3. **Empleado debe hacer logout/login:**
   - Si ya tenía sesión iniciada → debe cerrar sesión
   - Volver a iniciar sesión con sus credenciales
   - Ahora obtendrá los datos actualizados (`activo: true`)

---

## 🎯 Verificación de Sucursales

### **Asegúrate de que coincidan:**

| Elemento | Sucursal | Debe Coincidir |
|----------|----------|----------------|
| Máquina en Firestore | `PASAJE` | ✅ |
| PC Actual (Electron) | `PASAJE` | ✅ |
| Usuario asignado | `PASAJE` | ✅ |

**Si no coinciden:**
```
Error: "Tu cuenta está asignada a la sucursal DEV001. 
        No puedes iniciar sesión desde PASAJE."
```

---

## 📝 Cómo Verificar la Sucursal de una Máquina

### **Opción 1: En Firestore (Firebase Console)**
1. Ve a Firestore Database
2. Colección: `maquinas_autorizadas`
3. Busca el documento por `machineId`
4. Verifica el campo `sucursal`

### **Opción 2: En la App (Gestionar Máquinas)**
1. Ve a **Administración** → **Gestionar Máquinas**
2. Busca la máquina en la lista
3. La columna "Sucursal" muestra el valor asignado

---

## 🔄 Sincronización de Datos

### **Problema de Caché:**
Firebase Auth mantiene en caché los datos del usuario. Al desbloquear:

```
┌─────────────────────────────────┐
│  Admin desbloquea empleado      │
│  (activo: false → true)         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Firestore actualizado ✅       │
│  activo: true                   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Empleado YA tiene sesión       │
│  Con datos ANTIGUOS en caché ❌ │
│  activo: false                  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  SOLUCIÓN: Cerrar sesión        │
│  y volver a iniciar sesión      │
└─────────────────────────────────┘
```

---

## 🚀 Pasos para Resolver Ahora

### **1. Desplegar Reglas de Firestore**
```bash
firebase deploy --only firestore:rules
```

### **2. Verificar que la Sucursal sea Correcta**

**Opción A: Si quieres usar "PASAJE":**
1. Ve a Gestionar Máquinas
2. Encuentra la máquina actual
3. Edita y cambia sucursal a "PASAJE"
4. Guarda

**Opción B: Si quieres usar "DEV001":**
1. Ve a Electron (`main.js`)
2. Busca la línea donde se define la sucursal
3. Cambia de "PASAJE" a "DEV001"
4. Recompila la app de Electron

### **3. Desbloquear al Usuario Correctamente**
1. Asegúrate de que el usuario esté **bloqueado** primero
2. Desbloquea y selecciona una máquina con la sucursal correcta
3. **El usuario debe cerrar sesión** si estaba logueado
4. El usuario inicia sesión nuevamente

### **4. Verificar en Firestore**
1. Ve a Firebase Console → Firestore
2. Colección: `usuarios`
3. Busca al empleado
4. Verifica:
   ```json
   {
     "activo": true,
     "machineId": "abc123...",
     "sucursal": "PASAJE"
   }
   ```

---

## 🧪 Prueba Completa

### **Test 1: Usuario Bloqueado**
```bash
1. Crear usuario nuevo
2. NO desbloquearlo
3. Intentar login
   → ❌ "Tu cuenta aún no ha sido autorizada"
```

### **Test 2: Usuario Desbloqueado Correctamente**
```bash
1. Usuario bloqueado
2. Desbloquear y asignar máquina "PASAJE"
3. Usuario cierra sesión (si estaba logueado)
4. Usuario inicia sesión
   → ✅ Acceso permitido
```

### **Test 3: Usuario en Máquina Incorrecta**
```bash
1. Usuario asignado a máquina "DEV001"
2. Intentar login desde PC "PASAJE"
   → ❌ "Tu cuenta está asignada a la sucursal DEV001"
```

---

## ⚠️ Importante

### **Reglas de Oro:**

1. **Siempre desplegar las reglas de Firestore** después de editarlas
2. **Cerrar sesión** después de desbloquear/bloquear un usuario
3. **Verificar que las sucursales coincidan** (Máquina, PC, Usuario)
4. **No hardcodear sucursales** en las reglas de Firestore

---

## 📋 Checklist de Solución

- [ ] Desplegar reglas de Firestore (`firebase deploy --only firestore:rules`)
- [ ] Verificar que la máquina tenga la sucursal correcta
- [ ] Bloquear al usuario problemático
- [ ] Desbloquear y asignar máquina con sucursal correcta
- [ ] Usuario cierra sesión
- [ ] Usuario inicia sesión nuevamente
- [ ] ✅ Verificar que funcione correctamente

---

*Documento generado: 2 de febrero de 2026*  
*Sistema: Óptica Macías - Solución de Errores de Permisos*
