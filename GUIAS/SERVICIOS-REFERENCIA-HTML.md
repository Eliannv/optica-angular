# Referencia HTML: Formulario de Servicios

## Botón para Agregar Servicio

Agrega este botón cerca de donde está el input de búsqueda de productos:

```html
<!-- Botón para mostrar/ocultar formulario de servicio -->
<div class="servicio-button-container">
  <button 
    type="button" 
    class="btn btn-info" 
    (click)="toggleFormServicio()"
    [class.btn-outline-info]="!mostrarFormServicio"
  >
    <span *ngIf="!mostrarFormServicio">➕ Agregar Servicio</span>
    <span *ngIf="mostrarFormServicio">❌ Cerrar</span>
  </button>
</div>
```

---

## Formulario de Servicio (Modal/Collapsible)

Agrega este formulario en la sección de filtros o como panel colapsable:

```html
<!-- Formulario para agregar servicio (mostrar/ocultar) -->
<div 
  *ngIf="mostrarFormServicio" 
  class="form-servicio panel"
  [@slideDown]
>
  <div class="form-group">
    <label for="servicioNombre">Nombre del Servicio *</label>
    <input 
      id="servicioNombre"
      type="text" 
      class="form-input" 
      [(ngModel)]="servicioNuevo.nombre" 
      placeholder="Ej: Limpieza de lentes, Ajuste de armazón"
      (keydown.enter)="agregarServicio()"
    />
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="servicioCantidad">Cantidad</label>
      <input 
        id="servicioCantidad"
        type="number" 
        class="form-input" 
        [(ngModel)]="servicioNuevo.cantidad" 
        min="1" 
        value="1"
        (keydown.enter)="agregarServicio()"
      />
    </div>

    <div class="form-group">
      <label for="servicioPrecio">Precio *</label>
      <input 
        id="servicioPrecio"
        type="number" 
        class="form-input" 
        [(ngModel)]="servicioNuevo.precio" 
        min="0.01" 
        step="0.01"
        placeholder="0.00"
        (keydown.enter)="agregarServicio()"
      />
    </div>
  </div>

  <button 
    type="button" 
    class="btn btn-success" 
    (click)="agregarServicio()"
  >
    ✅ Agregar Servicio
  </button>
</div>
```

---

## Items en la Venta (Modificado)

Actualiza la sección donde se muestran los items para identificar servicios:

```html
<!-- Tabla de items (productos + servicios) -->
<table class="table items-table">
  <thead>
    <tr>
      <th>Item</th>
      <th>Tipo</th>
      <th>Cantidad</th>
      <th>Precio Unit.</th>
      <th>Total</th>
      <th>Acciones</th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let item of items; let i = index" [class.servicio-row]="item.esServicio">
      <td>
        {{ item.nombre }}
        <span *ngIf="item.esServicio" class="badge badge-info ml-2">
          🔧 SERVICIO
        </span>
      </td>
      <td>{{ item.tipo }}</td>
      <td>
        <input 
          type="number" 
          class="form-input-sm" 
          [value]="item.cantidad"
          (change)="cambiarCantidad(item, $event.target.value)"
          min="1"
          [max]="item.stockDisponible"
        />
      </td>
      <td>${{ item.precioUnitario | number:'1.2-2' }}</td>
      <td class="total">${{ item.total | number:'1.2-2' }}</td>
      <td>
        <button 
          type="button" 
          class="btn btn-sm btn-danger" 
          (click)="quitar(item)"
          title="Eliminar item"
        >
          🗑️
        </button>
      </td>
    </tr>
  </tbody>
</table>

<!-- Indicador de servicios agregados -->
<div *ngIf="items.length > 0" class="items-summary">
  <div class="summary-info">
    <span class="badge badge-primary">
      {{ items.filter((i: any) => !i.esServicio).length }} Productos
    </span>
    <span 
      *ngIf="items.some((i: any) => i.esServicio)" 
      class="badge badge-info ml-2"
    >
      {{ items.filter((i: any) => i.esServicio).length }} Servicios
    </span>
  </div>
</div>
```

---

## Botón Guardar/Imprimir (Actualizado)

