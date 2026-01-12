# Sistema de Identificadores de Productos

## Descripción General

El sistema de productos ahora utiliza **dos tipos de identificadores** para una mejor gestión:

### 1. **ID Interno (Auto-incremental)** 
- **Campo**: `idInterno` (número)
- **Propósito**: Identificador numérico único generado automáticamente
- **Formato**: 1001, 1002, 1003, 1004...
- **Gestión**: Completamente automático, no requiere intervención del usuario
- **Almacenamiento**: Se mantiene un contador en Firestore (`counters/productos`)
- **Uso**: Para referencias internas del sistema, reportes, ordenamiento

### 2. **Código de Armazón**
- **Campo**: `codigo` (string)
- **Propósito**: Identificador personalizado para uso del personal del local
- **Formato**: Libre (ej: "O0012", "ARM-001", "METAL-BLUE")
- **Gestión**: Definido por el usuario al crear el producto
- **Validación**: Debe ser único (no puede repetirse)
- **Uso**: Para búsquedas, etiquetas, identificación visual por los trabajadores

### 3. **ID de Firestore**
- **Campo**: `id` (string)
- **Propósito**: Identificador único generado por Firestore
- **Formato**: Alfanumérico aleatorio (ej: "xK7mP9qR2sT...")
- **Gestión**: Automático por Firestore
- **Uso**: Para operaciones CRUD en la base de datos

---

## Flujo de Creación de Producto

### Al abrir el formulario:
1. Se carga automáticamente el **próximo ID interno** desde Firestore
2. Se muestra en el header del formulario (ej: "ID Interno (auto): **1005**")
3. El usuario NO puede modificar este ID

### Al completar el campo "Código de Armazón":
1. El usuario escribe el código deseado (ej: "O0012")
2. Al salir del campo (`blur`), se valida automáticamente:
   - ✅ **Código disponible**: Muestra check verde
   - ❌ **Código ya existe**: Muestra X roja con mensaje de error
   - 🔄 **Validando...**: Muestra spinner mientras consulta

### Al guardar el producto:
1. **Validación final** del código de armazón
2. Si existe, muestra alerta y cancela el guardado
3. Si es único:
   - Genera el **ID interno** incrementando el contador
   - Guarda el producto con todos los datos
   - Muestra confirmación con ambos identificadores

---

## Estructura en Firestore

### Colección `productos`
```typescript
{
  id: "xK7mP9qR2sT...",           // Auto (Firestore)
  idInterno: 1005,                 // Auto (Contador)
  codigo: "O0012",                 // Usuario (único)
  nombre: "ARMAZON DE METAL ECO",
  // ... resto de campos
}
```

### Documento `counters/productos`
```typescript
{
  lastId: 1005  // Último ID interno usado
}
```

---

## Archivos Modificados

### Modelo: `producto.model.ts`
```typescript
export interface Producto {
  id?: string;           // ID de Firestore
  idInterno?: number;    // ID incremental automático
  codigo: string;        // Código de armazón (único)
  nombre: string;
  // ...
}
```

### Servicio: `productos.ts`
Nuevos métodos agregados:

#### `getCounterDoc(): Promise<number | null>`
- Obtiene el último ID usado sin incrementarlo
- Usado para preview del próximo ID

#### `getNextIdInterno(): Promise<number>`
- Genera el siguiente ID interno usando una transacción
- Incrementa el contador atómicamente
- Retorna el nuevo ID generado

#### `codigoArmazonExists(codigo: string, excludeId?: string): Promise<boolean>`
- Verifica si un código de armazón ya existe en la BD
- `excludeId`: opcional, para excluir un producto al editar
- Retorna `true` si existe, `false` si está disponible

#### `createProducto(producto: Producto)`
- Modificado para generar automáticamente el `idInterno`
- Guarda el producto con el ID incremental asignado

#### `getProductoByCodigo(codigo: string): Promise<Producto | null>`
- Busca un producto por su código de armazón
- Retorna el producto completo o `null` si no existe

