# Guía de Migración: De Historial Único a Múltiples Historiales Clínicos

## 📋 Resumen Ejecutivo

Esta guía documenta la migración de un sistema de **historial clínico único** (`main`) a un sistema de **múltiples historiales clínicos por cliente**, permitiendo registrar diferentes graduaciones a lo largo del tiempo.

### Cambios principales:
- ✅ Múltiples documentos de historial por cliente
- ✅ Nuevo flujo UX: seleccionar/crear historial → crear venta
- ✅ Relación entre ventas y historiales clínicos
- ✅ Optimización de lecturas de Firestore
- ✅ Migración automática de datos existentes

---

## 🏗️ Estructura Final en Firestore

### ANTES (estructura actual):
```
clientes/{clienteId}/historialClinico/main
  - clienteId: string
  - odEsfera: number
  - odCilindro: number
  - ... (demás campos)
  - createdAt: timestamp
  - updatedAt: timestamp
```

### DESPUÉS (nueva estructura):
```
clientes/{clienteId}/historialClinico/{historialId}
  - id: string (auto-generado por Firestore)
  - clienteId: string
  - odEsfera: number
  - odCilindro: number
  - ... (demás campos)
  - createdAt: timestamp
  - updatedAt: timestamp
  - migratedFrom?: "main" (solo para datos migrados)
  - migratedAt?: timestamp (solo para datos migrados)
```

**Nombre del documento:** Auto-generado por Firestore (no más `main` fijo).

---

## 🎨 Nuevo Flujo UX

### ANTES:
```
Lista de clientes → [Crear venta] → Formulario de venta
                  ↓
        [Crear/Editar historial] → Formulario historial
```

### DESPUÉS:
```
Lista de clientes → [Ver historiales] → Lista de historiales del cliente
                                        ├─ [Nuevo historial] → Formulario
                                        ├─ [Usar para venta] → Crear venta
                                        └─ [Editar historial] → Formulario
```

### Botones en lista de clientes:
- ❌ **ELIMINAR:** Botón directo "Crear venta"
- ✅ **NUEVO:** "Ver historiales clínicos"
- ✅ **MANTENER:** "Cobrar deuda"
- ✅ **MANTENER:** "Eliminar cliente" (admin)

### Vista intermedia (seleccionar-historial):
- Lista paginada de historiales del cliente (ordenados por fecha desc)
- Botón "Nuevo historial clínico"
- Acciones por historial:
  - **Usar para venta** → navega a crear-venta con `clienteId` + `historialId`
  - **Editar** → navega a editar historial
  - **Ver detalles** → modal con información completa

---

## 🔧 Cambios Técnicos

### 1. Modelo HistoriaClinica
**Archivo:** `src/app/core/models/historia-clinica.model.ts`

**Cambios:**
```typescript
export interface HistoriaClinica {
  id?: string; // ✅ Mantener (auto-generado)
  clienteId: string;
  
  // ... demás campos existentes ...
  
  createdAt?: any; // ✅ Nuevo (timestamp de creación)
  updatedAt?: any; // ✅ Nuevo (timestamp de última modificación)
  
  // Solo para historiales migrados desde "main"
  migratedFrom?: string; // ✅ Nuevo (valor: "main")
  migratedAt?: any; // ✅ Nuevo (timestamp de migración)
}
```

---

### 2. Servicio HistorialClinicoService
**Archivo:** `src/app/core/services/historial-clinico.service.ts`

#### Métodos NUEVOS:
```typescript
// ✅ Crear nuevo historial (sin ID fijo)
async crearHistorial(
  clienteId: string, 
  data: Omit<HistoriaClinica, 'id' | 'clienteId' | 'createdAt' | 'updatedAt'>
): Promise<string>

// ✅ Actualizar historial específico
async actualizarHistorial(
  clienteId: string,
  historialId: string,
  data: Partial<HistoriaClinica>
): Promise<void>

// ✅ Obtener un historial específico
obtenerHistorialPorId(
  clienteId: string, 
  historialId: string
): Promise<DocumentSnapshot>

// ✅ Listar historiales con paginación
getHistorialesPaginados(
  clienteId: string, 
  limit: number, 
  startAfterDoc?: any
): Observable<HistoriaClinica[]>

// ✅ Contar historiales de un cliente
async contarHistoriales(clienteId: string): Promise<number>
```

#### Métodos DEPRECADOS (mantener temporalmente para compatibilidad):
```typescript
// ⚠️ DEPRECADO: usar crearHistorial()
async guardarHistorial(clienteId: string, data: any): Promise<void>

// ⚠️ DEPRECADO: usar obtenerHistorialPorId()
obtenerHistorial(clienteId: string): Promise<DocumentSnapshot>
```

---

### 3. Nuevo Componente: SeleccionarHistorialComponent
**Ruta:** `src/app/modules/clientes/pages/seleccionar-historial/`

