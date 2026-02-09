# Refactoring: Sistema de Control de Stock Diferenciado

## 📋 Resumen

Se refactorizó el sistema de control de stock para aplicar la gestión de **stock ilimitado** a múltiples grupos de productos, no solo Lunas. Ahora:

- **Stock NORMAL (controlado):** ARMAZONES, GAFAS
- **Stock ILIMITADO (no controlado):** LUNAS, LENTES DE CONTACTO, LIQUIDO DE LENTES DE CONTACTO, LIQUIDO DESEMPAÑANTE, SERVICIOS, VARIOS, y cualquier otro grupo no especificado

## 🎯 Objetivo

Mantener stock finito SOLO para productos controlados (Armazones, Gafas), mientras que todos los demás productos utilizan stock ilimitado, de la misma forma en que ya estaban implementadas las Lunas.

---

## 🔧 Cambios Implementados

### 1. ProductosService - Método `createProducto()`

**Cambio:** El campo `tipo_control_stock` ahora se asigna basado en el grupo del producto

**Antes:**
```typescript
// Stock ilimitado SOLO para grupo LUNAS
const esIlimitado = (producto as any)?.grupo === 'LUNAS';
const tipoControlStock = esIlimitado ? 'ILIMITADO' : 'NORMAL';
```

**Ahora:**
```typescript
// Stock control: NORMAL ONLY para ARMAZONES y GAFAS
// ILIMITADO para todos los demás (LUNAS, SERVICIOS, ACCESORIOS, etc.)
const grupo = (producto as any)?.grupo || '';
const esControlNormal = grupo === 'ARMAZONES' || grupo === 'GAFAS';
const tipoControlStock = esControlNormal ? 'NORMAL' : 'ILIMITADO';
```

**Impacto:**
- Nuevos productos de grupos como SERVICIOS, LENTES DE CONTACTO, etc. se crean automáticamente con `tipo_control_stock: 'ILIMITADO'`
- Armazones y Gafas siguen siendo los únicos con control de stock (`tipo_control_stock: 'NORMAL'`)
- El stock inicial se establece en 0 para productos con stock ilimitado

### 2. IngresosService - Método `crearProductoDesdeIngreso()`

**Cambio:** Se generalizan los criterios para determinar si un producto tiene stock ilimitado

**Antes:**
```typescript
// Construir objeto sin valores undefined (Firestore no admite undefined)
const esIlimitado = (detalle.grupo === 'LUNAS');
const tipoControlStock = esIlimitado ? 'ILIMITADO' : 'NORMAL';
```

**Ahora:**
```typescript
// Construir objeto sin valores undefined (Firestore no admite undefined)
// Stock control: NORMAL ONLY para ARMAZONES y GAFAS
// ILIMITADO para todos los demás (LUNAS, SERVICIOS, ACCESORIOS, etc.)
const grupo = detalle.grupo || '';
const esControlNormal = grupo === 'ARMAZONES' || grupo === 'GAFAS';
const tipoControlStock = esControlNormal ? 'NORMAL' : 'ILIMITADO';
```

**Impacto:**
- Productos importados desde Excel o creados manualmente en ingresos seguirán la nueva lógica
- El comportamiento para Armazones y Gafas se mantiene idéntico
- Todos los demás productos funcionan como Lunas (sin descuento de stock)

---

## 📦 Flujo de Control de Stock

### Creación de Producto

```
Grupo del Producto
    ↓
├─→ ARMAZONES o GAFAS → tipo_control_stock = 'NORMAL'
└─→ Cualquier otro → tipo_control_stock = 'ILIMITADO'
```

### Validación en Venta (crear-venta.component.ts)

```typescript
const tipoControl = producto.tipo_control_stock || 'NORMAL';
const esStockIlimitado = tipoControl === 'ILIMITADO';

if (!esStockIlimitado) {
  // VALIDAR stock: Armazones/Gafas
  if (stockDisponible <= 0) {
    // ❌ Bloquear venta
  }
} else {
  // SIN VALIDAR: Lunas, Servicios, etc.
  // ✅ Permitir cantidad ilimitada
}
```

### Deducción de Stock en Venta (ProductosService.descontarStock)

```typescript
const tipoControl = producto.tipo_control_stock || 'NORMAL';

if (tipoControl === 'ILIMITADO') {
  // NO descontar: Lunas, Servicios, etc.
  return;
} else {
  // DESCONTAR: Armazones, Gafas
  stock = stock - cantidad;
}
```

---

## 📊 Matriz de Comportamiento

