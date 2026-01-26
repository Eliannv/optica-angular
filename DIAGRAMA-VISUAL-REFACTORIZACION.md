# 🎨 Diagrama Visual - Nuevo Diseño

## Estructura General

```
┌────────────────────────────────────────────────────────────────────┐
│ HISTORIAL CLÍNICO                                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [🔍 Buscar cliente...]                           [+ Nuevo] 🎯   │ ← FILA 1 (Primaria)
│                                                                    │
│  [⚙️ Filtros]  📌 Panel Desplegable              [Orden: ... ▼]  │ ← FILA 2 (Secundaria)
│   ┌─────────────────────────────┐                                │
│   │ Filtrar resultados       [✕]│                                │
│   ├─────────────────────────────┤                                │
│   │ 📋 Estado del Historial    │                                │
│   │ [Todos                    ▼]│                                │
│   │                             │                                │
│   │ 💳 Crédito Personal        │                                │
│   │ [Todos                    ▼]│                                │
│   ├─────────────────────────────┤                                │
│   │ [Limpiar] [✓ Aplicar]      │                                │
│   └─────────────────────────────┘                                │
│                                                                    │
│  15 resultado(s) encontrado(s)                                    │ ← Resultado de búsqueda
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  TABLA DE CLIENTES                                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Cliente │ Cédula │ Teléfono │ Historial │ Crédito │ Deuda │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ Juan... │ 1234.. │ 555-... │ ✓ Con...  │ Sí     │ Al...│ │
│  │ María.. │ 5678.. │ 555-... │ ✗ Sin...  │ No     │ Debe │ │
│  │ ...     │ ...    │ ...     │ ...       │ ...    │ ...   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Mostrando 1-10 de 45 clientes                                   │
│  [« Primera] [← Anterior] [Siguiente →] [Última »]              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Panel de Filtros - Detallado

### Estado Cerrado
```
┌─────────────────────────┐
│ ⚙️ Filtros              │  ← Botón cerrado
└─────────────────────────┘
```

### Estado Abierto
```
┌──────────────────────────────────────────┐
│ ⚙️ Filtros (Activo)                      │  ← Botón activo (bg primario)
└──────────────────────────────────────────┘
        ↓ Panel Desplegable Abierto

        ┌──────────────────────────────────────┐
        │ 🎯 Filtrar resultados            [✕] │
        ├──────────────────────────────────────┤
        │                                      │
        │ 📋 Estado del Historial              │
        │ ┌────────────────────────────────┐  │
        │ │ Todos                        ▼ │  │
        │ │ • Con historial              │  │
        │ │ • Sin historial              │  │
        │ └────────────────────────────────┘  │
        │                                      │
        │ 💳 Crédito Personal                 │
        │ ┌────────────────────────────────┐  │
        │ │ Todos                        ▼ │  │
        │ │ • Solo con crédito personal  │  │
        │ │ • Sin crédito personal       │  │
        │ └────────────────────────────────┘  │
        │                                      │
        ├──────────────────────────────────────┤
        │ [Limpiar filtros] [✓ Aplicar filtros]│
        └──────────────────────────────────────┘
```

---

## Flujo de Interacción

### Escenario 1: Abrir y Cerrar Panel

```
Usuario hace clic en [⚙️ Filtros]
        ↓
togglePanelFiltros() ejecuta
        ↓
mostrarPanelFiltros = !mostrarPanelFiltros (true)
        ↓
Panel se muestra con animación slideDown
        ↓
        [Usuario hace clic en ✕]
        ↓
cerrarPanelFiltros() ejecuta
        ↓
mostrarPanelFiltros = false
        ↓
Panel desaparece
```

### Escenario 2: Aplicar Filtros

```
Panel abierto
        ↓
Usuario selecciona:
  - "Con historial" en Estado
  - "Solo con crédito personal" en Crédito
        ↓
Usuario hace clic en [✓ Aplicar filtros]
        ↓
aplicarFiltrosYCerrar() ejecuta
        ↓
aplicarFiltro() filtra la tabla
        ↓
cerrarPanelFiltros() cierra el panel
        ↓
Tabla actualizada + Panel cerrado
```

### Escenario 3: Limpiar Filtros

```
Panel abierto con filtros activos
        ↓
Usuario hace clic en [Limpiar filtros]
        ↓
limpiarFiltros() ejecuta:
  - filtroEstado = 'todos'
  - filtroCredito = 'todos'
  - ordenarPor = 'fecha'
        ↓
aplicarFiltro() se ejecuta
        ↓
cerrarPanelFiltros() cierra panel
        ↓
Tabla muestra todos + Panel cerrado
```

---

## Responsive - Puntos de Quiebre

### Desktop (> 768px)
```
┌────────────────────────────────────────┐
│ [🔍 Buscar] ........................[+ Nuevo]│
│ [⚙️ Filtros]    Dropdown Panel    [Orden ▼] │
├────────────────────────────────────────┤
│ (Tabla con scroll horizontal)          │
└────────────────────────────────────────┘

