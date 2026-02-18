# Implementación Multi-Sucursal - Sistema Completo

## 📋 Resumen

Este documento detalla la implementación completa del sistema multi-sucursal para la aplicación de óptica.

## 🏗️ Arquitectura

### Componentes Creados

1. **`sucursal-constants.ts`**: Constantes y tipos TypeScript
2. **`sucursal-context.service.ts`**: Gestiona la sucursal seleccionada
3. **`sucursal-query-helper.service.ts`**: Helper para filtros en Firestore

### Flujo de Datos

```
Usuario (ADMIN/OPERADOR)
        ↓
SucursalContextService
    (mantiene sucursal activa)
        ↓
SucursalQueryHelperService
    (aplica filtros a queries)
        ↓
Servicios Firestore
    (cajas, facturas, clientes, etc.)
        ↓
Firestore (con sucursalId)
```

---

## 🔧 Cómo Modificar Servicios Firestore Existentes

### Patrón General

Todos los servicios que consultan Firestore deben:

1. **Inyectar el helper**:
```typescript
private sucursalHelper = inject(SucursalQueryHelperService);
```

2. **Para consultas READ (getAll, getList, etc.)**:
```typescript
// ANTES
getFacturas(): Observable<Factura[]> {
  const q = query(this.facturasRef, orderBy('fecha', 'desc'));
  return collectionData(q, { idField: 'id' });
}

// DESPUÉS
getFacturas(): Observable<Factura[]> {
  const q = this.sucursalHelper.agregarFiltroSucursal(
    this.facturasRef,
    orderBy('fecha', 'desc')
  );
  return collectionData(q, { idField: 'id' });
}
```

3. **Para consultas con paginación**:
```typescript
// ANTES
getFacturasPaginadas(pageSize: number = 50): Observable<Factura[]> {
  const q = query(this.facturasRef, orderBy('fecha', 'desc'), limit(pageSize));
  return collectionData(q, { idField: 'id' });
}

// DESPUÉS
getFacturasPaginadas(pageSize: number = 50): Observable<Factura[]> {
  // Si es "TODAS", usar límite; si es sucursal específica, usar filtro
  const q = this.sucursalHelper.agregarFiltroConLimite(
    this.facturasRef,
    pageSize,
    orderBy('fecha', 'desc')
  );
  return collectionData(q, { idField: 'id' });
}
```

4. **Para operaciones CREATE**:
```typescript
// ANTES
async crearFactura(factura: Partial<Factura>): Promise<void> {
  const docRef = doc(this.facturasRef, facturaId);
  await setDoc(docRef, {
    ...factura,
    fecha: new Date()
  });
}

// DESPUÉS
async crearFactura(factura: Partial<Factura>): Promise<void> {
  const docRef = doc(this.facturasRef, facturaId);
  await setDoc(docRef, {
    ...factura,
    ...this.sucursalHelper.getSucursalParaDocumento(), // ✅ Agrega sucursalId y sucursalNombre
    fecha: new Date()
  });
}
```

---

## 📝 Ejemplo Completo: CajaBancoService

### Modificaciones Necesarias

```typescript
import { inject, Injectable } from '@angular/core';
import { SucursalQueryHelperService } from './sucursal-query-helper.service';

@Injectable({
  providedIn: 'root',
})
export class CajaBancoService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private sucursalHelper = inject(SucursalQueryHelperService); // ✅ NUEVO

  /**
   * Obtener todas las cajas banco (filtradas por sucursal)
   */
  getCajasBanco(): Observable<CajaBanco[]> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    
    // ✅ MODIFICADO: Agregar filtro de sucursal
    const q = this.sucursalHelper.agregarFiltroSucursal(
      cajasRef,
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map((cajas: any[]) => {
        return (cajas || []).filter(c => c.activo !== false);
      })
    ) as Observable<CajaBanco[]>;
  }

  /**
   * Crear nueva caja banco
   */
  async crearCajaBanco(datos: Partial<CajaBanco>): Promise<string> {
    const cajasRef = collection(this.firestore, 'cajas_banco');
    
    // ✅ MODIFICADO: Agregar sucursalId y sucursalNombre automáticamente
    const docRef = await addDoc(cajasRef, {
      ...datos,
      ...this.sucursalHelper.getSucursalParaDocumento(), // ✅ NUEVO
      activo: true,
      createdAt: new Date()
    });
    
    return docRef.id;
  }

  /**
   * Obtener movimientos de una caja (también filtrados por sucursal)
   */
  getMovimientosCaja(cajaId: string): Observable<MovimientoCajaBanco[]> {
    const movimientosRef = collection(
      this.firestore, 
      `cajas_banco/${cajaId}/movimientos`
    );
    
    // ✅ MODIFICADO: Los movimientos también tienen sucursalId
    const q = this.sucursalHelper.agregarFiltroSucursal(
      movimientosRef,
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }) as Observable<MovimientoCajaBanco[]>;
  }
}
```

