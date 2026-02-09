# 📚 Estructura de Colección: maquinas_autorizadas

## Documento de Ejemplo

```json
{
  "machineId": "858744ddedd2fca1",
  "sucursal": "DESARROLLO_1",
  "nombreMaquina": "PC Desarrollo 1",
  "activo": true,
  "fechaRegistro": {
    "_seconds": 1738368000,
    "_nanoseconds": 0
  },
  "ultimoAcceso": {
    "_seconds": 1738454400,
    "_nanoseconds": 0
  },
  "observaciones": "Máquina de desarrollo principal",
  "autorizadoPor": "admin_uid_abc123"
}
```

## Campos del Documento

### machineId (string) - REQUERIDO
- **Descripción**: Identificador único de la máquina
- **Formato**: Hash SHA-256 de 16 caracteres
- **Ejemplo**: `"858744ddedd2fca1"`
- **Generación**: Automática basada en hostname + platform + CPU
- **Único**: Sí (usar como Document ID)
- **Validación**: Exactamente 16 caracteres hexadecimales

### sucursal (string) - REQUERIDO
- **Descripción**: Sucursal a la que pertenece la máquina
- **Valores permitidos**: 
  - `"MACHALA"` - Sede principal
  - `"PASAJE"` - Sucursal Pasaje
  - `"DESARROLLO_1"` - Ambiente desarrollo 1
  - `"DESARROLLO_2"` - Ambiente desarrollo 2
- **Ejemplo**: `"PASAJE"`
- **Caso**: Mayúsculas
- **Extensible**: Sí (agregar más sucursales si es necesario)

### nombreMaquina (string) - REQUERIDO
- **Descripción**: Nombre descriptivo de la máquina
- **Formato**: Texto libre
- **Ejemplo**: `"PC Recepción Pasaje"`
- **Longitud**: 3-100 caracteres
- **Sugerencia**: Incluir ubicación física o función

### activo (boolean) - REQUERIDO
- **Descripción**: Estado de autorización
- **Valores**:
  - `true` - Máquina autorizada, puede acceder
  - `false` - Máquina desactivada, acceso denegado
- **Por defecto**: `true`
- **Nota**: Preferir desactivar en lugar de eliminar

### fechaRegistro (Timestamp) - REQUERIDO
- **Descripción**: Fecha y hora de registro en el sistema
- **Tipo**: Firestore Timestamp
- **Generación**: Automática al crear (serverTimestamp)
- **Inmutable**: No debe modificarse después de creación
- **Formato**: Timestamp de Firestore

### ultimoAcceso (Timestamp) - OPCIONAL
- **Descripción**: Última vez que la máquina accedió al sistema
- **Tipo**: Firestore Timestamp
- **Actualización**: Automática cada vez que Electron inicia
- **Uso**: Auditoría y detección de máquinas inactivas
- **Formato**: Timestamp de Firestore

### observaciones (string) - OPCIONAL
- **Descripción**: Notas adicionales sobre la máquina
- **Formato**: Texto libre
- **Ejemplo**: `"PC principal de caja - Reemplazada 15/01/2025"`
- **Longitud**: 0-500 caracteres
- **Uso**: Documentación, historial, notas importantes

### autorizadoPor (string) - OPCIONAL
- **Descripción**: UID del administrador que autorizó la máquina
- **Formato**: Firebase Auth UID
- **Ejemplo**: `"abc123xyz789"`
- **Uso**: Auditoría, trazabilidad
- **Relación**: Enlaza con colección `usuarios`

## Índices Recomendados

### Índice 1: Búsqueda por sucursal activa
```
Collection: maquinas_autorizadas
Fields:
  - sucursal (Ascending)
  - activo (Ascending)
```

### Índice 2: Búsqueda por estado y fecha
```
Collection: maquinas_autorizadas
Fields:
  - activo (Ascending)
  - ultimoAcceso (Descending)
```

## Reglas de Seguridad

```javascript
match /maquinas_autorizadas/{maquinaId} {
  // Leer: cualquier usuario autenticado (necesario para verificación en Electron)
  allow read: if isSignedIn();
  
  // Crear/Actualizar/Eliminar: solo administradores
  allow create, update, delete: if isAdmin();
}
```

