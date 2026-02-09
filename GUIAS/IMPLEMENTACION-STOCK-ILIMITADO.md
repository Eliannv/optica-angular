# Implementación de Control de Stock ILIMITADO para Lunas

## 📋 Resumen

Se implementó correctamente el manejo de productos tipo **LUNAS** (stock ilimitado) en el sistema de ingresos/facturas de proveedor, permitiendo registrar la compra de estos productos sin modificar el inventario físico.

## 🎯 Objetivo Alcanzado

Los productos LUNAS ahora:
- ✅ Se registran en facturas de proveedor
- ✅ **NO** modifican el stock del inventario
- ✅ **SÍ** calculan correctamente el costo de la factura
- ✅ Se incluyen en subtotales, IVA, descuentos y fletes
- ✅ Funcionan en **importación Excel** y **creación manual**

---

## 🔧 Cambios Implementados

### 1️⃣ **Modelo de Producto** (`producto.model.ts`)

Se agregó el campo `tipo_control_stock`:

```typescript
/** Tipo de control de stock: NORMAL (suma stock) | ILIMITADO (no suma stock, solo cálculo de costos) */
tipo_control_stock?: 'NORMAL' | 'ILIMITADO';
```

**Valores permitidos:**
- `'NORMAL'`: Productos con stock físico (armazones, accesorios)
- `'ILIMITADO'`: Productos sin stock físico (lunas, servicios)

**Compatibilidad legacy:** Se mantiene el campo `stockIlimitado` para datos históricos.

---

### 2️⃣ **Servicio de Ingresos** (`ingresos.service.ts`)

#### **Método: `finalizarIngreso()`**

Se actualizó la lógica de actualización de stock para productos existentes:

```typescript
// Solo actualizar stock si el tipo de control es NORMAL (no ILIMITADO)
const tipoControl = productoData.tipo_control_stock || 
                    ((productoData as any)?.stockIlimitado ? 'ILIMITADO' : 'NORMAL');

if (tipoControl === 'NORMAL') {
  const stockActual = productoData.stock || 0;
  const nuevoStock = stockActual + detalle.cantidad;
  actualizaciones.stock = nuevoStock;
}
// Si es ILIMITADO: cantidad se usa SOLO para calcular subtotal, NO se suma al stock
```

**Comportamiento:**
- **NORMAL:** Suma `cantidad` al stock existente
- **ILIMITADO:** NO modifica stock, solo registra la cantidad para cálculo del costo

#### **Método: `crearProductoDesdeIngreso()`**

Los nuevos productos del grupo `LUNAS` se crean con `tipo_control_stock = 'ILIMITADO'`:

```typescript
const esIlimitado = (detalle.grupo === 'LUNAS');
const tipoControlStock = esIlimitado ? 'ILIMITADO' : 'NORMAL';

const nuevoProducto: any = {
  idInterno: productoIdInterno,
  nombre: detalle.nombre,
  stock: esIlimitado ? 0 : detalle.cantidad, // Lunas no suman stock inicial
  tipo_control_stock: tipoControlStock,
  // ... resto de campos
};
```

#### **Método: `actualizarStockProducto()`**

Se agregó validación explícita por tipo de control:

```typescript
const tipoControl = producto.tipo_control_stock || 
                    ((producto as any)?.stockIlimitado ? 'ILIMITADO' : 'NORMAL');

// Solo actualizar stock si el control es NORMAL
if (tipoControl === 'NORMAL') {
  const nuevoStock = (producto.stock || 0) + cantidad;
  updateData.stock = nuevoStock;
}
// Para productos ILIMITADOS: cantidad se usa SOLO para calcular costo total
```

---

### 3️⃣ **Servicio de Productos** (`productos.ts`)

#### **Método: `createProducto()`**

Los productos nuevos se crean con `tipo_control_stock` según el grupo:

```typescript
const esIlimitado = (producto as any)?.grupo === 'LUNAS';
const tipoControlStock = esIlimitado ? 'ILIMITADO' : 'NORMAL';

return addDoc(this.productosRef, {
  ...producto,
  idInterno,
  tipo_control_stock: tipoControlStock,
  stock: esIlimitado ? 0 : (producto.stock || 0),
  // Mantener stockIlimitado para compatibilidad con datos legacy
  ...(esIlimitado ? { stockIlimitado: true } : {}),
});
```

#### **Método: `descontarStock()`**

Al descontar stock en ventas, se verifica el tipo de control:

```typescript
const tipoControl = data?.tipo_control_stock || 
                    (data?.stockIlimitado ? 'ILIMITADO' : 'NORMAL');

if (tipoControl === 'ILIMITADO') {
  // Productos con stock ilimitado no descuentan
  return;
}
```

---

## 📦 Flujos Funcionales

### **Importación por Excel**

1. ✅ Usuario sube archivo Excel con productos (incluyendo LUNAS)
2. ✅ Sistema detecta grupo `'LUNAS'` en columna correspondiente
3. ✅ Al finalizar importación:
   - **LUNAS:** `cantidad` → se usa para calcular `subtotal = cantidad × costo`
   - **LUNAS:** `stock` → NO se modifica (permanece en 0 o valor previo)
   - **Otros:** `cantidad` → se suma al stock existente

