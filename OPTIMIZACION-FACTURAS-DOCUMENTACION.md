# Optimización de Lista de Facturas - Paginación Real

## ✅ COMPLETADO

### 1. Servicios Optimizados ✅

**`src/app/core/services/facturas.ts`**
- ✅ Agregado método `getFacturasPaginadasReal()` con paginación cursor
- ✅ Soporta `limit()`, `startAfter()`, `endBefore()`, `limitToLast()`
- ✅ Búsqueda optimizada (solo trae todos cuando hay término de búsqueda)
- ✅ Filtro por tipo de factura (TODAS, NORMALES, COBROS_DEUDA)

**`src/app/core/services/facturas-deuda.service.ts`**
- ✅ Agregado método `getPagosDeudaPaginadosReal()` con paginación cursor
- ✅ Mismo patrón optimizado que `getFacturasPaginadasReal()`
- ✅ B\u00fasqueda optimizada en múltiples campos

## 🔧 PENDIENTE - Componente (Manual)

El componente `src/app/modules/factura/pages/listar-facturas/listar-facturas.ts` debe modificarse siguiendo el patrón de `src/app/modules/productos/pages/listar-productos/listar-productos.ts`.

### Cambios Necesarios:

#### 1. Imports

```typescript
// ❌ ELIMINAR
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { combineLatest } from 'rxjs';

// ✅ AGREGAR
import { DocumentSnapshot } from '@angular/fire/firestore';
```

#### 2. Propiedades de Clase

```typescript
export class ListarFacturasComponent {
  // 🚀 NUEVAS PROPIEDADES (agregar)
  lastVisible: DocumentSnapshot | null = null;
  firstVisible: DocumentSnapshot | null = null;
  hasMore: boolean = false;
  isLoading: boolean = false;
  paginasHistorial: Array<{
    firstDoc: DocumentSnapshot | null;
    lastDoc: DocumentSnapshot | null;
    pageNumber: number;
  }> = [];

  // ❌ ELIMINAR estas propiedades:
  // facturas: any[] = [];
  // filtradas: any[] = [];
  
  // Las demás propiedades se mantienen igual
}
```

#### 3. Constructor - Reemplazar Completo

```typescript
constructor(
  private facturasSrv: FacturasService,
  private facturasDeudaSrv: FacturasDeudaService,
  private router: Router,
  private productosSrv: ProductosService,
  private cajaChicaSrv: CajaChicaService,
  // ❌ ELIMINAR esta línea:
  // private cajaBancoSrv: CajaBancoService,
  private authService: AuthService
) {
  this.verificarCajaAbierta();
  
  // ❌ ELIMINAR todo el bloque de combineLatest()
  // ✅ AGREGAR:
  this.cargarPrimeraPage();
}
```

#### 4. Nuevo Método `cargarPrimeraPage()`