### Componente: `crear-producto.ts`
Nuevas propiedades:
- `proximoIdInterno: number | null` - Preview del próximo ID
- `validandoCodigo: boolean` - Estado de validación
- `codigoExiste: boolean` - Resultado de validación

Nuevos métodos:
- `cargarProximoId()` - Carga el próximo ID al inicializar
- `validarCodigoArmazon()` - Valida unicidad del código en tiempo real
- `guardar()` - Modificado con validación de código único

### Template: `crear-producto.html`
Mejoras en UI:
- **Header**: Muestra preview del ID interno automático
- **Campo Código**: 
  - Validación visual (verde/roja)
  - Feedback en tiempo real
  - Spinner durante validación
  - Mensajes informativos
- **Ayudas contextuales**: Textos explicativos bajo los campos

### Estilos: `crear-producto.css`
Nuevos estilos:
- `.id-preview` - Badge del ID en header
- `.input-with-validation` - Contenedor de validación
- `.validation-feedback` - Mensajes de feedback
- `.is-valid` / `.is-invalid` - Estados de validación
- Colores temáticos para success/danger/info

---

## Ventajas del Sistema

✅ **Automatización**: El ID interno se genera sin intervención del usuario

✅ **Flexibilidad**: El código de armazón permite nomenclaturas personalizadas

✅ **Integridad**: Validación en tiempo real previene duplicados

✅ **Trazabilidad**: Dos sistemas de identificación para diferentes propósitos

✅ **Escalabilidad**: El contador en Firestore soporta operaciones concurrentes

✅ **UX mejorada**: Feedback visual inmediato sobre la validez del código

---

## Búsquedas y Consultas

### Buscar por ID de Firestore (interno del sistema):
```typescript
productosService.getProductoById('xK7mP9qR2sT...')
```

### Buscar por Código de Armazón (para usuarios):
```typescript
productosService.getProductoByCodigo('O0012')
```

### Verificar si código existe:
```typescript
const existe = await productosService.codigoArmazonExists('O0012')
```

---

## Consideraciones Técnicas

### Transacciones Atómicas
El método `getNextIdInterno()` usa `runTransaction` para garantizar que:
- No se generen IDs duplicados en operaciones concurrentes
- El contador siempre esté sincronizado
- Las operaciones sean atómicas y consistentes

### Validación en Dos Etapas
1. **Tiempo real** (`blur`): Validación mientras el usuario completa el formulario
2. **Antes de guardar**: Validación final para prevenir race conditions

### Inicialización del Contador
Si el documento `counters/productos` no existe:
- Se crea automáticamente al crear el primer producto
- Inicia en **1001** como valor base
- Se actualiza con cada nuevo producto

---

## Migraciones y Productos Existentes

Para productos creados antes de este sistema:
- `idInterno` será `undefined` hasta que se editen
- Opción 1: Script de migración para asignar IDs a todos
- Opción 2: Asignación progresiva al editar cada producto

Script sugerido para migración (ejecutar una vez):
```javascript
// crear-ids-internos.js
const admin = require('firebase-admin');

async function migrarProductos() {
  const productosRef = admin.firestore().collection('productos');
  const snapshot = await productosRef.get();
  
  let idActual = 1001;
  
  for (const doc of snapshot.docs) {
    if (!doc.data().idInterno) {
      await doc.ref.update({ idInterno: idActual++ });
    }
  }
  
  // Actualizar contador
  await admin.firestore()
    .doc('counters/productos')
    .set({ lastId: idActual - 1 });
    
  console.log(`Migrados ${snapshot.size} productos`);
}
```

---

## Próximas Mejoras Sugeridas

1. **Generador de códigos**: Sugerencias automáticas basadas en categoría
2. **Validación de formato**: Expresiones regulares para formatos específicos
3. **Búsqueda predictiva**: Autocompletar mientras se escribe el código
4. **QR/Código de barras**: Generar automáticamente desde el ID interno
5. **Historial de cambios**: Registrar cambios en códigos de armazón
6. **Importación masiva**: Validar códigos únicos en imports CSV/Excel
