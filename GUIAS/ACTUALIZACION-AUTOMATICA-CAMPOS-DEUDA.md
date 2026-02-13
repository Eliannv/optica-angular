# 💳💰 Actualización Automática de Campos de Deuda/Crédito

## 📋 Descripción General

Este documento explica cómo funciona la **actualización automática** de los campos denormalizados de deuda y crédito en los documentos de clientes.

### Campos Actualizados Automáticamente

Cada vez que se crea/edita una venta o se registra un pago, se actualizan automáticamente estos campos en el documento del cliente:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tieneCredito` | boolean | `true` si el cliente tiene al menos 1 crédito personal activo |
| `tieneDeuda` | boolean | `true` si el cliente tiene deuda pendiente > $0 |
| `_deudaCalculada` | number | Monto total de deuda pendiente |
| `_facturasPendientes` | number | Cantidad de facturas con saldo pendiente |
| `ultimaActualizacionDeuda` | timestamp | Fecha/hora de última actualización |

---

## 🔄 Flujo de Actualización

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREAR VENTA (POS)                            │
│                                                                 │
│  1. Usuario crea/edita factura                                 │
│  2. Se guarda factura en Firestore (crearFactura())            │
│  3. ✅ Se llama: actualizarCamposDeudaCredito(clienteId)       │
│     └─► Lee todas las facturas del cliente                     │
│     └─► Calcula resumen (deuda total, créditos, pendientes)   │
│     └─► Actualiza campos en doc del cliente                    │
│                                                                 │
│  Resultado: Campos actualizados en tiempo real                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    COBRAR DEUDA                                 │
│                                                                 │
│  1. Usuario registra pago/abono                                │
│  2. Se guarda registro en facturas_deudas                      │
│  3. Si factura queda pagada → marcarFacturaComoPagada()        │
│  4. ✅ Se llama: actualizarCamposDeudaCredito(clienteId)       │
│     └─► Recalcula deuda (contemplando pagos)                   │
│     └─► Actualiza campos en doc del cliente                    │
│                                                                 │
│  Resultado: Campos reflejan estado real de deuda               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💻 Implementación Técnica

### Método en ClientesService

```typescript
async actualizarCamposDeudaCredito(clienteId: string): Promise<void> {
  // 1. Obtener resumen usando FacturasService
  const resumen = await this.facturasSrv.getResumenDeuda(clienteId);
  // resumen = { deudaTotal, pendientes, creditosActivos, creditoPersonalActivo }
  
  // 2. Preparar campos
  const campos = {
    tieneCredito: resumen.creditoPersonalActivo,
    tieneDeuda: resumen.deudaTotal > 0,
    _deudaCalculada: resumen.deudaTotal,
    _facturasPendientes: resumen.pendientes,
    ultimaActualizacionDeuda: new Date()
  };
  
  // 3. Actualizar documento
  await updateDoc(doc(firestore, `clientes/${clienteId}`), campos);
}
```

### Integración en Crear Venta

**Archivo:** `src/app/modules/ventas/crear-venta/crear-venta.ts`

**Ubicación:** Después de `crearFactura()` o `actualizarFactura()` (línea ~1435)

```typescript
// ✅ GUARDAR FACTURA
const ref = await this.facturasSrv.crearFactura(factura);
facturaId = ref.id;

// 💳💰 ACTUALIZAR CAMPOS DE DEUDA/CRÉDITO
await this.clientesSrv.actualizarCamposDeudaCredito(this.clienteId);
```

### Integración en Cobrar Deuda

**Archivo:** `src/app/modules/ventas/cobrar-deuda/cobrar-deuda.ts`

**Ubicación:** Después de `crearPagoDeuda()` y `marcarFacturaComoPagada()` (línea ~470)

```typescript
// ✅ GUARDAR PAGO
await this.facturasDeudaService.crearPagoDeuda(deuda);

// Si factura queda pagada
if (estadoPago === 'PAGADA') {
  await this.facturasSrv.marcarFacturaComoPagada(f.id);
}