**Responsabilidades:**
- Recibir `clienteId` por query params
- Mostrar lista paginada de historiales clínicos del cliente
- Permitir crear nuevo historial
- Permitir seleccionar historial para crear venta
- Permitir editar historial existente

**Navegación:**
```typescript
// Desde historial-clinico.ts
this.router.navigate(['/clientes/historiales'], {
  queryParams: { clienteId: cliente.id }
});

// Hacia crear-venta
this.router.navigate(['/ventas/crear'], {
  queryParams: { 
    clienteId: this.clienteId,
    historialId: historial.id 
  }
});
```

---

### 4. Actualización en CrearVentaComponent
**Archivo:** `src/app/modules/ventas/crear-venta/crear-venta.ts`

**Cambios:**
```typescript
export class CrearVentaComponent implements OnInit {
  clienteId = '';
  historialId = ''; // ✅ NUEVO: ID del historial seleccionado
  cliente: any = null;
  historial: any = null;
  
  async ngOnInit() {
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || '';
    this.historialId = this.route.snapshot.queryParamMap.get('historialId') || ''; // ✅ NUEVO
    
    if (this.clienteId) {
      await this.cargarCliente();
      
      // ✅ NUEVO: cargar historial específico si existe historialId
      if (this.historialId) {
        await this.cargarHistorialEspecifico();
      }
    }
  }
  
  // ✅ NUEVO: cargar historial por ID
  private async cargarHistorialEspecifico(): Promise<void> {
    const snap = await this.historialSrv.obtenerHistorialPorId(
      this.clienteId, 
      this.historialId
    );
    
    if (snap.exists()) {
      this.historial = { id: snap.id, ...snap.data() };
    }
  }
  
  // Al guardar venta
  async guardarVenta() {
    const factura: Factura = {
      clienteId: this.clienteId,
      historialClinicoId: this.historialId, // ✅ NUEVO
      historialSnapshot: this.historial ? {...this.historial} : null,
      // ... demás campos
    };
  }
}
```

---

### 5. Actualización en Modelo Factura
**Archivo:** `src/app/core/models/factura.model.ts`

**Cambios:**
```typescript
export interface Factura {
  id?: string;
  clienteId: string;
  historialClinicoId?: string; // ✅ NUEVO: ID del historial usado
  historialSnapshot?: any; // ✅ Mantener (snapshot completo)
  
  // ... demás campos existentes
}
```

**Importante:** El campo `historialSnapshot` se mantiene para preservar los datos clínicos al momento de la venta (inmutabilidad histórica).

---

## 📦 Script de Migración

**Archivo:** `GUIAS/migrar-historiales-clinicos.js`

### Características:
- ✅ Recorre todos los clientes activos
- ✅ Detecta documento `historialClinico/main`
- ✅ Crea nuevo documento con ID auto-generado
- ✅ Copia todos los campos existentes
- ✅ Mantiene el timestamp original de `createdAt`
- ✅ Añade metadatos de migración: `migratedFrom` y `migratedAt`
- ✅ Elimina el documento `main` después de migrar (con confirmación)
- ✅ Manejo robusto de errores (continúa con el siguiente cliente)
- ✅ Logging detallado de cada operación
- ✅ Validaciones de seguridad

### Flujo del script:
```
1. Listar todos los clientes activos
2. Por cada cliente:
   a. Verificar si existe historialClinico/main
   b. Si existe:
      - Leer datos completos
      - Crear nuevo documento con ID auto-generado
      - Copiar todos los campos + metadatos
      - Eliminar documento "main"
      - Log: "✅ Migrado: cliente X"
   c. Si no existe:
      - Log: "ℹ️  Sin historial: cliente X"
3. Resumen final:
   - Total clientes procesados
   - Historiales migrados exitosamente
   - Errores encontrados
```

---

## 🚀 Plan de Ejecución

### Fase 1: Preparación (SIN riesgo)
1. ✅ Leer toda esta documentación
2. ✅ Revisar código actual
3. ✅ Hacer backup completo de Firestore
4. ✅ Probar script de migración en entorno de prueba

### Fase 2: Migración de Código (desarrollo)
1. ✅ Actualizar modelo `HistoriaClinica`
2. ✅ Actualizar servicio `HistorialClinicoService`
3. ✅ Crear componente `SeleccionarHistorialComponent`
4. ✅ Actualizar componente `HistorialClinicoComponent`
5. ✅ Actualizar modelo `Factura`
6. ✅ Actualizar `CrearVentaComponent`
7. ✅ Configurar rutas nuevas
8. ✅ Probar todo el flujo en desarrollo

### Fase 3: Migración de Datos (CRÍTICO)
1. ⚠️ **BACKUP OBLIGATORIO** de Firestore
2. ⚠️ Ejecutar script de migración en producción:
   ```bash
   node GUIAS/migrar-historiales-clinicos.js
   ```
3. ⚠️ Verificar logs del script
4. ⚠️ Validar manualmente algunos clientes en Firestore Console
5. ⚠️ Probar creación de venta con historial migrado

