# Migración de IDs Internos para Productos

Este documento explica cómo ejecutar el script de migración para asignar IDs internos automáticos a productos existentes en la base de datos.

## ⚠️ Importante

- **Ejecutar UNA SOLA VEZ** después de implementar el nuevo sistema de IDs
- Crear un **backup de Firestore** antes de ejecutar
- Ejecutar en un momento de **baja actividad** del sistema
- El proceso es **irreversible**

---

## Prerequisitos

### 1. Instalar dependencias

El script requiere `firebase-admin`:

```bash
npm install firebase-admin --save-dev
```

### 2. Verificar serviceAccountKey.json

Asegurarse de que el archivo `serviceAccountKey.json` esté en la raíz del proyecto y sea válido.

**Cómo obtenerlo:**
1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Proyecto → Configuración (⚙️) → Cuentas de servicio
3. Generar nueva clave privada
4. Guardar como `serviceAccountKey.json` en la raíz

---

## Ejecución del Script

### Paso 1: Crear Backup (MUY IMPORTANTE)

Desde Firebase Console:
1. Firestore Database → ⚙️ → Exportar
2. Seleccionar colección `productos`
3. Guardar en Cloud Storage
4. Esperar confirmación de export exitoso

### Paso 2: Ejecutar la Migración

```bash
node migrar-ids-productos.js
```

### Paso 3: Confirmar Ejecución

El script pedirá confirmación:

```
⚠️  ADVERTENCIA: Este script modificará todos los productos en Firestore

   - Asignará IDs internos a productos que no los tengan
   - Actualizará el contador de productos
   - Este proceso es irreversible

¿Desea continuar? (escriba "SI" para confirmar): 
```

Escribir `SI` (en mayúsculas) y presionar Enter.

### Paso 4: Monitorear Progreso

El script mostrará el progreso en tiempo real:

```
🚀 Iniciando migración de IDs internos para productos...

📦 Encontrados 150 productos

🔢 Iniciando asignación desde ID: 1001

✅ [1/150] Producto "O0012" → idInterno: 1001
✅ [2/150] Producto "O0013" → idInterno: 1002
⏭️  [3/150] Producto "ARM-001" ya tiene idInterno: 1050 - OMITIDO
...
```

### Paso 5: Verificar Resultado

Al finalizar, se mostrará un resumen:

```
============================================================
✨ Migración completada exitosamente

📊 Resumen:
   - Total procesados: 150
   - Actualizados: 145
   - Omitidos (ya tenían ID): 5
   - Último ID asignado: 1145
   - Próximo ID disponible: 1146
============================================================
```

---

## Verificación Post-Migración

### 1. Revisar en Firestore Console

1. Ir a Firestore Database
2. Abrir colección `productos`
3. Verificar que todos tengan el campo `idInterno`
4. Verificar que no haya duplicados

### 2. Verificar el Contador

1. Ir a colección `counters`
2. Abrir documento `productos`
3. Verificar que `lastId` sea correcto

### 3. Probar Crear Producto

1. Abrir la aplicación
2. Ir a "Crear Producto"
3. Verificar que el preview del ID sea correcto (lastId + 1)
4. Crear un producto de prueba
5. Verificar que se asigne el ID correcto

---

## Solución de Problemas

### Error: "Cannot find module 'firebase-admin'"

**Solución:**
```bash
npm install firebase-admin
```

### Error: "ENOENT: no such file or directory, open './serviceAccountKey.json'"

**Solución:**
- Verificar que `serviceAccountKey.json` esté en la raíz del proyecto
- Verificar que el nombre del archivo sea exacto (mayúsculas/minúsculas)

### Error: "Permission denied"

**Solución:**
- Verificar que la cuenta de servicio tenga permisos de lectura/escritura en Firestore
- Regenerar la clave privada desde Firebase Console

### IDs No Secuenciales

Si algunos productos ya tenían IDs (por pruebas anteriores), el script:
- Los respeta y no los modifica
- Ajusta el contador para continuar desde el más alto encontrado
- Esto puede resultar en saltos en la secuencia (ej: 1001, 1002, 1050, 1051...)

**¿Es un problema?**
No. Los IDs internos no necesitan ser perfectamente secuenciales, solo únicos.

---

## Rollback (Deshacer)

Si algo sale mal, restaurar desde el backup:

### Desde Firebase Console:
1. Firestore Database → ⚙️ → Importar
2. Seleccionar el archivo de backup exportado
3. Confirmar importación

### Con gcloud CLI:
```bash
gcloud firestore import gs://[BUCKET_NAME]/[EXPORT_FOLDER]
```

---

## Script Alternativo: Migración por Lotes

Si tienes muchos productos (>1000), considera procesar por lotes:

```javascript
// En migrar-ids-productos.js, reemplazar el for loop:

const batch = db.batch();
let batchCount = 0;

for (const doc of snapshot.docs) {
  if (data.idInterno) continue;
  
  batch.update(doc.ref, { idInterno: idActual++ });
  batchCount++;
  
  // Commit cada 500 documentos
  if (batchCount === 500) {
    await batch.commit();
    console.log(`📦 Lote de 500 productos guardado`);
    batch = db.batch();
    batchCount = 0;
  }
}

// Commit restantes
if (batchCount > 0) {
  await batch.commit();
}
```

---

## Preguntas Frecuentes

**P: ¿Puedo ejecutar el script múltiples veces?**  
R: Sí, es seguro. El script omite productos que ya tienen `idInterno`.

**P: ¿Qué pasa si se crea un producto mientras se ejecuta el script?**  
R: El script usa transacciones, pero se recomienda ejecutarlo en horario de baja actividad.

**P: ¿Los IDs deben empezar en 1001?**  
R: No, puedes modificar el valor inicial en el script (línea: `let idActual = 1001;`).

**P: ¿Cómo cambio el formato de los IDs (ej: PRD-0001)?**  
R: Ese es el `codigo` (código de armazón), no el `idInterno`. El idInterno siempre es numérico.

**P: ¿Puedo usar este script para otros contadores (clientes, proveedores)?**  
R: Sí, solo modifica las referencias de colección y contador.

---

## Contacto

Si tienes problemas o dudas durante la migración, revisa:
- [SISTEMA-IDS-PRODUCTOS.md](./SISTEMA-IDS-PRODUCTOS.md) - Documentación del sistema
- Firebase Console → Logs - Para errores de Firestore
- Console del navegador - Para errores de la aplicación