```typescript
private async cargarPrimeraPage(): Promise<void> {
  this.isLoading = true;
  this.paginaActual = 1;
  this.paginasHistorial = [];
  
  try {
    // Cargar facturas normales
    const resultadoFacturas = await this.facturasSrv.getFacturasPaginadasReal({
      pageSize: this.facturasPorPagina,
      terminoBusqueda: this.term,
      filtroTipoFactura: this.filtroTipoFactura
    });

    // Cargar pagos de deuda
    const resultadoPagos = await this.facturasDeudaSrv.getPagosDeudaPaginadosReal({
      pageSize: this.facturasPorPagina,
      terminoBusqueda: this.term
    });

    // Combinar y convertir
    const facturasNormales = resultadoFacturas.facturas.map(f => ({
      ...f,
      total: Number(f?.total || 0),
      saldoPendiente: Number(f?.saldoPendiente || 0),
      tipoFactura: f.tipoFactura || 'NORMAL'
    }));

    const facturasDeudaConvertidas = resultadoPagos.pagos.map((deuda: any) => ({
      id: deuda.facturaIdPersonalizado || deuda.id,
      idPersonalizado: deuda.facturaIdPersonalizado || deuda.id,
      clienteNombre: deuda.clienteNombre || '',
      clienteTelefono: deuda.clienteTelefono || '',
      clienteId: deuda.clienteId || '',
      fecha: deuda.fechaPago || new Date(),
      total: Number(deuda.totalFactura || 0),
      abonado: Number(deuda.abonadoNuevo || 0),
      saldoPendiente: Number(deuda.saldoNuevo || 0),
      metodoPago: deuda.metodoPago || '',
      items: deuda.items || [],
      esCredito: deuda.esCreditoPersonal || false,
      estadoPago: (Number(deuda.saldoNuevo || 0) <= 0) ? 'PAGADA' : 'PENDIENTE',
      tipoFactura: 'COBRO_DEUDA',
      usuarioId: deuda.usuarioId || '',
      usuarioNombre: deuda.usuarioNombre || '',
      createdAt: deuda.createdAt || new Date(),
      updatedAt: deuda.updatedAt || new Date(),
      origenCaja: deuda.origenCaja || '',
      cajaChicaId: deuda.cajaChicaId || ''
    }));

    // Combinar y ordenar
    const todasFacturas = [...facturasNormales, ...facturasDeudaConvertidas];
    todasFacturas.sort((a, b) => this.getFechaMs(b) - this.getFechaMs(a));

    this.facturasPaginadas = todasFacturas.slice(0, this.facturasPorPagina);
    this.hasMore = resultadoFacturas.hasMore || resultadoPagos.hasMore;
    this.lastVisible = resultadoFacturas.lastDoc;
    this.firstVisible = resultadoFacturas.firstDoc;
    
    if (resultadoFacturas.firstDoc) {
      this.paginasHistorial.push({
        firstDoc: resultadoFacturas.firstDoc,
        lastDoc: resultadoFacturas.lastDoc,
        pageNumber: 1
      });
    }
    
    this.totalFacturas = this.facturasPaginadas.length;
    
  } catch (error) {
    console.error('Error al cargar facturas:', error);
    Swal.fire('Error', 'No se pudieron cargar las facturas', 'error');
  } finally {
    this.isLoading = false;
  }
}
```

####5. Modificar Método `filtrar()`

```typescript
// ❌ REEMPLAZAR completamente el método filtrar() actual
async filtrar(): Promise<void> {
  await this.cargarPrimeraPage();
}
```

#### 6. Modificar `paginaSiguiente()` y `paginaAnterior()`

Consultar el archivo `src/app/modules/productos/pages/listar-productos/listar-productos.ts` líneas 181-280 para referencia completa.

## 📊 Resultados Esperados

### Antes (Sin Optimización):
- ❌ Carga TODAS las facturas de Firestore al inicio
- ❌ Mantiene todas en memoria todo el tiempo
- ❌ Paginación solo en cliente (slice de array)
- ❌ Consumo alto de lecturas Firestore
- ❌ Lento con >1000 facturas

### Después (Con Optimización):
- ✅ Carga solo 10 facturas visibles  
- ✅ Navega con cursores (startAfter/endBefore)
- ✅ Libera memoria de páginas no visibles
- ✅ Reduce lecturas Firestore en ~90%
- ✅ Rendimiento constante con miles de facturas

## 🎯 Instrucciones de Implementación Manual

1. Hacer backup del archivo actual:
   ```bash
   copy "src\app\modules\factura\pages\listar-facturas\listar-facturas.ts" "src\app\modules\factura\pages\listar-facturas\listar-facturas.ts.backup"
   ```

2. Abrir ambos archivos lado a lado:
   - `src/app/modules/productos/pages/listar-productos/listar-productos.ts` (referencia)
   - `src/app/modules/factura/pages/listar-facturas/listar-facturas.ts` (a modificar)

3. Aplicar cambios siguiendo los puntos 1-6 anteriores

4. Mantener TODA la lógica de negocio existente:
   - `verificarCajaAbierta()`
   - `puedeEditarEliminar()`
   - `eliminarFactura()`
   - `editarFactura()`
   - `cobrarDeuda()`
   - `ver()`
   - `nuevaVenta()`

5. Probar navegación de páginas y búsqueda

## ⚠️ IMPORTANTE

- **NO modificar** la lógica de edición/eliminación
- **NO modificar** los permisos por rol de usuario
- **NO modificar** el template HTML
- **SOLO** cambiar cómo se cargan/navegan las facturas

## 📚 Archivos de Referencia

1. **Productos (paginación optimizada)**:
   - `src/app/modules/productos/pages/listar-productos/listar-productos.ts`
   - Líneas 81-280: Paginación completa

2. **Cajas Chicas (mismo patrón)**:
   - `src/app/modules/caja-chica/pages/listar-cajas/listar-cajas.ts`

---

**Estado**: ✅ Servicios listos | ⏳ Componente pendiente implementación manual

**Fecha**: {{fecha}}
