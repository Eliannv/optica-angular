# 🔄 Sistema de Soft Delete (Eliminación Lógica)

## 📋 Descripción General

Este documento describe la implementación de **soft delete** (eliminación lógica) en el sistema. En lugar de eliminar físicamente registros de Firestore, los marcamos como inactivos con el campo `activo: boolean`.

## ✅ Beneficios

✓ **Escalabilidad**: No rompe referencias entre documentos  
✓ **Auditoría**: Mantienes historial completo de cambios  
✓ **Recuperación**: Puedes reactivar registros sin perder datos  
✓ **Integridad**: Preserva relaciones (facturas, ventas, etc.)  

## 📊 Entidades Afectadas

### 1. **Clientes**
```typescript
interface Cliente {
  // ... campos existentes
  activo?: boolean;  // 🔹 true = activo, false = desactivado
  updatedAt?: Date;  // Registro de última actualización
}
```


**Métodos en `ClientesService`:**
- `getClientes()` - Retorna SOLO clientes activos
- `createCliente()` - Nuevos clientes con `activo: true`
- `desactivarCliente(id)` - Marca como `activo: false` (SOFT DELETE)
- `activarCliente(id)` - Marca como `activo: true` (reversible)
- `deleteCliente(id)` - Eliminación física (HARD DELETE, solo test)

---

### 2. **Productos**
```typescript
interface Producto {
  // ... campos existentes
  activo?: boolean;  // 🔹 true = activo, false = desactivado
}
```

**Métodos en `ProductosService`:**
- `getProductos()` - Retorna SOLO productos activos
- `createProducto()` - Nuevos productos con `activo: true`
- `desactivarProducto(id)` - Marca como `activo: false` (SOFT DELETE)
- `activarProducto(id)` - Marca como `activo: true` (reversible)
- `deleteProducto(id)` - Eliminación física (HARD DELETE, solo test)

---

### 3. **Proveedores**
```typescript
interface Proveedor {
  // ... campos existentes
  activo?: boolean;  // 🔹 true = activo, false = desactivado
  updatedAt?: Date;
}
```

**Métodos en `ProveedoresService`:**
- `getProveedores()` - Retorna SOLO proveedores activos
- `addProveedor()` - Nuevos proveedores con `activo: true`
- `desactivarProveedor(id)` - Marca como `activo: false` (SOFT DELETE)
- `activarProveedor(id)` - Marca como `activo: true` (reversible)
- `deleteProveedor(id)` - Eliminación física (HARD DELETE, solo test)

---

### 4. **Cajas Chicas**
```typescript
interface CajaChica {
  // ... campos existentes
  activo?: boolean;  // 🔹 true = activo, false = desactivado
}
```

**Métodos en `CajaChicaService`:**
- `getCajasChicas()` - Retorna SOLO cajas activas
- `getCajasChicasAbiertas()` - Solo cajas ABIERTA Y activas
- `abrirCajaChica()` - Nueva caja con `activo: true`
- `desactivarCajaChica(id)` - Marca como `activo: false` (SOFT DELETE)
- `activarCajaChica(id)` - Marca como `activo: true` (reversible)
- `eliminarCajaChica(id)` - Eliminación física (HARD DELETE, solo test)

---

### 5. **Cajas Banco**
```typescript
interface CajaBanco {
  // ... campos existentes
  activo?: boolean;  // 🔹 true = activo, false = desactivado
}
```

**Métodos en `CajaBancoService`:**
- `getCajasBanco()` - Retorna SOLO cajas activas
- `abrirCajaBanco()` - Nueva caja con `activo: true`
- `desactivarCajaBanco(id)` - Marca como `activo: false` (SOFT DELETE)
- `activarCajaBanco(id)` - Marca como `activo: true` (reversible)
- `eliminarCajaBanco(id)` - Eliminación física (HARD DELETE, solo test)

---

## 🔍 Consultas Firestore

### Patrón de Soft Delete

**Obtener registros ACTIVOS:**
```typescript
const q = query(
  collection,
  where('activo', '!=', false)  // ✓ Incluye undefined, null, true
);
```

