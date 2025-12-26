# 🔐 Seguridad de la Aplicación

## Medidas de Seguridad Implementadas

### 1. **Control de Acceso por Roles y Autorización**

#### Firestore Security Rules
- **Administradores** (`rol == 1`): Acceso completo a todas las colecciones
- **Operadores autorizados** (`rol == 2`, `activo == true`, `sucursal == "PASAJE"`): Acceso limitado a operaciones de ventas
- **Usuarios sin autorizar** (`activo == false`): Sin acceso hasta ser autorizados

```javascript
function isAdmin() {
  return isSignedIn() && userDoc().data.rol == 1;
}

function isAuthorizedOperator() {
  return hasSucursalPasaje() && isActive();
}
```

#### Mensajes de Error Específicos
- **Sin autorización**: "Tu cuenta aún no ha sido autorizada por el administrador"
- **Cuenta bloqueada**: "Tu cuenta ha sido bloqueada. Contacta al administrador"
- **Acceso desde otra computadora**: "Esta cuenta está autorizada para otra computadora"

### 2. **Gestión de Sesión y Auto-Logout**

#### SessionService - Auto-logout por Inactividad
- **Tiempo de inactividad**: 30 minutos sin interacción
- **Eventos monitoreados**: mousemove, click, keypress, scroll, touch
- **Throttling**: 1 evento por segundo para optimizar rendimiento

```typescript
private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos
```

#### Integración en App Component
- Se inicia el monitoreo automáticamente al autenticarse
- Se detiene al cerrar sesión o salir de la aplicación
- Muestra alerta antes de cerrar sesión

### 3. **Detección de Conectividad a Internet**

#### ConnectivityService
- **Monitoreo continuo** de la conexión a internet
- **Eventos nativos**: `online` y `offline` del navegador
- **Observable** para suscripción en componentes

#### Validaciones Implementadas
- ✅ **Al iniciar sesión**: Verifica conexión antes de intentar autenticación
- ✅ **Durante el uso**: Alerta si se pierde la conexión
- ✅ **Al recuperar conexión**: Notificación de conexión restaurada

#### Mensajes Contextuales
```typescript
// Error al intentar login sin internet
"No se puede iniciar sesión sin conexión a internet"

// Error de red durante una operación
"No se pudo conectar con el servidor. Verifica tu conexión"

// Conexión perdida durante uso
"Se ha perdido la conexión a internet. Algunas funciones pueden no estar disponibles"
```

### 4. **Seguridad de Contraseñas**

#### Visibilidad de Contraseña
- Botón de mostrar/ocultar en todos los campos de contraseña:
  - Login
  - Registro
  - Confirmar contraseña

#### Validaciones de Contraseña Fuerte
```typescript
// Mínimo 8 caracteres
// Al menos 1 mayúscula
// Al menos 1 minúscula
// Al menos 1 número
// Al menos 1 símbolo especial (!@#$%^&*(),.?":{}|<>)
```

### 5. **Restricción por Machine ID**

#### Validación en AuthService
```typescript
private validarAccesoSucursal(userData: Usuario): void {
  const electronApi = (window as any).electron;
  const machineIdActual = electronApi.machineId;
  
  if (userData.machineId && userData.machineId !== machineIdActual) {
    throw new Error('Esta cuenta está autorizada para otra computadora');
  }
}
```

#### Configuración
```bash
# Asignar machine ID a un usuario
node set-user-machine-id.js <email> <machine-id> PASAJE
```

### 6. **Firestore Security Rules Completas**

#### Validaciones por Colección

**Clientes**:
```javascript
allow read, write: if isAdmin() || isAuthorizedOperator();
```

**Productos, Proveedores, Ingresos, Facturas, Ventas**:
```javascript
allow read, write: if isAdmin() || isAuthorizedOperator();
```

**Usuarios**:
```javascript
// Leer: propio documento, usuarios PASAJE, o admin
allow read: if (isSignedIn() && request.auth.uid == uid) || hasSucursalPasaje() || isAdmin();

// Crear: al registrarse
allow create: if isSignedIn() && request.auth.uid == uid;

// Actualizar/Eliminar: admin o el propio usuario
allow update, delete: if isAdmin() || (isSignedIn() && request.auth.uid == uid);
```

## 🚀 Flujo de Autorización

### Nuevo Usuario
1. ✅ Usuario se registra → `activo: false`
2. ❌ Intenta iniciar sesión → "Tu cuenta aún no ha sido autorizada"
3. ✅ Admin autoriza desde panel de empleados → `activo: true`
4. ✅ Usuario puede iniciar sesión y trabajar

### Bloqueo de Usuario
1. ✅ Admin bloquea usuario → `activo: false`
2. ❌ Usuario pierde acceso inmediato a Firestore
3. ❌ Intenta iniciar sesión → "Tu cuenta ha sido bloqueada"

### Restricción por Computadora
1. ✅ Admin asigna `machineId` al usuario
2. ✅ Usuario solo puede acceder desde esa PC
3. ❌ Intento desde otra PC → "Esta cuenta está autorizada para otra computadora"

## 📊 Monitoreo y Logs

### Eventos de Seguridad
- Intentos de login fallidos (consola)
- Validación de sucursal y machine ID (consola)
- Pérdida/recuperación de conexión (toast notifications)
- Auto-logout por inactividad (alerta)

### Recomendaciones
1. **Revisar regularmente** los usuarios autorizados en el panel de admin
2. **Actualizar machine IDs** cuando se cambie de equipo
3. **Monitorear** intentos de acceso no autorizados en logs de Firebase
4. **Mantener actualizadas** las reglas de Firestore según cambien los requisitos

## 🔧 Scripts Útiles

```bash
# Asignar sucursal a usuario
node set-user-machine-id.js <email> <machine-id> PASAJE

# Desplegar reglas de seguridad
firebase deploy --only firestore:rules

# Ver logs de Firebase
firebase functions:log
```

## ⚠️ Notas Importantes

- Las reglas ya están desplegadas en producción
- El auto-logout está configurado para 30 minutos
- La validación de machine ID solo funciona en la app de Electron
- En modo desarrollo (navegador), la validación de sucursal está deshabilitada

---

**Última actualización**: 26 de diciembre de 2025