### Fase 4: Verificación Post-Migración
- [ ] Verificar que NO existen documentos `main` en Firestore
- [ ] Validar que todos los clientes tienen historiales con ID auto-generado
- [ ] Probar crear nuevo historial clínico
- [ ] Probar crear venta con historial seleccionado
- [ ] Verificar que las ventas guardan `historialClinicoId`
- [ ] Revisar reportes y facturas existentes (no deben romperse)

---

## ⚠️ Consideraciones Importantes

### 1. Compatibilidad hacia atrás
- Las facturas antiguas NO tienen `historialClinicoId` (es opcional)
- El campo `historialSnapshot` mantiene los datos clínicos históricos
- Los reportes deben funcionar con y sin `historialClinicoId`

### 2. Optimización de lecturas
- **ANTES:** Se cargaba `historialClinico/main` de cada cliente en la lista
- **DESPUÉS:** NO se precargan historiales en la lista de clientes
- Los historiales se cargan SOLO al hacer clic en "Ver historiales"
- Paginación con `limit + startAfter` para grandes volúmenes

### 3. Manejo de clientes sin historial
- Si un cliente no tiene historiales:
  - Mostrar mensaje: "Sin historiales clínicos registrados"
  - Botón: "Crear primer historial"
- La venta puede crearse sin historial (para productos sin graduación)

### 4. Seguridad
- El script de migración NO modifica facturas existentes
- Cada cliente mantiene su historial migrado con metadatos
- El proceso es reversible (se puede restaurar desde backup)

---

## 🧪 Pruebas Recomendadas

### Antes de migración:
- [ ] Crear cliente de prueba con historial `main`
- [ ] Crear venta con ese cliente
- [ ] Verificar que la venta tiene `historialSnapshot`

### Después de migración:
- [ ] Verificar que el cliente de prueba tiene historial migrado
- [ ] El historial migrado tiene `migratedFrom: "main"`
- [ ] No existe el documento `main`
- [ ] Crear nuevo historial para el mismo cliente
- [ ] Crear venta seleccionando el nuevo historial
- [ ] Verificar que la venta tiene `historialClinicoId`

### Regresión:
- [ ] Listar facturas antiguas (pre-migración)
- [ ] Imprimir ticket de factura antigua
- [ ] Ver historial snapshot en factura antigua
- [ ] Generar reportes de ventas
- [ ] Cobrar deuda de cliente

---

## 📊 Métricas de Éxito

### Post-Migración:
- ✅ 100% de documentos `main` eliminados
- ✅ 0 errores en script de migración
- ✅ Todos los historiales tienen campo `createdAt`
- ✅ Ventas nuevas incluyen `historialClinicoId`
- ✅ No hay errores en consola de navegador
- ✅ Reportes funcionan correctamente

---

## 🆘 Rollback (en caso de problemas)

Si algo sale mal durante la migración:

1. **DETENER** el script de migración (Ctrl+C)
2. **RESTAURAR** backup de Firestore
3. **REVERTIR** cambios de código en Git:
   ```bash
   git checkout -- .
   ```
4. **ANALIZAR** logs del script para identificar el problema
5. **CORREGIR** el script si es necesario
6. **REPETIR** el proceso de migración

---

## 📝 Notas del Arquitecto

### Decisiones de diseño:
1. **¿Por qué no usar subdocumentos numerados?**
   - IDs auto-generados son más escalables y seguros
   - Evitan colisiones y condiciones de carrera
   
2. **¿Por qué mantener `historialSnapshot` en facturas?**
   - Inmutabilidad: la factura debe reflejar datos exactos al momento de venta
   - Si se modifica un historial, no debe afectar facturas anteriores
   
3. **¿Por qué no migrar automáticamente las facturas?**
   - Las facturas antiguas funcionan perfectamente con `historialSnapshot`
   - Agregar `historialClinicoId` a facturas antiguas requeriría lógica compleja
   - El campo es opcional, las facturas nuevas lo tendrán

4. **¿Por qué componente intermedio en vez de modal?**
   - UX más clara y navegable
   - Permite URLs compartibles
   - Mejor experiencia en móviles
   - Facilita debugging

---

## ✅ Checklist Final

Antes de considerar la migración completa:

- [ ] Código actualizado y probado en desarrollo
- [ ] Script de migración probado en datos de prueba
- [ ] Backup completo de Firestore creado
- [ ] Script ejecutado en producción sin errores
- [ ] Verificación manual de 5-10 clientes aleatorios
- [ ] Pruebas de flujo completo: crear historial → crear venta
- [ ] Pruebas de regresión: facturas antiguas, reportes
- [ ] Documentación actualizada en `.github/copilot-instructions.md`
- [ ] Equipo notificado de los cambios

---

**Fecha de creación:** 8 de febrero de 2026  
**Autor:** Arquitecto de Software Senior  
**Estado:** ✅ Lista para implementación