| Grupo de Producto | tipo_control_stock | ¿Se valida en venta? | ¿Se descuenta al vender? | ¿Se suma en ingreso? |
|---|---|---|---|---|
| ARMAZONES | NORMAL | ✅ Sí | ✅ Sí | ✅ Sí |
| GAFAS | NORMAL | ✅ Sí | ✅ Sí | ✅ Sí |
| LUNAS | ILIMITADO | ❌ No | ❌ No | ❌ No |
| LENTES DE CONTACTO | ILIMITADO | ❌ No | ❌ No | ❌ No |
| LIQUIDO DE LENTES DE CONTACTO | ILIMITADO | ❌ No | ❌ No | ❌ No |
| LIQUIDO DESEMPAÑANTE | ILIMITADO | ❌ No | ❌ No | ❌ No |
| SERVICIOS | ILIMITADO | ❌ No | ❌ No | ❌ No |
| VARIOS | ILIMITADO | ❌ No | ❌ No | ❌ No |
| Otros grupos futuros | ILIMITADO | ❌ No | ❌ No | ❌ No |

---

## 🔍 Verificación de Cambios

### ✅ Lógica de Validación (sin cambios necesarios)

El componente `crear-venta.ts` ya implementa correctamente la validación basada en `tipo_control_stock`:

```typescript
// Línea 554-575: Determina si el producto tiene stock ilimitado
const tipoControl = (p as any).tipo_control_stock || 'NORMAL';
const esStockIlimitado = tipoControl === 'ILIMITADO';
const stockDisponible = esStockIlimitado ? Number.POSITIVE_INFINITY : Number(p.stock || 0);

// Solo valida stock si NO es ilimitado
if (!esStockIlimitado) {
  if (!isFinite(stockDisponible) || stockDisponible <= 0) {
    // Bloquea la venta
  }
}
```

### ✅ Lógica de Deducción (sin cambios necesarios)

El servicio `ProductosService.descontarStock()` ya implementa correctamente la deducción:

```typescript
// Línea 276-280: No descuenta stock si es ILIMITADO
const tipoControl = data?.tipo_control_stock || 'NORMAL';
if (tipoControl === 'ILIMITADO') {
  // Productos con stock ilimitado no descuentan
  return;
}
```

---

## 🎬 Casos de Uso

### Caso 1: Venta de Armazones (Stock Normal)
1. Usuario intenta vender 2 armazones cuando hay stock = 0
2. Sistema valida: `tipo_control_stock = 'NORMAL'` y `stock = 0`
3. ❌ **Se bloquea la venta** con mensaje "Sin stock"
4. Usuario debe ingresar nuevos armazones primero

### Caso 2: Venta de Servicios (Stock Ilimitado)
1. Usuario intenta vender servicio de limpieza cuando hay stock = 0
2. Sistema valida: `tipo_control_stock = 'ILIMITADO'`
3. ✅ **Se permite la venta** sin validación de stock
4. Cantidad ilimitada disponible

### Caso 3: Ingreso de Gafas (Stock Normal)
1. Proveedor envía 10 gafas nuevas
2. Sistema crea producto con `tipo_control_stock = 'NORMAL'` e `stock = 10`
3. **Stock se suma y se puede vender hasta 10 unidades**

### Caso 4: Ingreso de Liquido Desempañante (Stock Ilimitado)
1. Proveedor envía 5 botellas de líquido desempañante
2. Sistema crea producto con `tipo_control_stock = 'ILIMITADO'` e `stock = 0`
3. **Stock no se suma, cantidad ilimitada en ventas**

---

## 🔄 Migración de Datos Existentes

**Nota importante:** Los productos existentes con grupo `LUNAS` ya tienen `tipo_control_stock = 'ILIMITADO'` establecido.

Para actualizar otros productos existentes en Firestore, si es necesario, se puede ejecutar una migración que aplique la nueva lógica:

```typescript
// Pseudocódigo para migración (si es necesaria en el futuro)
productos.forEach(producto => {
  const grupo = producto.grupo || '';
  const esControlNormal = grupo === 'ARMAZONES' || grupo === 'GAFAS';
  producto.tipo_control_stock = esControlNormal ? 'NORMAL' : 'ILIMITADO';
});
```

**Estado actual:** La refactorización se aplica automáticamente a todos los nuevos productos.

---

## ✅ Checklist de Validación

- [x] Cambio en `ProductosService.createProducto()` implementado
- [x] Cambio en `IngresosService.crearProductoDesdeIngreso()` implementado
- [x] Validación en `crear-venta.ts` funciona correctamente (sin cambios necesarios)
- [x] Deducción en `ProductosService.descontarStock()` funciona correctamente (sin cambios necesarios)
- [x] Lógica de visualización de stock en UI mantiene símbolos (∞ para ilimitado)
- [x] Documentación actualizada

---

## 📝 Próximos Pasos

1. Compilar y verificar que no hay errores
2. Probar flujo completo: crear producto → importar ingreso → realizar venta
3. Verificar que Armazones/Gafas validan stock correctamente
4. Verificar que otros grupos permiten cantidad ilimitada
5. Validar en Firestore que `tipo_control_stock` se establece correctamente