```html
<!-- Botón guardar/imprimir con validación mejorada -->
<div class="button-group">
  <button 
    type="button" 
    class="btn btn-primary btn-lg" 
    (click)="guardarEImprimir()"
    [disabled]="!puedeGuardar || guardando"
  >
    <span *ngIf="!guardando">
      💾 Guardar e Imprimir
    </span>
    <span *ngIf="guardando">
      ⏳ Procesando...
    </span>
  </button>
  
  <button 
    type="button" 
    class="btn btn-secondary btn-lg" 
    (click)="volver()"
    [disabled]="guardando"
  >
    ← Volver
  </button>
</div>

<!-- Validación de items -->
<div *ngIf="!puedeGuardar" class="alert alert-warning">
  ⚠️ Agregue al menos un producto o servicio para continuar.
</div>
```

---

## Estilos CSS (Opcional)

Agrega estos estilos a `crear-venta.css`:

```css
/* Contenedor del formulario de servicio */
.form-servicio {
  background-color: #f8f9fa;
  border: 2px dashed #0d6efd;
  border-radius: 8px;
  padding: 15px;
  margin: 10px 0;
  animation: slideDown 0.3s ease-out;
}

.form-servicio .form-group {
  margin-bottom: 12px;
}

.form-servicio .form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.form-servicio label {
  font-weight: 600;
  font-size: 13px;
  color: #495057;
  margin-bottom: 5px;
  display: block;
}

.form-servicio .form-input {
  padding: 8px 10px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 13px;
  width: 100%;
}

.form-servicio .form-input:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

/* Fila de servicio en la tabla de items */
.servicio-row {
  background-color: #e7f3ff;
  border-left: 4px solid #0d6efd;
}

.servicio-row td {
  color: #0d6efd;
  font-weight: 500;
}

/* Contenedor de botón de servicio */
.servicio-button-container {
  margin: 10px 0;
}

.servicio-button-container .btn-info {
  background-color: #0dcaf0;
  border-color: #0dcaf0;
}

.servicio-button-container .btn-info:hover {
  background-color: #0aa2c0;
}

/* Resumen de items */
.items-summary {
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin: 10px 0;
  text-align: center;
}

.items-summary .badge {
  margin: 5px;
  font-size: 12px;
  padding: 6px 10px;
}

/* Tabla de items */
.items-table {
  margin-top: 20px;
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  padding: 10px;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
}

.items-table td {
  padding: 10px;
  border-bottom: 1px solid #dee2e6;
}

.items-table .total {
  font-weight: 700;
  color: #198754;
}

/* Animación */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## Integración en el Template

### Orden sugerido en el template:

1. **Header con cliente**
2. **Búsqueda de productos** (existente)
3. **Botón "Agregar Servicio"** ← AGREGAR
4. **Formulario de Servicio** ← AGREGAR
5. **Tabla de items** (productos + servicios)
6. **Totales** (subtotal, IVA, descuento, total)
7. **Métodos de pago**
8. **Botón Guardar/Imprimir**

---

## Funcionalidad del Formulario

### Flujo de Usuario

```
1. Click en "Agregar Servicio"
   ↓
2. Se abre formulario con 3 campos
   - Nombre (obligatorio)
   - Cantidad (1 por defecto)
   - Precio (obligatorio, > 0)
   ↓
3. Usuario completa datos
   ↓
4. Click "Agregar" o Enter
   ↓
5. Sistema valida:
   - ✅ Nombre no vacío
   - ✅ Precio > 0
   ↓
6. Se agrega a tabla de items
   ↓
7. Se recalculan totales
   ↓
8. Formulario se limpia y cierra
```

---

## Casos de Uso en UI

### Caso 1: Servicio Simple
```
Usuario clicks: "Agregar Servicio"
Ingresa:
  Nombre: "Limpieza de lentes"
  Cantidad: 1
  Precio: 5.00
Resultado: Item agregado a tabla
```

### Caso 2: Múltiples Servicios
```
Primero: "Limpieza" - $5
Segundo: "Ajuste" - $3
Resultado: Dos filas en tabla, total = $8
```

### Caso 3: Producto + Servicio
```
Primero: Producto "Armazón" - $50 (descuenta stock)
Segundo: Servicio "Incluye envío" - $10 (no descuenta stock)
Resultado: Factura con ambos items
```

---

## Notas de Implementación

1. **Validación Real-time:** Mostrar mensajes si faltan datos
2. **Foco Automático:** El input de nombre se enfoca al abrir
3. **Enter para Enviar:** Presionar Enter en cualquier campo agrega el servicio
4. **Limpieza:** Formulario se limpia después de agregar
5. **Cierre:** Cierre automático después de agregar servicio
6. **Icono:** Usar 🔧 o 📌 para identificar servicios visualmente