## Consultas Comunes

### Obtener todas las máquinas activas
```typescript
const maquinasActivas = await getDocs(
  query(
    collection(db, 'maquinas_autorizadas'),
    where('activo', '==', true)
  )
);
```

### Obtener máquinas de una sucursal
```typescript
const maquinasPasaje = await getDocs(
  query(
    collection(db, 'maquinas_autorizadas'),
    where('sucursal', '==', 'PASAJE')
  )
);
```

### Verificar si un machineId está autorizado
```typescript
const snapshot = await getDocs(
  query(
    collection(db, 'maquinas_autorizadas'),
    where('machineId', '==', machineId),
    where('activo', '==', true),
    limit(1)
  )
);

const autorizado = !snapshot.empty;
```

### Obtener máquinas sin acceso reciente (>30 días)
```typescript
const hace30Dias = new Date();
hace30Dias.setDate(hace30Dias.getDate() - 30);

const maquinasInactivas = await getDocs(
  query(
    collection(db, 'maquinas_autorizadas'),
    where('ultimoAcceso', '<', Timestamp.fromDate(hace30Dias))
  )
);
```

## Validaciones del Lado del Cliente

```typescript
interface MaquinaAutorizada {
  id?: string;
  machineId: string; // 16 caracteres hex
  sucursal: 'MACHALA' | 'PASAJE' | 'DESARROLLO_1' | 'DESARROLLO_2';
  nombreMaquina: string; // 3-100 caracteres
  activo: boolean;
  fechaRegistro: Date;
  ultimoAcceso?: Date;
  observaciones?: string; // max 500 caracteres
  autorizadoPor?: string;
}

// Validación
function validarMaquina(maquina: Partial<MaquinaAutorizada>): boolean {
  if (!maquina.machineId || maquina.machineId.length !== 16) return false;
  if (!['MACHALA', 'PASAJE', 'DESARROLLO_1', 'DESARROLLO_2'].includes(maquina.sucursal!)) return false;
  if (!maquina.nombreMaquina || maquina.nombreMaquina.length < 3) return false;
  if (maquina.observaciones && maquina.observaciones.length > 500) return false;
  return true;
}
```

## Ejemplo de Documento Completo en Firestore

**Ruta**: `maquinas_autorizadas/858744ddedd2fca1`

```json
{
  "machineId": "858744ddedd2fca1",
  "sucursal": "DESARROLLO_1",
  "nombreMaquina": "PC Desarrollo 1",
  "activo": true,
  "fechaRegistro": Timestamp(2025-01-31 10:00:00),
  "ultimoAcceso": Timestamp(2025-01-31 15:30:00),
  "observaciones": "Máquina de desarrollo principal. Windows 11 Pro.",
  "autorizadoPor": "xyz789admin"
}
```

## Migraciones

### Agregar nuevo campo a documentos existentes

```javascript
const batch = db.batch();
const maquinas = await db.collection('maquinas_autorizadas').get();

maquinas.forEach(doc => {
  batch.update(doc.ref, { nuevoField: valorDefault });
});

await batch.commit();
```

### Cambiar nombre de sucursal

```javascript
const batch = db.batch();
const maquinas = await db.collection('maquinas_autorizadas')
  .where('sucursal', '==', 'NOMBRE_ANTIGUO')
  .get();

maquinas.forEach(doc => {
  batch.update(doc.ref, { sucursal: 'NOMBRE_NUEVO' });
});

await batch.commit();
```

## Backup

### Exportar todas las máquinas

```bash
# Usando Firebase CLI
firebase firestore:export gs://[BUCKET]/backups/maquinas_autorizadas

# O usando script personalizado
node export-maquinas.js > maquinas-backup-$(date +%Y%m%d).json
```

### Importar desde backup

```bash
firebase firestore:import gs://[BUCKET]/backups/maquinas_autorizadas
```

---

**Notas Importantes:**
1. El `machineId` debe usarse como Document ID para garantizar unicidad
2. Siempre usar `serverTimestamp()` para fechas en el servidor
3. No eliminar documentos, mejor desactivar (`activo: false`)
4. Revisar `ultimoAcceso` regularmente para detectar anomalías
5. Mantener observaciones actualizadas para auditoría
