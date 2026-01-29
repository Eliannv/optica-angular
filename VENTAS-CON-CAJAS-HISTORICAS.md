# Ventas con Cajas Históricas ✅

**Fecha**: 29/01/2026  
**Problema Resuelto**: Sistema bloqueaba ventas y cobros cuando solo existía una caja chica histórica (no del día actual)

---

## 🔴 Problema Original

```
Situación: 
- Usuario tiene caja chica del 31/10/2025 (ABIERTA)
- Fecha actual: 29/01/2026
- Sistema bloquea: crear ventas y cobrar deudas

Mensaje error:
"Debe crear primero la caja chica de este día para empezar con una nueva venta"
```

### Causa Raíz

Los sistemas de validación buscaban cajas **del día actual**:
- `validarCajaChicaHoy()` → solo cajas con `fecha = hoy`
- `existeCajaAbiertaHoy()` → solo cajas con `fecha = hoy`
- `cajaChicaGuard` → validaba existencia de caja del día

Esto contradecía la nueva funcionalidad de **creación histórica** donde puedes tener cajas abiertas de fechas pasadas.

---

## ✅ Solución Implementada

### 1. Nuevos Métodos en `CajaChicaService`

#### **`getCajaAbierta()` - Busca CUALQUIER caja ABIERTA**
```typescript
async getCajaAbierta(): Promise<CajaChica | null> {
  const q = query(
    cajasRef,
    where('estado', '==', 'ABIERTA'),
    orderBy('fecha', 'desc'), // Primero la más reciente
    limit(1)
  );
  
  // Retorna la primera caja ABIERTA encontrada (sin importar fecha)
}
```

#### **`validarCajaAbierta()` - Valida si existe alguna caja ABIERTA**
```typescript
async validarCajaAbierta(): Promise<{ valida: boolean; caja?: CajaChica }> {
  const caja = await this.getCajaAbierta();
  return {
    valida: caja !== null,
    caja: caja || undefined
  };
}
```

### 2. Guard Actualizado: `cajaChicaGuard`

**ANTES** ❌
```typescript
// Bloqueaba si no había caja DEL DÍA ACTUAL
const cajaChicaAbierta = localStorage.getItem('cajaChicaAbierta');
if (!cajaChicaAbierta) {
  const existeEnFirestore = await cajaChicaService.existeCajaAbiertaHoy();
  if (!existeEnFirestore) {
    // ⛔ Bloqueo
  }
}
```

**AHORA** ✅
```typescript
// Permite ventas si hay CUALQUIER caja ABIERTA (histórica o actual)
const validacion = await cajaChicaService.validarCajaAbierta();

if (!validacion.valida) {
  Swal.fire({
    text: 'Debe tener al menos una caja chica ABIERTA para realizar ventas (puede ser de cualquier fecha)',
  });
  return false;
}
```

### 3. Historial Clínico Actualizado

**Componente**: `historial-clinico.ts`

**ANTES** ❌
```typescript
async ngOnInit() {
  const validacion = await this.cajasChicaService.validarCajaChicaHoy();
  this.cajaChicaAbierta = validacion.valida && validacion.tipo === 'ABIERTA';
}
```

**AHORA** ✅
```typescript
async ngOnInit() {
  // ✅ Validar si existe ALGUNA caja ABIERTA (histórica o actual)
  const validacion = await this.cajasChicaService.validarCajaAbierta();
  this.cajaChicaAbierta = validacion.valida;
}
```

---

## 🎯 Comportamiento Actual

| Escenario | Resultado |
|-----------|-----------|
| Caja 31/10/2025 ABIERTA (hoy 29/01/2026) | ✅ Permite ventas y cobros |
| Caja 29/01/2026 ABIERTA | ✅ Permite ventas y cobros |
| Caja 15/12/2025 CERRADA + Caja 10/11/2025 ABIERTA | ✅ Permite ventas (usa la ABIERTA) |
| NO hay ninguna caja ABIERTA | ⛔ Bloquea ventas ("debe tener al menos una caja ABIERTA") |

### Orden de Búsqueda

El método `getCajaAbierta()` usa `orderBy('fecha', 'desc')` para retornar la caja ABIERTA **más reciente** si hay múltiples:

