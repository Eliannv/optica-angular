# Configuración de Autenticación - Óptica Angular

## 📋 Resumen

Se ha adaptado el sistema de autenticación para funcionar con **Firebase Authentication** y **Firestore**, específico para empleados de una óptica.

## 🔧 Cambios Realizados

### 1. Servicio de Autenticación (`auth.service.ts`)
- ✅ Integración completa con Firebase Auth
- ✅ Manejo de sesiones con `authState$`
- ✅ Validación de usuarios en Firestore
- ✅ Verificación de cuentas activas/inactivas
- ✅ Distinción entre roles (admin/empleado)

### 2. Componente de Login (`auth-carousel`)
- ✅ Simplificado solo para login y recuperación de contraseña
- ✅ Eliminado el registro público (los empleados deben ser creados por un admin)
- ✅ Validaciones reactivas con formularios
- ✅ Estados de carga mejorados
- ✅ Mensajes de error claros

### 3. Guards de Seguridad (`auth.guard.ts`)
- ✅ `authGuard`: Protege rutas que requieren autenticación
- ✅ `adminGuard`: Protege rutas solo para administradores

## 🔥 Estructura de Firestore

### Colección: `usuarios`

Cada documento de usuario debe tener la siguiente estructura:

```typescript
{
  id: string,           // UID generado por Firebase Auth
  nombre: string,       // Nombre del empleado
  email: string,        // Email (usado para login)
  rol: 'admin' | 'empleado',  // Rol del usuario
  activo: boolean,      // true si puede acceder, false si está deshabilitado
  createdAt: timestamp  // Fecha de creación (opcional)
}
```

### Ejemplo de documento:

```json
{
  "nombre": "Juan Pérez",
  "email": "juan@optica.com",
  "rol": "empleado",
  "activo": true,
  "createdAt": "2025-12-17T10:00:00.000Z"
}
```

## 👤 Crear Usuarios en Firebase

### Opción 1: Desde Firebase Console

1. **Ir a Firebase Console** → Authentication
2. **Agregar usuario**:
   - Email: `empleado@optica.com`
   - Contraseña: `password123` (el usuario puede cambiarla después)
3. **Copiar el UID** generado
4. **Ir a Firestore Database** → Colección `usuarios`
5. **Crear documento** con el UID como ID:
   ```json
   {
     "nombre": "María López",
     "email": "empleado@optica.com",
     "rol": "empleado",
     "activo": true
   }
   ```

### Opción 2: Script de Creación (Backend)

Crea un archivo `crear-usuario.js` en tu proyecto:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function crearEmpleado(email, password, nombre, rol = 'empleado') {
  try {
    // Crear usuario en Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: nombre,
    });

    // Crear documento en Firestore
    await admin.firestore().collection('usuarios').doc(userRecord.uid).set({
      nombre: nombre,
      email: email,
      rol: rol,
      activo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Usuario creado:', userRecord.uid);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejemplos de uso:
crearEmpleado('admin@optica.com', 'Admin123!', 'Administrador Óptica', 'admin');
crearEmpleado('vendedor@optica.com', 'Vendedor123!', 'Juan Vendedor', 'empleado');
```

Ejecutar con: `node crear-usuario.js`

### Opción 3: Endpoint en tu Backend (Recomendado)

Crea un endpoint protegido solo para administradores que permita crear nuevos empleados.

## 🛡️ Proteger Rutas en Angular

En tu archivo [app.routes.ts](app.routes.ts), usa los guards:

```typescript
import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: AuthCarousel },
  
  // Rutas protegidas (cualquier usuario autenticado)
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  
  // Rutas solo para administradores
  { 
    path: 'admin-dashboard', 
    component: AdminDashboardComponent,
    canActivate: [authGuard, adminGuard]
  },
  
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
```

## 🎨 Personalización del Logo

Cambia la imagen del login en [auth-carousel.html](src/app/shared/components/auth/auth-carousel.html):

```html
<img class="main-icon" src="img/LoginOptica.png" alt="Logo Óptica">
```

Coloca tu logo en `public/img/LoginOptica.png`

## 🚀 Próximos Pasos

1. ✅ **Crear usuarios iniciales** en Firebase
2. ✅ **Configurar rutas** con los guards
3. ✅ **Crear panel de administración** para gestionar empleados
4. ✅ **Agregar funcionalidad** para desactivar/activar usuarios
5. ✅ **Implementar cambio de contraseña** desde el perfil

## 📝 Notas Importantes

- Los empleados **NO pueden registrarse solos**, deben ser creados por un administrador
- El campo `activo` permite deshabilitar cuentas sin eliminarlas
- La recuperación de contraseña usa el email de Firebase Auth
- Los roles determinan a qué secciones puede acceder cada usuario

## 🐛 Solución de Problemas

### Error: "Usuario no encontrado en la base de datos"
- Verifica que existe un documento en `usuarios/[UID]` con el mismo UID del usuario en Auth

### Error: "Tu cuenta está inactiva"
- El campo `activo` está en `false`, cambiar a `true` en Firestore

### No redirige al dashboard correcto
- Verifica el campo `rol` en Firestore (debe ser 'admin' o 'empleado')
