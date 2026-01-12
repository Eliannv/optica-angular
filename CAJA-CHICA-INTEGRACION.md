# 📊 Integración de Caja Chica - Flujo Completo

## 📋 Resumen
La caja chica está **completamente integrada** con el sistema de ventas y cobros. Los recibos se suman automáticamente durante el día.

---

## 🔄 Flujo de Ingresos Automáticos

### 1️⃣ **Ventas en Efectivo** → Caja Chica
📍 **Archivo:** `src/app/modules/ventas/crear-venta/crear-venta.ts` (línea ~284)

**Proceso:**
1. Usuario crea una venta y selecciona "Efectivo" como método de pago
2. Se crea la factura en Firestore
3. **Automáticamente** se registra un movimiento de INGRESO en caja chica:
   ```
   tipo: 'INGRESO'
   descripcion: `Venta #${id} - ${nombre_cliente}`
   monto: total_venta
   comprobante: id_factura
   ```
4. El saldo de caja chica se **actualiza inmediatamente**

**Validación:**
- ⚠️ Solo se registra si hay una caja abierta (`getCajaAbiertaHoy()`)
- No falla la venta si hay error en caja chica

---

### 2️⃣ **Abonos de Deudas en Efectivo** → Caja Chica
📍 **Archivo:** `src/app/modules/ventas/cobrar-deuda/cobrar-deuda.ts` (línea ~231)

**Proceso:**
1. Usuario selecciona una factura pendiente
2. Ingresa monto de abono
3. Registra el abono (actualiza estado de pago)
4. **Automáticamente** se registra un movimiento de INGRESO en caja chica:
   ```
   tipo: 'INGRESO'
   descripcion: `Pago de deuda - ${nombre_cliente} - Factura #${id}`
   monto: monto_abono
   comprobante: id_factura
   ```
5. El saldo de caja chica se **actualiza inmediatamente**

**Validación:**
- ⚠️ Solo se registra si el método de pago es "Efectivo"
- ⚠️ Solo si hay una caja abierta
- No falla el cobro si hay error en caja chica

---

## 💾 Actualización de Saldo (NUEVO)

### **Servicio:** `CajaChicaService.registrarMovimiento()`
📍 **Archivo:** `src/app/core/services/caja-chica.service.ts`

**Lo que hace ahora:**
1. ✅ Obtiene el saldo actual de la caja
2. ✅ Calcula el nuevo saldo según tipo:
   - INGRESO: `saldo_nuevo = saldo_anterior + monto`
   - EGRESO: `saldo_nuevo = saldo_anterior - monto`
3. ✅ Registra el movimiento con ambos saldos
4. ✅ **Actualiza `monto_actual` de la caja**

**Resultado:**
- Los recibos se suman en tiempo real
- El saldo de caja se refleja inmediatamente en la UI
- El historial registra saldo anterior y nuevo para auditoría

---

## 📊 Resumen de Caja Diaria

La página **"Ver Detalles de Caja"** (`/caja-chica/ver/:id`) muestra:
- ✅ **Monto inicial** de apertura
- ✅ **Total de ingresos** (suma de TODOS los INGRESOS del día)
- ✅ **Total de egresos** (suma de TODOS los EGRESOS)
- ✅ **Saldo actual** (monto_inicial + ingresos - egresos)
- ✅ **Historial de movimientos** en orden cronológico inverso

---

## 🔐 Seguridad & Auditoría

Cada movimiento registra:
- `saldo_anterior` - Saldo antes de la operación
- `saldo_nuevo` - Saldo después de la operación
- `usuario_id` y `usuario_nombre` - Quién realizó la operación
- `createdAt` - Timestamp exacto del servidor
- `comprobante` - Referencia a factura/venta

**Esto permite:**
- Auditar quién registró cada movimiento
- Detectar discrepancias de saldo
- Rastrear cambios históricos

---

## ⚙️ Ejemplo de Flujo Diario

```
09:00 - Abre caja chica con $100 iniciales
        ├─ monto_inicial: 100
        └─ monto_actual: 100

09:15 - Venta en efectivo $80
        ├─ Registra INGRESO por $80
        ├─ saldo_anterior: 100
        ├─ saldo_nuevo: 180
        └─ monto_actual: 180 ✅

09:45 - Abono de deuda $50
        ├─ Registra INGRESO por $50
        ├─ saldo_anterior: 180
        ├─ saldo_nuevo: 230
        └─ monto_actual: 230 ✅

10:30 - Pago de pequeño gasto $10
        ├─ Registra EGRESO por $10
        ├─ saldo_anterior: 230
        ├─ saldo_nuevo: 220
        └─ monto_actual: 220 ✅

16:00 - Cierra caja
        └─ Total ingresos: $130 (80+50)
        └─ Total egresos: $10
        └─ Saldo final: $220 (100+130-10) ✅
```

---

## 🚀 Próximas mejoras (opcionales)

1. **Resumen por hora** - Ver ingresos acumulados cada hora
2. **Gráficos** - Visualizar tendencia de ingresos durante el día
3. **Alertas** - Notificar cuando se alcanza meta diaria
4. **Reportes** - Exportar resumen diario a PDF/Excel
5. **Cuadratura** - Comparar caja chica vs total de ventas

---

**Actualizado:** 12 de enero de 2026
**Estado:** ✅ Sistema integrado y funcionando