---

## 📝 Ejemplo Completo: FacturasService

```typescript
import { inject, Injectable } from '@angular/core';
import { SucursalQueryHelperService } from './sucursal-query-helper.service';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private fs = inject(Firestore);
  private sucursalHelper = inject(SucursalQueryHelperService); // ✅ NUEVO
  
  private facturasRef = collection(this.fs, 'facturas');

  /**
   * Obtener facturas (con filtro de sucursal)
   */
  getFacturas(): Observable<Factura[]> {
    // ✅ MODIFICADO: Agregar filtro de sucursal
    const q = this.sucursalHelper.agregarFiltroConLimite(
      this.facturasRef,
      100, // Límite si es "TODAS"
      orderBy('fecha', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }) as Observable<Factura[]>;
  }

  /**
   * Crear factura
   */
  async crearFactura(factura: Omit<Factura, 'id'>): Promise<string> {
    const idPersonalizado = await this.generarIdSecuencial();
    const docRef = doc(this.facturasRef, idPersonalizado);
    
    // ✅ MODIFICADO: Agregar sucursalId y sucursalNombre
    await setDoc(docRef, {
      ...factura,
      ...this.sucursalHelper.getSucursalParaDocumento(), // ✅ NUEVO
      idPersonalizado,
      fecha: Timestamp.fromDate(factura.fecha as Date)
    });

    return docRef.id;
  }

  /**
   * Buscar facturas por cliente (mantiene filtro de sucursal)
   */
  async buscarFacturasPorCliente(clienteId: string): Promise<Factura[]> {
    const sucursalId = this.sucursalHelper.getSucursalIdActual();
    
    let q;
    if (sucursalId) {
      // Filtro por cliente Y sucursal
      q = query(
        this.facturasRef,
        where('clienteId', '==', clienteId),
        where('sucursalId', '==', sucursalId)
      );
    } else {
      // Solo por cliente (si es TODAS)
      q = query(
        this.facturasRef,
        where('clienteId', '==', clienteId),
        limit(100) // ✅ Límite para "TODAS"
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Factura));
  }
}
```

---

## 📝 Ejemplo Completo: ClientesService

**IMPORTANTE**: Los clientes pueden compartirse entre sucursales, pero el historial clínico es POR SUCURSAL.

```typescript
import { inject, Injectable } from '@angular/core';
import { SucursalQueryHelperService } from './sucursal-query-helper.service';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private firestore = inject(Firestore);
  private sucursalHelper = inject(SucursalQueryHelperService); // ✅ NUEVO
  
  /**
   * Obtener clientes
   * CLIENTES NO se filtran por sucursal (son globales)
   */
  getClientes(): Observable<Cliente[]> {
    const q = query(
      this.clientesRef, 
      where('activo', '!=', false)
    );
    return collectionData(q, { idField: 'id' }) as Observable<Cliente[]>;
  }

  /**
   * Crear cliente (sin sucursalId, son globales)
   */
  async crearCliente(cliente: Partial<Cliente>): Promise<string> {
    const docRef = await addDoc(this.clientesRef, {
      ...cliente,
      activo: true,
      createdAt: new Date()
      // ❌ NO agregar sucursalId aquí
    });
    return docRef.id;
  }
}
```

---

## 📝 Ejemplo: HistorialClinicoService

