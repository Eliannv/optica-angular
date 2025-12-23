# 🎹 Guía de Navegación por Teclado - Agregar Productos a Ingreso

## 📦 Agregar Producto Existente

### Búsqueda Rápida con Teclado
1. **Escribe** en el campo de búsqueda para filtrar productos
2. **Flecha ↓** - Navegar hacia abajo en la lista
3. **Flecha ↑** - Navegar hacia arriba en la lista
4. **Enter** - Seleccionar el producto resaltado

### Completar Información
Una vez seleccionado el producto, el cursor se posiciona automáticamente en:

1. **Cantidad** → `Enter` para siguiente campo
2. **Costo Unitario** → `Enter` para siguiente campo
3. **Observaciones** (textarea grande):
   - `Enter` normal: salto de línea
   - `Ctrl + Enter`: ir al botón Agregar
4. **Botón Agregar** → Click o `Enter` para agregar

Al agregar el producto, el cursor regresa automáticamente al buscador.

---

## ✨ Crear Producto Nuevo

### Orden de Campos (Navegación con Enter)

El formulario es **reactivo**: Stock y Cantidad están sincronizados automáticamente.

1. **Nombre del Producto** → `Enter` ⏭
2. **Modelo** → `Enter` ⏭
3. **Color** → `Enter` ⏭
4. **Grupo** → `Enter` ⏭ (tiene autocompletado)
5. **Stock (Cantidad)** → `Enter` ⏭ 
   - 💡 Este valor se sincroniza con la cantidad del ingreso
6. **Costo Unitario** → `Enter` ⏭
7. **PVP (Precio de Venta)** → `Enter` ⏭
8. **Observaciones** (textarea grande):
   - `Enter` normal: salto de línea
   - `Ctrl + Enter`: ir al botón Crear
9. **Botón Crear y Agregar** → Click o `Enter`

**Proveedor**: Se asigna automáticamente desde el ingreso actual.

Al crear el producto, el cursor regresa al campo Nombre para agregar más productos rápidamente.

---

## 🔄 Lógica Reactiva

### Sincronización Stock ↔ Cantidad
- Al cambiar **Stock**, la **Cantidad** se actualiza automáticamente
- Al cambiar **Cantidad**, el **Stock** se actualiza automáticamente
- Ambos campos siempre tienen el mismo valor (stock inicial = cantidad ingresada)

---

## 💡 Consejos de Uso

### Flujo de Trabajo Optimizado

**Para productos existentes:**
```
Buscar → ↑↓ → Enter → Cantidad → Enter → Costo → Enter → Obs (Ctrl+Enter) → Agregar
```

**Para productos nuevos:**
```
Nombre → Enter → Modelo → Enter → Color → Enter → Grupo → Enter 
→ Stock → Enter → Costo → Enter → PVP → Enter → Obs (Ctrl+Enter) → Crear
```

### Atajos Importantes
- `Enter` en campos normales = siguiente campo
- `Ctrl + Enter` en textareas = siguiente campo (permite saltos de línea con Enter normal)
- `↑` `↓` en búsqueda = navegar entre productos
- El autofocus te lleva automáticamente al campo siguiente después de cada acción

---

## 📝 Campos de Texto Grandes (Observaciones)

Las observaciones ahora son **textareas** que permiten:
- Múltiples líneas de texto
- Saltos de línea con `Enter`
- Navegación con `Ctrl + Enter` al siguiente campo

Esto es útil para:
- Notas detalladas sobre el producto
- Condiciones especiales
- Información de seguimiento
- Observaciones del proveedor

---

## ✅ Validaciones

- **Nombre**: Requerido
- **Stock/Cantidad**: Requerido, mínimo 1
- Los campos de precio aceptan decimales (ej: 12.50)
- No puedes agregar un producto sin completar los campos obligatorios (*)

El botón de acción se deshabilitará automáticamente si faltan campos requeridos.
