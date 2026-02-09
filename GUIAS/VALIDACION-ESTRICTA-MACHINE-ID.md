# 🔒 Validación Estricta de Machine ID - Implementación Completa

## 📋 Cambios Realizados

Se ha implementado una **validación estricta** para garantizar que un empleado **SOLO** pueda acceder desde la computadora física que tiene el .exe de Electron instalado.

---

## 🔧 Modificaciones Técnicas

### **1. Electron Main Process ([`main.js`](electron/main.js))**

#### ✅ **Almacenamiento de Información de Máquina**
```javascript
// Guardar información de la máquina para usarla en IPC
global.machineInfo = {
  sucursal: verificacion.sucursal,
  machineId: verificacion.machineId
};
```

#### ✅ **IPC Handler para Obtener Información**
```javascript
// Handler para obtener información de la máquina
ipcMain.handle('get-machine-info', async () => {
  return global.machineInfo || {
    sucursal: 'DESCONOCIDA',
    machineId: generarIdMaquina()
  };
});
```

### **2. Preload Script ([`preload.js`](electron/preload.js))**

#### ✅ **Exposición de API para Angular**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  descargarPlantilla: () => ipcRenderer.invoke('descargar-plantilla'),
  getMachineInfo: () => ipcRenderer.invoke('get-machine-info'), // NUEVO
});
```

**ANTES:** La sucursal estaba hardcodeada como `'PASAJE'`  
**AHORA:** Se obtiene dinámicamente desde Firestore vía IPC

### **3. Auth Service ([`auth.service.ts`](src/app/core/services/auth.service.ts))**

#### ✅ **Validación Asíncrona con Logs de Depuración**
```typescript
private async validarAccesoSucursal(userData: Usuario): Promise<void> {
  // Obtener información REAL de la máquina desde Electron
  const machineInfo = await electronAPI.getMachineInfo();
  
  // DEBUG: Mostrar comparación
  console.log('🔍 VALIDACIÓN DE ACCESO:');
  console.log('  Machine ID Usuario:', userData.machineId);
  console.log('  Machine ID Actual:', machineIdActual);
  console.log('  ¿Coinciden IDs?:', userData.machineId === machineIdActual);
  
  // Validación estricta
  if (userData.machineId !== machineIdActual) {
    throw new Error('RESTRICTED: No puedes iniciar sesión desde esta máquina');
  }
}
```

---

## 🎯 Cómo Funciona la Validación

### **Flujo Completo:**

```
┌──────────────────────────────────────┐
│ 1. Electron inicia                   │
│    - Genera Machine ID de la PC      │
│    - Consulta Firestore              │
│    - Verifica si está autorizada     │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│ 2. Si está autorizada:               │
│    - Guarda en global.machineInfo    │
│    - Abre la ventana                 │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│ 3. Usuario hace login                │
│    - Ingresa email/password          │
│    - Firebase Auth valida            │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│ 4. Obtener datos de Firestore        │
│    - Usuario tiene machineId         │
│    - Usuario tiene sucursal          │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│ 5. Angular solicita info de máquina  │
│    electronAPI.getMachineInfo()      │
│    ↓                                 │
│    Retorna: { sucursal, machineId }  │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│ 6. Comparación ESTRICTA              │
│    ¿userData.machineId === PC.id?    │
│         ↓              ↓              │
│       SÍ ✅          NO ❌            │
│    PERMITIR        BLOQUEAR          │
└──────────────────────────────────────┘
```

---

## 🧪 Pruebas de Validación

### **Test 1: Asignar Máquina INCORRECTA**

**Escenario:**
- PC Actual tiene Machine ID: `abc123def456`
- Admin asigna al usuario la máquina con ID: `xyz789ghi012` (DIFERENTE)

**Resultado Esperado:**
```
❌ Error: RESTRICTED: Acceso restringido. 
   Tu cuenta está asignada a otra computadora.
   
   Máquina asignada: xyz789ghi012
   Máquina actual: abc123def456
```

**Consola (DevTools):**
```
🔍 VALIDACIÓN DE ACCESO:
  Machine ID Usuario: xyz789ghi012
  Machine ID Actual: abc123def456
  ¿Coinciden IDs?: false
```

---

### **Test 2: Asignar Máquina CORRECTA**

**Escenario:**
- PC Actual tiene Machine ID: `abc123def456`
- Admin asigna al usuario la máquina con ID: `abc123def456` (IGUAL)

**Resultado Esperado:**
```
✅ Login exitoso
   Acceso permitido
```

**Consola (DevTools):**
```
🔍 VALIDACIÓN DE ACCESO:
  Machine ID Usuario: abc123def456
  Machine ID Actual: abc123def456
  ¿Coinciden IDs?: true
