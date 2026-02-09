# 🔐 Sistema de Seguridad por Machine ID - Mejoras Implementadas

## 📋 Resumen de Cambios

Se ha mejorado el sistema de control de acceso basado en Machine ID para garantizar que:
1. ✅ Los usuarios **bloqueados** (`activo: false`) **NO puedan iniciar sesión**
2. ✅ Los usuarios solo puedan acceder desde la **máquina asignada**
3. ✅ Se muestre un mensaje claro con la **sucursal asignada** cuando se bloquee el acceso

---

## 🚨 Problema Identificado

**Antes de la corrección:**
- Un usuario bloqueado podía iniciar sesión si tenía credenciales válidas
- La validación de machine ID solo se ejecutaba si `activo === false && rol === 2`
- Los mensajes de error no indicaban claramente la sucursal asignada

**Síntomas del problema:**
- Usuario bloqueado → podía ingresar pero no ver datos
- Usuario en máquina incorrecta → podía ingresar sin restricción

---

## ✅ Solución Implementada

### 1. **Separación de Validaciones en `auth.service.ts`**

Se separaron las validaciones en dos niveles:

#### **Validación 1: Estado de la Cuenta**
```typescript
// VALIDACIÓN 1: Verificar si el usuario está bloqueado (activo === false)
if (userData.activo === false) {
  // Distinguir entre "sin autorización" y "bloqueado"
  if (!userData.machineId) {
    throw new Error('UNAUTHORIZED: Tu cuenta aún no ha sido autorizada...');
  } else {
    throw new Error('BLOCKED: Tu cuenta ha sido bloqueada...');
  }
}
```

#### **Validación 2: Machine ID y Sucursal**
```typescript
// VALIDACIÓN 2: Verificar Machine ID y Sucursal (solo operadores)
if (userData.rol === RolUsuario.OPERADOR) {
  this.validarAccesoSucursal(userData);
}
```

### 2. **Mejora del Método `validarAccesoSucursal`**

Se agregaron 3 validaciones críticas:

#### ✅ **Validación de Asignación**
```typescript
if (!userData.machineId || !userData.sucursal) {
  throw new Error('RESTRICTED: Acceso restringido. Tu cuenta aún no ha sido asignada...');
}
```

#### ✅ **Validación de Machine ID (Crítico)**
```typescript
if (userData.machineId !== machineIdActual) {
  throw new Error(
    `RESTRICTED: Acceso restringido. Tu cuenta está asignada a la sucursal ${userData.sucursal}. ` +
    `No puedes iniciar sesión desde esta computadora.`
  );
}
```

#### ✅ **Validación de Sucursal (Adicional)**
```typescript
if (userData.sucursal !== sucursalActual) {
  throw new Error(
    `RESTRICTED: Acceso restringido. Tu cuenta está asignada a la sucursal ${userData.sucursal}. ` +
    `No puedes iniciar sesión desde ${sucursalActual}.`
  );
}
```

### 3. **Manejo de Errores en `auth-carousel.ts`**

Se agregó el manejo del nuevo tipo de error `RESTRICTED`:

```typescript
else if (err.message.startsWith('RESTRICTED:')) {
  errorIcon = 'warning';
  errorTitle = 'Acceso restringido';
  errorMessage = err.message.replace('RESTRICTED: ', '');
}
```

---

## 🎯 Flujos de Validación

### **Escenario 1: Usuario Bloqueado**
```
1. Usuario intenta login
   ↓
2. Credenciales válidas en Firebase Auth
   ↓
3. Se obtienen datos de Firestore
   ↓
4. ❌ activo === false
   ↓
5. Verificar si tiene machineId:
   - Sin machineId → "UNAUTHORIZED: Tu cuenta aún no ha sido autorizada"
   - Con machineId → "BLOCKED: Tu cuenta ha sido bloqueada"
   ↓
6. Se rechaza el login ANTES de cualquier otra validación
```

### **Escenario 2: Usuario Activo en Máquina Incorrecta**
```
1. Usuario intenta login
   ↓
2. Credenciales válidas en Firebase Auth
   ↓
3. Se obtienen datos de Firestore
   ↓
4. ✅ activo === true
   ↓
5. Si rol === OPERADOR:
   ↓
6. Verificar machineId y sucursal asignados
   ↓
7. ❌ machineId !== machineIdActual
   ↓
8. Se muestra: "RESTRICTED: Acceso restringido. Tu cuenta está asignada a la sucursal [NOMBRE_SUCURSAL]"
   ↓
9. Se rechaza el login
```

