# Módulo de Cuentas - Sistema de Gestión de Deudas

## 📋 Descripción General

El módulo de **Cuentas** centraliza el control de deudas en el sistema, permitiendo gestionar tanto las cuentas por pagar (deudas que tenemos con terceros) como las cuentas por cobrar (deudas que terceros tienen con nosotros).

## 🎯 Características Principales

### Cuentas por Pagar
- ✅ Registro de deudas que tenemos con terceros
- ✅ Al registrar: **SUMA** el monto a caja/banco (recibimos dinero prestado)
- ✅ Al pagar: **DESCUENTA** el monto de caja/banco (devolvemos dinero)
- ✅ Permite pagos parciales
- ✅ Actualización automática de saldos
- ✅ Marca como cancelada cuando saldo = 0

### Cuentas por Cobrar
- ✅ Registro de deudas que nos deben terceros
- ✅ Al registrar: **DESCUENTA** el monto de caja/banco (prestamos dinero)
- ✅ Al cobrar: **SUMA** el monto a caja/banco (nos devuelven dinero)
- ✅ Permite abonos parciales
- ✅ Actualización automática de saldos
- ✅ Marca como cancelada cuando saldo = 0

## 🗂️ Estructura de Archivos

```
src/app/
├── core/
│   ├── models/
│   │   └── cuenta.model.ts           # Modelo de datos
│   └── services/
│       └── cuentas.service.ts        # Servicio principal
└── modules/
    └── cuentas/
        ├── pages/
        │   ├── cuentas-por-pagar/
        │   │   ├── cuentas-por-pagar.ts
        │   │   ├── cuentas-por-pagar.html
        │   │   └── cuentas-por-pagar.css
        │   └── cuentas-por-cobrar/
        │       ├── cuentas-por-cobrar.ts
        │       ├── cuentas-por-cobrar.html
        │       └── cuentas-por-cobrar.css
        ├── cuentas-module.ts
        └── cuentas-routing-module.ts
```

## 📊 Modelo de Datos

### Interfaz `Cuenta`

```typescript
interface Cuenta {
  id?: string;                  // ID único de Firestore
  fecha: Date;                  // Fecha de creación
  tipo: TipoCuenta;             // PAGAR o COBRAR
  montoTotal: number;           // Monto total inicial
  montoAbonado: number;         // Monto total abonado
  saldo: number;                // Saldo pendiente (montoTotal - montoAbonado)
  estado: EstadoCuenta;         // ACTIVA o CANCELADA
  observacion: string;          // Descripción o motivo
  abonos?: AbonoCuenta[];       // Historial de abonos
  fechaModificacion?: Date;     // Última modificación
}
```

### Enumeraciones

```typescript
enum TipoCuenta {
  PAGAR = 'PAGAR',
  COBRAR = 'COBRAR'
}

enum EstadoCuenta {
  ACTIVA = 'ACTIVA',
  CANCELADA = 'CANCELADA'
}
```

## 🔄 Flujo de Operaciones

### Registrar Cuenta por Pagar

1. Usuario ingresa monto y observación
2. Sistema crea cuenta con estado ACTIVA
3. **Sistema SUMA el monto a caja/banco** (movimiento de tipo OTRO_INGRESO)
4. Cuenta queda registrada con saldo = montoTotal

### Pagar Cuenta

1. Usuario selecciona cuenta activa
2. Ingresa monto del pago (parcial o total)
3. **Sistema DESCUENTA el monto de caja/banco** (movimiento de tipo OTRO_EGRESO)
4. Se actualiza el saldo: `saldo = saldo - montoPago`
5. Se registra el abono en el historial
6. Si saldo = 0, se marca como CANCELADA

### Registrar Cuenta por Cobrar

1. Usuario ingresa monto y observación
2. Sistema crea cuenta con estado ACTIVA
3. **Sistema DESCUENTA el monto de caja/banco** (movimiento de tipo OTRO_EGRESO)
4. Cuenta queda registrada con saldo = montoTotal

### Cobrar Cuenta

1. Usuario selecciona cuenta activa
2. Ingresa monto del cobro (parcial o total)
3. **Sistema SUMA el monto a caja/banco** (movimiento de tipo OTRO_INGRESO)
4. Se actualiza el saldo: `saldo = saldo - montoCobro`
5. Se registra el abono en el historial
6. Si saldo = 0, se marca como CANCELADA

## 🔐 Permisos

**Acceso:** Operadores y Administradores

Ambos roles pueden:
- Registrar cuentas por pagar y cobrar
- Realizar pagos/cobros
- Ver listados y filtrar por estado
- Consultar historial de abonos

## 🛣️ Rutas

