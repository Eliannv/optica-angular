# Validaciones Reactivas del Formulario de Proveedores

## Descripción General

El formulario de crear proveedor incluye **validaciones específicas para Ecuador**, con énfasis en la provincia de **El Oro - Pasaje**. Las validaciones garantizan que los datos ingresados cumplan con los formatos oficiales ecuatorianos.

---

## Validaciones Implementadas

### 1. **Código del Proveedor** (Campo opcional)

#### Reglas:
- ✅ Mínimo **1 letra** (mayúscula o minúscula)
- ✅ Mínimo **4 números**
- ⚠️ Opcional (si se completa, debe cumplir el formato)

#### Ejemplos válidos:
- `P0001` ✅ (1 letra, 4 números)
- `PROV1234` ✅ (4 letras, 4 números)
- `DIST0001` ✅ (4 letras, 4 números)
- _(vacío)_ ✅ (opcional)

#### Ejemplos inválidos:
- `P001` ❌ (solo 3 números)
- `1234` ❌ (sin letras)
- `PROV` ❌ (sin números)

---

### 2. **RUC Ecuatoriano** (Campo obligatorio) ⭐

#### Reglas:
- ✅ Exactamente **13 dígitos**
- ✅ Primeros 2 dígitos: código de provincia válido (01-24)
- ✅ Tercer dígito: tipo de RUC válido (0-9)
- ✅ Para El Oro: debe iniciar con **07**

#### Estructura del RUC:
```
0 7 X X X X X X X X X 0 0 1
│ │ │                 └─┴─┴─ Establecimiento (001, 002, etc.)
│ │ └─────────────────────── Número secuencial
│ └───────────────────────── Tipo de RUC (0-9)
└─────────────────────────── Código de provincia (07 = El Oro)
```

#### Tipos de RUC (tercer dígito):
- **0-5**: Persona natural o jurídica con cédula
- **6**: Sociedades públicas
- **9**: RUC público o privado sin cédula

#### Ejemplos válidos:
- `0701234567001` ✅ (El Oro - persona natural)
- `0791234567001` ✅ (El Oro - empresa privada)
- `0761234567001` ✅ (El Oro - sociedad pública)
- `1701234567001` ✅ (Pichincha)
- `0901234567001` ✅ (Guayas)

#### Ejemplos inválidos:
- `070123456700` ❌ (solo 12 dígitos)
- `07012345670012` ❌ (14 dígitos)
- `2501234567001` ❌ (provincia 25 no existe)
- `ABC1234567001` ❌ (contiene letras)
- `0771234567001` ❌ (tercer dígito 7 inválido)

---

### 3. **Teléfonos** (Campos opcionales)

#### Reglas para Ecuador - El Oro:

##### Teléfono Celular:
- ✅ Formato: `09XXXXXXXX` (10 dígitos)
- ✅ Inicia con **09**
- ✅ Operadoras: Claro, Movistar, CNT

##### Teléfono Convencional (El Oro):
- ✅ Formato: `07XXXXXXX` (9 dígitos) o `07XXXXXXXX` (10 dígitos)
- ✅ Inicia con **07**
- ✅ Específico para la provincia de El Oro

#### Ejemplos válidos:
**Celulares:**
- `0991234567` ✅
- `0981234567` ✅
- `0995551234` ✅

**Convencionales El Oro:**
- `072931234` ✅ (9 dígitos - Pasaje)
- `0729312345` ✅ (10 dígitos)
- `072951234` ✅ (Machala)

#### Ejemplos inválidos:
- `991234567` ❌ (falta el 0 inicial)
- `0891234567` ❌ (no inicia con 09)
- `021234567` ❌ (código de otra provincia)
- `07123` ❌ (muy corto)

---

### 4. **Código de Lugar** (Campo opcional)

#### Reglas:
- ✅ Código de provincia de 2 dígitos (01-24)
- ✅ Recomendado: **07** para El Oro - Pasaje
- ⭐ Muestra mensaje especial cuando es 07

#### Códigos de provincia Ecuador:
```
01 = Azuay               13 = Manabí
02 = Bolívar             14 = Morona Santiago
03 = Cañar               15 = Napo
04 = Carchi              16 = Pastaza
05 = Cotopaxi            17 = Pichincha
06 = Chimborazo          18 = Tungurahua
07 = El Oro ⭐          19 = Zamora Chinchipe
08 = Esmeraldas          20 = Galápagos
09 = Guayas              21 = Sucumbíos
10 = Imbabura            22 = Orellana
11 = Loja                23 = Santo Domingo
12 = Los Ríos            24 = Santa Elena
```