### **Creación Manual de Factura Proveedor**

1. ✅ Usuario crea ingreso y agrega productos
2. ✅ Al agregar producto LUNAS:
   - Se pide `cantidad` (para cálculo de costo)
   - Se registra el gasto en la factura
   - **NO** se suma al stock
3. ✅ Al finalizar ingreso:
   - Total de factura incluye LUNAS correctamente
   - Stock de LUNAS no cambia

---

## 🧪 Validaciones Implementadas

### ✅ Validación de tipo de control

```typescript
const tipoControl = producto.tipo_control_stock || 
                    (producto.stockIlimitado ? 'ILIMITADO' : 'NORMAL');
```

**Lógica de fallback:**
1. Primero intenta usar `tipo_control_stock`
2. Si no existe, verifica `stockIlimitado` (legacy)
3. Por defecto asume `'NORMAL'` si no hay ninguno

### ✅ Cálculo de totales

Los productos ILIMITADOS **SÍ** se incluyen en:
- ✅ Subtotal de productos
- ✅ IVA de la factura
- ✅ Descuentos aplicados
- ✅ Flete de la factura
- ✅ Total final del ingreso

**Fórmula:**
```typescript
totalFactura += (detalle.costoUnitario || 0) * detalle.cantidad;
```

---

## 📁 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| [`producto.model.ts`](src/app/core/models/producto.model.ts) | Agregado campo `tipo_control_stock` |
| [`ingresos.service.ts`](src/app/core/services/ingresos.service.ts) | Lógica de actualización de stock según tipo de control |
| [`productos.ts`](src/app/core/services/productos.ts) | Creación y descuento de stock según tipo de control |

---

## 🔄 Compatibilidad con Datos Legacy

Se mantiene compatibilidad con productos existentes que usan `stockIlimitado`:

```typescript
const tipoControl = producto.tipo_control_stock || 
                    ((producto as any)?.stockIlimitado ? 'ILIMITADO' : 'NORMAL');
```

**Migración automática:** Los productos LUNAS existentes funcionarán correctamente aunque no tengan `tipo_control_stock`, ya que el sistema detecta `stockIlimitado` como fallback.

---

## 📊 Ejemplo de Uso

### **Factura con productos mixtos**

```
Proveedor: OPTICA XYZ
Factura: 001-001-0001234
Fecha: 24/01/2026

Productos:
1. Armazón Ray-Ban (NORMAL)    - Cantidad: 10 - Costo: $50  → Stock: +10 unidades
2. Luna CR-39 (ILIMITADO)       - Cantidad: 20 - Costo: $15  → Stock: sin cambios
3. Estuche (NORMAL)             - Cantidad: 15 - Costo: $2   → Stock: +15 unidades

Cálculos:
- Subtotal productos: $1030 (50×10 + 15×20 + 2×15)
- IVA (15%): $154.50
- Flete: $50
- Descuento: $20
- TOTAL FACTURA: $1214.50 ✅

Inventario:
- Armazón Ray-Ban: +10 unidades ✅
- Luna CR-39: sin cambios (stock ilimitado) ✅
- Estuche: +15 unidades ✅
```

---

## ✅ Checklist de Cumplimiento

- ✅ Modelo de producto tiene `tipo_control_stock`
- ✅ Importación Excel: LUNAS no suman stock
- ✅ Importación Excel: LUNAS calculan subtotal
- ✅ Creación manual: LUNAS no suman stock
- ✅ Creación manual: LUNAS calculan costo
- ✅ Totales incluyen LUNAS (subtotal, IVA, descuento, flete)
- ✅ Compatibilidad con datos legacy (`stockIlimitado`)
- ✅ Sin errores de compilación
- ✅ Código limpio y documentado
- ✅ Comentarios JSDoc donde aportan valor

---

## 🚀 Próximos Pasos (Opcional)

Si se desea migrar los datos legacy:

1. Crear script de migración para agregar `tipo_control_stock` a productos existentes
2. Detectar productos con `stockIlimitado = true` y asignarles `tipo_control_stock = 'ILIMITADO'`
3. Detectar productos del grupo `'LUNAS'` sin `tipo_control_stock` y asignarles `'ILIMITADO'`
4. Productos sin ninguno de estos indicadores: asignar `tipo_control_stock = 'NORMAL'`

---

## 📝 Notas Técnicas

- El campo `tipo_control_stock` es **opcional** para mantener compatibilidad
- Los productos LUNAS siempre tienen `stock = 0` en BD
- La cantidad de LUNAS en facturas es **solo informativa** para cálculo de costos
- El sistema respeta la lógica: **LUNAS = stock ilimitado = NO suma inventario**
- Los movimientos de stock se registran normalmente, pero el stock físico no cambia

---

## 🎨 Mejoras Visuales en Punto de Venta (POS)

### **Indicadores de Stock con Colores**

Se agregaron indicadores visuales de stock en la lista de productos del POS ([crear-venta](src/app/modules/ventas/crear-venta/crear-venta.ts)):

#### **Clases de Color según Stock**