```typescript
/cuentas              → Redirecciona a /cuentas/pagar
/cuentas/pagar        → Gestión de cuentas por pagar
/cuentas/cobrar       → Gestión de cuentas por cobrar
```

## 📱 Integración con el Sistema

### Sidebar

El módulo aparece en el sidebar con un menú desplegable:

```
Cuentas
  ├── Cuentas por Pagar
  └── Cuentas por Cobrar
```

### Caja/Banco

Todas las operaciones impactan **automáticamente** en caja/banco:
- Se valida que exista una caja banco ABIERTA antes de registrar movimientos
- Los movimientos quedan registrados en `movimientos_cajas_banco`
- Se actualiza el saldo de la caja banco actual

## 🎨 Interfaz de Usuario

### Características UI
- ✅ Diseño consistente con el resto del sistema
- ✅ Usa variables CSS del tema actual (claro/oscuro)
- ✅ Formularios con validación en tiempo real
- ✅ Tablas con filtros por estado
- ✅ Resumen de totales y cuentas activas
- ✅ Modales para ver detalles e historial
- ✅ Sin colores especiales, solo texto plano y badges

### Componentes Visuales
- **Header**: Título, subtítulo y botón de nueva cuenta
- **Resumen**: Cards con total pendiente, cuentas activas y total de cuentas
- **Filtros**: Botones para filtrar por TODAS / ACTIVAS / CANCELADAS
- **Tabla**: Listado con fecha, observación, montos, saldo, estado y acciones
- **Acciones**: Ver detalles (ícono ojo) y Registrar pago/cobro (ícono $)

## 🔧 Métodos Principales del Servicio

### CuentasService

```typescript
// Consultas
getCuentas(): Observable<Cuenta[]>
getCuentasPorTipo(tipo: TipoCuenta): Observable<Cuenta[]>
getCuentasPorEstado(tipo: TipoCuenta, estado: EstadoCuenta): Observable<Cuenta[]>
getCuenta(id: string): Observable<Cuenta | undefined>
getTotalCuentasActivas(tipo: TipoCuenta): Observable<number>

// Operaciones
registrarCuenta(cuenta: Omit<Cuenta, 'id' | 'montoAbonado' | 'saldo' | 'estado' | 'abonos'>): Promise<string>
registrarAbono(cuentaId: string, monto: number, observacion?: string): Promise<void>
```

## 📝 Firestore

### Colección: `cuentas`

```json
{
  "fecha": Timestamp,
  "tipo": "PAGAR" | "COBRAR",
  "montoTotal": number,
  "montoAbonado": number,
  "saldo": number,
  "estado": "ACTIVA" | "CANCELADA",
  "observacion": string,
  "abonos": [
    {
      "fecha": Timestamp,
      "monto": number,
      "observacion": string,
      "saldoRestante": number
    }
  ],
  "fechaModificacion": Timestamp
}
```

### Reglas de Seguridad (Recomendadas)

```javascript
match /cuentas/{cuentaId} {
  // Permitir lectura a usuarios autenticados
  allow read: if request.auth != null;
  
  // Permitir escritura solo a operadores y administradores
  allow create, update: if request.auth != null 
    && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol in ['OPERADOR', 'ADMINISTRADOR'];
  
  // No permitir eliminación física (usar soft delete si es necesario)
  allow delete: if false;
}
```

## ⚠️ Consideraciones Importantes

1. **Caja Banco Abierta**: Debe existir una caja banco abierta para registrar movimientos
2. **Validación de Montos**: Los abonos no pueden exceder el saldo pendiente
3. **Estados Automáticos**: El estado CANCELADA se asigna automáticamente cuando saldo = 0
4. **Historial Completo**: Todos los abonos quedan registrados con fecha, monto y observación
5. **Sin Sucursales**: Este módulo no maneja sucursales específicas

## 🚀 Próximas Mejoras Sugeridas

- [ ] Agregar filtros por fecha
- [ ] Exportar listados a Excel
- [ ] Imprimir comprobantes de pago/cobro
- [ ] Notificaciones de cuentas próximas a vencer
- [ ] Gráficos de evolución de deudas
- [ ] Asociar cuentas con clientes o proveedores específicos
- [ ] Agregar campo de fecha de vencimiento
- [ ] Calcular intereses automáticos

## 📞 Soporte

Para dudas o problemas con el módulo de Cuentas, consultar:
- Documentación técnica en archivos del proyecto
- README principal del proyecto
- Instrucciones de Copilot en `.github/copilot-instructions.md`

---

**Versión:** 1.0.0  
**Fecha:** Febrero 2026  
**Autor:** Sistema de Gestión Óptica Macias
