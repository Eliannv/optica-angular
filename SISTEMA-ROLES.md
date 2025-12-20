# Sistema de Roles - Óptica Angular

## 📋 Descripción General

El sistema implementa control de acceso basado en roles (RBAC) con dos niveles de permisos:

### Roles Disponibles

| Código | Nombre | Descripción |
|--------|--------|-------------|
| 1 | ADMINISTRADOR | Gestión de productos y proveedores |
| 2 | OPERADOR | Gestión de clientes, historial clínico y ventas/facturas |

---

## 👥 Permisos por Rol

### 🔑 ADMINISTRADOR (Rol 1)

**Permisos:**

- ✅ Crear, editar y eliminar **Productos**
- ✅ Crear, editar y eliminar **Proveedores**
- ✅ **Acceso completo** a todas las funcionalidades del OPERADOR:
  - Crear, editar y listar **Clientes**
  - Crear y consultar **Historial Clínico**
  - Crear **Ventas (POS)**
  - Crear y consultar **Facturas**

**Restricciones:**

- ❌ Ninguna (acceso total al sistema)

**Menú visible:**

- Historial Clínico
- Productos
- Proveedores
- Ventas (POS)
- Facturas

---

### 👤 OPERADOR (Rol 2)

**Permisos:**

- ✅ Crear, editar y listar **Clientes**
- ✅ Crear y consultar **Historial Clínico**
- ✅ Crear **Ventas (POS)**
- ✅ Crear y consultar **Facturas**

**Restricciones:**

- ❌ No puede acceder a Productos
- ❌ No puede acceder a Proveedores

**Menú visible:**

- Historial Clínico
- Ventas (POS)
- Facturas

---

## 🔐 Creación de Usuarios

### Registro Público (Auth Carousel)
- **Cualquier persona** puede registrarse desde el formulario de login
- Los usuarios registrados públicamente **siempre** obtienen el rol **OPERADOR (2)**
- No es posible crear administradores desde el registro público

### Creación de Administradores
Los administradores deben ser creados **manualmente en Firestore**:

```javascript
// Ejemplo: Crear administrador directamente en Firestore
{
  id: "uid-del-usuario",
  nombre: "Juan Pérez",
  email: "admin@optica.com",
  rol: 1,  // RolUsuario.ADMINISTRADOR
  activo: true,
  createdAt: serverTimestamp()
}
```

O usando el script `crear-usuarios-iniciales.js` modificado.

---

## 🛡️ Protección de Rutas

Las rutas están protegidas mediante guards:

### authGuard
Verifica que el usuario esté autenticado.

### roleGuard
Verifica que el usuario tenga el rol correcto para acceder a la ruta.

**Ejemplo en app.routes.ts:**
```typescript
{
  path: 'productos',
  loadChildren: () => import('./modules/productos/productos-module')
    .then(m => m.ProductosModule),
  canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR])]
}
```

---

## 🚀 Migración de Usuarios Existentes

Si ya tienes usuarios en la base de datos con roles antiguos (`'admin'`, `'empleado'`), ejecuta el script de migración:

```bash
node migrar-roles-usuarios.js
```

**Este script:**
- Convierte `'admin'` → `RolUsuario.ADMINISTRADOR (1)`
- Convierte `'empleado'` → `RolUsuario.OPERADOR (2)`
- Es seguro ejecutarlo múltiples veces (detecta usuarios ya migrados)

---

## 📂 Archivos Modificados

### Modelos
- `src/app/core/models/usuario.model.ts`
  - Cambio de `type RolUsuario` a `enum RolUsuario`
  - Valores numéricos: 1 (ADMINISTRADOR), 2 (OPERADOR)

### Servicios
- `src/app/core/services/auth.service.ts`
  - Método `register()` asigna `RolUsuario.OPERADOR` por defecto
  - Nuevos métodos: `isAdmin()`, `isOperador()`
  - Import de `RolUsuario`

### Guards
- `src/app/core/guards/role.guard.ts` *(nuevo)*
  - Guard funcional para proteger rutas según rol
  - Redirige automáticamente según el rol del usuario si no tiene permiso

### Componentes
- `src/app/shared/components/sidebar/sidebar.ts`
  - Filtrado dinámico de menú según rol del usuario
  - Cada item tiene propiedad `roles: RolUsuario[]`
  
- `src/app/shared/components/auth/auth-carousel.ts`
  - Redirección después del login según rol:
    - ADMINISTRADOR → `/productos`
    - OPERADOR → `/clientes/historial-clinico`

### Rutas
- `src/app/app.routes.ts`
  - Todas las rutas protegidas con `roleGuard`
  - Redirección por defecto a `/login`

---

## 🧪 Pruebas

### Probar OPERADOR:
1. Registrar nuevo usuario desde el formulario público
2. Iniciar sesión
3. Verificar que solo ve: Historial Clínico, Ventas, Facturas
4. Intentar acceder a `/productos` → debe redirigir con mensaje de error

### Probar ADMINISTRADOR:
1. Crear usuario con `rol: 1` en Firestore
2. Iniciar sesión con ese usuario
3. Verificar que solo ve: Productos, Proveedores
4. Intentar acceder a `/clientes/historial-clinico` → debe redirigir con mensaje de error

---

## ⚠️ Notas Importantes

1. **Usuarios existentes:** Ejecutar script de migración antes de usar el nuevo sistema
2. **Administradores:** Solo se crean manualmente en la BD
3. **Seguridad:** Los guards protegen las rutas, pero considera agregar validación adicional en el backend/Firestore Rules
4. **Firestore Rules:** Actualizar las reglas de seguridad para validar roles también en el backend

---

## 🔧 Mantenimiento

### Agregar un nuevo rol:
1. Actualizar `enum RolUsuario` en `usuario.model.ts`
2. Actualizar permisos en `roleGuard`
3. Actualizar items del sidebar con el nuevo rol
4. Actualizar rutas en `app.routes.ts`
5. Actualizar script de migración si es necesario

### Cambiar permisos de una ruta:
Editar el array de roles permitidos en `app.routes.ts`:
```typescript
canActivate: [authGuard, roleGuard([RolUsuario.ADMINISTRADOR, RolUsuario.OPERADOR])]
```

---

## 📞 Soporte

Si encuentras problemas con el sistema de roles:
1. Verificar que el usuario tenga el campo `rol` con valor numérico en Firestore
2. Revisar la consola del navegador para errores de autenticación
3. Verificar que los guards estén correctamente aplicados en las rutas