| Color | Clase CSS | Condición | Significado |
|-------|-----------|-----------|-------------|
| 🟢 Verde | `badge-success` | Stock > 10 | Disponibilidad alta |
| 🟡 Amarillo | `badge-warning` | 1 ≤ Stock ≤ 10 | Disponibilidad baja |
| 🔴 Rojo | `badge-danger` | Stock = 0 | Sin stock |
| 🔵 Azul | `badge-info` | tipo_control_stock = 'ILIMITADO' | Stock ilimitado (∞) |

#### **Métodos Implementados**

```typescript
/**
 * Retorna clase CSS para indicador de stock según disponibilidad
 */
getStockBadgeClass(p: any): string {
  const tipoControl = (p as any).tipo_control_stock || 
                      ((p as any).stockIlimitado ? 'ILIMITADO' : 'NORMAL');
  
  if (tipoControl === 'ILIMITADO') {
    return 'badge-info'; // Azul para stock ilimitado
  }
  
  const stock = Number(p.stock || 0);
  if (stock > 10) return 'badge-success'; // Verde
  if (stock > 0) return 'badge-warning';  // Amarillo
  return 'badge-danger';                   // Rojo
}

/**
 * Retorna texto descriptivo del stock
 */
getStockText(p: any): string {
  const tipoControl = (p as any).tipo_control_stock || 
                      ((p as any).stockIlimitado ? 'ILIMITADO' : 'NORMAL');
  
  if (tipoControl === 'ILIMITADO') {
    return '∞'; // Símbolo infinito para stock ilimitado
  }
  
  return String(p.stock || 0);
}
```

### **Validación de Stock en POS**

Se actualizó la lógica de validación para productos ILIMITADOS:

```typescript
// Determinar tipo de control de stock (NORMAL o ILIMITADO)
const tipoControl = (p as any).tipo_control_stock || 
                    ((p as any).stockIlimitado ? 'ILIMITADO' : 'NORMAL');
const esStockIlimitado = tipoControl === 'ILIMITADO';
const stockDisponible = esStockIlimitado ? Number.POSITIVE_INFINITY : Number(p.stock || 0);

// Solo validar stock si el producto NO es ILIMITADO (ej: no es LUNAS)
if (!esStockIlimitado) {
  // Validaciones de stock solo para productos NORMALES
  if (!isFinite(stockDisponible) || stockDisponible <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Sin stock',
      text: `El producto "${p.nombre}" no tiene stock disponible.`,
    });
    return;
  }
}
```

**Comportamiento:**
- ✅ **Productos NORMALES:** Se valida stock disponible (no permite agregar si stock = 0)
- ✅ **Productos ILIMITADOS (LUNAS):** Se pueden agregar sin límite de cantidad
- ✅ **Indicador visual:** Muestra ∞ (infinito) para productos ILIMITADOS

### **Vista del Usuario**

En el POS, cada producto muestra:
```
📦 PRODUCTO XYZ
🔢 #1234  📦 Modelo ABC  🎨 Color Negro  📊 10 (verde/amarillo/rojo/azul)
Categoría: GAFAS
$50.00
```

El badge de stock tiene:
- **Icono:** 📦 (caja)
- **Número:** Stock disponible o ∞ para ilimitados
- **Color:** Verde/Amarillo/Rojo/Azul según disponibilidad

---

## 📁 Archivos Modificados (Actualización POS)

| Archivo | Cambios |
|---------|---------|
| [`crear-venta.ts`](src/app/modules/ventas/crear-venta/crear-venta.ts) | Métodos de color y validación de stock para ILIMITADOS |
| [`crear-venta.html`](src/app/modules/ventas/crear-venta/crear-venta.html) | Badge de stock con colores en lista de productos |
| [`crear-venta.css`](src/app/modules/ventas/crear-venta/crear-venta.css) | Estilos para badge-warning y badge-info |

---

## ✅ Checklist de Cumplimiento (Actualizado)

- ✅ Modelo de producto tiene `tipo_control_stock`
- ✅ Importación Excel: LUNAS no suman stock
- ✅ Importación Excel: LUNAS calculan subtotal
- ✅ Creación manual: LUNAS no suman stock
- ✅ Creación manual: LUNAS calculan costo
- ✅ Totales incluyen LUNAS (subtotal, IVA, descuento, flete)
- ✅ Compatibilidad con datos legacy (`stockIlimitado`)
- ✅ **POS: LUNAS no validan stock al agregar**
- ✅ **POS: Indicadores visuales de stock con colores**
- ✅ **POS: Muestra símbolo ∞ para stock ilimitado**
- ✅ Sin errores de compilación
- ✅ Código limpio y documentado
- ✅ Comentarios JSDoc donde aportan valor

---

## ✨ Resultado Final

El sistema ahora maneja correctamente productos con stock físico (NORMAL) y productos conceptuales/ilimitados (ILIMITADO), permitiendo un control contable preciso sin afectar el inventario de productos que no lo requieren.

**Estado:** ✅ Implementación completada y validada
**Fecha:** 24 de enero de 2026
**Desarrollador:** Senior Software Engineer (Angular/TypeScript/Firestore)
