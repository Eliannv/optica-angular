# Sistema de Administración - Sucursales y Máquinas

## 🎯 Resumen Ejecutivo

Sistema centralizado para gestionar **sucursales** y **máquinas autorizadas** de forma dinámica, eliminando configuraciones hardcodeadas.

---

## 📁 Estructura de Carpetas

```
src/app/modules/administracion/
└── sucursales/
    ├── gestionar-maquinas/         # CRUD de máquinas (movido desde empleados)
    │   ├── gestionar-maquinas.component.ts
    │   ├── gestionar-maquinas.component.html
    │   └── gestionar-maquinas.component.css
    └── crear-sucursal/              # Formulario para nuevas sucursales
        ├── crear-sucursal.ts
        ├── crear-sucursal.html
        └── crear-sucursal.css
```

---

## 🗂️ Modelos

### Sucursal (`sucursal.model.ts`)
```typescript
{
  id?: string;              // Código de sucursal (ej: "MACH001")
  codigo: string;           // Código único alfanumérico
  nombre: string;           // Nombre descriptivo
  activo: boolean;          // Estado
  direccion?: string;       // Dirección física
  telefono?: string;        // Número de contacto
  fechaCreacion?: Date;     // Timestamp de creación
  creadoPor?: string;       // UID del creador
}
```

### Máquina Autorizada (`maquina-autorizada.model.ts`)
```typescript
{
  id?: string;
  machineId: string;        // ID único generado por hardware
  sucursal: string;         // Código de sucursal (ej: "MACH001")
  nombreMaquina: string;
  activo: boolean;
  fechaRegistro: Date;
  ultimoAcceso?: Date;
  observaciones?: string;
  autorizadoPor?: string;
}
```

---

## 🔥 Colecciones Firestore

### `sucursales`
```javascript
{
  "MACH001": {
    codigo: "MACH001",
    nombre: "MACHALA CENTRO",
    activo: true,
    direccion: "Av. 25 de Junio y Rocafuerte",
    telefono: "07-2930000",
    fechaCreacion: Timestamp,
    creadoPor: "system"
  }
}
```

### `maquinas_autorizadas`
```javascript
{
  "uuid-auto-generado": {
    machineId: "16-chars-hash",
    sucursal: "MACH001",
    nombreMaquina: "PC Recepción Machala",
    activo: true,
    fechaRegistro: Timestamp
  }
}
```

---

## 🛠️ Servicios

### `SucursalesService`

**Métodos principales:**
- `getSucursales()` → Observable de todas las sucursales
- `getSucursalesActivas()` → Solo activas (para selección)
- `guardarSucursal(sucursal, creadoPor)` → Crear/actualizar
- `cambiarEstadoSucursal(id, activo)` → Toggle estado
- `eliminarSucursal(id)` → Eliminar permanentemente
- `existeCodigo(codigo, excluirId?)` → Validar duplicados

### `MaquinasAutorizadasService`

**Actualizado para usar sucursales dinámicas:**
- `getMaquinasAutorizadas()` → Todas las máquinas
- `getMaquinasPorSucursal(codigo)` → Filtrar por sucursal
- `guardarMaquina(maquina, autorizadoPor)` → CRUD
- `cambiarEstadoMaquina(id, activo)` → Toggle
- `eliminarMaquina(id)` → Eliminar

---

## 🧭 Rutas

### Configuración en `app.routes.ts`
```typescript
{
  path: 'administracion',
  children: [
    {
      path: 'gestionar-maquinas',
      loadComponent: () => import('./modules/administracion/sucursales/gestionar-maquinas/...')
    },
    {
      path: 'crear-sucursal',
      loadComponent: () => import('./modules/administracion/sucursales/crear-sucursal/...')
    },
    { path: '', redirectTo: 'gestionar-maquinas', pathMatch: 'full' }
  ]
}
```

### Menú Lateral (`sidebar.ts`)
```typescript
{
  label: 'Administración',
  icon: '<svg>monitor-check</svg>',
  roles: [RolUsuario.ADMINISTRADOR],
  children: [
    { label: 'Gestionar Máquinas', route: '/administracion/gestionar-maquinas' },
    { label: 'Nueva Sucursal', route: '/administracion/crear-sucursal' }
  ]
}
```

---

## 💻 Componentes

### `crear-sucursal`

**Campos del formulario:**
- **Código** (requerido, uppercase alfanumérico) - Validación: `/^[A-Z0-9]+$/`
- **Nombre** (requerido, min 3 caracteres)
- **Dirección** (opcional)
- **Teléfono** (opcional)
- **Estado** (toggle switch, default: activo)

**Validaciones:**
- ✅ Código único (verifica duplicados con `existeCodigo()`)
- ✅ Formulario completo antes de guardar
- ✅ SweetAlert2 para confirmaciones

**Flujo:**
1. Llenar formulario
2. Validar campos requeridos
3. Verificar código único
4. Confirmar con SweetAlert2
5. Guardar en Firestore
6. Redirigir a Gestionar Máquinas

---

### `gestionar-maquinas`

**Cambios principales:**
- ❌ Eliminado botón "Registrar Máquinas Iniciales"
- ✅ Agregado botón "Nueva Sucursal" (verde)
- ✅ Select de sucursales ahora dinámico:
  ```html
  @for (sucursal of sucursales(); track sucursal.id) {
    <option [value]="sucursal.codigo">{{ sucursal.nombre }}</option>
  }
  ```
