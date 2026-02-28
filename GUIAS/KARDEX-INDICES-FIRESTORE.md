# Índices de Firestore para el Módulo de Kardex

Este documento describe los índices compuestos necesarios en Firestore para que las consultas del módulo de Kardex funcionen correctamente.

## 🎯 Por qué son necesarios

Firestore requiere **índices compuestos** cuando:
- Se combina un campo de igualdad (`==`) con un campo de ordenamiento (`orderBy`)
- Se usan múltiples campos de rango (`>=`, `<=`)
- Se ordenan los resultados por un campo distinto al usado en el filtro

El módulo de Kardex realiza consultas complejas con múltiples filtros, por lo que **es crítico crear estos índices**.

---

## 📋 Índices Requeridos

### 1. **Índice básico: Producto + Fecha**
**Propósito:** Consulta por producto ordenada por fecha (caso más común)

```
Colección: movimientos_stock
Campos indexados:
  - productoId (Ascending)
  - createdAt (Ascending)
```

**Cuándo se usa:**
- Filtro solo por `productoId`
- Ordenamiento por `createdAt`

---

### 2. **Índice: Producto + Sucursal + Fecha**
**Propósito:** Consulta por producto y sucursal específica

```
Colección: movimientos_stock
Campos indexados:
  - productoId (Ascending)
  - sucursalId (Ascending)
  - createdAt (Ascending)
```

**Cuándo se usa:**
- Filtro por `productoId` + `sucursalId`
- Ordenamiento por `createdAt`

---

### 3. **Índice: Producto + Tipo + Fecha**
**Propósito:** Consulta por producto y tipo de movimiento específico

```
Colección: movimientos_stock
Campos indexados:
  - productoId (Ascending)
  - tipo (Ascending)
  - createdAt (Ascending)
```

**Cuándo se usa:**
- Filtro por `productoId` + `tipo` (Ej: solo VENTAS)
- Ordenamiento por `createdAt`

---

### 4. **Índice: Producto + Sucursal + Tipo + Fecha**
**Propósito:** Consulta completa con todos los filtros

```
Colección: movimientos_stock
Campos indexados:
  - productoId (Ascending)
  - sucursalId (Ascending)
  - tipo (Ascending)
  - createdAt (Ascending)
```

**Cuándo se usa:**
- Filtro por `productoId` + `sucursalId` + `tipo`
- Ordenamiento por `createdAt`

---

## 🚀 Cómo Crear los Índices

### Opción 1: Crear manualmente desde Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** → **Indexes** (pestaña)
4. Haz clic en **Create Index**
5. Configura cada índice según las especificaciones arriba
6. Haz clic en **Create**

---

### Opción 2: Dejar que Firestore cree el índice automáticamente

Cuando ejecutes la consulta del Kardex por primera vez sin el índice, Firestore te mostrará un **error con un link directo** para crear el índice.

**Ejemplo de error:**
```
The query requires an index. You can create it here: 
https://console.firebase.google.com/project/tu-proyecto/firestore/indexes?create_composite=...
```

**Pasos:**
1. Ejecuta la consulta del Kardex desde la app
2. Abre la consola del navegador (F12)
3. **Copia el link** que aparece en el error
4. Pégalo en el navegador
5. Haz clic en "Create Index" en Firebase Console
6. Espera 1-2 minutos a que se construya el índice
7. Vuelve a ejecutar la consulta

---

### Opción 3: Usar archivo `firestore.indexes.json`

Puedes definir todos los índices en el archivo `firestore.indexes.json` en la raíz del proyecto:

```json
{
  "indexes": [
    {
      "collectionGroup": "movimientos_stock",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productoId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "movimientos_stock",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productoId", "order": "ASCENDING" },
        { "fieldPath": "sucursalId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "movimientos_stock",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productoId", "order": "ASCENDING" },
        { "fieldPath": "tipo", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "movimientos_stock",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productoId", "order": "ASCENDING" },
        { "fieldPath": "sucursalId", "order": "ASCENDING" },
        { "fieldPath": "tipo", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Para deployarlos:**
```bash
firebase deploy --only firestore:indexes
```

---

## 🔍 Verificar Índices Existentes

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Abre tu proyecto
3. Ve a **Firestore Database** → **Indexes**
4. Verifica que los índices aparezcan con estado **"Enabled"** (verde)

---

## ⚡ Optimizaciones de Rendimiento

### 1. **Siempre selecciona un producto**
El filtro por `productoId` es **obligatorio** en el componente porque:
- Reduce drásticamente los documentos escaneados
- Optimiza el uso de los índices
- Mejora la velocidad de respuesta

### 2. **Limitar rango de fechas**
- Usa rangos de 1-3 meses para consultas más rápidas
- Para consultas históricas completas, considera usar paginación

### 3. **Paginación para grandes volúmenes**
Si un producto tiene miles de movimientos, usa el método `consultarKardexPaginado()` en lugar de `consultarKardex()`.

**Ejemplo:**
```typescript
// En lugar de cargar todo de una vez
this.movimientoStockSrv.consultarKardex(filtros).subscribe(...);

// Usa paginación
this.movimientoStockSrv.consultarKardexPaginado(filtros, 100).subscribe(...);
```

---

## 🐛 Troubleshooting

### Error: "The query requires an index"
**Solución:** Sigue el link del error para crear el índice faltante.

### Error: "9 FAILED_PRECONDITION: The query requires an index..."
**Solución:** El índice está en construcción. Espera 1-2 minutos y vuelve a intentar.

### Consulta muy lenta (>5 segundos)
**Posibles causas:**
- No estás usando el filtro de `productoId`
- El rango de fechas es muy amplio (>6 meses)
- El índice no está optimizado

**Solución:**
- Asegúrate de que `productoId` esté seleccionado
- Reduce el rango de fechas
- Verifica que el índice esté en estado "Enabled"

---

## 📊 Estimación de Costos

Firestore cobra por:
- **Lecturas de documentos:** $0.06 por 100,000 lecturas
- **Almacenamiento de índices:** $0.18 por GB/mes

**Ejemplo:**
- Consulta de 500 movimientos = 500 lecturas
- Costo: ~$0.0003 USD por consulta
- Los índices ocupan espacio mínimo (<1 MB para 10,000 movimientos)

---

## ✅ Checklist de Implementación

- [ ] Crear índice básico: `productoId + createdAt`
- [ ] Crear índice: `productoId + sucursalId + createdAt`
- [ ] Crear índice: `productoId + tipo + createdAt`
- [ ] Crear índice completo: `productoId + sucursalId + tipo + createdAt`
- [ ] Verificar que todos los índices estén en estado "Enabled"
- [ ] Probar consulta del Kardex desde la app
- [ ] Verificar tiempos de respuesta (<2 segundos)

---

## 📚 Referencias

- [Documentación oficial de Índices de Firestore](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Mejores prácticas de consultas](https://firebase.google.com/docs/firestore/best-practices)
- [Límites y cuotas de Firestore](https://firebase.google.com/docs/firestore/quotas)

---

**Fecha de creación:** 27 de febrero de 2026  
**Última actualización:** 27 de febrero de 2026  
**Versión:** 1.0  
**Autor:** Sistema de Kardex - OpticaAngular
