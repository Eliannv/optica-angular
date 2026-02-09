# Guía de Ejecución: Migración de Historiales Clínicos

## 📌 Resumen

Esta guía te ayudará a ejecutar de forma segura la migración de historiales clínicos desde un modelo de documento único (`main`) a múltiples documentos con IDs auto-generados.

---

## ⚠️ ANTES DE COMENZAR

### Prerequisitos Obligatorios:
1. ✅ **BACKUP COMPLETO** de Firestore (mandatory)
2. ✅ Leer completamente `GUIAS/MIGRACION-MULTIPLES-HISTORIALES.md`
3. ✅ Tener acceso a Firestore Console
4. ✅ Node.js instalado (v14 o superior)
5. ✅ Archivo `serviceAccountKey.json` en la raíz del proyecto

---

## 🔧 Pasos de Ejecución

### 1. Crear Backup de Firestore

**Opción A: Desde Firebase Console (Recomendado)**
```
1. Ir a Firebase Console → Firestore Database
2. Click en el menú de 3 puntos → "Exportar datos"
3. Seleccionar todas las colecciones
4. Guardar en Cloud Storage
5. Esperar a que complete y descargar localmente
```

**Opción B: Usando gcloud CLI**
```bash
# Exportar toda la base de datos
gcloud firestore export gs://tu-bucket/backup-historiales-2026-02-08

# Verificar que se completó
gcloud firestore operations list
```

### 2. Verificar el Entorno

Asegúrate de estar en el directorio correcto:
```bash
cd /path/to/optica-angular
```

Verifica que existe el archivo de credenciales:
```bash
ls -la serviceAccountKey.json
```

Debe mostrar el archivo. Si no existe, descárgalo desde Firebase Console:
```
Firebase Console → Project Settings → Service Accounts → Generate new private key
```

### 3. Ejecutar el Script de Migración

**Comando:**
```bash
node GUIAS/migrar-historiales-clinicos.js
```

**Salida esperada:**
```
========================================
🔍 VALIDACIÓN DE PREREQUISITOS
========================================

✅ Archivo de credenciales encontrado
✅ Conexión con Firestore establecida
✅ Base de datos contiene clientes

========================================
⚠️  ADVERTENCIA IMPORTANTE
========================================

Esta migración:
1. Modificará TODOS los historiales clínicos
2. Eliminará los documentos "main" existentes
3. Es un proceso IRREVERSIBLE sin backup

ANTES DE CONTINUAR:
✅ Asegúrate de haber hecho un BACKUP completo de Firestore
✅ Verifica que estás ejecutando en el ambiente correcto
✅ Lee la documentación completa de migración

¿Deseas continuar con la migración? (escribe SI para confirmar): 
```

**Escribe `SI` y presiona Enter**

### 4. Monitorear la Ejecución

El script mostrará el progreso en tiempo real:
```
========================================
🚀 INICIO DE MIGRACIÓN DE HISTORIALES CLÍNICOS
========================================

⏰ Fecha/Hora: 8/2/2026, 15:30:45

📋 Obteniendo lista de clientes activos...

✅ Total de clientes activos: 150

[1/150] Procesando: Juan Pérez (ID: abc123)
   ✅ Nuevo historial creado con ID: xyz789
   🗑️  Documento 'main' eliminado
   ✅ Migración exitosa

[2/150] Procesando: María González (ID: def456)
   ℹ️  Sin historial (no existe documento main)

...
```

### 5. Revisar el Resumen Final

Al terminar, verás un resumen como este:
```
========================================
📊 RESUMEN DE MIGRACIÓN
========================================

Total de clientes procesados:     150
✅ Historiales migrados exitosamente: 120
ℹ️  Clientes sin historial:           28
❌ Clientes con error:                2

========================================
❌ DETALLES DE ERRORES
========================================

1. Cliente: Pedro López (ID: ghi789)
   Error: El nuevo documento no se creó correctamente

2. Cliente: Ana Martínez (ID: jkl012)
   Error: Timeout al acceder a Firestore
```

---

## ✅ Verificación Post-Migración

### 1. Verificar en Firestore Console

Abre Firebase Console y navega a `clientes/{cualquier-cliente}/historialClinico`

**Verificaciones:**
- [ ] No debe existir documento llamado `main`
- [ ] Debe existir al menos un documento con ID auto-generado
- [ ] El documento debe tener campo `migratedFrom: "main"`
- [ ] El campo `createdAt` debe mantener la fecha original

### 2. Verificar Manualmente 5-10 Clientes

Selecciona clientes aleatorios y verifica:
```javascript
// En Firestore Console, Query:
clientes/abc123/historialClinico

// Debe mostrar documentos con estructura como:
{
  id: "xyz789",
  clienteId: "abc123",
  odEsfera: -2.5,
  // ... demás campos
  createdAt: Timestamp(2025, 10, 15), // Fecha original
  updatedAt: Timestamp(2026, 2, 8),   // Fecha de migración
  migratedFrom: "main",
  migratedAt: Timestamp(2026, 2, 8)
}
```

### 3. Probar Flujo Completo en la Aplicación

**Paso 1: Iniciar la aplicación**
```bash
npm start
```

**Paso 2: Navegar a Historial Clínico**
```
http://localhost:4200/clientes/historial
```

**Paso 3: Seleccionar un cliente**
- Click en "Ver historiales clínicos"
- Debe mostrar lista de historiales del cliente
- Verificar que aparece el historial migrado

**Paso 4: Crear nuevo historial**
- Click en "Nuevo Historial"
- Llenar formulario
- Guardar
- Verificar que se crea correctamente

