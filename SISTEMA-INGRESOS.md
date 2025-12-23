# Sistema de Ingresos / Facturas - Gestión Profesional de Inventario

## 🎯 Concepto

El sistema de **Ingresos/Facturas** reemplaza el flujo antiguo de creación individual de productos por un proceso profesional que refleja el mundo real de compras a proveedores.

### Flujo Antiguo ❌
- Crear producto → Elegir proveedor → Stock inicial
- **Problema**: No hay registro de la factura/compra original

### Flujo Nuevo ✅
1. **Crear Ingreso/Factura** con datos del proveedor
2. **Agregar productos** (existentes o nuevos) a ese ingreso
3. **Finalizar** y el sistema registra todo automáticamente

---

## 📦 Estructura de Datos (Firestore)

### Colección: `ingresos`
```typescript
{
  id: string;                    // Auto-generado
  proveedor: string;             // "OPTICA ABC S.A."
  numeroFactura: string;         // "001-001-000123"
  fecha: Date;                   // Fecha de la factura
  tipoCompra: 'CONTADO' | 'CREDITO';
  observacion?: string;
  total?: number;                // Calculado automáticamente
  estado: 'BORRADOR' | 'FINALIZADO';
  createdAt: Date;
  updatedAt: Date;
}
```

### Colección: `productos`
```typescript
{
  // ... campos existentes ...
  proveedor: string;             // Heredado del ingreso
  ingresoId?: string;            // Relación con el ingreso
  stock: number;                 // Actualizado automáticamente
  costo: number;                 // Del último ingreso
}
```

### Colección: `movimientos_stock` 🔥 NUEVA
```typescript
{
  id: string;
  productoId: string;
  ingresoId?: string;
  tipo: 'INGRESO' | 'SALIDA' | 'AJUSTE' | 'VENTA';
  cantidad: number;              // +20, -5, etc.
  costoUnitario?: number;
  stockAnterior: number;
  stockNuevo: number;
  observacion?: string;
  createdAt: Date;
}
```

**Beneficios de `movimientos_stock`:**
- ✅ Historial completo de cambios de stock
- ✅ Trazabilidad de costos
- ✅ Auditoría de operaciones
- ✅ Reportes de movimientos por producto o período

---

## 🚀 Flujo de Usuario (UX)

### PASO 1: Crear Ingreso (Factura)
**Ruta:** `/productos/nuevo-ingreso`

El usuario ingresa datos generales:
- ✅ Proveedor (text input con datalist)
- ✅ Número de factura
- ✅ Fecha
- ✅ Tipo de compra (CONTADO / CRÉDITO)
- ✅ Observación (opcional)

**Resultado:** Se crea un ingreso en estado `BORRADOR`

---

### PASO 2: Agregar Productos al Ingreso
**Ruta:** `/productos/ingreso/:id/agregar-productos`

El usuario tiene **DOS opciones:**

#### 🔹 OPCIÓN A: Agregar Producto Existente
1. Buscar por nombre, modelo o código
2. Seleccionar producto
3. Ingresar:
   - Cantidad comprada
   - Costo unitario (opcional, se sugiere el último)
   - Observación

**Resultado:**
- ❌ No se crea producto nuevo
- ✅ Se suma stock
- ✅ Se actualiza costo (si se ingresó)
- ✅ Se registra movimiento

#### 🔹 OPCIÓN B: Crear Producto Nuevo
1. Click en "➕ Producto Nuevo"
2. Formulario completo (SIN proveedor, se hereda del ingreso):
   - Nombre
   - Modelo
   - Color
   - Grupo
   - Código
   - Cantidad inicial
   - Costo unitario
   - PVP1

**Resultado:**
- ✅ Se crea producto nuevo
- ✅ Stock inicial = cantidad ingresada
- ✅ Proveedor heredado del ingreso
- ✅ Se registra movimiento

---

### PASO 3: Vista Previa
Se muestra una tabla con todos los productos agregados:

| Producto | Tipo | Cantidad | Costo | Subtotal | Acciones |
|----------|------|----------|-------|----------|----------|
| SOFT-30 | EXISTENTE | +20 | $25 | $500 | ❌ Eliminar |
| ARMAZÓN ECO | NUEVO | +10 | $45 | $450 | ❌ Eliminar |

**Total calculado:** $950

---

### PASO 4: Finalizar Ingreso
Al hacer click en **"Finalizar Ingreso"**:

1. ✅ Se crean los productos nuevos
2. ✅ Se actualiza stock de productos existentes
3. ✅ Se registran movimientos en `movimientos_stock`
4. ✅ Se actualiza el ingreso a estado `FINALIZADO`
5. ✅ Se calcula el total de la factura

**Redirección:** `/productos` (lista de productos)

---

## 🔧 Componentes Creados