// 💳💰 ACTUALIZAR CAMPOS DE DEUDA/CRÉDITO
await this.clientesSrv.actualizarCamposDeudaCredito(this.clienteId);
```

---

## ✅ Beneficios

### 1. **Filtros Eficientes en Firestore**
Antes:
```typescript
// ❌ Tenía que cargar TODOS los clientes y luego filtrar localmente
// Causaba inconsistencia: 9 clientes en vez de 10 por página
```

Ahora:
```typescript
// ✅ Filtro directo en Firestore - rápido y consistente
query(clientesRef, 
  where('tieneDeuda', '==', true), 
  limit(10)
)
```

### 2. **Paginación Consistente**
- Siempre 10 clientes por página
- No se rompe con filtros activos
- No necesita cargar todas las facturas por adelantado

### 3. **Cálculo Preciso**
- Usa la misma lógica que `getResumenDeuda()`
- Considera pagos parciales (facturas_deudas)
- Detecta créditos personales correctamente

### 4. **Actualización Automática**
- No hay que ejecutar scripts manualmente
- Se actualiza en cada operación relevante
- Siempre refleja el estado real

---

## 🔍 Lógica de Cálculo (getResumenDeuda)

El método `getResumenDeuda()` del `FacturasService`:

1. **Busca facturas pendientes** del cliente
   ```typescript
   where('clienteId', '==', clienteId)
   where('estadoPago', '==', 'PENDIENTE')
   ```

2. **Lee pagos parciales** de `facturas_deudas`
   ```typescript
   query(facturasDeudaRef, where('clienteId', '==', clienteId))
   ```

3. **Calcula saldo real** por cada factura:
   ```typescript
   saldoBase = factura.saldoPendiente ?? (total - abonado)
   pagosRealizados = suma de montoPagado en facturas_deudas
   saldoReal = saldoBase - pagosRealizados
   ```

4. **Detecta crédito personal**:
   ```typescript
   esCredito = factura.esCredito 
            || factura.tipoVenta === 'CREDITO' 
            || factura.estadoCredito === 'ACTIVO'
   ```

5. **Suma totales**:
   - `deudaTotal`: suma de todos los saldos > 0
   - `pendientes`: cantidad de facturas con saldo > 0
   - `creditosActivos`: cantidad de facturas de crédito personal con saldo > 0
   - `creditoPersonalActivo`: `creditosActivos > 0`

---

## 🛡️ Manejo de Errores

La actualización está **protegida con try/catch** para no bloquear el flujo principal:

```typescript
try {
  await this.clientesSrv.actualizarCamposDeudaCredito(clienteId);
  console.log('✅ Campos actualizados');
} catch (err) {
  console.warn('⚠️ No se pudieron actualizar campos:', err);
  // No lanza error - continúa el flujo
}
```

**Implicaciones:**
- Si falla la actualización, la venta/pago SE GUARDA de todos modos
- Solo se loguea el error en consola
- Los campos se actualizarán en la siguiente operación

---

## 📊 Índices de Firestore Necesarios

Para filtros eficientes, crear estos índices compuestos:

### 1. Filtro por deuda + ordenar por fecha
```
Collection: clientes
Fields:
  - activo (Ascending)
  - tieneDeuda (Ascending)
  - createdAt (Descending)
```

### 2. Filtro por crédito + ordenar por fecha
```
Collection: clientes
Fields:
  - activo (Ascending)
  - tieneCredito (Ascending)
  - createdAt (Descending)
```

### 3. Filtro por deuda + ordenar por nombre
```
Collection: clientes
Fields:
  - activo (Ascending)
  - tieneDeuda (Ascending)
  - nombres (Ascending)
```

### 4. Filtro por crédito + ordenar por nombre
```
Collection: clientes
Fields:
  - activo (Ascending)
  - tieneCredito (Ascending)
  - nombres (Ascending)
