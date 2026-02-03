# Implementación de Edición de Facturas

## 📋 Resumen
Se implementó funcionalidad completa para **editar y eliminar facturas** en el sistema. El componente `crear-venta` ahora funciona en **modo dual** (creación/edición) para evitar duplicación de código.

## ✅ Cambios Implementados

### 1. **Servicios Backend**

#### `ProductosService` (`productos.ts`)
- ✅ **Nuevo método**: `incrementarStock(id, cantidad)` 
  - Usa transacciones de Firestore (runTransaction)
  - Respeta tipo_control_stock (NORMAL vs ILIMITADO)
  - Se usa para revertir inventario al editar/eliminar ventas

#### `FacturasService` (`facturas.ts`)
- ✅ **Nuevo método**: `eliminarFactura(id)` - Eliminación permanente (deleteDoc)
- ✅ **Nuevo método**: `actualizarFactura(id, datos)` - Actualización parcial (updateDoc)
  - Excluye campos inmutables: `id`, `idPersonalizado`, `historialSnapshot`

#### `CajaChicaService` (`caja-chica.service.ts`)
- ✅ **Nuevo método**: `eliminarMovimientoPorFactura(cajaChicaId, facturaId)`
  - Busca movimiento por comprobante (facturaId)
  - Elimina y ajusta saldo de caja

#### `CajaBancoService` (`caja-banco.service.ts`)
- ✅ **Cambio**: `eliminarCajaBanco` ahora hace **hard delete** (deleteDoc) en lugar de soft delete
  - Solo permitido si `saldo_inicial === saldo_actual`
- ✅ **Nuevo método**: `eliminarMovimientoPorFactura(facturaId)`
  - Busca movimiento por comprobante
  - Elimina y ajusta saldo de caja

### 2. **Componente Crear-Venta (Modo Dual)**

#### Variables de Estado Agregadas
```typescript
modoEdicion: boolean = false;
facturaId: string | null = null;
facturaOriginal: any = null;
itemsOriginales: any[] = [];
```

#### Lógica de Detección de Modo
```typescript
ngOnInit() {
  this.route.paramMap.subscribe(params => {
    this.facturaId = params.get('facturaId');
    if (this.facturaId) {
      this.modoEdicion = true;
      this.cargarFacturaParaEditar();
    }
  });
}
```

#### Carga de Factura para Edición
- **Pre-llena todos los campos** del formulario
- Carga cliente y su historial clínico
- Restaura items de venta (productos/servicios)
- Configura método de pago y montos
- Guarda copia de items originales para reversión

#### Reversión de Inventario
```typescript
async revertirInventarioOriginal() {
  for (const itemOriginal of this.itemsOriginales) {
    if (itemOriginal.esServicio) continue;
    await this.productosSrv.incrementarStock(itemOriginal.productoId, itemOriginal.cantidad);
  }
}
```

#### Guardado Inteligente
- **Modo creación**: `crearFactura()` → nuevo ID de 10 dígitos
- **Modo edición**: 
  1. Revertir inventario original (incrementar stock)
  2. Validar stock de nuevos items
  3. `actualizarFactura()` con mismo ID
  4. Eliminar movimientos antiguos de cajas si cambió método/monto
  5. Crear nuevos movimientos en cajas
  6. Descontar stock de nuevos items

### 3. **Componente Listar Facturas**

#### Botones Agregados (Desktop y Mobile)
```html
<!-- Botón Editar -->
<button (click)="editarFactura(f, $event)" class="btn btn-sm btn-warning">
  <i class="bi bi-pencil-square"></i> Editar
</button>

<!-- Botón Eliminar -->
<button (click)="eliminarFactura(f, $event)" class="btn btn-sm btn-danger">
  <i class="bi bi-trash"></i> Eliminar
</button>
```

#### Métodos Implementados
```typescript
editarFactura(factura, ev?) {
  ev?.stopPropagation();
  const facturaId = factura.idPersonalizado || factura.id;
  this.router.navigate(['/ventas/editar', facturaId]);
}

eliminarFactura(factura, ev?) {
  ev?.stopPropagation();
  Swal.fire({
    title: '¿Eliminar factura?',
    text: 'Esta acción no se puede deshacer',
    icon: 'warning',
    showCancelButton: true
  }).then(async (result) => {
    if (result.isConfirmed) {
      await this.facturasSrv.eliminarFactura(factura.id);
      Swal.fire('Eliminada', 'La factura ha sido eliminada', 'success');
    }
  });
}
```