### 1. Modelos
- ✅ `ingreso.model.ts` - Datos del ingreso y detalles
- ✅ `movimiento-stock.model.ts` - Movimientos de inventario

### 2. Servicios
- ✅ `ingresos.service.ts` - CRUD de ingresos y lógica de negocio

### 3. Componentes
- ✅ `crear-ingreso` - PASO 1
- ✅ `agregar-productos-ingreso` - PASOS 2, 3 y 4
- ✅ `listar-ingresos` - Historial de ingresos

### 4. Rutas
```typescript
'/productos/nuevo-ingreso'
'/productos/ingreso/:id/agregar-productos'
'/productos/ingresos'
```

---

## 📊 Ventajas del Nuevo Sistema

### Para el negocio:
- ✅ Registro completo de facturas de proveedores
- ✅ Trazabilidad de costos por ingreso
- ✅ Historial de movimientos de stock
- ✅ Reportes de compras por proveedor/período
- ✅ Control de inventario profesional

### Para el usuario:
- ✅ Flujo natural (factura → productos)
- ✅ No se repite información del proveedor
- ✅ Creación masiva de productos en un solo ingreso
- ✅ Vista previa antes de confirmar
- ✅ Actualización automática de stock

### Para el desarrollo:
- ✅ Separación de responsabilidades (ingreso vs producto)
- ✅ Modelos claros y bien definidos
- ✅ Servicios reutilizables
- ✅ Componentes standalone modernos
- ✅ Facilita futuras funcionalidades (reportes, auditoría)

---

## 🎨 Interfaz de Usuario

### Página de Productos
- **Botón principal:** `+ Nuevo Ingreso` (verde, destacado)
- **Botón secundario:** `+ Nuevo Producto` (para casos excepcionales)

### Diseño Responsivo
- ✅ Formularios adaptables
- ✅ Tablas con scroll horizontal en móviles
- ✅ Botones táctiles (44px mínimo)

### Feedback Visual
- ✅ Spinners al guardar
- ✅ Mensajes de error claros
- ✅ Estados de productos (NUEVO/EXISTENTE)
- ✅ Badges de estado (BORRADOR/FINALIZADO)

---

## 🔮 Funcionalidades Futuras

### Corto plazo:
- [ ] Vista de detalle de ingreso
- [ ] Edición de ingresos en borrador
- [ ] Búsqueda/filtros en lista de ingresos

### Mediano plazo:
- [ ] Reportes de compras por proveedor
- [ ] Gráficos de costos históricos
- [ ] Alertas de stock bajo
- [ ] Exportar ingresos a PDF/Excel

### Largo plazo:
- [ ] Integración con contabilidad
- [ ] Gestión de cuentas por pagar (créditos)
- [ ] Órdenes de compra
- [ ] Comparación de precios entre proveedores

---

## 🚨 Notas Importantes

### Migración de Datos
- Los productos existentes **NO** tienen `ingresoId`
- Solo los productos creados desde el nuevo sistema tendrán este campo
- Esto es normal y no afecta el funcionamiento

### Compatibilidad
- El sistema antiguo de crear productos sigue funcionando
- Recomendado: Usar **solo** el nuevo flujo de ingresos

### Permisos
- Por ahora, todos los usuarios pueden crear ingresos
- Se puede agregar control de roles más adelante

---

## 📚 Ejemplos de Uso

### Ejemplo 1: Compra de 50 armazones nuevos
1. Crear ingreso: "DISTRIBUIDORA XYZ" - Factura "001-150"
2. Agregar 50 productos nuevos (o menos, variantes de modelos/colores)
3. Finalizar → Se crean todos los productos con el mismo proveedor

### Ejemplo 2: Reposición de stock
1. Crear ingreso: "PROVEEDOR ABC" - Factura "002-200"
2. Buscar productos existentes (SOFT-30, GAFAS-X)
3. Agregar cantidades (20, 15)
4. Finalizar → Se actualiza stock automáticamente

### Ejemplo 3: Compra mixta
1. Crear ingreso
2. Agregar 10 productos existentes
3. Agregar 5 productos nuevos
4. Finalizar → Se procesan ambos tipos correctamente

---

## 👨‍💻 Mantenimiento

### Servicios utilizados:
- `IngresosService` - Gestión de ingresos
- `ProductosService` - Gestión de productos (reutilizado)

### Transacciones:
- ✅ Uso de `writeBatch` para operaciones atómicas
- ✅ Rollback automático en caso de error

### Optimizaciones:
- Se pueden agregar índices en Firestore:
  - `ingresos` → `estado`, `proveedor`, `fecha`
  - `movimientos_stock` → `productoId`, `ingresoId`, `createdAt`

---

## 📞 Soporte

Para dudas o sugerencias sobre el sistema de ingresos:
1. Revisar esta documentación
2. Verificar la consola del navegador (errores)
3. Contactar al equipo de desarrollo

---

**¡Sistema listo para usar! 🎉**