### **Escenario 3: Usuario Activo en Máquina Correcta**
```
1. Usuario intenta login
   ↓
2. Credenciales válidas en Firebase Auth
   ↓
3. Se obtienen datos de Firestore
   ↓
4. ✅ activo === true
   ↓
5. Si rol === OPERADOR:
   ↓
6. ✅ machineId === machineIdActual
   ↓
7. ✅ sucursal === sucursalActual
   ↓
8. ✅ Login exitoso → Redirige al sistema
```

---

## 🔧 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| [`src/app/core/services/auth.service.ts`](src/app/core/services/auth.service.ts) | Separación de validaciones + mejora de `validarAccesoSucursal()` |
| [`src/app/shared/components/auth/auth-carousel.ts`](src/app/shared/components/auth/auth-carousel.ts) | Manejo del error `RESTRICTED` |

---

## 📊 Tipos de Mensajes de Error

| Código | Título | Mensaje | Caso |
|--------|--------|---------|------|
| `OFFLINE` | Sin conexión a internet | No hay conexión a internet... | Sin conexión |
| `UNAUTHORIZED` | Cuenta sin autorización | Tu cuenta aún no ha sido autorizada... | Usuario nuevo sin machineId |
| `BLOCKED` | Cuenta bloqueada | Tu cuenta ha sido bloqueada... | Usuario bloqueado con machineId |
| `RESTRICTED` | Acceso restringido | Tu cuenta está asignada a la sucursal [X]... | Machine ID incorrecto |

---

## ✅ Resultado Final

### **Antes:**
- ❌ Usuario bloqueado → podía ingresar
- ❌ Usuario en otra PC → podía ingresar
- ❌ Mensaje genérico sin detalles

### **Después:**
- ✅ Usuario bloqueado → **NO puede ingresar**
- ✅ Usuario en otra PC → **NO puede ingresar**
- ✅ Mensaje específico: **"Tu cuenta está asignada a la sucursal [NOMBRE]"**

---

## 🧪 Pruebas Recomendadas

### **Prueba 1: Usuario Bloqueado**
1. Crear usuario en Empleados
2. Desbloquear y asignar máquina
3. **Bloquear** nuevamente
4. Intentar login → ❌ Debe mostrar "Cuenta bloqueada"

### **Prueba 2: Usuario en Máquina Incorrecta**
1. Crear usuario y asignar a Máquina A
2. Intentar login desde Máquina B
3. Debe mostrar: "Tu cuenta está asignada a la sucursal [X]"

### **Prueba 3: Usuario Sin Asignar**
1. Crear usuario nuevo (sin desbloquear)
2. Intentar login
3. Debe mostrar: "Tu cuenta aún no ha sido autorizada"

### **Prueba 4: Usuario Correcto**
1. Usuario desbloqueado con máquina asignada
2. Login desde la máquina correcta
3. ✅ Debe permitir acceso completo

---

## 🔒 Seguridad Multicapa

El sistema ahora tiene **3 niveles de seguridad**:

### **Nivel 1: Electron** (Validación de Máquina)
- Verifica que el Machine ID esté en `maquinas_autorizadas`
- Se ejecuta ANTES de abrir la aplicación

### **Nivel 2: Estado de Usuario** (Validación de Cuenta)
- Verifica que `activo === true`
- Se ejecuta AL HACER LOGIN

### **Nivel 3: Machine ID** (Validación de Asignación)
- Verifica que machineId coincida con la PC actual
- Verifica que sucursal coincida
- Se ejecuta AL HACER LOGIN (solo operadores)

---

## 📝 Notas Importantes

1. **Administradores**: NO se les aplica la validación de Machine ID
2. **Desarrollo**: Validación deshabilitada en navegador (solo Electron)
3. **Mensajes**: Todos incluyen `RESTRICTED:` para fácil identificación
4. **Sucursal**: Se muestra en el mensaje para que el usuario sepa dónde está asignado

---

## 🎯 Próximos Pasos Recomendados

1. ✅ Probar todos los escenarios descritos arriba
2. ✅ Verificar logs en Electron para confirmar validaciones
3. ✅ Documentar en manual de usuario los mensajes de error
4. ✅ Capacitar a administradores sobre el flujo de bloqueo/desbloqueo

---

*Documento generado: 2 de febrero de 2026*  
*Sistema: Óptica Macías - Control de Acceso por Machine ID*