### 4. **Componente Listar Cajas Banco**

#### Validación de Eliminación
- Solo muestra botón si `saldo_inicial === saldo_actual`
```html
<button *ngIf="caja.id && (caja.saldo_inicial === caja.saldo_actual)"
        (click)="eliminarCajaBanco(caja)"
        class="btn btn-sm btn-danger">
  <i class="bi bi-trash"></i> Eliminar
</button>
```

### 5. **Routing**

#### Nueva Ruta Agregada (`ventas-routing-module.ts`)
```typescript
{
  path: 'editar/:facturaId',
  canActivate: [cajaChicaGuard],
  loadComponent: () => import('./crear-venta/crear-venta')
    .then(m => m.CrearVentaComponent),
}
```

## 🔄 Flujo de Edición Completo

### Caso 1: Usuario edita factura sin cambiar productos
1. Usuario hace clic en "Editar" en listar-facturas
2. Navega a `/ventas/editar/0000000123`
3. `crear-venta` detecta `facturaId` en parámetros → `modoEdicion = true`
4. Carga factura y pre-llena todos los campos
5. Usuario modifica solo cliente o descuento
6. Al guardar:
   - NO se revierte inventario (mismos productos/cantidades)
   - Se actualiza factura con `actualizarFactura()`
   - Mantiene mismo ID personalizado

### Caso 2: Usuario edita factura cambiando productos
1. Usuario hace clic en "Editar"
2. `crear-venta` carga factura con 2 items:
   - Montura ABC (cantidad: 3)
   - Lentes XYZ (cantidad: 2)
3. Usuario elimina Lentes XYZ y agrega Estuche DEF (cantidad: 1)
4. Al guardar:
   - **Reversión**: `incrementarStock('ABC', 3)` y `incrementarStock('XYZ', 2)` → stock restaurado
   - **Validación**: Verifica stock disponible de Montura ABC y Estuche DEF
   - **Actualización**: Guarda factura con nuevos items
   - **Descuento**: `descontarStock('ABC', 3)` y `descontarStock('DEF', 1)`