#### Ejemplos válidos:
- `07` ✅ (El Oro - Pasaje) ⭐ mensaje especial
- `09` ✅ (Guayas)
- `17` ✅ (Pichincha)
- `01` ✅ (Azuay)

#### Ejemplos inválidos:
- `25` ❌ (fuera de rango)
- `00` ❌ (no existe)
- `7` ❌ (debe ser 2 dígitos)
- `ABC` ❌ (no numérico)

---

### 5. **Saldo Inicial** (Campo opcional)

#### Reglas:
- ✅ Puede ser **positivo**, **negativo** o **cero**
- ✅ Debe ser un número válido
- 📊 Interpretación del saldo:

##### Saldo Positivo (> 0):
- 💰 **A favor del proveedor**
- Significa que el negocio le debe dinero al proveedor
- Ejemplo: Adelantos recibidos, facturas pendientes de pago

##### Saldo Negativo (< 0):
- ⚠️ **Deuda con el proveedor**
- Significa que el proveedor debe dinero al negocio
- Ejemplo: Anticipos dados, devoluciones pendientes

##### Saldo Cero (= 0):
- ✅ **Sin saldo pendiente**
- No hay deudas en ninguna dirección

#### Ejemplos válidos:
- `1000.00` ✅ → "Saldo a favor del proveedor" (le debemos $1000)
- `-500.50` ✅ → "Deuda con el proveedor" (nos debe $500.50)
- `0.00` ✅ → "Sin saldo pendiente"
- `0` ✅ → "Sin saldo pendiente"

#### Ejemplos inválidos:
- `ABC` ❌ (no es número)
- `1,000.00` ❌ (usar punto, no coma)

---

## Flujo de Validación

### Al Escribir (input event):
1. **Código**: Valida formato en tiempo real
2. **RUC**: Valida estructura mientras escribe
3. **Teléfonos**: Verifica formato celular/convencional
4. **Código de lugar**: Valida rango de provincia
5. **Saldo**: Valida que sea número y actualiza mensaje

### Al Salir del Campo (blur event):
- Realiza validación final del campo
- Actualiza mensajes de feedback
- Aplica estilos visuales

### Al Guardar:
1. ✅ Verifica campos obligatorios (Nombre y RUC)
2. ✅ Valida formato de código (si está presente)
3. ✅ Valida RUC completo
4. ✅ Valida teléfonos (si están presentes)
5. ✅ Valida código de lugar (si está presente)
6. ✅ Valida saldo
7. ✅ Solo guarda si todas las validaciones pasan

---

## Mensajes de Validación

### Código del Proveedor:
- ❌ "Debe contener al menos 1 letra y 4 números"
- ✅ "Formato válido"

### RUC:
- ❌ "El RUC debe tener exactamente 13 dígitos"
- ❌ "Código de provincia inválido (primeros 2 dígitos)"
- ❌ "Tercer dígito de RUC inválido"
- ✅ "RUC válido"

### Teléfonos:
- ❌ "Debe ser celular (09XXXXXXXX) o convencional de El Oro (07XXXXXXX)"
- ✅ "Teléfono celular válido"
- ✅ "Teléfono convencional válido (El Oro)"

### Código de Lugar:
- ❌ "Código debe estar entre 01 y 24"
- ❌ "Debe ser un código de 2 dígitos (Ej: 07 para El Oro)"
- ✅ "El Oro - Pasaje ✅" (cuando es 07)
- ✅ "Código de provincia válido"

### Saldo:
- ❌ "El saldo debe ser un número válido"
- ℹ️ "Saldo a favor del proveedor"
- ⚠️ "Deuda con el proveedor"
- ✅ "Sin saldo pendiente"

---

## Casos de Uso Específicos

### Caso 1: Proveedor de El Oro - Pasaje
```
Código: P0001 ✅
RUC: 0701234567001 ✅ (El Oro)
Teléfono Principal: 072931234 ✅ (Convencional Pasaje)
Teléfono Secundario: 0991234567 ✅ (Celular)
Código de Lugar: 07 ✅ (El Oro - Pasaje)
Saldo: 0.00 ✅
→ Todos los campos específicos para El Oro
```

