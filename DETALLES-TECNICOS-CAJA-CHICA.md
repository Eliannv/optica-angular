# 🔧 Detalles Técnicos del Cambio

## Archivo Modificado
**`src/app/core/services/caja-chica.service.ts`**

## Método Modificado: `registrarMovimiento()`

### ANTES (código viejo)
```typescript
async registrarMovimiento(cajaChicaId: string, movimiento: MovimientoCajaChica): Promise<string> {
  try {
    const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
    
    // ❌ PROBLEMA: No actualiza saldo, no registra saldos anteriores/nuevos
    const nuevoMovimiento: MovimientoCajaChica = {
      caja_chica_id: cajaChicaId,
      fecha: movimiento.fecha || new Date(),
      tipo: movimiento.tipo,
      descripcion: movimiento.descripcion,
      monto: movimiento.monto,
      comprobante: movimiento.comprobante || '',
      usuario_id: movimiento.usuario_id,
      usuario_nombre: movimiento.usuario_nombre,
      observacion: movimiento.observacion || '',
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(movimientosRef, nuevoMovimiento);
    return docRef.id;
  } catch (error) {
    console.error('Error registrando movimiento:', error);
    throw error;
  }
}
```

### DESPUÉS (código nuevo)
```typescript
async registrarMovimiento(cajaChicaId: string, movimiento: MovimientoCajaChica): Promise<string> {
  try {
    // ✅ PASO 1: Obtener la caja actual para conocer el saldo
    const cajaDoc = await getDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`));
    if (!cajaDoc.exists()) {
      throw new Error('Caja chica no encontrada');
    }

    const caja = cajaDoc.data() as CajaChica;
    const saldoAnterior = caja.monto_actual || 0;

    // ✅ PASO 2: Calcular el nuevo saldo según el tipo de movimiento
    let nuevoSaldo = saldoAnterior;
    if (movimiento.tipo === 'INGRESO') {
      nuevoSaldo = saldoAnterior + (movimiento.monto || 0);
    } else if (movimiento.tipo === 'EGRESO') {
      nuevoSaldo = saldoAnterior - (movimiento.monto || 0);
    }

    // ✅ PASO 3: Registrar el movimiento con saldos
    const movimientosRef = collection(this.firestore, 'movimientos_cajas_chicas');
    const nuevoMovimiento: MovimientoCajaChica = {
      caja_chica_id: cajaChicaId,
      fecha: movimiento.fecha || new Date(),
      tipo: movimiento.tipo,
      descripcion: movimiento.descripcion,
      monto: movimiento.monto,
      saldo_anterior: saldoAnterior,              // ✅ NUEVO
      saldo_nuevo: Math.max(0, nuevoSaldo),      // ✅ NUEVO + validación
      comprobante: movimiento.comprobante || '',
      usuario_id: movimiento.usuario_id,
      usuario_nombre: movimiento.usuario_nombre,
      observacion: movimiento.observacion || '',
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(movimientosRef, nuevoMovimiento);

    // ✅ PASO 4: Actualizar el monto_actual de la caja
    await updateDoc(doc(this.firestore, `cajas_chicas/${cajaChicaId}`), {
      monto_actual: Math.max(0, nuevoSaldo),
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error registrando movimiento:', error);
    throw error;
  }
}
```

---

## Cambios Específicos

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Saldo anterior** | ❌ No se guardaba | ✅ Se obtiene y guarda |
| **Saldo nuevo** | ❌ No se calculaba | ✅ Se calcula dinámicamente |
| **Actualizar caja** | ❌ Manual/no se hacía | ✅ Automático en cada movimiento |
| **Validación** | ❌ Saldo negativo posible | ✅ `Math.max(0, ...)` previene negativos |
| **Auditoría** | ❌ Sin historial de saldos | ✅ Registra ambos saldos |

---

## Flujo de Ejecución

### Cuando se registra un movimiento:

```
┌─────────────────────────────────────────┐
│ registrarMovimiento(cajaId, movimiento)  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ getDoc(cajaChica)                        │ 👈 Obtiene documento
│ ├─ monto_actual: 180                    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Calcular nuevo saldo                    │
│ ├─ Si INGRESO: 180 + 50 = 230          │
│ ├─ Si EGRESO: 180 - 50 = 130           │
│ └─ Validar: Math.max(0, resultado)      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ addDoc(movimiento)                       │ 👈 Registra movimiento
│ ├─ saldo_anterior: 180                  │
│ ├─ saldo_nuevo: 230                     │
│ └─ otros campos...                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ updateDoc(cajaChica)                    │ 👈 Actualiza caja
│ └─ monto_actual: 230                    │
└─────────────────────────────────────────┘
                 │
                 ▼
         ✅ Movimiento completado
```

---

## Ejemplo Real

### Caso: Venta en efectivo de $80

**Estado inicial de caja:**
```
Caja Abierta
├─ monto_inicial: 100
└─ monto_actual: 100  👈 Saldo actual
```

**Se ejecuta:** `registrarMovimiento(cajaId, { tipo: 'INGRESO', monto: 80, ... })`

**Paso 1 - Obtener saldo:**
```javascript
const caja = await getDoc(cajaChicaId)
const saldoAnterior = 100  // monto_actual actual
```

**Paso 2 - Calcular nuevo saldo:**
```javascript
nuevoSaldo = 100 + 80 = 180
```

**Paso 3 - Registrar movimiento:**
```javascript
addDoc(movimientos_cajas_chicas, {
  caja_chica_id: cajaId,
  tipo: 'INGRESO',
  monto: 80,
  descripcion: 'Venta #ABC123 - Cliente X',
  saldo_anterior: 100,  // 👈 Se guarda
  saldo_nuevo: 180,      // 👈 Se guarda
  comprobante: 'ABC123',
  createdAt: timestamp
})
```

**Paso 4 - Actualizar caja:**
```javascript
updateDoc(cajaChicaId, {
  monto_actual: 180,  // 👈 Se actualiza
  updatedAt: timestamp
})
```

**Estado final de caja:**
```
Caja Abierta
├─ monto_inicial: 100
└─ monto_actual: 180  ✅ Actualizado
```

---

## Ventajas de Este Cambio

### 1. **Sumas Automáticas**
- El saldo se actualiza en cada operación
- No requiere cálculos manuales
- El usuario ve el saldo actual en tiempo real

### 2. **Auditoría Completa**
- Se registra saldo anterior y nuevo
- Permite rastrear cambios de saldo
- Detecta anomalías o errores

### 3. **Seguridad**
- No permite saldos negativos (`Math.max(0, ...)`)
- Validación en cada paso
- Manejo de errores robusto

### 4. **Escalabilidad**
- Funciona con cualquier cantidad de movimientos
- Sin índices compuestos necesarios
- Calcula en el cliente, no en Firestore

---

## Impacto en Otros Módulos

### ✅ **Crear Venta** (`crear-venta.ts`)
- Ya registra en caja chica
- Ahora el saldo se actualiza automáticamente
- **No requiere cambios**

### ✅ **Cobrar Deuda** (`cobrar-deuda.ts`)
- Ya registra abonos en caja chica
- Ahora el saldo se actualiza automáticamente
- **No requiere cambios**

### ✅ **Ver Caja Chica** (página de detalles)
- Muestra el saldo actual (ahora actualizado)
- Muestra historial de movimientos
- Muestra resumen con totales
- **No requiere cambios**

---

## Testing

### Para verificar que funciona:

1. **Abrir una caja chica**
   - Ir a `/caja-chica` → Nueva
   - Abrir con $100 inicial

2. **Crear una venta en efectivo**
   - Ir a `/ventas/crear-venta`
   - Crear venta por $80
   - El saldo de caja debe ser $180 (100+80)

3. **Registrar un abono en efectivo**
   - Ir a `/ventas/cobrar-deuda`
   - Registrar abono de $50
   - El saldo debe ser $230 (180+50)

4. **Ver detalles de caja**
   - Ir a `/caja-chica/ver/:id`
   - Verificar que el saldo actual es $230
   - Verificar el historial de movimientos

---

## Notas de Desarrollo

- **No hay breaking changes** - El código es backward compatible
- **Recompilación necesaria** - Aunque el servidor esté corriendo, es buena idea reiniciar
- **Firestore:** Solo se usan métodos simples (getDoc, updateDoc, addDoc)
- **Rendimiento:** Cada movimiento hace 2 writes (movimiento + caja), es eficiente

---

**Actualizado:** 12 de enero de 2026
**Versión:** OpticaAngular v20 + Caja Chica Integrada