**Paso 5: Crear venta con historial**
- Desde la lista de historiales, click en "Usar para Venta"
- Debe navegar a crear-venta con el historial seleccionado
- Completar venta
- Guardar
- Verificar que la factura tiene campo `historialClinicoId`

### 4. Verificar Facturas Antiguas (Regresión)

**Paso 1: Ir a Listar Facturas**
```
http://localhost:4200/ventas/facturas
```

**Paso 2: Filtrar por fechas antiguas (pre-migración)**

**Paso 3: Ver detalles de factura antigua**
- Verificar que se muestra correctamente
- El campo `historialSnapshot` debe seguir funcionando
- El campo `historialClinicoId` puede estar ausente (es opcional)

**Paso 4: Imprimir ticket de factura antigua**
- Debe imprimir sin errores
- Datos clínicos deben mostrarse del `historialSnapshot`

---

## 🆘 Solución de Problemas

### Error: "No se encontró el archivo serviceAccountKey.json"

**Solución:**
1. Descargar desde Firebase Console → Project Settings → Service Accounts
2. Guardar en la raíz del proyecto como `serviceAccountKey.json`
3. Reintentar

### Error: "Error conectando con Firestore"

**Posibles causas:**
- Credenciales inválidas
- Firebase no tiene permisos
- Firewall bloqueando conexión

**Solución:**
1. Verificar que el archivo `serviceAccountKey.json` es correcto
2. Intentar manualmente desde Firestore Console
3. Verificar reglas de Firestore (deben permitir lectura/escritura)

### Error: "Cliente con error" durante migración

**Acciones:**
1. Anotar el ID del cliente con problema
2. Revisar manualmente ese cliente en Firestore Console
3. Verificar si tiene un historial corrupto o formato inválido
4. Opción 1: Corregir el historial manualmente
5. Opción 2: Eliminar historial antiguo y crear uno nuevo desde la app

### Algunos clientes no tienen historiales migrados

**Esto es normal si:**
- El cliente nunca tuvo historial clínico (`Sin historial`)
- El cliente fue creado recientemente

**Verificación:**
```
En el resumen final:
ℹ️  Clientes sin historial: 28
```

Esto NO es un error, solo significa que esos clientes no tenían documento `main`.

---

## 🔄 Rollback (Restaurar desde Backup)

Si algo sale mal, puedes restaurar el backup:

### Opción A: Desde Firebase Console
```
1. Ir a Firebase Console → Firestore Database
2. Click en "Importar datos"
3. Seleccionar el backup creado anteriormente
4. Esperar a que complete
```

### Opción B: Usando gcloud CLI
```bash
# Importar backup
gcloud firestore import gs://tu-bucket/backup-historiales-2026-02-08

# Verificar que completó
gcloud firestore operations list
```

**IMPORTANTE:** Al restaurar, perderás cualquier dato creado después del backup.

---

## 📋 Checklist Final

Antes de considerar la migración exitosa:

- [ ] Backup de Firestore creado y descargado
- [ ] Script ejecutado sin errores críticos
- [ ] Resumen de migración revisado
- [ ] Verificación manual en Firestore Console completada
- [ ] 5-10 clientes verificados manualmente
- [ ] Flujo completo probado: crear historial → crear venta
- [ ] Facturas antiguas funcionan correctamente
- [ ] No existen documentos `main` en Firestore
- [ ] Aplicación funciona sin errores en consola
- [ ] Equipo notificado de los cambios
- [ ] Documentación actualizada (`.github/copilot-instructions.md`)

---

## 📞 Soporte

Si encuentras problemas durante la migración:

1. **Detener el script** (Ctrl+C)
2. **Anotar el error** y el cliente donde falló
3. **Consultar** `GUIAS/MIGRACION-MULTIPLES-HISTORIALES.md`
4. **No ejecutar** el script nuevamente hasta identificar el problema
5. **Considerar restaurar** desde backup si hay datos corruptos

---

## ✅ Post-Migración

### Actualizar Documentación

Editar `.github/copilot-instructions.md`:
```markdown
// ANTES:
- Clinical history is stored as a single document at `clientes/{id}/historialClinico/main`

// DESPUÉS:
- Clinical history: clients can have MULTIPLE clinical histories stored at 
  `clientes/{clienteId}/historialClinico/{historialId}` with auto-generated IDs
- Each sale references the specific historialClinicoId used
```

### Comunicar Cambios al Equipo

**Email de ejemplo:**
```
Asunto: ✅ Migración de Sistema de Historiales Clínicos Completada

Equipo,

Se ha completado exitosamente la migración del sistema de historiales clínicos.

CAMBIOS PRINCIPALES:
- Ahora cada cliente puede tener MÚLTIPLES historiales clínicos
- Se eliminó el concepto de documento único "main"
- Nuevo flujo: Seleccionar historial → Crear venta

IMPACTO EN EL USO:
- Al crear una venta, primero se selecciona el historial clínico del cliente
- Se pueden crear múltiples historiales por cliente (uno por fecha)
- Las ventas antiguas siguen funcionando normalmente

ESTADÍSTICAS:
- Clientes migrados: XXX
- Historiales migrados: XXX
- Duración total: XX minutos

Para más detalles, consultar: GUIAS/MIGRACION-MULTIPLES-HISTORIALES.md

Saludos,
Equipo de Desarrollo
```

---

**IMPORTANTE:** Guarda esta guía para futuras referencias y compártela con todo el equipo antes de ejecutar la migración.