**Obtener registros INACTIVOS:**
```typescript
const q = query(
  collection,
  where('activo', '==', false)
);
```

**Obtener TODOS (incluyendo inactivos):**
```typescript
const q = query(collection);  // Sin filtro
```

---

## 🚀 Migración Inicial

### Paso 1: Limpiar datos existentes
```bash
node GUIAS/migrate-soft-delete.js
```

Este script:
1. ✓ Elimina todos los clientes, proveedores, productos, cajas chicas, cajas banco
2. ✓ Prepara la BD para el nuevo sistema de soft delete

### Paso 2: Verificación manual
- Accede a Firebase Console
- Verifica que las colecciones estén vacías
- Los nuevos documentos que crees ahora tendrán `activo: true`

---

## 💡 Casos de Uso

### Desactivar un Cliente
```typescript
// En componente
constructor(private clientesService: ClientesService) {}

async desactivarCliente(clienteId: string) {
  try {
    await this.clientesService.desactivarCliente(clienteId);
    // Cliente ahora no aparece en getClientes()
    // Pero sigue en BD para auditoría
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Reactivar un Producto
```typescript
async reactivarProducto(productoId: string) {
  try {
    await this.productosService.activarProducto(productoId);
    // Producto vuelve a ser visible en getProductos()
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Listar Inactivos (Admin)
```typescript
// Para auditoría/recuperación
async getClientesInactivos(): Promise<Cliente[]> {
  const q = query(
    collection(this.firestore, 'clientes'),
    where('activo', '==', false)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

---

## ⚠️ Consideraciones

### 1. **Índices en Firestore**
Para queries con `where('activo', '!=', false)` puede que necesites crear un índice compuesto si tienes:
- Múltiples filtros adicionales
- Muchos documentos (>1000)

Firebase Cloud Firestore te notificará automáticamente si lo necesitas.

### 2. **Performance**
- Las queries de soft delete son ligeramente más lentas que queries sin filtros
- Pero es negligible comparado a la durabilidad y escalabilidad ganada

### 3. **Backups**
- Los registros desactivados siguen siendo parte de tus backups
- Asegúrate de revisar políticas de retención si es necesario

---

## 📝 Cambios Detectados

### Modelos Actualizados
- ✅ Cliente: agregado `activo`, `updatedAt`
- ✅ Proveedor: agregado `activo`
- ✅ Producto: agregado `activo`
- ✅ CajaChica: agregado `activo`
- ✅ CajaBanco: agregado `activo`

### Servicios Actualizados
- ✅ ClientesService: soft delete + métodos activo/inactivo
- ✅ ProveedoresService: soft delete + métodos activo/inactivo
- ✅ ProductosService: soft delete + métodos activo/inactivo
- ✅ CajaChicaService: soft delete + métodos activo/inactivo
- ✅ CajaBancoService: soft delete + métodos activo/inactivo

### Queries Actualizadas
- ✅ Todas las queries de listado ahora filtran por `where('activo', '!=', false)`
- ✅ Las validaciones de unicidad incluyen solo registros activos

---

## 🔗 Referencias

**Próximas actualizaciones necesarias (interfaz/UI):**
- [ ] Componentes de listado: mostrar indicador "Inactivo"
- [ ] Acciones contextuales: botón "Reactivar" en lugar de "Eliminar"
- [ ] Admin panel: vista de registros desactivados
- [ ] Auditoría: tabla de `updatedAt` para historial

---

## ✨ Mejores Prácticas

1. **Siempre usar desactivar, no eliminar** (excepto en desarrollo)
2. **Registrar quién desactivó y cuándo** (agregar `desactivadoEn`, `desactivadoPor`)
3. **Mantener `updatedAt` actualizado** en cada cambio
4. **En reportes**: incluir opción "mostrar inactivos" para admin

---

**Fecha de implementación:** 16 de enero de 2026  
**Sistema:** OpticaAngular con Firebase Firestore  
**Versión:** 1.0
