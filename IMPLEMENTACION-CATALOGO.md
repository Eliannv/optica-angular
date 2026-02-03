# 📚 IMPLEMENTACIÓN DEL MÓDULO CATÁLOGO

## 🎯 DESCRIPCIÓN GENERAL

El módulo **Catálogo** es un nuevo componente de la aplicación OpticaAngular que permite gestionar ítems vendibles sin inventario, deuda ni afectación a caja/banco.

**Característica principal:** Todos los ítems del catálogo tienen **stock infinito** y no generan movimientos de inventario, compras ni deuda.

---

## 📋 OBJETIVO DEL MÓDULO

- ✅ Registrar ítems que se pueden vender SIN manejar stock real
- ✅ NO genera compras ni ingreso de mercancía
- ✅ NO genera deuda
- ✅ NO afecta caja/banco ni contabilidad
- ✅ Separación clara del módulo de Productos (armazones, gafas)
- ✅ Facilita venta de servicios, lunas, lentes de contacto y líquidos

---

## 📦 CATEGORÍAS SOPORTADAS

| Categoría | Código | Descripción |
|-----------|--------|-------------|
| Tipos de Lunas | `LUNA` | Lunas oftálmicas (anti-reflejo, fotocromáticas, etc.) |
| Lentes de Contacto | `LENTE_CONTACTO` | Lentes de contacto de diferentes tipos |
| Líquidos | `LIQUIDO` | Líquidos para limpieza y desinfección |
| Servicios | `SERVICIO` | Servicios como ajuste, corte, etc. |

### Restricción Importante
⚠️ **NO SE DEBE usar este módulo para:**
- ARMAZONES (usar módulo Productos)
- GAFAS (usar módulo Productos)

---

## 📂 ESTRUCTURA DE ARCHIVOS CREADOS

```
src/
├── app/
│   ├── core/
│   │   ├── models/
│   │   │   └── catalogo.model.ts          # Interfaz y enums del catálogo
│   │   └── services/
│   │       └── catalogo.service.ts        # Servicio CRUD de Firestore
│   └── modules/
│       └── catalogo/                      # Nuevo módulo
│           ├── catalogo.module.ts         # Definición del módulo
│           ├── catalogo-routing.module.ts # Rutas lazy-loaded
│           └── pages/
│               ├── listar-catalogo/       # Listado de ítems
│               │   ├── listar-catalogo.ts
│               │   ├── listar-catalogo.html
│               │   └── listar-catalogo.css
│               └── form-catalogo/         # Crear/editar ítems
│                   ├── form-catalogo.ts
│                   ├── form-catalogo.html
│                   └── form-catalogo.css
```

---

## 🔧 CONFIGURACIÓN DEL MODELO

### Interfaz: `CatalogoItem`

```typescript
interface CatalogoItem {
  id?: string;                              // ID Firestore (auto-generado)
  nombre: string;                           // Nombre descriptivo
  categoria: CategoriaCatalogo;             // Una de las 4 categorías
  precio?: number;                          // Precio base (opcional)
  iva?: number;                             // Porcentaje de IVA
  precioConIVA?: number;                    // Calculado automáticamente
  activo: boolean;                          // true = activo, false = inactivo
  observacion?: string | null;              // Notas adicionales
  createdAt?: any;                          // Fecha creación
  updatedAt?: any;                          // Fecha última actualización
}
```

### Campos Comunes a Todos los Ítems
- **nombre**: Campo requerido, mín. 3 caracteres
- **categoría**: Selección obligatoria de las 4 opciones
- **precio base**: Opcional, se puede editar en venta
- **IVA**: Porcentaje aplicable (default 15%)
- **estado**: Activo/Inactivo (soft delete)
- **observación**: Notas adicionales (opcional)

### Cálculo de Precio
```
precioConIVA = precio × (1 + iva/100)
Ejemplo: 100 × (1 + 15/100) = 115
```

---

## 🚀 CARACTERÍSTICAS DEL SERVICIO

### Métodos Principales

#### 1. **Lectura**
```typescript
// Obtener todos los ítems activos
getItems(): Observable<CatalogoItem[]>

// Obtener ítems de una categoría
getItemsPorCategoria(categoria: CategoriaCatalogo): Observable<CatalogoItem[]>

// Obtener un ítem específico
getItemById(id: string): Observable<CatalogoItem>

// Obtener todos incluyendo inactivos
getItemsTodosInclusoInactivos(): Observable<CatalogoItem[]>
```

#### 2. **Escritura**
```typescript
// Crear nuevo ítem
crearItem(item: CatalogoItem): Promise<string>

// Actualizar ítem
actualizarItem(id: string, item: Partial<CatalogoItem>): Promise<void>

// Desactivar (soft delete)
desactivarItem(id: string): Promise<void>

// Activar ítem desactivado
activarItem(id: string): Promise<void>

// Eliminar (irreversible)
eliminarItem(id: string): Promise<void>
```

---

## 📱 COMPONENTES DE LA UI

### 1. **ListarCatalogoComponent**
Página principal para visualizar todos los ítems del catálogo.

