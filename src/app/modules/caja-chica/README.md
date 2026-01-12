# 💰 Módulo de Caja Chica

## Descripción

El módulo de Caja Chica es un sistema de gestión de ingresos en efectivo de las compras diarias realizadas. Permite:

- **Abrir cajas chicas** con un monto inicial
- **Registrar movimientos** (ingresos y egresos)
- **Ver historial** de todos los movimientos
- **Cerrar cajas** al final del día
- **Obtener resúmenes** con totales de ingresos, egresos y saldo final

## Características principales

### 1. Listar Cajas Chicas
- Visualizar todas las cajas chicas abiertas y cerradas
- Filtrar por estado (todas, abiertas, cerradas)
- Acciones rápidas: ver detalles, registrar movimientos

### 2. Abrir Nueva Caja
- Especificar fecha de apertura
- Definir monto inicial
- Agregar observaciones opcionales
- El usuario que abre la caja se registra automáticamente

### 3. Registrar Movimientos
- **Tipo**: Ingreso (ventas en efectivo) o Egreso (gastos pequeños)
- **Descripción**: Detalle del movimiento
- **Monto**: Cantidad de dinero
- **Número de Comprobante**: Referencia a factura/ticket (opcional)
- **Observaciones**: Notas adicionales (opcional)

### 4. Ver Detalles de Caja
- Información general de la caja (fecha, estado, usuario)
- Resumen financiero:
  - Monto inicial
  - Saldo actual
  - Total ingresos
  - Total egresos
  - Cantidad de movimientos
- Tabla de movimientos con historial completo
- Opción para eliminar movimientos (solo si caja está abierta)
- Opción para cerrar la caja

## Estructura de carpetas

```
src/app/modules/caja-chica/
├── caja-chica-module.ts          # Módulo principal
├── caja-chica-routing-module.ts  # Rutas del módulo
├── pages/
│   ├── listar-cajas/             # Listado de cajas
│   │   ├── listar-cajas.ts
│   │   ├── listar-cajas.html
│   │   └── listar-cajas.css
│   ├── abrir-caja/               # Apertura de caja
│   │   ├── abrir-caja.ts
│   │   ├── abrir-caja.html
│   │   └── abrir-caja.css
│   ├── ver-caja/                 # Detalles y movimientos
│   │   ├── ver-caja.ts
│   │   ├── ver-caja.html
│   │   └── ver-caja.css
│   └── registrar-movimiento/     # Registrar movimientos
│       ├── registrar-movimiento.ts
│       ├── registrar-movimiento.html
│       └── registrar-movimiento.css
```

## Modelos de datos

### CajaChica
```typescript
interface CajaChica {
  id?: string;                  // ID de Firestore
  fecha: Date;                  // Fecha de apertura
  monto_inicial: number;        // Monto inicial
  monto_actual: number;         // Saldo actual
  estado: 'ABIERTA' | 'CERRADA'; // Estado
  usuario_id?: string;          // ID del usuario que la abrió
  usuario_nombre?: string;      // Nombre del usuario
  observacion?: string;         // Observaciones
  createdAt?: any;              // Timestamp de creación
  updatedAt?: any;              // Timestamp de actualización
  cerrado_en?: any;             // Timestamp de cierre
}
```

### MovimientoCajaChica
```typescript
interface MovimientoCajaChica {
  id?: string;                  // ID de Firestore
  caja_chica_id: string;        // ID de la caja chica
  fecha: Date;                  // Fecha del movimiento
  tipo: 'INGRESO' | 'EGRESO';   // Tipo de movimiento
  descripcion: string;          // Descripción
  monto: number;                // Monto
  saldo_anterior?: number;      // Saldo antes del movimiento
  saldo_nuevo?: number;         // Saldo después del movimiento
  comprobante?: string;         // Referencia a comprobante
  usuario_id?: string;          // ID del usuario
  usuario_nombre?: string;      // Nombre del usuario
  observacion?: string;         // Observaciones
  createdAt?: any;              // Timestamp de creación
}
```

## Servicio (CajaChicaService)

### Métodos principales

#### `getCajasChicas(): Observable<CajaChica[]>`
Obtiene todas las cajas chicas ordenadas por fecha descendente.

#### `getCajasChicasAbiertas(): Observable<CajaChica[]>`
Obtiene solo las cajas chicas con estado "ABIERTA".

#### `getCajaChicaById(id: string): Observable<CajaChica>`
Obtiene una caja chica específica por ID.

#### `getUltimaCajaAbierta(): Promise<CajaChica | null>`
Obtiene la última caja abierta (útil para verificar si hay caja activa).

#### `abrirCajaChica(caja: CajaChica): Promise<string>`
Crea una nueva caja chica. Retorna el ID de la caja creada.

