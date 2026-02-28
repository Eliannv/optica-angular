# Módulo de Kardex - Guía de Implementación y Uso

## 📋 Descripción General

El módulo de Kardex es un sistema de reporte de inventario que consulta la colección `movimientos_stock` de Firestore para mostrar el historial completo de movimientos de productos (entradas, salidas, ventas, ajustes).

**Características principales:**
- ✅ Filtros múltiples: producto, sucursal, fechas, tipo de movimiento
- ✅ Cálculos automáticos: entradas, salidas, stock final, utilidad
- ✅ Exportación a CSV
- ✅ Impresión optimizada
- ✅ Consultas optimizadas con índices
- ✅ No recalcula stock, usa datos ya guardados

---

## 🏗️ Arquitectura

### Archivos Creados/Modificados

#### 1. **Modelo** (`src/app/core/models/movimiento-stock.model.ts`)
```typescript
// Interfaces añadidas:
- FiltrosKardex: criterios de búsqueda
- ResumenKardex: totalizaciones calculadas
```

#### 2. **Servicio** (`src/app/core/services/movimiento-stock.service.ts`)
```typescript
// Métodos añadidos:
- consultarKardex(filtros): Observable con movimientos
- consultarKardexPaginado(filtros, pageSize, lastDoc): Observable paginado
- obtenerKardexConResumen(filtros): Promise con movimientos + resumen
- calcularResumenKardex(filtros): Promise solo con resumen
```

#### 3. **Componente** (`src/app/modules/informes/pages/kardex/`)
```
kardex.ts       - Lógica del componente
kardex.html     - Vista con filtros y tabla
kardex.css      - Estilos responsivos
```

#### 4. **Rutas** (`src/app/modules/informes/informes-routing-module.ts`)
```typescript
// Ruta añadida:
{
  path: 'kardex',
  loadComponent: () => import('./pages/kardex/kardex')
}
```

---

## 🚀 Uso del Módulo

### Acceso desde la App

**URL:** `/informes/kardex`

**Desde el menú:**
1. Navega a "Informes"
2. Selecciona "Kardex de Inventario"

---

### Flujo de Uso

1. **Seleccionar Producto** (obligatorio)
   - Ayuda a optimizar la consulta en Firestore
   - Reduce los documentos escaneados

2. **Aplicar Filtros Opcionales**
   - **Sucursal:** filtra por ubicación específica
   - **Fechas:** rango de inicio y fin
   - **Tipo:** INGRESO, VENTA, SALIDA, AJUSTE, ANULACIÓN

3. **Hacer clic en "Consultar Kardex"**
   - Se ejecuta la consulta a Firestore
   - Se calculan los totales automáticamente

4. **Ver Resultados**
   - Tabla con todos los movimientos cronológicos
   - Tarjetas con resumen de totales
   - Utilidad de ventas calculada

5. **Exportar o Imprimir**
   - **CSV:** descarga archivo para Excel
   - **Imprimir:** versión optimizada para impresión

---

## 📊 Cálculos Realizados

### Totales Básicos

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **Total Entradas** | Suma de `cantidad` donde `tipo = INGRESO` | Unidades ingresadas al inventario |
| **Total Salidas** | Suma de `cantidad` donde `tipo = VENTA \| SALIDA \| ANULACION` | Unidades que salieron del inventario |
| **Stock Final** | Último `stockNuevo` del período | Stock resultante después del último movimiento |

### Totales Financieros

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **Costo Total Entradas** | `Σ(costoUnitario × cantidad)` para INGRESO | Inversión total en compras |
| **Valor Total Ventas** | `Σ(precioVenta × cantidad)` para VENTA | Ingresos totales por ventas |
| **Utilidad Total** | `Σ((precioVenta - costoUnitario) × cantidad)` para VENTA | Ganancia neta de ventas |

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Kardex Completo del Mes

**Objetivo:** Ver todos los movimientos de un producto en el mes actual

**Filtros:**
```
Producto: "ARMAZON MODELO XYZ"
Sucursal: (todas)
Fecha Inicio: 01/02/2026
Fecha Fin: 28/02/2026
Tipo: (todos)
```

**Resultado esperado:**
- Lista de 50 movimientos (INGRESO, VENTA, etc.)
- Total entradas: 30 unidades
- Total salidas: 25 unidades
- Stock final: 5 unidades
- Utilidad: $150.00

---

### Ejemplo 2: Solo Ventas de una Sucursal

**Objetivo:** Analizar ventas de un producto en sucursal específica

**Filtros:**
```
Producto: "LENTE TRANSITIONS"
Sucursal: "PASJO01"
Fecha Inicio: 01/01/2026
Fecha Fin: 31/01/2026
Tipo: VENTA
```

**Resultado esperado:**
- Solo movimientos tipo VENTA
- Valor total de ventas: $2,500.00
- Utilidad de ventas: $800.00

---

### Ejemplo 3: Auditoría de Ingresos

**Objetivo:** Revisar todas las compras de un producto

**Filtros:**
```
Producto: "LENTE CRIZAL"
Sucursal: (todas)
Fecha Inicio: 01/12/2025
Fecha Fin: 28/02/2026
Tipo: INGRESO
```

**Resultado esperado:**
- Solo movimientos tipo INGRESO
- Total entradas: 100 unidades
- Costo total: $5,000.00
- Proveedores mencionados en `referenciaId`

---

## ⚙️ Configuración de Índices

**⚠️ IMPORTANTE:** Antes de usar el módulo, debes crear los índices compuestos en Firestore.

**Consulta la guía completa:** [KARDEX-INDICES-FIRESTORE.md](./KARDEX-INDICES-FIRESTORE.md)

### Índices Mínimos Requeridos