**Funcionalidades:**
- ✅ Listado con tabla responsiva
- ✅ Filtrado por categoría
- ✅ Mostrar/ocultar ítems inactivos
- ✅ Ver nombre, categoría, precios e IVA
- ✅ Botones de editar, desactivar/activar
- ✅ Crear nuevos ítems

**Ruta:** `/catalogo`

### 2. **FormCatalogoComponent**
Formulario para crear y editar ítems del catálogo.

**Funcionalidades:**
- ✅ Formularios reactivos con validaciones
- ✅ Campos: nombre, categoría, precio, IVA, observación, estado
- ✅ Cálculo en tiempo real de precioConIVA
- ✅ Panel informativo de características
- ✅ Botones guardar/cancelar con feedback

**Rutas:**
- `/catalogo/crear` - Crear nuevo ítem
- `/catalogo/editar/:id` - Editar ítem existente

---

## 🔐 PROTECCIONES Y REGLAS

### Control de Acceso
- **Acceso:** Solo administradores (`RolUsuario.ADMINISTRADOR`)
- **Guards:** `authGuard` + `roleGuard`

### Integridad de Datos
- **Soft Delete:** Los ítems no se eliminan, solo se desactivan
- **Validación:** Campo `activo` filtra ítems automáticamente
- **Timestamps:** `createdAt` y `updatedAt` automáticos
- **IVA Calculado:** `precioConIVA` se recalcula al guardar

### Reglas de Negocio
```typescript
// Todos los ítems del catálogo:
- STOCK: Infinito (no se valida ni descuenta)
- MOVIMIENTOS: No generan movimiento de inventario
- COMPRAS: No generan ingreso de mercancía
- DEUDA: No afecta cuentas por pagar
- CAJA/BANCO: No se registran en movimientos financieros
```

---

## 🔗 INTEGRACIÓN CON VENTAS

**EN PRÓXIMA FASE:**
Al agregar un ítem del catálogo a una venta:
1. Se incluye en la línea de venta
2. Se permite edición del precio según configuración
3. No genera movimiento de inventario
4. Se registra en factura normalmente
5. Cálculo de totales incluye IVA del ítem

**Ejemplo de implementación futuro:**
```typescript
// En ventas.service.ts
agregarItemCatalogo(venta: Venta, catalogoItem: CatalogoItem, cantidad: number, precioVenta: number) {
  const lineaVenta: ItemVenta = {
    descripcion: catalogoItem.nombre,
    cantidad,
    precioUnitario: precioVenta,
    esDelCatalogo: true,
    catalogoItemId: catalogoItem.id,
    // NO incluir: descuentoStock, movimientoInventario
  };
  // ...resto de la lógica
}
```

---

## 📊 COLECCIÓN FIRESTORE

**Colección:** `catalogo`

**Ejemplo de documento:**
```json
{
  "id": "abc123def456",
  "nombre": "Luna Anti-Reflejo Progressive",
  "categoria": "LUNA",
  "precio": 150,
  "iva": 15,
  "precioConIVA": 172.5,
  "activo": true,
  "observacion": "Recomendada para uso prolongado",
  "createdAt": "2025-02-02T10:30:00.000Z",
  "updatedAt": "2025-02-02T10:30:00.000Z"
}
```

**Índices necesarios:**
- `categoria` (ASC)
- `nombre` (ASC)
- `activo` (DESC)

---

