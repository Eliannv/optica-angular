# Validaciones Reactivas del Formulario de Productos

## Descripción General

El formulario de crear producto ahora incluye **validaciones reactivas en tiempo real** que aseguran la integridad y consistencia de los datos antes de guardar.

---

## Validaciones Implementadas

### 1. **Código de Armazón** (Campo obligatorio)

#### Reglas:
- ✅ Mínimo **1 letra** (mayúscula o minúscula)
- ✅ Mínimo **4 números**
- ✅ Debe ser **único** en la base de datos
- ✅ No puede estar vacío

#### Ejemplos válidos:
- `O0012` ✅ (1 letra, 4 números)
- `ARM1234` ✅ (3 letras, 4 números)
- `A12345` ✅ (1 letra, 5 números)
- `METAL0001` ✅ (5 letras, 4 números)

#### Ejemplos inválidos:
- `O001` ❌ (solo 3 números)
- `1234` ❌ (sin letras)
- `ABCD` ❌ (sin números)
- `O12` ❌ (solo 2 números)

#### Feedback visual:
- **En tiempo real**: Se valida mientras escribe
- **Al salir del campo**: Verifica unicidad en BD
- **Verde**: Código válido y disponible ✅
- **Rojo**: Formato incorrecto o código ya existe ❌
- **Azul con spinner**: Validando en la base de datos 🔄

---

### 2. **Grupo** (Campo opcional)

#### Reglas:
- ✅ Mínimo **1 letra**
- ✅ Mínimo **4 números**
- ⚠️ Opcional (si se completa, debe cumplir el formato)

#### Ejemplos válidos:
- `O0002` ✅
- `GRP1234` ✅
- `G12345` ✅
- _(vacío)_ ✅ (opcional)

#### Ejemplos inválidos:
- `O12` ❌ (solo 2 números)
- `1234` ❌ (sin letras)

#### Feedback visual:
- **En tiempo real**: Se valida mientras escribe
- **Verde**: Formato válido ✅
- **Rojo**: Formato incorrecto ❌

---

### 3. **Unidad** (Campo obligatorio)

#### Reglas:
- ✅ Debe ser un **número mayor a 0**
- ✅ Representa la cantidad de unidades por caja
- ✅ Se usa para calcular el costo/precio por unidad

#### Ejemplos válidos:
- `1` ✅ (1 unidad por caja)
- `12` ✅ (12 unidades por caja)
- `100` ✅

#### Ejemplos inválidos:
- `0` ❌ (debe ser mayor a 0)
- `-1` ❌ (no puede ser negativo)

---

### 4. **Lógica de Precios** (Validación cruzada)

#### Reglas:

##### 4.1. Precio Caja > Costo Caja
- El **precio de venta por caja** debe ser **mayor** que el **costo de compra**
- Garantiza margen de ganancia

```
Ejemplo válido:
  Costo Caja: $100.00
  Precio Caja: $120.00 ✅ (20% margen)

Ejemplo inválido:
  Costo Caja: $100.00
  Precio Caja: $90.00 ❌ (pérdida)
```

##### 4.2. PVP1 > Costo por Unidad
- El **precio de venta unitario** debe ser **mayor** que el **costo por unidad**
- El costo por unidad se calcula: `Costo Caja / Unidad`

```
Ejemplo válido:
  Costo Caja: $120.00
  Unidad: 12
  Costo por Unidad: $10.00
  PVP1: $12.00 ✅ (20% margen)

Ejemplo inválido:
  Costo Caja: $120.00
  Unidad: 12
  Costo por Unidad: $10.00
  PVP1: $9.00 ❌ (pérdida por unidad)
```

##### 4.3. Unidad > 0
- La cantidad de unidades debe ser mayor a cero para evitar división por cero

#### Feedback visual:
- **Alerta amarilla**: Aparece cuando hay inconsistencias
- **Mensaje descriptivo**: Explica qué está mal
- **Se valida en tiempo real**: Al cambiar cualquier campo de precio

---

## Flujo de Validación

### Al Escribir:
1. **Código de Armazón**: Valida formato al escribir
2. **Grupo**: Valida formato al escribir
3. **Precios**: Valida lógica al cambiar valores

### Al Salir del Campo (blur):
1. **Código de Armazón**: Verifica unicidad en BD
2. **Grupo**: Valida formato final

### Al Guardar:
1. ✅ Verifica que todos los campos obligatorios estén completos
2. ✅ Valida formato de código de armazón
3. ✅ Valida formato de grupo (si está presente)
4. ✅ Verifica unicidad del código en BD
5. ✅ Valida lógica de precios
6. ✅ Solo guarda si todas las validaciones pasan

---

## Ejemplos de Mensajes

### Mensajes de Error:

#### Código de Armazón:
- ❌ "Debe contener al menos 1 letra y 4 números"
- ❌ "Este código ya existe"

#### Grupo:
- ❌ "Debe contener al menos 1 letra y 4 números"