```

**Firestore creará estos índices automáticamente cuando intentes usar los filtros** (mostrará error con link para crearlos).

---

## 🚀 Próximos Pasos

### 1. Ejecutar migración inicial
Ejecutar el script `GUIAS/actualizar-campos-credito-deuda.js` para poblar los campos en clientes existentes:

```bash
node GUIAS/actualizar-campos-credito-deuda.js
```

### 2. Habilitar filtros en UI
Restaurar los selectores de filtro en `lista-clientes.html`:

```html
<!-- Filtro de Crédito -->
<select [(ngModel)]="filtroCredito" (change)="cargarPrimeraPage()">
  <option value="todos">Todos</option>
  <option value="conCredito">Con Crédito</option>
  <option value="sinCredito">Sin Crédito</option>
</select>

<!-- Filtro de Deuda -->
<select [(ngModel)]="filtroDeuda" (change)="cargarPrimeraPage()">
  <option value="todos">Todos</option>
  <option value="conDeuda">Con Deuda</option>
  <option value="sinDeuda">Sin Deuda</option>
</select>
```

### 3. Actualizar servicio para soportar nuevos filtros
Modificar `getClientesPaginadosReal()` en `ClientesService`:

```typescript
async getClientesPaginadosReal(options: {
  pageSize?: number;
  lastVisible?: DocumentSnapshot | null;
  firstVisible?: DocumentSnapshot | null;
  direction?: 'next' | 'prev';
  ordenamiento?: 'reciente' | 'nombre';
  filtroEstado?: 'todos' | 'conHistorial' | 'sinHistorial';
  filtroCredito?: 'todos' | 'conCredito' | 'sinCredito';  // ✅ NUEVO
  filtroDeuda?: 'todos' | 'conDeuda' | 'sinDeuda';        // ✅ NUEVO
}) {
  // ... agregar where() para tieneCredito y tieneDeuda
}
```

---

## 📝 Notas Importantes

1. **No se modifican facturas antiguas** - Solo se actualizan los campos del cliente
2. **Idempotente** - Se puede ejecutar múltiples veces sin problemas
3. **Compatible con facturas sin historial** (`tipoFactura: 'SIN_HISTORIAL'`)
4. **Considera pagos parciales** registrados en `facturas_deudas`
5. **No afecta lógica de deuda existente** - Solo agrega campos denormalizados

---

## 🐛 Debug

Para verificar que se están actualizando correctamente:

### En consola del navegador (crear-venta):
```
💳 Actualizando campos de deuda/crédito para cliente: ABC123
📊 Resumen de deuda obtenido: { deudaTotal: 855.84, pendientes: 7, ... }
✅ Campos a actualizar: { tieneCredito: true, tieneDeuda: true, ... }
✅ Campos de deuda/crédito actualizados correctamente
```

### En consola del navegador (cobrar-deuda):
```
💳 Actualizando campos de deuda/crédito para cliente: ABC123
📊 Resumen de deuda obtenido: { deudaTotal: 705.84, pendientes: 6, ... }
✅ Campos a actualizar: { tieneCredito: true, tieneDeuda: true, ... }
✅ Campos de deuda/crédito actualizados correctamente
```

### En Firestore:
Revisar documento del cliente - debe tener:
```json
{
  "nombres": "Jose",
  "apellidos": "Iturralde",
  "tieneCredito": true,
  "tieneDeuda": true,
  "_deudaCalculada": 855.84,
  "_facturasPendientes": 7,
  "ultimaActualizacionDeuda": Timestamp(...)
}
```

---

## 🎯 Resumen Ejecutivo

**¿Qué hace?**
Actualiza automáticamente campos de deuda/crédito en el documento del cliente después de crear ventas o registrar pagos.

**¿Por qué?**
Permite filtros eficientes en Firestore y paginación consistente sin cargar todas las facturas primero.

**¿Cuándo se ejecuta?**
- Al crear/editar venta en POS
- Al registrar pago/abono en cobrar-deuda

**¿Cómo funciona?**
Usa `getResumenDeuda()` del FacturasService para calcular el estado real y actualiza el doc del cliente.

**¿Qué pasa si falla?**
La venta/pago se guarda de todos modos, solo se loguea el error. Se actualizará en la siguiente operación.

---

**Fecha de implementación:** 13 de febrero de 2026  
**Versión del sistema:** Angular 20  
**Autor:** GitHub Copilot (Claude Sonnet 4.5)