#### `registrarMovimiento(cajaChicaId: string, movimiento: MovimientoCajaChica): Promise<string>`
Registra un movimiento y actualiza automáticamente el saldo de la caja.
- Valida que la caja esté abierta
- Valida que el saldo sea suficiente para egresos
- Actualiza el monto_actual de la caja

#### `getMovimientosCajaChica(cajaChicaId: string): Observable<MovimientoCajaChica[]>`
Obtiene todos los movimientos de una caja, ordenados por fecha descendente.

#### `cerrarCajaChica(cajaChicaId: string, montoFinal?: number): Promise<void>`
Cierra una caja chica y registra la fecha/hora de cierre.

#### `getResumenCajaChica(cajaChicaId: string): Promise<ResumenCajaChica>`
Obtiene un resumen con totales de ingresos, egresos y cantidad de movimientos.

#### `eliminarMovimiento(cajaChicaId: string, movimientoId: string): Promise<void>`
Elimina un movimiento y revierte su efecto en el saldo de la caja.

## Base de datos (Firestore)

### Colecciones

#### `cajas_chicas`
Almacena la información de cada caja chica.

```
cajas_chicas/
├── {cajaId}/
│   ├── fecha: Date
│   ├── monto_inicial: number
│   ├── monto_actual: number
│   ├── estado: string
│   ├── usuario_id: string
│   ├── usuario_nombre: string
│   ├── observacion: string
│   ├── createdAt: Timestamp
│   ├── updatedAt: Timestamp
│   └── cerrado_en: Timestamp
```

#### `movimientos_cajas_chicas`
Almacena todos los movimientos de las cajas chicas.

```
movimientos_cajas_chicas/
├── {movId}/
│   ├── caja_chica_id: string
│   ├── fecha: Date
│   ├── tipo: string (INGRESO|EGRESO)
│   ├── descripcion: string
│   ├── monto: number
│   ├── saldo_anterior: number
│   ├── saldo_nuevo: number
│   ├── comprobante: string
│   ├── usuario_id: string
│   ├── usuario_nombre: string
│   ├── observacion: string
│   └── createdAt: Timestamp
```

## Rutas disponibles

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/caja-chica` | ListarCajasComponent | Listado de todas las cajas |
| `/caja-chica/nueva` | AbrirCajaComponent | Formulario para abrir caja |
| `/caja-chica/ver/:id` | VerCajaComponent | Detalles y movimientos de una caja |
| `/caja-chica/registrar/:id` | RegistrarMovimientoComponent | Registrar movimiento en una caja |

## Permisos de acceso

El módulo está protegido con autenticación y requiere uno de los siguientes roles:
- `OPERADOR`
- `ADMINISTRADOR`

## Casos de uso

### Inicio de día - Abrir Caja Chica
1. Ir a Caja Chica → Abrir Caja
2. Confirmar fecha (por defecto hoy)
3. Ingresar monto inicial (ej: $100.00)
4. Guardar

### Durante el día - Registrar Venta en Efectivo
1. Ir a la caja abierta → Ver Detalles
2. Hacer clic en "Registrar Movimiento"
3. Seleccionar tipo: "Ingreso"
4. Ingresar descripción: "Venta de armazones"
5. Ingresar monto
6. (Opcional) Ingresar número de ticket/factura
7. Guardar

### Durante el día - Registrar Egreso (Gasto pequeño)
1. Ir a la caja abierta → Ver Detalles
2. Hacer clic en "Registrar Movimiento"
3. Seleccionar tipo: "Egreso"
4. Ingresar descripción: "Compra de artículos de limpieza"
5. Ingresar monto
6. (Opcional) Ingresar observaciones
7. Guardar

### Fin de día - Cerrar Caja
1. Ir a la caja abierta → Ver Detalles
2. Revisar el resumen de ingresos/egresos
3. Verificar que el saldo actual sea correcto
4. Hacer clic en "Cerrar Caja"
5. Confirmar

## Validaciones

- **Monto inicial**: Debe ser ≥ 0
- **Egresos**: El monto no puede exceder el saldo actual
- **Descripción**: Requerida, mínimo 3 caracteres
- **Caja**: Debe estar abierta para registrar movimientos
- **Movimientos**: Se valida que la caja exista antes de registrar

## Características de seguridad

- ✓ Autenticación requerida (Firebase Auth)
- ✓ Control de roles (OPERADOR, ADMINISTRADOR)
- ✓ Validación de saldo antes de egresos
- ✓ Registro de usuario en cada operación
- ✓ Timestamps automáticos (Firestore serverTimestamp)
- ✓ Rastreo de cambios (createdAt, updatedAt, cerrado_en)

## Notas de desarrollo

- Los timestamps se registran usando `Timestamp.now()` de `@angular/fire/firestore`
- La información del usuario se obtiene de `SessionService`
- Los movimientos no se pueden registrar en cajas cerradas
- Se pueden eliminar movimientos solo mientras la caja esté abierta
- El saldo de la caja se actualiza automáticamente con cada movimiento
