# Uso de Códigos de Proveedor en el Sistema

## ⚠️ Cambio Importante

A partir de ahora, el sistema utiliza **códigos de proveedor** (Ej: `P008`, `P005`) en lugar de nombres (Ej: `OPTEC`, `DISTRIBUIDORA XYZ`) para todas las relaciones entre productos, ingresos y proveedores.

## ¿Por qué este cambio?

### Problema Anterior
- Los productos guardaban el **nombre del proveedor** en el campo `proveedor`
- Esto causaba inconsistencias si el nombre del proveedor cambiaba
- Dificultaba búsquedas y relaciones en la base de datos
- No había una forma única de identificar proveedores

### Solución Actual
- Todos los productos y ingresos ahora guardan el **código del proveedor** (Ej: `P008`)
- Los códigos son únicos e inmutables
- Facilita relaciones consistentes en la base de datos
- Permite cambiar nombres de proveedores sin afectar registros históricos

## ¿Cómo funciona ahora?

### En Firestore
```
productos/
  └─ productId/
      ├─ nombre: "GOTAS HUMECTANTES"
      ├─ proveedor: "P008"  ← CÓDIGO, no nombre
      └─ ...

proveedores/
  └─ P008/
      ├─ codigo: "P008"
      ├─ nombre: "OPTEC"
      └─ ...

ingresos/
  └─ ingresoId/
      ├─ proveedor: "P008"  ← CÓDIGO, no nombre
      └─ ...
```

### En la UI

#### Crear Producto
```html
<!-- El usuario ve -->
P008 - OPTEC

<!-- Pero el sistema guarda solo -->
"P008"
```

#### Crear Ingreso
```html
<!-- Campo de proveedor -->
<input [(ngModel)]="ingreso.proveedor" 
       placeholder="Escribe el código del proveedor (Ej: P001)...">

<datalist>
  <option value="P008">P008 - OPTEC</option>
  <option value="P005">P005 - DISTRIBUIDORA XYZ</option>
</datalist>
```

#### Agregar Producto a Ingreso
Cuando agregas un producto existente que tiene `proveedor: "P005"` a un ingreso con `proveedor: "P008"`:
1. El sistema detecta que son diferentes
2. Actualiza automáticamente el producto: `proveedor: "P008"`
3. Mantiene la consistencia de datos

## Componentes Actualizados

### 1. `crear-producto` ✅
- Datalist usa `[value]="prov.codigo || prov.id"`
- Guarda código en `producto.proveedor`
- Placeholder: "Escribe el código del proveedor (Ej: P001)..."

### 2. `crear-ingreso` ✅
- Datalist usa `[value]="prov.codigo || prov.id"`
- Guarda código en `ingreso.proveedor`
- Al crear nuevo proveedor inline, asigna su código
- Placeholder: "Escribe el código del proveedor (Ej: P001)..."

### 3. `agregar-productos-ingreso` ✅
- Hereda el código del proveedor del ingreso
- Al crear producto nuevo, usa el código del ingreso
- Muestra el código en mensajes informativos

### 4. `ingresos.service` ✅
- Método `finalizarIngreso()` compara códigos
- Actualiza productos existentes si el código es diferente
- Método `crearProductoDesdeIngreso()` asigna el código del ingreso

## Migración de Datos Existentes

### Productos con Nombres de Proveedor
Si tienes productos antiguos con nombres en lugar de códigos:

**Antes:**
```json
{
  "nombre": "ARMAZON METALICO",
  "proveedor": "OPTEC"  ← Nombre
}
```

**Después:**
```json
{
  "nombre": "ARMAZON METALICO",
  "proveedor": "P008"  ← Código
}
```

### Cómo Migrar
1. Crear un script de migración que:
   - Lea todos los productos
   - Por cada producto, busque el proveedor por nombre
   - Actualice `producto.proveedor` con el código del proveedor encontrado

Ejemplo:
```javascript
// migrar-proveedores-productos.js
const admin = require('firebase-admin');

async function migrarProveedores() {
  const db = admin.firestore();
  
  // Obtener todos los proveedores
  const proveedoresSnap = await db.collection('proveedores').get();
  const proveedoresMap = {};
  proveedoresSnap.forEach(doc => {
    const data = doc.data();
    proveedoresMap[data.nombre] = data.codigo || doc.id;
  });
  
  // Actualizar productos
  const productosSnap = await db.collection('productos').get();
  const batch = db.batch();
  
  productosSnap.forEach(doc => {
    const producto = doc.data();
    if (producto.proveedor && !producto.proveedor.startsWith('P')) {
      // Es un nombre, buscar código
      const codigo = proveedoresMap[producto.proveedor];
      if (codigo) {
        batch.update(doc.ref, { proveedor: codigo });
        console.log(`Actualizando ${doc.id}: ${producto.proveedor} → ${codigo}`);
      }
    }
  });
  
  await batch.commit();
  console.log('Migración completada');
}
```

## Ventajas del Sistema Actual

✅ **Consistencia:** Códigos únicos e inmutables  
✅ **Flexibilidad:** Nombres de proveedores pueden cambiar  
✅ **Trazabilidad:** Fácil rastrear todos los productos de un proveedor  
✅ **Integridad:** Relaciones sólidas en la base de datos  
✅ **Performance:** Búsquedas más rápidas por código  

## Cómo Mostrar Nombres en la UI

Para mostrar el nombre del proveedor en lugar del código en la interfaz:

### Opción 1: Join en el componente
```typescript
proveedores: Proveedor[] = [];
productos: Producto[] = [];

getNombreProveedor(codigo: string): string {
  const prov = this.proveedores.find(p => 
    (p.codigo || p.id) === codigo
  );
  return prov ? prov.nombre : codigo;
}
```

```html
<td>{{ getNombreProveedor(producto.proveedor) }}</td>
```

### Opción 2: Observable con switchMap
```typescript
producto$ = this.productosService.getProducto(id).pipe(
  switchMap(producto => {
    return this.proveedoresService.getProveedorByCodigo(producto.proveedor).pipe(
      map(proveedor => ({ ...producto, proveedorNombre: proveedor.nombre }))
    );
  })
);
```

## Referencias

- [MEJORAS-INGRESOS.md](MEJORAS-INGRESOS.md) - Documentación de mejoras recientes
- [SISTEMA-INGRESOS.md](SISTEMA-INGRESOS.md) - Sistema completo de ingresos
- [proveedor.model.ts](src/app/core/models/proveedor.model.ts) - Modelo de proveedor
