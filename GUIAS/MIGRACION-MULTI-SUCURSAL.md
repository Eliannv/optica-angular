# Script de Migración: Sistema Multi-Sucursal con Control Centralizado

## 📋 Resumen de Cambios

Se ha implementado un sistema completo de control de acceso multi-sucursal donde:

1. **El administrador desde Machala** puede controlar qué máquinas tienen acceso
2. **Las máquinas se registran en Firestore** (colección `maquinas_autorizadas`)
3. **Electron consulta Firestore** al iniciar para verificar autorización
4. **Soporta 4 sucursales**: MACHALA, PASAJE, DESARROLLO_1, DESARROLLO_2

## 🚀 Pasos de Implementación

### 1. Instalar Dependencia en Electron

```bash
npm install firebase-admin --save
```

### 2. Configurar Firebase Admin

Asegúrate de tener el archivo `serviceAccountKey.json` en la raíz del proyecto.
Si no lo tienes:

1. Ve a Firebase Console → Configuración del proyecto → Cuentas de servicio
2. Genera nueva clave privada
3. Guarda como `serviceAccountKey.json` en la raíz

### 3. Registrar Máquinas Iniciales

Desde la aplicación web (como administrador):

1. Inicia sesión como administrador
2. Ve a "Gestionar Máquinas" en el menú
3. Haz clic en "Registrar Máquinas Iniciales"
4. Se crearán automáticamente las 4 máquinas:
   - `858744ddedd2fca1` → DESARROLLO_1
   - `e1561953fadb3e82` → DESARROLLO_2
   - `45dfe499c7a935ed` → PASAJE
   - `d87cced3d5d6611b` → MACHALA

### 4. Desplegar Reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

### 5. Probar el Sistema

1. **Máquina autorizada**: Ejecutar Electron → Debe permitir acceso
2. **Máquina NO autorizada**: Ejecutar Electron → Debe mostrar error con Machine ID
3. **Desactivar máquina**: Desde panel admin → Electron debe denegar acceso

## 📁 Archivos Creados/Modificados

### Nuevos Archivos
- `src/app/core/models/maquina-autorizada.model.ts`
- `src/app/core/services/maquinas-autorizadas.service.ts`
- `src/app/modules/empleados/gestionar-maquinas/gestionar-maquinas.component.ts`
- `src/app/modules/empleados/gestionar-maquinas/gestionar-maquinas.component.html`
- `src/app/modules/empleados/gestionar-maquinas/gestionar-maquinas.component.css`

### Archivos Modificados
- `electron/main.js` - Consulta Firestore en lugar de IDs hardcodeados
- `firestore.rules` - Reglas multi-sucursal
- `src/app/app.routes.ts` - Ruta para gestionar máquinas

## 🔐 Estructura de Seguridad

### Colección: `maquinas_autorizadas`
```typescript
{
  id: string,              // Machine ID (16 caracteres)
  machineId: string,       // Mismo que ID
  sucursal: 'MACHALA' | 'PASAJE' | 'DESARROLLO_1' | 'DESARROLLO_2',
  nombreMaquina: string,   // "PC Recepción Pasaje"
  activo: boolean,         // true = autorizada
  fechaRegistro: Date,
  ultimoAcceso: Date,      // Se actualiza cada vez que inicia
  observaciones: string,
  autorizadoPor: string    // UID del admin
}
```

### Reglas de Firestore
- Cualquier usuario autenticado puede **leer** `maquinas_autorizadas` (necesario para Electron)
- Solo **administradores** pueden crear/modificar/eliminar máquinas
- Los operadores necesitan `sucursal` válida + `activo: true` para operar

## 🎯 Flujo de Autorización

```
1. Electron inicia
   ↓
2. Genera Machine ID de la PC
   ↓
3. Consulta Firestore: ¿Existe este Machine ID activo?
   ↓
4a. SI → Permite acceso, muestra sucursal en título
4b. NO → Muestra error con Machine ID, cierra app
   ↓
5. Actualiza ultimoAcceso en Firestore
```

## 📝 Agregar Nueva Máquina

### Opción 1: Desde Panel de Administración (Recomendado)

1. Obtener Machine ID:
   - Ejecutar Electron en la PC nueva
   - Copiar el Machine ID del mensaje de error
   
2. Registrar en el sistema:
   - Login como admin → Gestionar Máquinas
   - Nueva Máquina
   - Pegar Machine ID
   - Seleccionar sucursal
   - Nombre descriptivo
   - Guardar

### Opción 2: Script Manual

```javascript
// En consola de Firebase o script Node.js
const admin = require('firebase-admin');
// ... inicializar admin

await admin.firestore().collection('maquinas_autorizadas').doc('NUEVO_MACHINE_ID').set({
  machineId: 'NUEVO_MACHINE_ID',
  sucursal: 'PASAJE',
  nombreMaquina: 'PC Caja Pasaje',
  activo: true,
  fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
  autorizadoPor: 'admin_uid'
});
```

## ⚙️ Configuración de Usuarios

Los usuarios ahora deben tener:
- `sucursal`: 'MACHALA' | 'PASAJE' | 'DESARROLLO_1' | 'DESARROLLO_2'
- `activo`: true

Ejemplo:
```typescript
{
  uid: 'abc123',
  email: 'operador@optica.com',
  rol: RolUsuario.OPERADOR,
  sucursal: 'PASAJE',
  activo: true
}
```

## 🐛 Troubleshooting

### Error: "No se pudo conectar a Firestore"
- Verifica que existe `serviceAccountKey.json`
- Revisa que las credenciales sean correctas
- Confirma conexión a Internet

### Error: "Machine ID no autorizado"
- Copia el Machine ID del error
- Regístralo en el panel de administración
- Asegúrate de marcarlo como activo

### La máquina sigue bloqueada después de activarla
- Cierra completamente Electron
- Vuelve a abrir (consultará Firestore nuevamente)

## 🔄 Migración desde Sistema Anterior

Si tenías usuarios con `sucursal: "PASAJE"` hardcodeado:

1. Actualizar usuarios existentes:
```javascript
// Script de migración para usuarios
const usuarios = await firestore.collection('usuarios').get();
for (const doc of usuarios.docs) {
  if (!doc.data().sucursal) {
    await doc.ref.update({ sucursal: 'PASAJE', activo: true });
  }
}
```

2. Las máquinas ya están en el código, solo ejecuta "Registrar Máquinas Iniciales"

## 📊 Monitoreo

Desde "Gestionar Máquinas" puedes ver:
- Total de máquinas registradas
- Cuántas están activas/inactivas
- Última vez que accedieron
- Distribución por sucursal

## 🔒 Seguridad

- Los Machine IDs son hashes únicos de 16 caracteres
- No pueden ser falsificados fácilmente
- Se verifican en cada inicio de Electron
- Solo el admin puede modificar autorizaciones
- El `ultimoAcceso` sirve como auditoría

## 🎨 Interfaz de Usuario

El panel de gestión permite:
- ✅ Ver todas las máquinas
- ✅ Activar/Desactivar con un clic
- ✅ Editar nombre y sucursal
- ✅ Agregar observaciones
- ✅ Ver último acceso
- ✅ Filtros visuales por sucursal

---

**¿Próximos pasos?**
- Agregar botón en empleados.component.html para acceder a "Gestionar Máquinas"
- Actualizar navegación/menú principal
- Probar en todas las máquinas