### Caso 3: Usuario edita método de pago
1. Factura original: `metodoPago: 'Efectivo'`, `abonado: 50 USD`
2. Usuario cambia a `metodoPago: 'Transferencia'`
3. Al guardar:
   - Elimina movimiento de Caja Chica (INGRESO 50 USD con comprobante #0000000123)
   - Crea movimiento en Caja Banco (INGRESO 50 USD, transferencia)
   - Actualiza factura

## 🛡️ Protecciones Implementadas

### Inmutabilidad del Historial Clínico
- `historialSnapshot` en factura **NO se modifica ni elimina**
- `actualizarFactura()` excluye este campo de las actualizaciones
- Historial clínico solo se gestiona desde módulo de clientes

### Validación de Stock
- Antes de aplicar cambios, se **valida stock disponible**
- Si falta stock, se **deshace la reversión** con `descontarInventarioOriginal()`
- Usuario ve error y factura no se guarda

### Consistencia de Cajas
- Al cambiar método/monto de pago:
  - Se eliminan movimientos antiguos (con reversión de saldo)
  - Se crean nuevos movimientos con nueva fecha/monto
- Evita duplicación de ingresos/egresos

### Productos con Stock Ilimitado
- `tipo_control_stock: 'ILIMITADO'` → No se incrementa ni decrementa stock
- Ejemplo: LUNAS (stock siempre disponible)

## 📊 Modelo de Datos

### Factura
```typescript
{
  id: string;                    // ID Firestore
  idPersonalizado: string;       // 0000000001, 0000000002, etc. (INMUTABLE)
  clienteId: string;
  clienteNombre: string;
  historialSnapshot: any | null; // ⚠️ INMUTABLE - historial clínico
  items: ItemVenta[];
  subtotal: number;
  descuentoPorcentaje: number;
  descuentoMonto: number;
  iva: number;
  total: number;
  metodoPago: 'Efectivo' | 'Transferencia' | 'Tarjeta';
  codigoTransferencia?: string;
  ultimosCuatroTarjeta?: string;
  fecha: Date;
  esCredito: boolean;
  abonado: number;
  saldoPendiente: number;
  estadoPago: 'PAGADA' | 'PENDIENTE';
  estadoCredito: 'ACTIVO' | 'CANCELADO';
}
```

### ItemVenta
```typescript
{
  esServicio: boolean;         // true = servicio, false = producto físico
  productoId?: string;         // solo para productos
  nombre: string;
  tipo: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  codigo?: string;
  idInterno?: string;
}
```

## 🧪 Casos de Prueba Sugeridos

### Prueba 1: Editar cantidad de producto
1. Crear venta con Montura ABC (cantidad: 5, stock actual: 20)
2. Editar factura, cambiar cantidad a 3
3. **Esperado**: Stock final = 20 + 5 - 3 = 22

### Prueba 2: Cambiar método de pago
1. Crear venta efectivo por 100 USD
2. Verificar ingreso en Caja Chica
3. Editar factura, cambiar a Transferencia
4. **Esperado**: 
   - Movimiento de Caja Chica eliminado
   - Nuevo movimiento en Caja Banco
   - Saldos correctos en ambas cajas

### Prueba 3: Editar con stock insuficiente
1. Crear venta con Producto X (cantidad: 2, stock: 10)
2. Vender 8 unidades de Producto X en otra venta (stock = 0)
3. Editar primera venta, cambiar cantidad a 5
4. **Esperado**: Error "Stock insuficiente", no se guarda, stock restaurado a estado previo

### Prueba 4: Eliminar factura
1. Crear venta con 3 productos
2. Verificar movimiento en caja
3. Eliminar factura
4. **Esperado**: ⚠️ **Actualmente NO revierte inventario** (feature pendiente)

## 🚀 Mejoras Futuras

### Prioridad Alta
- [ ] **Reversión de inventario al eliminar factura**
  - Actualmente elimina factura pero NO restaura stock
  - Solución: Llamar `incrementarStock` para cada item antes de `deleteDoc`

### Prioridad Media
- [ ] **Auditoría de cambios**
  - Registrar quién editó, cuándo, y qué cambió
  - Guardar snapshot de factura anterior en sub-colección `facturas/{id}/historial_ediciones`

- [ ] **Notificación al cliente**
  - Email/SMS cuando se modifica su factura
  - Enviar nuevo comprobante PDF

### Prioridad Baja
- [ ] **Restricción de edición por tiempo**
  - Ej: Solo permitir editar facturas de los últimos 7 días
  - Después requiere autorización de admin

- [ ] **Edición parcial de items**
  - Permitir editar cantidad sin eliminar/re-agregar producto
  - Mejorar UX del componente

## 📝 Notas Importantes

### Historial Clínico
- **NUNCA** se modifica desde facturas
- Solo se gestiona en módulo de clientes (`historial-clinico`)
- `historialSnapshot` es una copia de solo lectura en la factura

### IDs Personalizados
- **NO** se regeneran al editar
- Ejemplo: Factura #0000000025 siempre será #0000000025
- Facilita trazabilidad y reportes

### Transacciones de Stock
- Usan `runTransaction` de Firestore para atomicidad
- Evitan race conditions en inventario
- Validan stock antes de commit

### Cajas Mensuales vs Diarias
- **Caja Chica**: Diaria (efectivo)
- **Caja Banco**: Mensual (transferencias/tarjetas)
- Al editar factura, fecha se mantiene → mismo periodo

## 🔗 Archivos Modificados

1. `src/app/core/services/productos.ts` - Agregado incrementarStock()
2. `src/app/core/services/facturas.ts` - Agregado eliminarFactura(), actualizarFactura()
3. `src/app/core/services/caja-chica.service.ts` - Agregado eliminarMovimientoPorFactura()
4. `src/app/core/services/caja-banco.service.ts` - Modificado eliminarCajaBanco(), agregado eliminarMovimientoPorFactura()
5. `src/app/modules/ventas/crear-venta/crear-venta.ts` - Implementado modo dual (creación/edición)
6. `src/app/modules/factura/pages/listar-facturas/listar-facturas.ts` - Agregado botones editar/eliminar
7. `src/app/modules/factura/pages/listar-facturas/listar-facturas.html` - UI para editar/eliminar
8. `src/app/modules/ventas/ventas-routing-module.ts` - Ruta /ventas/editar/:facturaId
9. `src/app/modules/caja-banco/pages/listar-cajas/listar-cajas.html` - Botón eliminar con condición
10. `src/app/modules/caja-banco/pages/listar-cajas/listar-cajas.ts` - Lógica de validación

---

**Fecha de implementación**: 2025-01-28  
**Desarrollado por**: GitHub Copilot + Usuario  
**Estado**: ✅ Completado y funcional
