# ✅ Autenticación Configurada

## 📦 Archivos Creados/Modificados

### Nuevos Archivos:
1. ✅ `src/app/core/services/auth.service.ts` - Servicio de autenticación con Firebase
2. ✅ `src/app/core/guards/auth.guard.ts` - Guards de protección de rutas
3. ✅ `AUTH-README.md` - Documentación completa del sistema de autenticación
4. ✅ `crear-usuarios-iniciales.js` - Script para crear usuarios en Firebase

### Archivos Modificados:
1. ✅ `src/app/shared/components/auth/auth-carousel.ts` - Componente de login adaptado
2. ✅ `src/app/shared/components/auth/auth-carousel.html` - Template simplificado
3. ✅ `src/app/shared/components/navbar/navbar.ts` - Navbar con logout
4. ✅ `src/app/app.config.ts` - Configuración con animaciones
5. ✅ `src/app/app.routes.ts` - Rutas protegidas con guards
6. ✅ `README.md` - Actualizado con instrucciones

## 🎯 Próximos Pasos

### 1. Crear Usuarios en Firebase

**Opción A: Usando el script (Recomendado)**
```bash
# 1. Descarga la clave privada de Firebase Admin SDK
#    Firebase Console > Project Settings > Service Accounts > Generate new private key
#    Guárdala como 'serviceAccountKey.json' en la raíz del proyecto

# 2. Ejecuta el script
node crear-usuarios-iniciales.js
```

**Opción B: Manualmente desde Firebase Console**
1. Ve a Firebase Console → Authentication
2. Agrega usuarios con email/contraseña
3. Copia el UID de cada usuario
4. Ve a Firestore Database → Colección `usuarios`
5. Crea un documento con el UID como ID:
```json
{
  "nombre": "Juan Pérez",
  "email": "juan@optica.com",
  "rol": "empleado",
  "activo": true
}
```

### 2. Probar el Login

```bash
# Iniciar el servidor de desarrollo
ng serve

# Abrir en el navegador
http://localhost:4200
```

**Credenciales de prueba (si usaste el script):**
- Admin: `admin@optica.com` / `Admin123!`
- Empleado: `vendedor1@optica.com` / `Vendedor123!`

### 3. Personalizar

#### Cambiar el logo:
- Coloca tu logo en `public/img/LoginOptica.png`

#### Modificar textos:
- Edita `src/app/shared/components/auth/auth-carousel.html`

#### Ajustar colores:
- Edita `src/app/shared/components/auth/auth-carousel.scss`

## 🔐 Características Implementadas

### ✅ Autenticación
- Login con email/contraseña
- Recuperación de contraseña
- Validación de formularios reactivos
- Mensajes de error personalizados
- Estados de carga

### ✅ Seguridad
- Rutas protegidas con guards
- Validación de roles (admin/empleado)
- Cuentas activas/inactivas
- Cierre de sesión confirmado

### ✅ Firestore
- Datos de usuario sincronizados
- Observable del estado de autenticación
- Verificación en tiempo real

## 📋 Estructura de Usuario en Firestore

```typescript
interface Usuario {
  id?: string;           // UID de Firebase Auth
  nombre: string;        // Nombre completo
  email: string;         // Email (para login)
  rol: 'admin' | 'empleado';  // Rol del usuario
  activo: boolean;       // Si puede acceder al sistema
  createdAt?: any;       // Fecha de creación
}
```

## 🚨 Solución de Problemas

### Error: "Usuario no encontrado en la base de datos"
- Verifica que el documento existe en `usuarios/[UID]`
- El UID debe coincidir con el de Firebase Auth

### Error: "Tu cuenta está inactiva"
- Cambia el campo `activo` a `true` en Firestore

### No redirige correctamente
- Verifica que el campo `rol` sea 'admin' o 'empleado'
- Revisa que las rutas estén configuradas correctamente

### Problemas con las animaciones
- Verifica que `@angular/animations` esté instalado
- Revisa que `provideAnimations()` esté en `app.config.ts`

## 📚 Documentación Adicional

- [AUTH-README.md](AUTH-README.md) - Guía completa de autenticación
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [Angular Guards](https://angular.dev/guide/routing/common-router-tasks#preventing-unauthorized-access)

## 🎉 ¡Listo para usar!

Tu sistema de autenticación está completamente configurado y listo para usar. 
Los empleados ahora pueden acceder de forma segura a la aplicación.

**Siguiente paso recomendado:** Crear un panel de administración para gestionar empleados.
