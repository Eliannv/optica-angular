# 🛠️ Implementación: Venta de Servicios Sin Productos

## ✅ Cambios Realizados

Se ha refactorizado el componente de ventas para permitir vender servicios de forma independiente sin necesidad de productos. Los servicios se agreguen al mismo carrito que los productos y se registren en la factura.

---

## 📝 Resumen de Cambios

### 1. **Propiedades Agregadas** (Línea 51-59)

```typescript
// 🔧 SERVICIOS
mostrarFormServicio: boolean = false; // Toggle para mostrar/ocultar formulario de servicio
servicioNuevo = {
  nombre: '',
  cantidad: 1,
  precio: 0
};
```

**Propósito:** Almacenar el estado del formulario de servicios.

---

### 2. **Nuevo Método: `agregarServicio()`** (Línea 788-855)

```typescript
agregarServicio() {
  const nombre = (this.servicioNuevo.nombre || '').trim();
  const cantidad = Math.max(1, Number(this.servicioNuevo.cantidad || 1));
  const precio = Math.max(0, Number(this.servicioNuevo.precio || 0));

  // Validaciones
  if (!nombre) { /* Error */ }
  if (precio <= 0) { /* Error */ }

  // Agregar al array de items
  const existing = this.items.find((i: any) => i.esServicio && ...);
  if (existing) {
    existing.cantidad++;
  } else {
    this.items.push({
      esServicio: true, // ✅ Identificador clave
      nombre: nombre,
      tipo: 'SERVICIO',
      cantidad: cantidad,
      precioUnitario: precio,
      total: cantidad * precio,
      // ... más campos
    });
  }

  // Limpiar formulario
  this.servicioNuevo = { nombre: '', cantidad: 1, precio: 0 };
  this.mostrarFormServicio = false;
  this.recalcular();
}
```

**Características:**
- ✅ Valida nombre y precio requeridos
- ✅ Agrupa servicios idénticos (incrementa cantidad)
- ✅ Marca servicios con `esServicio: true`
- ✅ NO requiere stock (stockDisponible = Infinity)
- ✅ Calcula totales automáticamente

---

### 3. **Nuevo Método: `toggleFormServicio()`** (Línea 857-872)

```typescript
toggleFormServicio() {
  this.mostrarFormServicio = !this.mostrarFormServicio;
  if (this.mostrarFormServicio) {
    this.servicioNuevo = { nombre: '', cantidad: 1, precio: 0 };
    // Enfocar input después de renderizar
    setTimeout(() => {
      const input = document.querySelector('.form-servicio input[type="text"]');
      if (input) input.focus();
    }, 100);
  }
}
```

**Propósito:** Mostrar/ocultar y resetear el formulario de servicios.

---

### 4. **Nuevo Getter: `puedeGuardar`** (Línea 119-123)

```typescript
get puedeGuardar(): boolean {
  return Boolean(this.clienteId && this.items.length > 0);
}
```

**Cambio:** Ahora permite guardar si hay **productos O servicios**, no solo productos.

---

### 5. **Validación Actualizada en `guardarEImprimir()`** (Línea 906-913)

```typescript
// ✅ Verificar stock SOLO para productos, NO para servicios
for (const it of this.items) {
  // ✅ Saltar si es servicio
  if (it.esServicio) {
    continue;
  }
  // Validar stock solo para productos...
}
```

**Cambio:** Saltamos validación de stock si `esServicio === true`.

---

### 6. **Items Actualizados en Factura** (Línea 1019-1032)

```typescript
items: this.items.map((i: any) => ({
  esServicio: i.esServicio || false, // ✅ Incluir flag
  productoId: i.productoId || undefined,
  nombre: i.nombre,
  tipo: i.tipo,
  cantidad: i.cantidad,
  precioUnitario: i.precioUnitario,
  total: i.total,
  // ...
})),
```

**Cambio:** La factura ahora incluye la propiedad `esServicio` para cada item.

---

### 7. **Deducción de Stock Actualizada** (Línea 1093-1106)

```typescript
// ✅ Descontar stock SOLO para productos, NO para servicios
for (const it of this.items) {
  // ✅ Saltar si es servicio
  if (it.esServicio) {
    console.log(`⏭️ Saltando deducción para servicio: "${it.nombre}"`);
    continue;
  }
  // Descontar stock solo para productos...
}
```

**Cambio:** Servicios NO descuentan inventario.

---

## 🎯 Estructura de Items

### Producto Tradicional
```typescript
{
  codigo: 'ABC123',
  idInterno: 1,
  productoId: 'docId123',
  nombre: 'Armazón Modelo X',
  tipo: 'ARMAZONES',
  cantidad: 2,
  precioUnitario: 45.00,
  total: 90.00,
  totalSinIva: 78.26,
  porcentajeIva: 15,
  stockDisponible: 5,
  esServicio: false // ← Implícito
}
```