#### Precios:
- ⚠️ "El precio de caja debe ser mayor que el costo"
- ⚠️ "El PVP1 debe ser mayor que el costo por unidad"
- ⚠️ "La unidad debe ser mayor a 0"

### Mensajes de Éxito:

- ✅ "Código disponible"
- ✅ "Formato válido"

---

## Implementación Técnica

### Componente TypeScript

#### Método: `validarFormatoCodigo(codigo: string): boolean`
```typescript
validarFormatoCodigo(codigo: string): boolean {
  const letras = (codigo.match(/[a-zA-Z]/g) || []).length;
  const numeros = (codigo.match(/[0-9]/g) || []).length;
  return letras >= 1 && numeros >= 4;
}
```

#### Método: `validarCodigoArmazon()`
- Valida formato con expresiones regulares
- Consulta Firestore para verificar unicidad
- Actualiza estado de validación en tiempo real

#### Método: `validarGrupo()`
- Valida formato igual que código
- Solo si el campo tiene valor (opcional)

#### Método: `validarPrecios()`
- Valida relaciones entre costo, precio y PVP
- Calcula costo por unidad automáticamente
- Actualiza mensajes de advertencia

### Template HTML

#### Clases dinámicas:
```html
[class.is-invalid]="condición de error"
[class.is-valid]="condición de éxito"
```

#### Eventos:
- `(input)="validar()"` - Valida al escribir
- `(blur)="validar()"` - Valida al salir del campo

#### Feedback condicional:
```html
<span *ngIf="validaciones.codigo.mensaje" class="text-danger">
  {{ validaciones.codigo.mensaje }}
</span>
```

---

## Beneficios

### Para el Usuario:
✅ **Feedback inmediato** - Sabe al instante si algo está mal
✅ **Previene errores** - No puede guardar datos inválidos
✅ **Guía clara** - Mensajes descriptivos y ejemplos
✅ **Ahorra tiempo** - No necesita intentar guardar para ver errores

### Para el Negocio:
✅ **Integridad de datos** - Solo datos válidos en la BD
✅ **Consistencia** - Códigos siguen un formato estándar
✅ **Evita pérdidas** - Valida que precios sean rentables
✅ **Mejor inventario** - Códigos únicos previenen duplicados

---

## Mejoras Futuras Sugeridas

1. **Formato personalizado de códigos**:
   - Permitir configurar el patrón (ej: "Letra-4Números-Letra")
   - Validación más estricta según categoría

2. **Sugerencias de código**:
   - Auto-generar códigos basados en categoría
   - Mostrar siguiente código disponible

3. **Calculadora de margen**:
   - Mostrar porcentaje de ganancia
   - Sugerir precios basados en margen deseado

4. **Validación de stock**:
   - Alertar si stock es muy bajo
   - Relacionar con historial de ventas

5. **Historial de precios**:
   - Registrar cambios de precios
   - Mostrar tendencias

6. **Importación masiva**:
   - Validar formatos antes de importar
   - Reportar errores por fila

---

## Casos de Uso

### Caso 1: Crear producto de armazón nuevo
```
1. Usuario escribe código: "O0012"
   → ✅ Validación de formato: OK
   → 🔄 Verificando unicidad...
   → ✅ Código disponible

2. Usuario escribe grupo: "O002"
   → ❌ Solo 3 números
   → Usuario corrige a "O0002"
   → ✅ Formato válido

3. Usuario llena precios:
   Costo Caja: 100
   Unidad: 12
   PVP1: 8
   → ⚠️ PVP1 debe ser mayor que costo unitario ($8.33)
   → Usuario corrige PVP1 a 10
   → ✅ Precios válidos

4. Usuario hace clic en Guardar
   → ✅ Todas las validaciones pasan
   → Producto creado exitosamente
```

### Caso 2: Intentar código duplicado
```
1. Usuario escribe código: "ARM1234"
   → ✅ Formato válido
   → 🔄 Verificando...
   → ❌ Este código ya existe

2. Usuario intenta guardar
   → ❌ Alerta: "El código ya existe"
   → No se guarda

3. Usuario cambia a "ARM1235"
   → ✅ Código disponible
   → Puede guardar
```

---

## Testing

### Casos a probar:

#### Formato de código:
- [ ] "O0012" → válido
- [ ] "ARM1234" → válido
- [ ] "O12" → inválido (pocos números)
- [ ] "1234" → inválido (sin letras)
- [ ] "ABCD" → inválido (sin números)

#### Unicidad:
- [ ] Código nuevo → puede guardar
- [ ] Código duplicado → no puede guardar
- [ ] Código existente editado → puede guardar con nuevo código

#### Precios:
- [ ] Precio > Costo → válido
- [ ] Precio < Costo → inválido
- [ ] PVP > Costo unitario → válido
- [ ] PVP < Costo unitario → inválido
- [ ] Unidad = 0 → inválido
- [ ] Unidad > 0 → válido