```typescript
import { inject, Injectable } from '@angular/core';
import { SucursalQueryHelperService } from './sucursal-query-helper.service';

@Injectable({ providedIn: 'root' })
export class HistorialClinicoService {
  private fs = inject(Firestore);
  private sucursalHelper = inject(SucursalQueryHelperService); // ✅ NUEVO

  /**
   * Crear historial clínico (siempre con sucursalId)
   */
  async crearHistorial(clienteId: string, datos: any): Promise<string> {
    const historialRef = collection(
      this.fs, 
      `clientes/${clienteId}/historialClinico`
    );
    
    // ✅ AGREGAR sucursalId y sucursalNombre
    const docRef = await addDoc(historialRef, {
      ...datos,
      ...this.sucursalHelper.getSucursalParaDocumento(), // ✅ NUEVO
      createdAt: new Date()
    });
    
    return docRef.id;
  }

  /**
   * Obtener historiales de un cliente (filtrado por sucursal)
   */
  getHistorialesPorCliente(clienteId: string): Observable<HistoriaClinica[]> {
    const historialRef = collection(
      this.fs, 
      `clientes/${clienteId}/historialClinico`
    );
    
    // ✅ Filtrar por sucursal
    const q = this.sucursalHelper.agregarFiltroSucursal(
      historialRef,
      orderBy('createdAt', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }) as Observable<HistoriaClinica[]>;
  }
}
```

---

## 🎨 Componente Selector de Sucursal

### Servicio en TypeScript

Ahora crearemos un componente standalone que muestre el selector.

**Ubicación recomendada**: `src/app/shared/components/selector-sucursal/`

---

## ✅ Checklist de Implementación

### Servicios a Modificar (completar uno por uno):

- [ ] `caja-banco.service.ts` ✅
- [ ] `caja-chica.service.ts` ✅
- [ ] `facturas.ts` ✅
- [ ] `facturas-deuda.service.ts` ✅
- [ ] `historial-clinico.service.ts` ✅
- [ ] `ingresos.service.ts` ✅
- [ ] `productos.ts` (movimientos de stock) ✅
- [ ] `ventas-tarjeta.service.ts` ✅
- [ ] `cobros.service.ts` ✅
- [ ] `ventas.service.ts` ✅

### Servicios que NO necesitan filtro:
- `clientes.ts` - Clientes son globales
- `proveedores.ts` - Proveedores son globales
- `sucursales.service.ts` - Gestión de sucursales
- `auth.service.ts` - Autenticación

---

## 📦 Resumen de Cambios

### Nuevos Archivos
1. `src/app/core/models/sucursal-constants.ts`
2. `src/app/core/services/sucursal-context.service.ts`
3. `src/app/core/services/sucursal-query-helper.service.ts`

### Patrón de Modificación

**Para cada servicio Firestore:**

1. Importar e inyectar:
```typescript
import { SucursalQueryHelperService } from './sucursal-query-helper.service';
private sucursalHelper = inject(SucursalQueryHelperService);
```

2. Modificar queries READ:
```typescript
const q = this.sucursalHelper.agregarFiltroSucursal(collectionRef, ...constraints);
```

3. Modificar CREATE:
```typescript
await setDoc(docRef, {
  ...datos,
  ...this.sucursalHelper.getSucursalParaDocumento()
});
```

---

## 🚀 Próximos Pasos

1. ✅ Crear componente UI selector de sucursal
2. ✅ Integrar en app-header o toolbar
3. ✅ Modificar servicios siguiendo el patrón
4. ✅ Probar con usuarios ADMIN y OPERADOR
5. ✅ Validar que Firestore rules funcionan correctamente

---

## 🔐 Validación de Seguridad

El frontend implementa filtros pero **Firestore Rules son la seguridad real**:

```javascript
// Firestore Rules (ya implementadas)
match /facturas/{facturaId} {
  allow read: if isAuthenticated() && 
    (isAdmin() || resource.data.sucursalId == getUserSucursal());
  
  allow create: if isAuthenticated() && 
    request.resource.data.sucursalId == getUserSucursal();
}
```

El frontend solo facilita la UX, la seguridad está en el backend (Firestore).

---

## 📞 Soporte

Para dudas sobre la implementación:
- Revisar ejemplos en este documento
- Verificar que `sucursalId` existe en los documentos de Firestore
- Confirmar que Firestore rules permiten las operaciones

---

**Fecha**: 18 de febrero de 2026  
**Versión**: 1.0  
**Estado**: ✅ Arquitectura completada - Pendiente implementación en servicios específicos