- ✅ Carga sucursales activas en `ngOnInit()`
- ✅ Estadística `totalSucursales` ahora cuenta `sucursales().length`

**Tarjetas estadísticas:**
- Total Máquinas
- Máquinas Activas
- Máquinas Inactivas
- Total Sucursales (dinámico)

---

## 📜 Scripts de Inicialización

### `registrar-sucursales-iniciales.js`

Crea 4 sucursales base:
```javascript
MACH001 - MACHALA CENTRO
PASJ001 - PASAJE
DEV001  - DESARROLLO 1
DEV002  - DESARROLLO 2
```

**Ejecución:**
```bash
node registrar-sucursales-iniciales.js
```

---

## 🔒 Reglas de Firestore

```javascript
// Sucursales
match /sucursales/{sucursalId} {
  allow read: if isSignedIn();
  allow create, update, delete: if isAdmin();
}

// Máquinas Autorizadas
match /maquinas_autorizadas/{maquinaId} {
  allow read: if isSignedIn();
  allow create, update, delete: if isAdmin();
}
```

---

## 🚀 Flujo de Trabajo Completo

### 1. Crear Sucursal
1. Ir a **Administración > Nueva Sucursal**
2. Llenar formulario (código debe ser único)
3. Guardar → Redirige a Gestionar Máquinas

### 2. Asignar Máquina
1. En **Gestionar Máquinas**, click "Nueva Máquina"
2. Seleccionar sucursal del dropdown (carga dinámicamente)
3. Ingresar Machine ID y nombre
4. Guardar

### 3. Desbloquear Empleado
1. Ir a **Empleados**
2. Click "Desbloquear" en empleado
3. Seleccionar máquina del dropdown (muestra: "Nombre - Sucursal")
4. Confirmar → Empleado recibe `machineId` y `sucursal`

---

## 🔍 Integración con Electron

### `electron/main.js`
```javascript
async function verificarSucursal() {
  const machineId = getUniqueMachineId();
  const snapshot = await db.collection('maquinas_autorizadas')
    .where('machineId', '==', machineId)
    .where('activo', '==', true)
    .get();
  
  if (snapshot.empty) {
    // Mostrar error y bloquear acceso
  } else {
    // Obtener sucursal de la máquina
    const maquinaData = snapshot.docs[0].data();
    global.sucursalActual = maquinaData.sucursal;
  }
}
```

---

## ✅ Checklist de Migración Completado

- [x] Crear modelo `Sucursal`
- [x] Crear servicio `SucursalesService`
- [x] Crear componente `crear-sucursal`
- [x] Reorganizar carpetas: `administracion/sucursales/`
- [x] Mover `gestionar-maquinas` a nueva ubicación
- [x] Actualizar rutas en `app.routes.ts`
- [x] Agregar sección "Administración" en sidebar
- [x] Actualizar modelo `MaquinaAutorizada` (sucursal: string)
- [x] Modificar `gestionar-maquinas` para usar sucursales dinámicas
- [x] Eliminar constante `SUCURSALES` hardcodeada
- [x] Quitar botón "Registrar Máquinas Iniciales"
- [x] Agregar botón "Nueva Sucursal"
- [x] Actualizar reglas de Firestore
- [x] Crear script `registrar-sucursales-iniciales.js`
- [x] Ejecutar script y poblar Firestore

---

## 🎨 UI/UX

### Botones
- **Nueva Sucursal**: `btn-success` (verde) con ícono `building-add`
- **Nueva Máquina**: `btn-primary` (azul) con ícono `plus-lg`
- **Guardar**: `btn-primary` con spinner durante carga
- **Cancelar**: `btn-secondary`

### Alertas
Todas las alertas usan **SweetAlert2**:
- ✅ Éxito → `icon: 'success'`, auto-cierre 2s
- ⚠️ Advertencia → `icon: 'warning'`
- ❌ Error → `icon: 'error'`
- ❓ Confirmación → `icon: 'question'` con botones Sí/Cancelar

---

## 📊 Estadísticas y Getters

```typescript
// En gestionar-maquinas.component.ts
get totalMaquinas(): number {
  return this.maquinas().length;
}

get maquinasActivas(): number {
  return this.maquinas().filter(m => m.activo).length;
}

get totalSucursales(): number {
  return this.sucursales().length; // ✨ Dinámico
}
```

---

## 🐛 Troubleshooting

### Error: "No hay sucursales disponibles"
**Causa:** La colección `sucursales` está vacía.

**Solución:**
```bash
node registrar-sucursales-iniciales.js
```

### Select de sucursales vacío
**Causa:** No se están cargando las sucursales activas.

**Verificar:**
1. `ngOnInit()` llama a `cargarSucursales()`
2. Firestore tiene sucursales con `activo: true`
3. Console sin errores de Firestore

### Máquina no puede guardar sin sucursal
**Causa:** No hay sucursales activas para seleccionar.

**Fix:**
1. Crear al menos una sucursal activa
2. O activar sucursales existentes en Firestore

---

## 🔮 Próximas Mejoras

- [ ] Editar sucursales existentes
- [ ] Soft delete para sucursales
- [ ] Asignar múltiples máquinas a un empleado
- [ ] Migrar máquinas existentes a nuevos códigos de sucursal
- [ ] Dashboard con gráficas de distribución por sucursal
- [ ] Historial de cambios de asignación de empleados

---

**Última actualización:** $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Autor:** Sistema de Administración OpticaAngular
