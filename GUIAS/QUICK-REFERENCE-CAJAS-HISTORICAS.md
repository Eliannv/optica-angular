# Quick Reference - Creación Histórica de Cajas

## ¿Qué cambió?

### Antes:
- ❌ Cajas banco: solo fecha actual, automático
- ❌ Cajas chicas: solo fecha actual, automático
- ❌ Cierre automático al terminar mes
- ❌ Asociación por día exacto

### Ahora:
- ✅ Cajas banco: fecha manual (histórica o actual)
- ✅ Cajas chicas: fecha manual (histórica o actual)
- ✅ Cierre manual (cuando el usuario lo indique)
- ✅ Asociación por periodo (mes/año)

---

## Uso Rápido

### Crear Caja Banco Histórica:
1. "Caja Banco" → "Crear Caja Banco"
2. Seleccionar fecha: `01/11/2025`
3. Saldo inicial: (vacío para auto-herencia)
4. Crear

**Resultado:** Caja banco para TODO noviembre 2025

### Crear Caja Chica Histórica:
1. "Caja Chica" → "Abrir Caja"
2. Seleccionar fecha: `10/11/2025`
3. Monto inicial: `100`
4. Crear

**Resultado:** Caja chica del día 10/11/2025, asociada automáticamente a caja banco de noviembre 2025

---

## Validaciones

### Caja Banco:
- ✅ Solo 1 caja ABIERTA por periodo (mes/año)
- ✅ Hereda saldo del periodo anterior automáticamente
- ✅ Fecha se normaliza al día 1 del mes

### Caja Chica:
- ✅ Solo 1 caja por día exacto
- ✅ Se asocia a caja banco del mismo periodo (mes/año)
- ✅ Requiere que exista al menos 1 caja banco

---

## Ejemplo Completo

### Crear historial de noviembre 2025:

**1. Crear caja banco:**
- Fecha: `01/11/2025`
- Saldo: (vacío)
- → Hereda de octubre 2025 automáticamente

**2. Crear cajas chicas:**
- `01/11/2025` → Monto: `100`
- `10/11/2025` → Monto: `150`
- `22/11/2025` → Monto: `120`
- → Todas se asocian automáticamente a caja banco noviembre 2025

**3. Resultado:**
```
Caja Banco Nov 2025 (id: abc123)
├── Caja Chica 01/11/2025
├── Caja Chica 10/11/2025
└── Caja Chica 22/11/2025
```

---

## Archivos Clave

### Nuevo:
- `src/app/core/utils/fecha-helpers.ts`

### Modificados:
- `src/app/core/services/caja-banco.service.ts`
- `src/app/core/services/caja-chica.service.ts`
- `src/app/modules/caja-chica/pages/abrir-caja/` (ts + html)
- `src/app/modules/caja-banco/pages/listar-cajas/listar-cajas.ts`

---

## Métodos Nuevos

### CajaBancoService:
- `getCajaBancoPorPeriodo(year, monthIndex0)` - Busca caja por periodo específico

### Helpers de Fecha:
- `obtenerPeriodo(fecha)` - Extrae periodo (año + mes)
- `normalizarFecha(fecha)` - Normaliza a medianoche
- `rangoPeriodo(year, monthIndex0)` - Rango completo del mes

---

## ✅ Listo para usar

Todo funciona y está testeado. La lógica existente se mantiene 100% compatible.

Para más detalles ver: `IMPLEMENTACION-CREACION-HISTORICA-CAJAS.md`
