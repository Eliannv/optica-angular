# 🔐 Sistema de Protección por Sucursal y Machine ID

Sistema de seguridad de dos niveles para restringir el acceso a computadoras autorizadas.

## 🎯 Objetivo

Garantizar que:
1. La aplicación solo se ejecute en PCs autorizadas (validación a nivel Electron)
2. Los usuarios solo puedan iniciar sesión desde su PC asignada (validación a nivel Firebase)

---

## 📋 Niveles de Protección

### Nivel 1: Validación en Electron (main.js)
- Se ejecuta **antes** de abrir la aplicación
- Verifica que el Machine ID de la PC esté en la lista de IDs permitidos
- Si no coincide → muestra error y cierra la app inmediatamente

### Nivel 2: Validación en Firebase (auth.service.ts)
- Se ejecuta **durante el login**
- Verifica que el usuario tenga asignados:
  - Sucursal correcta (ej: PASAJE)
  - Machine ID que coincida con la PC actual
- Si no coincide → rechaza el login con mensaje de error

---

## 🛠️ Configuración Paso a Paso

### 1️⃣ Obtener el Machine ID de la PC de PASAJE

En la PC donde quieres instalar el sistema:

```bash
node get-machine-id.js
```

Copia el Machine ID que aparece (ej: `858744ddedd2fca1`)

### 2️⃣ Agregar Machine ID a la lista de IDs permitidos

Edita `electron/main.js` línea 25-28:

```javascript
const idsPermitidos = [
  '858744ddedd2fca1', // PC Desarrollo
  'ABC123XYZ789',     // PC PASAJE - REEMPLAZA CON EL ID REAL
];
```

### 3️⃣ Configurar Firebase Admin (solo primera vez)

1. Ve a Firebase Console → Project Settings → Service Accounts
2. Click en "Generate New Private Key"
3. Guarda el archivo JSON como `firebase-admin-key.json` en la raíz del proyecto
4. **⚠️ IMPORTANTE:** Agrega este archivo a `.gitignore` (ya está incluido)

### 4️⃣ Configurar usuarios en Firebase

Para cada usuario que necesite acceso:

```bash
# Sintaxis
node set-user-machine-id.js <email> <machine-id> <sucursal>

# Ejemplo: Configurar usuario para PC de PASAJE
node set-user-machine-id.js admin@optica.com ABC123XYZ789 PASAJE

# Ejemplo: Configurar operador
node set-user-machine-id.js operador@optica.com ABC123XYZ789 PASAJE
```

### 5️⃣ Compilar y Empaquetar

```bash
npm run build
npm run electron:build
```

El instalador estará en `release/`

---

## ✅ Verificación

### Verificar configuración actual de un usuario:

```bash
# Primero obtén el Machine ID de esta PC
node get-machine-id.js

# Luego configura el usuario
node set-user-machine-id.js usuario@email.com <machine-id> PASAJE
```

### Probar la seguridad:

1. **Instalar en PC no autorizada** → Debería mostrar error y no abrir
2. **Login desde PC autorizada pero con usuario de otra sucursal** → Debería rechazar login
3. **Login con usuario correcto en PC correcta** → Debería permitir acceso

---

## 🔒 Qué pasa si...

### ¿Qué pasa si instalo en una PC no autorizada?
```
❌ Acceso Denegado - Sistema Óptica
Este sistema está autorizado SOLO para la sucursal PASAJE.
No se puede ejecutar en esta ubicación.
Contacte al administrador del sistema.
```

### ¿Qué pasa si intento hacer login desde otra PC?
```
❌ Error al iniciar sesión
Esta cuenta está autorizada para otra computadora.
Contacta al administrador para autorizar este equipo.
```

### ¿Qué pasa si mi usuario está asignado a otra sucursal?
```
❌ Error al iniciar sesión
Tu cuenta está asignada a la sucursal CENTRO.
No puedes iniciar sesión desde PASAJE.
```

---

## 🚨 Importante

- **Guarda los Machine IDs** de todas las PCs autorizadas
- **Configura primero los usuarios** antes de distribuir la app
- **No compartas el archivo** `firebase-admin-key.json`
- Para **agregar nueva PC**: obtén su Machine ID y agrégalo a `main.js` + reconfigura usuarios

---

## 📝 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `node get-machine-id.js` | Obtiene el Machine ID de la PC actual |
| `node set-user-machine-id.js <email> <id> <sucursal>` | Configura usuario en Firebase |
| `node set-user-sucursal.js` | Script anterior (reemplazado) |

---

## 🔧 Troubleshooting

### Error: "Cannot find module 'firebase-admin'"
```bash
npm install firebase-admin
```

### Error: "Cannot find module './firebase-admin-key.json'"
Descarga las credenciales de Firebase Admin (paso 3️⃣)

### El usuario no puede hacer login
Verifica que tenga configurados `machineId` y `sucursal` en Firebase:
```bash
node set-user-machine-id.js email@usuario.com <machine-id> PASAJE
```

---

## 📊 Estructura de Usuario en Firebase

```typescript
{
  id: "abc123",
  nombre: "Juan Pérez",
  email: "juan@optica.com",
  rol: 1,
  activo: true,
  sucursal: "PASAJE",        // ← Nueva validación
  machineId: "858744ddedd2",  // ← Nueva validación
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 🎯 Resultado Final

✅ **Nivel 1 Activo**: Solo PCs con Machine ID autorizado pueden ejecutar la app
✅ **Nivel 2 Activo**: Solo usuarios con Machine ID correcto pueden hacer login
✅ **Doble Protección**: Imposible usar la app desde PCs no autorizadas