### Caso 2: Proveedor de otra provincia con celular
```
Código: DIST5001 ✅
RUC: 0991234567001 ✅ (Guayas)
Teléfono Principal: 0981234567 ✅ (Celular)
Código de Lugar: 09 ✅ (Guayas)
→ Válido para proveedor de Guayaquil
```

### Caso 3: Proveedor con saldo a favor
```
Código: PROV0010 ✅
RUC: 0701234567001 ✅
Saldo: 5000.00 ℹ️ "Saldo a favor del proveedor"
→ Le debemos $5000 al proveedor
```

### Caso 4: Errores comunes
```
❌ RUC: 070123456 (muy corto)
   → "El RUC debe tener exactamente 13 dígitos"

❌ Teléfono: 021234567 (Quito, no El Oro)
   → "Debe ser celular (09...) o convencional de El Oro (07...)"

❌ Código Lugar: 25 (no existe)
   → "Código debe estar entre 01 y 24"
```

---

## Archivos Modificados

### `crear-proveedor.ts`
Nuevos métodos agregados:
- `validarFormatoCodigo()` - Valida 1 letra + 4 números
- `validarCodigo()` - Valida código del proveedor
- `validarRUC()` - Validación completa de RUC ecuatoriano
- `validarTelefono()` - Valida celular o convencional de El Oro
- `validarCodigoLugar()` - Valida código de provincia
- `validarSaldo()` - Valida y clasifica el saldo

### `crear-proveedor.html`
Mejoras de UI:
- Validación en tiempo real en todos los campos
- Feedback visual (verde/rojo) instantáneo
- Mensajes descriptivos y contextuales
- Placeholders con ejemplos correctos

### `crear-proveedor.css`
Estilos para:
- `.input-with-validation` - Contenedor de validación
- `.validation-feedback` - Mensajes de feedback
- Estados `.is-valid` y `.is-invalid`
- Colores semánticos (success, danger, info, warning)

---

## Beneficios

### Para el Negocio:
✅ **Integridad de datos** - Solo información válida en BD
✅ **Cumplimiento legal** - RUCs válidos según normativa ecuatoriana
✅ **Comunicación efectiva** - Teléfonos correctos para contactar
✅ **Control financiero** - Saldos claros desde el inicio

### Para el Usuario:
✅ **Guía clara** - Sabe exactamente qué formato usar
✅ **Feedback inmediato** - Ve errores al instante
✅ **Ejemplos contextuales** - Placeholders con formato correcto
✅ **Prevención de errores** - No puede guardar datos inválidos

### Específico para El Oro - Pasaje:
✅ **Validación regional** - Teléfonos convencionales específicos
✅ **RUC local** - Verifica código de provincia correcto
✅ **Mensaje especial** - Reconoce código 07 como El Oro

---

## Referencias

### Normativas Ecuador:
- **RUC**: Reglamento del Registro Único de Contribuyentes (SRI)
- **Provincias**: División política administrativa de Ecuador
- **Telefonía**: Plan de numeración - ARCOTEL

### Códigos útiles:
- El Oro (Pasaje): Provincia **07**
- Teléfonos convencionales El Oro: **07** + 6-7 dígitos
- Teléfonos celulares Ecuador: **09** + 8 dígitos
- RUC: **13 dígitos** (PP-T-XXXXXXX-EEE)

---

## Testing Sugerido

### RUC:
- [ ] 0701234567001 → válido (El Oro)
- [ ] 070123456700 → inválido (12 dígitos)
- [ ] 2501234567001 → inválido (provincia 25)
- [ ] 0771234567001 → inválido (tercer dígito 7)

### Teléfonos:
- [ ] 0991234567 → válido (celular)
- [ ] 072931234 → válido (El Oro)
- [ ] 021234567 → inválido (Quito, no El Oro)
- [ ] 991234567 → inválido (falta 0)

### Código de Lugar:
- [ ] 07 → válido (El Oro ⭐)
- [ ] 17 → válido (Pichincha)
- [ ] 25 → inválido (no existe)
- [ ] 7 → inválido (1 dígito)

### Saldo:
- [ ] 1000 → válido (a favor)
- [ ] -500 → válido (deuda)
- [ ] 0 → válido (sin saldo)
- [ ] ABC → inválido (no numérico)