1. `productoId (ASC) + createdAt (ASC)`
2. `productoId (ASC) + sucursalId (ASC) + createdAt (ASC)`
3. `productoId (ASC) + tipo (ASC) + createdAt (ASC)`
4. `productoId (ASC) + sucursalId (ASC) + tipo (ASC) + createdAt (ASC)`

### Crear Índices Rápidamente

**Opción recomendada:** Ejecuta la consulta sin índices y sigue el link del error:

```
1. Abre la app y ve a /informes/kardex
2. Selecciona un producto y haz clic en "Consultar"
3. Aparecerá un error con un link
4. Haz clic en el link para crear el índice automáticamente
5. Espera 1-2 minutos
6. Vuelve a consultar
```

---

## 🎨 Personalización

### Cambiar Período por Defecto

Edita `kardex.ts` en el método `inicializarFormulario()`:

```typescript
// Actual: último mes
const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

// Cambiar a: últimos 7 días
const inicioMes = new Date(hoy.setDate(hoy.getDate() - 7));
```

### Añadir Más Columnas a la Tabla

Edita `kardex.html` y añade columnas:

```html
<th>Nueva Columna</th>

<!-- En el tbody -->
<td>{{ mov.nuevoValor }}</td>
```

### Cambiar Estilos de Badges

Edita `kardex.ts` en el método `obtenerClaseTipo()`:

```typescript
case 'INGRESO':
  return 'badge bg-success';  // Cambiar a 'bg-primary', etc.
```

---

## 🐛 Troubleshooting

### Problema: Consulta muy lenta (>5 segundos)

**Causas posibles:**
- No se seleccionó un producto
- Índices no están creados
- Rango de fechas demasiado amplio

**Solución:**
```
1. Asegúrate de seleccionar un producto
2. Verifica que los índices estén en estado "Enabled" en Firebase Console
3. Reduce el rango de fechas a 1-3 meses
```

---

### Problema: Error "The query requires an index"

**Causa:** Falta crear un índice compuesto en Firestore

**Solución:**
```
1. Copia el link del error en la consola del navegador
2. Pégalo en el navegador
3. Haz clic en "Create Index" en Firebase Console
4. Espera 1-2 minutos
5. Vuelve a ejecutar la consulta
```

---

### Problema: Stock final incorrecto

**Causa:** Los datos en `movimientos_stock` no están sincronizados

**Solución:**
```typescript
// Ejecutar script de recalculo (si existe)
node GUIAS/recalcular-stock-desde-kardex.js

// O verificar movimientos manualmente en Firestore Console
```

---

### Problema: No se muestran algunos productos

**Causa:** El producto no tiene movimientos registrados

**Solución:**
```
1. Verifica que el producto tenga movimientos en Firestore
2. Consulta: movimientos_stock → where productoId == "ID_PRODUCTO"
3. Si no hay datos, genera movimientos con una venta o ingreso
```

---

## 📈 Optimizaciones de Rendimiento

### 1. Paginación para Grandes Volúmenes

Si un producto tiene miles de movimientos, usa paginación:

```typescript
// En kardex.ts, reemplaza consultarKardex() por:
this.movimientoStockSrv.consultarKardexPaginado(filtros, 100).subscribe({
  next: (movimientos) => {
    this.movimientos = movimientos;
  }
});
```

### 2. Limitar Rango de Fechas

Establece un máximo de 6 meses:

```typescript
// En filtrosForm validation
if (fechaFin - fechaInicio > 180 días) {
  Swal.fire('El rango máximo es 6 meses');
  return;
}
```

### 3. Cache Local (Opcional)

Para consultas frecuentes, implementa cache:

```typescript
// En kardex.ts
private cacheKardex = new Map<string, MovimientoStock[]>();

consultarKardex() {
  const cacheKey = JSON.stringify(filtros);
  if (this.cacheKardex.has(cacheKey)) {
    this.movimientos = this.cacheKardex.get(cacheKey)!;
    return;
  }
  // ... continuar con consulta
}
```

---

## 🔐 Seguridad

### Reglas de Firestore Recomendadas

Asegúrate de que solo usuarios autenticados puedan leer `movimientos_stock`:

```javascript
// firestore.rules
match /movimientos_stock/{docId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo el backend escribe
}
```

---

## 📚 Referencias

- [Modelo MovimientoStock](../../src/app/core/models/movimiento-stock.model.ts)
- [Servicio MovimientoStock](../../src/app/core/services/movimiento-stock.service.ts)
- [Componente Kardex](../../src/app/modules/informes/pages/kardex/)
- [Índices Firestore](./KARDEX-INDICES-FIRESTORE.md)

---

## ✅ Checklist de Implementación

- [x] Modelo extendido con `FiltrosKardex` y `ResumenKardex`
- [x] Servicio con métodos de consulta Kardex
- [x] Componente standalone creado
- [x] Vista HTML con filtros y tabla
- [x] Estilos CSS responsivos
- [x] Ruta configurada en `informes-routing-module.ts`
- [ ] Índices de Firestore creados (ver [KARDEX-INDICES-FIRESTORE.md](./KARDEX-INDICES-FIRESTORE.md))
- [ ] Pruebas funcionales realizadas
- [ ] Documentación revisada

---

**Fecha de creación:** 27 de febrero de 2026  
**Última actualización:** 27 de febrero de 2026  
**Versión:** 1.0  
**Autor:** Sistema de Kardex - OpticaAngular

---

## 🎯 Próximas Mejoras (Roadmap)

- [ ] Gráficas de tendencias de stock
- [ ] Alertas de stock bajo
- [ ] Exportación a PDF
- [ ] Comparativa entre períodos
- [ ] Pronóstico de demanda
- [ ] Integración con reportes de ventas