Panel: Posición absolute, ancho max 280px
```

### Tablet (480px - 768px)
```
┌───────────────────┐
│ [🔍 Buscar...]    │
│                   │
│ [+ Nuevo]         │
├───────────────────┤
│ [⚙️ Filtros]      │
│ Dropdown Panel    │
│                   │
│ [Orden ▼]         │
├───────────────────┤
│ (Tabla apilada)   │
└───────────────────┘

Panel: Ancho 90% de pantalla
```

### Móvil (< 480px)
```
┌─────────────────┐
│ [🔍 Buscar...] │
│                 │
│ [+ Nuevo]       │
├─────────────────┤
│ [⚙️ Filtros]    │
│ [Orden ▼]       │
│                 │
│ ╔═════════════╗ │ ← Panel modal
│ ║ Filtrar ... ║ │
│ ║             ║ │
│ ║ [Limpiar]   ║ │
│ ║ [Aplicar]   ║ │
│ ╚═════════════╝ │
├─────────────────┤
│ (Tabla simple)  │
└─────────────────┘

Panel: fixed, bottom: 0, full-width
```

---

## Comparativa: Antes vs. Después

### ANTES (Problema)
```
┌──────────────────────────────────────────────────────────┐
│ Historial Clínico                                        │
├──────────────────────────────────────────────────────────┤
│ [🔍 Buscar...] [Todos ▼] [Crédito: Todos ▼] [Orden ▼] [+ Nuevo] │
│ ❌ Confuso: muchos elementos competitivos               │
│ ❌ Difícil de extender                                  │
│ ❌ Pobre en móvil                                       │
└──────────────────────────────────────────────────────────┘
```

### DESPUÉS (Solución)
```
┌──────────────────────────────────────┐
│ Historial Clínico                    │
├──────────────────────────────────────┤
│ [🔍 Buscar...]        [+ Nuevo]     │ ✓ Claro
│                                      │ ✓ Priorizado
│ [⚙️ Filtros] Dropdown [Orden ▼]     │ ✓ Extensible
├──────────────────────────────────────┤ ✓ Mobile-first
│ Tabla limpia                         │
└──────────────────────────────────────┘
```

---

## Colores y Variables CSS

El diseño usa variables del tema existente:

```css
/* Botones */
--btn-primary-bg       /* Colores para "Aplicar filtros" */
--btn-secondary-bg     /* Colores para "Limpiar filtros" */

/* Fondos */
--bg-card              /* Panel desplegable */
--bg-secondary         /* Header */
--bg-hover             /* Estados hover */

/* Bordes y Sombras */
--border-color         /* Separadores */
--shadow-lg            /* Sombra del panel */

/* Inputs */
--input-bg             /* Selectores en panel */
--input-border         /* Bordes de inputs */
--input-focus-border   /* Enfoque de inputs */

/* Texto */
--text-primary         /* Labels y títulos */
--text-secondary       /* Texto auxiliar */
--text-muted           /* Deshabilitado */
```

Todos estos colores adaptan automáticamente al tema claro/oscuro.

---

## Accesibilidad (WCAG 2.1)

✅ **Contraste:** Cumple ratio 4.5:1 (texto sobre fondo)
✅ **Labels:** Cada input tiene etiqueta visible asociada
✅ **Focus:** Estados de enfoque claramente visibles
✅ **Semántica:** Estructura HTML semántica (labels, buttons)
✅ **Títulos:** Botones tienen `title` attribute para tooltips
✅ **Animaciones:** No hay movimiento excesivo que cause mareos

---

## Animaciones

### Panel de Filtros
```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Duración: 0.2s */
/* Timing: ease-out */
```

### Transiciones de Botones
```css
transition: all var(--transition-fast);  /* 0.2s */
```

---

## Casos de Uso

### Caso 1: Usuario busca cliente por nombre
1. Escribe en `[🔍 Buscar...]`
2. Tabla filtra en tiempo real
3. Ve "15 resultado(s) encontrado(s)"
✅ **Flujo claro y rápido**

### Caso 2: Usuario aplica múltiples filtros
1. Hace clic en `[⚙️ Filtros]`
2. Abre panel desplegable
3. Selecciona "Con historial" y "Solo con crédito"
4. Hace clic en "Aplicar filtros"
5. Tabla actualizada, panel se cierra
✅ **Intención clara, ejecución fluida**

### Caso 3: Usuario quiere ver todos los clientes
1. Tiene filtros activos aplicados
2. Hace clic en `[⚙️ Filtros]`
3. Hace clic en "Limpiar filtros"
4. Vuelve al estado inicial
✅ **Una acción = reset completo**

---

## Performance

- ✅ **CSS modular:** Sin duplicaciones
- ✅ **Animaciones GPU:** `transform` y `opacity` solo
- ✅ **Sin JS innecesario:** Solo bindings de Angular
- ✅ **Responsive:** Usa media queries, no JavaScript
- ✅ **Componente standalone:** Carga bajo demanda

---

**Documento generado:** 26/01/2025  
**Status:** ✅ Listo para revisión y deployment
