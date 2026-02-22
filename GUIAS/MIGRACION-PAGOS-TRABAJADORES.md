# Migración: Agregar empleado_usuario_id a Pagos de Trabajadores

## 📋 Contexto del Problema

El sistema de pagos a empleados tenía un error donde:
- Los movimientos de tipo `PAGO_TRABAJADOR` guardaban `persona_cedula` y `persona_nombre`
- **PERO** no guardaban el `empleado_usuario_id` (ID del documento del empleado)
- El servicio `empleado-metricas.service.ts` busca por `empleado_usuario_id` para calcular métricas
- **Resultado:** Los pagos no aparecían en las métricas de empleados

## 🔧 Solución Implementada

### 1. Cambios en el Código

#### `registrar-movimiento.ts`
```typescript
// ANTES (❌ No guardaba el ID del empleado)
else if ((categoria === 'TRANSFERENCIA_CLIENTE' || categoria === 'PAGO_TRABAJADOR') && this.clienteSeleccionado) {
  movimientoBase.persona_nombre = `${nombre}${apellido ? ' ' + apellido : ''}`;
  movimientoBase.persona_cedula = cedula || null;
}

// DESPUÉS (✅ Guarda el ID del empleado)
else if (categoria === 'PAGO_TRABAJADOR' && this.clienteSeleccionado) {
  movimientoBase.persona_nombre = `${nombre}${apellido ? ' ' + apellido : ''}`;
  movimientoBase.persona_cedula = cedula || null;
  movimientoBase.empleado_usuario_id = this.clienteSeleccionado.id || null; // ← NUEVO
}
```

#### `empleado-metricas.service.ts`
```typescript
// ANTES
where('usuario_id', '==', usuarioId)  // ❌ usuario_id = quien REGISTRA el movimiento

// DESPUÉS  
where('empleado_usuario_id', '==', usuarioId)  // ✅ empleado_usuario_id = quien RECIBE el pago
```

### 2. Campos en `movimientos_cajas_banco`

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `usuario_id` | Quien **registra** el movimiento (cajero) | `PGoVRkuCQcViwDPVioP2ruWoAxy2` |
| `usuario_nombre` | Nombre del cajero | `JONATHAN JHONNY` |
| `empleado_usuario_id` | Quien **recibe** el pago (empleado) | `xyz123abc` |
| `persona_nombre` | Nombre del empleado que recibe | `JEAN VILLEGAS` |
| `persona_cedula` | Cédula del empleado | `1314276765` |

## 🚀 Ejecución de la Migración

### Requisitos Previos
- Node.js instalado
- `firebase-admin` instalado: `npm install firebase-admin`
- Archivo `serviceAccountKey.json` en la raíz del proyecto

### Paso 1: Verificar el Script
```bash
cd "c:\Users\ASUS VIVOBOOK\Documents\Programación\Angular\optica-angular"
```

Revisar el script:
```bash
Get-Content GUIAS\migrar-pagos-trabajadores-empleado-id.js
```

### Paso 2: Ejecutar la Migración
```bash
node GUIAS/migrar-pagos-trabajadores-empleado-id.js
```

### Paso 3: Verificar Resultados

El script mostrará un resumen como:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 RESUMEN DE MIGRACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Actualizados:        15
⏭️  Ya tenían campo:     0
❌ No encontrados:      2
📊 Total procesados:    17
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Paso 4: Verificar en Firestore
1. Abrir Firebase Console
2. Ir a `movimientos_cajas_banco`
3. Filtrar por `categoria == PAGO_TRABAJADOR`
4. Verificar que ahora tienen el campo `empleado_usuario_id`

## 🧪 Pruebas Post-Migración

### 1. Registrar un Nuevo Pago
1. Ir a **Caja Banco** → **Registrar Movimiento**
2. Tipo: **EGRESO**
3. Categoría: **Pago Trabajador**
4. Seleccionar empleado
5. Guardar

**Verificar en Firestore:**
```javascript
{
  tipo: 'EGRESO',
  categoria: 'PAGO_TRABAJADOR',
  persona_nombre: 'JEAN VILLEGAS',
  persona_cedula: '1314276765',
  empleado_usuario_id: 'xyz123',  // ✅ Este campo debe existir
  usuario_id: 'abc456',           // Quien registró
  usuario_nombre: 'JONATHAN JHONNY'
}
```

### 2. Verificar Métricas de Empleados
1. Ir a **Empleados**
2. Seleccionar un período
3. Las métricas globales deben mostrar: "Total Pagado a Empleados"
4. Hacer clic en "Ver detalle" de un empleado
5. En la sección **"Pagos Recibidos (Nómina)"** deben aparecer:
   - Total pagado
   - Cantidad de pagos
   - Historial de pagos

## ⚠️ Consideraciones Importantes

### Movimientos Sin Empleado_usuario_id
Si algunos movimientos no se migraron (campo `❌ No encontrados`):
- El empleado con esa cédula no existe en la colección `usuarios`
- Verificar manualmente la cédula
- Corregir en Firestore si es necesario

### Datos Futuros
- Todos los nuevos pagos se guardarán automáticamente con `empleado_usuario_id`
- No es necesario volver a ejecutar el script

### Rollback (Si algo sale mal)
Si necesitas deshacer la migración:
```javascript
const movimientosRef = db.collection('movimientos_cajas_banco');
const snapshot = await movimientosRef
  .where('categoria', '==', 'PAGO_TRABAJADOR')
  .get();

const batch = db.batch();
snapshot.docs.forEach(doc => {
  batch.update(doc.ref, {
    empleado_usuario_id: admin.firestore.FieldValue.delete()
  });
});

await batch.commit();
```

## 📊 Índice de Firestore Recomendado

Para optimizar las consultas de métricas, crear índice compuesto:

```
Collection: movimientos_cajas_banco
Fields:
  - empleado_usuario_id (Ascending)
  - categoria (Ascending)
  - fecha (Ascending)
```

**Crear desde:**
Firebase Console → Firestore → Indexes → Create Index

## ✅ Checklist Final

- [ ] Script ejecutado sin errores
- [ ] Verificado campo `empleado_usuario_id` en Firestore
- [ ] Probado registro de nuevo pago
- [ ] Verificadas métricas en componente de empleados
- [ ] Índice compuesto creado (opcional, si hay muchos datos)

---

**Fecha de Migración:** 22 de febrero de 2026  
**Scripts:**
- `GUIAS/migrar-pagos-trabajadores-empleado-id.js`

**Archivos Modificados:**
- `src/app/modules/caja-banco/pages/registrar-movimiento/registrar-movimiento.ts`
- `src/app/core/services/empleado-metricas.service.ts`