## 📍 RUTAS CONFIGURADAS

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/catalogo` | ListarCatalogoComponent | Listado principal |
| `/catalogo/crear` | FormCatalogoComponent | Crear nuevo ítem |
| `/catalogo/editar/:id` | FormCatalogoComponent | Editar ítem existente |

**Todas las rutas están lazy-loaded desde el módulo `CatalogoModule`.**

---

## 🎨 NAVBAR / SIDEBAR

Se agregó menú **CATÁLOGO** en el sidebar con submenús por categoría:

```
📚 CATÁLOGO
├── 🔍 Tipos de Lunas       (/catalogo?categoria=LUNA)
├── 📦 Lentes de Contacto   (/catalogo?categoria=LENTE_CONTACTO)
├── 💧 Líquidos Limpia Lunas (/catalogo?categoria=LIQUIDO)
└── 🛠️ Servicios             (/catalogo?categoria=SERVICIO)
```

- **Ícono:** Book Open (📚)
- **Acceso:** Solo Administradores
- **Comportamiento:** Expande/colapsa submenús

---

## ✅ VALIDACIONES

### En Formulario
- ✅ Nombre: Requerido, mín. 3 caracteres
- ✅ Categoría: Selección obligatoria
- ✅ Precio: Mín. 0 (opcional)
- ✅ IVA: Entre 0-100% (default 15%)
- ✅ Observación: Texto libre (opcional)

### En Servicio
- ✅ Cálculo automático de `precioConIVA`
- ✅ Validación de activo en lecturas
- ✅ Timestamps automáticos
- ✅ Soft delete preserva historial

---

## 🔄 FLUJOS DE TRABAJO

### Crear Nuevo Ítem
```
1. Click "Nuevo Ítem" en listado
2. Completa formulario (nombre requerido)
3. Selecciona categoría
4. Ingresa precio base (opcional)
5. IVA se aplica automáticamente (15% default)
6. Agrega observación si es necesario
7. Click "Crear"
8. Se registra en Firestore
9. Vuelve al listado
```

### Editar Ítem
```
1. Click ícono lápiz en listado
2. Formulario se carga con datos actuales
3. Modifica los campos necesarios
4. Click "Actualizar"
5. Se actualiza en Firestore
6. Vuelve al listado
```

### Desactivar Ítem
```
1. Click ícono trash en listado
2. Confirmación tipo SweetAlert
3. Campo "activo" se pone en false
4. Se mantiene historial completo
5. Desaparece del listado normal
6. Activar "Mostrar inactivos" para verlo
```

---

## 🛡️ CONSIDERACIONES TÉCNICAS

### Rendimiento
- **Lazy Loading:** El módulo se carga solo cuando accedes a `/catalogo`
- **Ordenamiento:** Los ítems se ordenan alfabéticamente por nombre
- **Filtrado:** Se hace en cliente para menor carga en Firestore

### Seguridad
- **Auth Guard:** Requiere usuario autenticado
- **Role Guard:** Solo administradores
- **Firestore Rules:** No configuradas aún (agregar en `firestore.rules`)

### Escalabilidad
- Estructura similar a Productos y otros módulos
- Fácil de extender con nuevas categorías
- Compatible con funcionalidades futuras de ventas

---

## 🔮 PRÓXIMAS FASES (Futuro)

1. **Integración con Ventas**
   - Permitir agregar ítems catálogo a ventas
   - Editar precio en punto de venta
   - Registrar en factura

2. **Reportes**
   - Ítems más vendidos
   - Ingresos por categoría
   - Historial de cambios de precio

3. **Importación/Exportación**
   - Importar ítems desde Excel
   - Exportar catálogo completo

4. **Imágenes y Documentos**
   - Almacenar fotos de ítems
   - Documentación técnica

5. **Auditoría**
   - Historial completo de cambios
   - Usuario que realizó cada cambio
   - Timestamps detallados

---

## 📚 ARCHIVOS MODIFICADOS

### Nuevos Archivos
- ✅ `src/app/core/models/catalogo.model.ts`
- ✅ `src/app/core/services/catalogo.service.ts`
- ✅ `src/app/modules/catalogo/catalogo.module.ts`
- ✅ `src/app/modules/catalogo/catalogo-routing.module.ts`
- ✅ `src/app/modules/catalogo/pages/listar-catalogo/listar-catalogo.ts`
- ✅ `src/app/modules/catalogo/pages/listar-catalogo/listar-catalogo.html`
- ✅ `src/app/modules/catalogo/pages/listar-catalogo/listar-catalogo.css`
- ✅ `src/app/modules/catalogo/pages/form-catalogo/form-catalogo.ts`
- ✅ `src/app/modules/catalogo/pages/form-catalogo/form-catalogo.html`
- ✅ `src/app/modules/catalogo/pages/form-catalogo/form-catalogo.css`

### Archivos Modificados
- ✏️ `src/app/app.routes.ts` - Agregó ruta lazy-load `/catalogo`
- ✏️ `src/app/shared/components/sidebar/sidebar.ts` - Agregó menú CATÁLOGO con submenús

---

## 🧪 TESTING (Recomendado)

### Unit Tests
```typescript
// Probar servicio
- getItems() retorna ítems activos
- getItemsPorCategoria() filtra correctamente
- crearItem() guarda en Firestore
- actualizarItem() actualiza correctamente
- desactivarItem() no elimina datos

// Probar componentes
- ListarCatalogoComponent carga items
- FormCatalogoComponent valida formulario
- Cálculo de precioConIVA es correcto
```

### E2E Tests
```
- Crear nuevo ítem
- Editar ítem existente
- Desactivar y activar ítem
- Filtrar por categoría
- Mostrar/ocultar inactivos
```

---

## 🚨 TROUBLESHOOTING

### Error: "Módulo no encontrado"
```
✅ Verificar que catalogo.module.ts esté en src/app/modules/catalogo/
✅ Verificar que la ruta esté correcta en app.routes.ts
✅ Limpiar caché del navegador
```

### Ítems no aparecen en el listado
```
✅ Verificar que activo !== false (por defecto debe ser true)
✅ Revisar Firestore permissions
✅ Verificar que el servicio esté inyectado correctamente
```

### Formulario no valida
```
✅ Verificar que ReactiveFormsModule esté importado
✅ Revisar FormGroup en componente
✅ Limpiar caché de navegador
```

---

## 📞 CONTACTO Y MANTENIMIENTO

Este módulo fue creado como parte de la expansión de OpticaAngular.

Para cambios futuros:
- Seguir patrones de Productos y Ventas
- Mantener estructura de carpetas
- Usar formularios reactivos
- Implementar soft delete

---

**Implementación completada:** 2025-02-02  
**Versión:** 1.0  
**Estado:** ✅ Listo para uso