### Servicio Nuevo
```typescript
{
  esServicio: true, // ← Identificador clave
  nombre: 'Arreglo de armazón',
  tipo: 'SERVICIO',
  cantidad: 1,
  precioUnitario: 15.00,
  total: 15.00,
  totalSinIva: 15.00,
  porcentajeIva: 0,
  stockDisponible: Infinity,
  codigo: '',
  idInterno: ''
}
```

---

## 📊 Validaciones Actualizadas

| Acción | Productos | Servicios |
|--------|-----------|-----------|
| Validar stock | ✅ | ❌ |
| Descontar stock | ✅ | ❌ |
| Calcular total | ✅ | ✅ |
| Aplicar IVA | Según config | No (0%) |
| Permitir guardar | ✅ | ✅ |
| Incluir en factura | ✅ | ✅ |

---

## 🧪 Casos de Uso Soportados

### ✅ Caso 1: Solo Servicio
```
Agregar servicio → "Limpieza de lentes" ($5)
Guardar → ✅ Se crea factura sin productos
```

### ✅ Caso 2: Producto + Servicio
```
Agregar producto → Armazón ($50)
Agregar servicio → Ajuste ($3)
Guardar → ✅ Factura con ambos items
Stock decrementa solo para Armazón
```

### ✅ Caso 3: Servicios Múltiples
```
Agregar servicio → Limpieza ($5)
Agregar servicio → Ajuste ($3)
Guardar → ✅ Factura con dos servicios
```

### ✅ Caso 4: Servicio + Crédito Personal
```
Agregar servicio → Reparación ($20)
Activar "Es Crédito"
Abono: $10
Guardar → ✅ Factura con saldo pendiente: $10
```

---

## 🔍 Lógica de Flujo

```
┌─ Usuario elige:
│
├─→ Agregar Producto
│   ├─ Selecciona de lista
│   ├─ Valida stock
│   ├─ Agrega a items
│   └─ Decremento en Firestore ✅
│
└─→ Agregar Servicio
    ├─ Ingresa nombre
    ├─ Ingresa cantidad
    ├─ Ingresa precio
    ├─ NO valida stock
    ├─ Agrega a items
    └─ NO decremento en Firestore ✅
```

---

## 💾 Cambios en Firestore

### Factura Anterior
```json
{
  "items": [
    {
      "productoId": "...",
      "nombre": "Armazón",
      "cantidad": 2,
      "precioUnitario": 45,
      "total": 90
    }
  ]
}
```

### Factura Actual
```json
{
  "items": [
    {
      "esServicio": false, // ← Nuevo campo
      "productoId": "...",
      "nombre": "Armazón",
      "cantidad": 2,
      "precioUnitario": 45,
      "total": 90
    },
    {
      "esServicio": true, // ← Nuevo campo
      "productoId": undefined,
      "nombre": "Limpieza",
      "cantidad": 1,
      "precioUnitario": 5,
      "total": 5
    }
  ]
}
```

---

## ✅ Validación de Código

- ✅ **Compilación:** Sin errores TypeScript
- ✅ **Lógica:** Servicios no descuentan stock
- ✅ **Facturación:** Servicios se registran en factura
- ✅ **Totales:** Se calculan correctamente
- ✅ **Compatibilidad:** Productos funcionan igual

---

## 🚀 Próximos Pasos (UI)

Necesitas actualizar el template HTML para:

1. **Botón "Agregar Servicio"** - Mostrar/ocultar formulario
2. **Formulario de Servicios** - Campos: nombre, cantidad, precio
3. **Lista de Items** - Mostrar servicios igual que productos
4. **Validación de Botón Guardar** - Habilitar si hay items

Ejemplo de estructura esperada:
```html
<!-- Botón para agregar servicio -->
<button (click)="toggleFormServicio()" class="btn btn-info">
  📌 Agregar Servicio
</button>

<!-- Formulario de servicio (condicional) -->
<div *ngIf="mostrarFormServicio" class="form-servicio">
  <input [(ngModel)]="servicioNuevo.nombre" placeholder="Nombre del servicio" />
  <input type="number" [(ngModel)]="servicioNuevo.cantidad" min="1" />
  <input type="number" [(ngModel)]="servicioNuevo.precio" min="0.01" step="0.01" />
  <button (click)="agregarServicio()" class="btn btn-success">Agregar</button>
</div>

<!-- Items (productos + servicios) -->
<div *ngFor="let item of items">
  {{ item.nombre }} - {{ item.cantidad }} x {{ item.precioUnitario }}
  <span *ngIf="item.esServicio" class="badge badge-info">SERVICIO</span>
</div>

<!-- Botón guardar con la nueva validación -->
<button (click)="guardarEImprimir()" [disabled]="!puedeGuardar">
  💾 Guardar e Imprimir
</button>
```

---

## 📋 Resumen

| Aspecto | Estado |
|--------|--------|
| Agregar servicios | ✅ Implementado |
| Validar servicios | ✅ Implementado |
| Calcular totales | ✅ Implementado |
| No descontar stock | ✅ Implementado |
| Facturación | ✅ Implementado |
| UI (HTML) | ⏳ Pendiente |