```
Firestore:
- Caja 15/01/2026 (ABIERTA) 👈 Esta se usa
- Caja 20/12/2025 (ABIERTA)
- Caja 05/11/2025 (ABIERTA)
- Caja 31/10/2025 (CERRADA)
```

---

## 📁 Archivos Modificados

1. **`src/app/core/services/caja-chica.service.ts`**
   - ➕ Agregado `getCajaAbierta()`
   - ➕ Agregado `validarCajaAbierta()`
   - ➕ Import de `limit` desde `@angular/fire/firestore`

2. **`src/app/core/guards/caja-chica.guard.ts`**
   - 🔄 Reemplazado `existeCajaAbiertaHoy()` con `validarCajaAbierta()`
   - 🔄 Mensaje actualizado: "puede ser de cualquier fecha"

3. **`src/app/modules/clientes/pages/historial-clinico/historial-clinico.ts`**
   - 🔄 Reemplazado `validarCajaChicaHoy()` con `validarCajaAbierta()`

---

## 🔍 Diferencias Entre Métodos

### Métodos para **DÍA ACTUAL** (mantienen funcionalidad previa)
```typescript
getCajaAbiertaHoy()       → Retorna caja ABIERTA con fecha = hoy
existeCajaAbiertaHoy()    → Boolean si existe caja ABIERTA con fecha = hoy
validarCajaChicaHoy()     → Valida caja del día con tipo (ABIERTA/CERRADA/NO_EXISTE)
```

### Métodos para **CUALQUIER FECHA** (nuevos) ✨
```typescript
getCajaAbierta()         → Retorna PRIMERA caja ABIERTA (más reciente)
validarCajaAbierta()     → Boolean si existe ALGUNA caja ABIERTA
```

### ¿Cuándo usar cada uno?

| Uso | Método Recomendado |
|-----|-------------------|
| Validar operaciones de venta/cobro | `validarCajaAbierta()` ✅ NUEVO |
| Dashboard diario (operaciones del día) | `validarCajaChicaHoy()` |
| Verificar estado específico de hoy | `existeCajaAbiertaHoy()` |
| Obtener caja activa para movimientos | `getCajaAbierta()` ✅ NUEVO |

---

## ⚙️ Configuración de Firestore

### Índice Requerido

El nuevo método usa `orderBy('fecha', 'desc')` + `where('estado', '==', 'ABIERTA')`, necesitas crear este índice:

**Colección**: `cajas_chicas`

| Campo | Orden |
|-------|-------|
| `estado` | Ascending |
| `fecha` | Descending |

Firestore te lo pedirá automáticamente con un enlace al ejecutar la query por primera vez.

---

## 🧪 Cómo Probar

### Escenario 1: Caja Histórica (31/10/2025) ABIERTA

1. Asegurarse de tener caja ABIERTA del 31/10/2025
2. Ir a **Historial Clínico**
3. Buscar cliente con deuda
4. Click en botón "Cobrar Deuda" → ✅ **Debe permitirlo**
5. Ir a **Facturas** (crear venta nueva)
6. El guard **NO** debe bloquearte → ✅ **Permite acceso**

### Escenario 2: Solo Cajas CERRADAS

1. Cerrar todas las cajas chicas existentes
2. Intentar ir a Facturas/Ventas
3. Debe mostrarse:
   ```
   🔴 Caja Chica Requerida
   
   Debe tener al menos una caja chica ABIERTA para realizar ventas
   (puede ser de cualquier fecha)
   
   [Ir a Caja Chica]
   ```

### Escenario 3: Múltiples Cajas ABIERTAS

1. Crear cajas abiertas:
   - 10/11/2025 (ABIERTA)
   - 15/12/2025 (ABIERTA)
   - 20/01/2026 (ABIERTA) ← **más reciente**
2. Al realizar venta → usa la del 20/01/2026 automáticamente

---

## 🎉 Resultado Final

Ahora el sistema funciona con **FLEXIBILIDAD HISTÓRICA**:

✅ Puedes tener cajas abiertas de cualquier fecha  
✅ Las ventas funcionan mientras haya UNA caja ABIERTA  
✅ El sistema prioriza la caja más reciente  
✅ No te obliga a crear caja del día actual  
✅ Mantiene integridad (siempre registra en ALGUNA caja)

**El usuario ahora controla completamente sus cajas, sin restricciones artificiales de fecha** 🚀