✅ Validación exitosa - Acceso permitido
```

---

## 📝 Pasos para Probar

### **1. Obtener Machine ID de la PC Actual**

Desde la PC donde quieres que el empleado trabaje:

```bash
node get-machine-id.js
```

**Salida:**
```
🔐 INFORMACIÓN DE ESTA PC:

  Hostname: PC-PASAJE-01
  Usuario: admin
  Sistema: win32
  CPU: Intel(R) Core(TM) i5-8250U

  ✅ MACHINE ID: abc123def456
```

### **2. Registrar la Máquina en el Sistema**

1. Ve a **Administración** → **Gestionar Máquinas**
2. Click en **"Nueva Máquina"**
3. Llena el formulario:
   - **Machine ID:** `abc123def456` (el que obtuviste)
   - **Nombre:** `PC Recepción PASAJE`
   - **Sucursal:** `PASAJE`
4. Guarda

### **3. Asignar la Máquina al Empleado**

1. Ve a **Empleados**
2. Busca al empleado que quieres autorizar
3. Si está bloqueado, click en **"Desbloquear"**
4. Selecciona la máquina: **"PC Recepción PASAJE - PASAJE"**
5. Confirma

**Datos en Firestore:**
```json
{
  "activo": true,
  "machineId": "abc123def456",
  "sucursal": "PASAJE"
}
```

### **4. Probar el Login**

**Desde la PC CORRECTA (abc123def456):**
```
✅ Login exitoso - Acceso permitido
```

**Desde OTRA PC (xyz789ghi012):**
```
❌ Error: No puedes iniciar sesión desde esta máquina
```

---

## 🔍 Debugging (Consola de Desarrollador)

### **Abrir DevTools en Electron:**
```javascript
// En main.js está configurado para abrir automáticamente en desarrollo
if (IS_DEV) {
  win.webContents.openDevTools();
}
```

### **Logs que Debes Ver:**

**Login Exitoso:**
```
🔍 VALIDACIÓN DE ACCESO:
  Machine ID Usuario: abc123def456
  Machine ID Actual: abc123def456
  Sucursal Usuario: PASAJE
  Sucursal Actual: PASAJE
  ¿Coinciden IDs?: true
  ¿Coinciden Sucursales?: true
✅ Validación exitosa - Acceso permitido
```

**Login Bloqueado:**
```
🔍 VALIDACIÓN DE ACCESO:
  Machine ID Usuario: abc123def456
  Machine ID Actual: xyz789ghi012
  Sucursal Usuario: PASAJE
  Sucursal Actual: PASAJE
  ¿Coinciden IDs?: false    ← AQUÍ ESTÁ EL PROBLEMA
  ¿Coinciden Sucursales?: true
Error: RESTRICTED: No puedes iniciar sesión desde esta máquina
```

---

## ⚠️ Importante: Recompilar Electron

**Después de estos cambios, debes recompilar la app de Electron:**

```bash
# 1. Construir Angular
npm run build

# 2. Empaquetar Electron
npm run dist
```

---

## 🎯 Verificación Final

### **Checklist:**

- [ ] Obtener Machine ID de la PC con `get-machine-id.js`
- [ ] Registrar máquina en **Gestionar Máquinas**
- [ ] Asignar máquina correcta al empleado
- [ ] Recompilar Electron (`npm run dist`)
- [ ] Probar login desde PC correcta → ✅ Debe permitir
- [ ] Probar login desde PC incorrecta → ❌ Debe bloquear
- [ ] Verificar logs en DevTools

---

## 🚨 Solución de Problemas

### **Problema: "Puede acceder con cualquier máquina"**

**Causa:** La sucursal estaba hardcodeada en `preload.js`  
**Solución:** Ahora usa IPC para obtener la info real ✅

### **Problema: "No muestra error al asignar otra máquina"**

**Verificar:**
1. Abrir DevTools
2. Ver logs de validación
3. Confirmar que `¿Coinciden IDs?: false`
4. Si no aparece el log, recompilar Electron

### **Problema: "Error: Missing permissions"**

**Causa:** Reglas de Firestore muy restrictivas  
**Solución:** Ya desplegadas con `firebase deploy` ✅

---

## 📊 Archivos Modificados

| Archivo | Cambio Principal |
|---------|------------------|
| [`electron/main.js`](electron/main.js) | IPC handler `get-machine-info` |
| [`electron/preload.js`](electron/preload.js) | Exposición de `getMachineInfo()` |
| [`src/app/core/services/auth.service.ts`](src/app/core/services/auth.service.ts) | Validación async con logs |

---

*Documento generado: 2 de febrero de 2026*  
*Sistema: Óptica Macías - Validación Estricta de Machine ID*
