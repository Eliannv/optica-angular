# ⚡ QUICK START - CATÁLOGO

## 📌 RESUMEN RÁPIDO

Se ha implementado un nuevo módulo **CATÁLOGO** que permite registrar ítems vendibles sin inventario ni deuda.

### ✅ Lo que incluye:

**1. Modelo de datos** (`catalogo.model.ts`)
- Interfaz `CatalogoItem`
- Enum `CategoriaCatalogo`
- Mapeo de labels de categorías

**2. Servicio** (`catalogo.service.ts`)
- Operaciones CRUD en Firestore
- Soft delete
- Filtrado por categoría
- Cálculo automático de IVA

**3. Componentes**
- **ListarCatalogoComponent**: Tabla con listado, filtros y acciones
- **FormCatalogoComponent**: Formulario con validaciones reactivas

**4. Rutas**
- `/catalogo` - Listado
- `/catalogo/crear` - Crear nuevo
- `/catalogo/editar/:id` - Editar existente
- Lazy-loaded (se carga solo cuando se accede)

**5. Navbar**
- Menú "CATÁLOGO" con submenús por categoría
- Acceso solo para administradores

---

## 🚀 CÓMO USAR

### Crear un Ítem

1. Ve a **CATÁLOGO** en el sidebar
2. Click en **"Nuevo Ítem"**
3. Completa:
   - **Nombre**: Ej: "Luna Anti-Reflejo"
   - **Categoría**: Selecciona una de las 4
   - **Precio**: Opcional
   - **IVA**: Default 15%
   - **Observación**: Opcional
4. Click **"Crear"**

### Filtrar Ítems

En el listado puedes:
- Hacer click en botones de categoría para filtrar
- Ver solo activos o mostrar inactivos
- Buscar visualizando la tabla

### Editar o Desactivar

- **Lápiz**: Editar el ítem
- **Trash**: Desactivar (mantiene historial)
- **Reactivar**: Si activaste "Mostrar inactivos"

---

## 📂 ARCHIVOS CREADOS

```
catalogo/
├── catalogo.module.ts
├── catalogo-routing.module.ts
└── pages/
    ├── listar-catalogo/
    │   ├── listar-catalogo.ts
    │   ├── listar-catalogo.html
    │   └── listar-catalogo.css
    └── form-catalogo/
        ├── form-catalogo.ts
        ├── form-catalogo.html
        └── form-catalogo.css
```

---

## 🎯 CATEGORÍAS

| Nombre | Código | Descripción |
|--------|--------|-------------|
| 🔍 Tipos de Lunas | `LUNA` | Lunas oftálmicas |
| 📦 Lentes de Contacto | `LENTE_CONTACTO` | Lentes de contacto |
| 💧 Líquidos Limpia Lunas | `LIQUIDO` | Líquidos de limpieza |
| 🛠️ Servicios | `SERVICIO` | Servicios diversos |

⚠️ **NO usar para:** Armazones, Gafas (usar módulo Productos)

---

## 💡 CARACTERÍSTICAS CLAVE

✅ **Stock Infinito** - No se gestiona inventario
✅ **Sin Compras** - No genera movimientos de stock
✅ **Sin Deuda** - No afecta cuentas por pagar
✅ **Sin Caja/Banco** - No impacta contabilidad
✅ **Soft Delete** - Se desactiva, no elimina
✅ **IVA Automático** - Se calcula al guardar
✅ **Validaciones** - Formularios reactivos

---

## 🔐 SEGURIDAD

- ✅ Requiere login
- ✅ Solo administradores
- ✅ Guards en rutas
- ✅ Validaciones en formularios

---

## 📊 FIRESTORE

**Colección:** `catalogo`

**Ejemplo de documento:**
```json
{
  "nombre": "Luna Progresiva",
  "categoria": "LUNA",
  "precio": 150,
  "iva": 15,
  "precioConIVA": 172.5,
  "activo": true,
  "observacion": "Recomendada",
  "createdAt": "2025-02-02T...",
  "updatedAt": "2025-02-02T..."
}
```

---

## 🔮 PRÓXIMO: INTEGRACIÓN CON VENTAS

En la próxima fase se agregará la capacidad de:
- Agregar ítems catálogo a ventas
- Editar precio en punto de venta
- Registrar en facturas sin afectar inventario

---

## 📞 AYUDA

¿Dudas? Revisar:
1. [IMPLEMENTACION-CATALOGO.md](IMPLEMENTACION-CATALOGO.md) - Documentación completa
2. Componentes similares (Productos, Ventas)
3. Patrón de formularios reactivos en la app

---

**Estado:** ✅ Listo para usar  
**Fecha:** 2025-02-02
