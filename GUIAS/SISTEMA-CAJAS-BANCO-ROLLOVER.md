# Sistema de Cajas Banco con Rollover Automático

## 📋 Descripción General

El sistema de **Cajas Banco** es un contenedor mensual para seguimiento de ingresos y egresos. Cada mes se abre una nueva caja banco que hereda automáticamente el saldo final del mes anterior, creando una cadena de saldos continuos.

## 🔄 Flujo del Sistema

### 1️⃣ Crear Primera Caja Banco (Mes 1)
```typescript
// Usuario abre "Crear Caja Banco" desde listar-cajas
// Proporciona: saldo_inicial (ej: $1000)

abrirCajaBanco({
  fecha: 2025-01-01,
  saldo_inicial: 1000,    // <- Usuario especifica
  saldo_actual: 1000,
  estado: 'ABIERTA'
})
```

### 2️⃣ Durante el Mes
- Se registran movimientos (INGRESOS/EGRESOS) asociados a esta caja
- `saldo_actual` se actualiza cada vez
- Al final del mes: `saldo_actual = saldo_inicial + ingresos - egresos`

**Ejemplo**: 
- Saldo inicial: $1000
- Ingresos: +$500
- Egresos: -$200
- Saldo final: $1300

### 3️⃣ Cerrar Mes (Usuario hace clic en "Cerrar Mes")

```typescript
// En ver-caja, usuario confirma "Cerrar Mes"
await cerrarMesCompleto(2025, 0); // Año 2025, Mes 0 (Enero)
```

El sistema ejecuta:

#### Paso A: Obtiene la caja ABIERTA del mes
```typescript
WHERE fecha >= 2025-01-01 AND fecha < 2025-02-01 AND estado = 'ABIERTA'
→ Obtiene la caja con saldo_actual = $1300
```

#### Paso B: Cierra la caja
```typescript
UPDATE cajas_banco SET estado = 'CERRADA' WHERE id = '...'
→ La caja ENERO ahora está CERRADA con saldo_actual = $1300
```

#### Paso C: Crea automáticamente nueva caja para FEBRERO
```typescript
abrirCajaBanco({
  fecha: 2025-02-01,
  saldo_inicial: 1300,  // <- Hereda del mes anterior AUTOMÁTICAMENTE
  saldo_actual: 1300,
  estado: 'ABIERTA'
})
```

### 4️⃣ Febrero Comienza
- Nueva caja ABIERTA con `saldo_inicial = $1300`
- Los movimientos de febrero se registran contra esta caja
- Si hay ingresos/egresos, `saldo_actual` se actualiza
- Al final de febrero: `saldo_actual = 1300 + ingresos_febrero - egresos_febrero`

### 5️⃣ Patrón Continuo
```
Enero:    saldo_inicial = $1000   → ... → saldo_actual = $1300 (CERRADA)
Febrero:  saldo_inicial = $1300   → ... → saldo_actual = $1450 (Ej. con +$150 neto)
Marzo:    saldo_inicial = $1450   → ... → saldo_actual = $1600 (Ej. con +$150 neto)
...
```

## 🛠️ Lógica de Código

### `abrirCajaBanco(caja: CajaBanco)`

```typescript
async abrirCajaBanco(caja: CajaBanco): Promise<string> {
  // 1. Normalizar fecha a medianoche
  const fechaNormalizada = new Date(caja.fecha);
  fechaNormalizada.setHours(0, 0, 0, 0);
  
  // 2. Buscar caja existente para EL MISMO DÍA
  const qMismoDia = query(
    cajasRef,
    where('fecha', '>=', fechaNormalizada),
    where('fecha', '<', new Date(fechaNormalizada.getTime() + 86400000))
  );
  const snapMismoDia = await getDocs(qMismoDia);
  
  // Si ya existe caja para hoy → actualizar
  if (!snapMismoDia.empty) {
    await updateDoc(...); // Actualizar la existente
    return cajaExistente.id;
  }
  
  // 3. Determinar saldo_inicial
  let saldoInicial = caja.saldo_inicial !== undefined 
    ? caja.saldo_inicial    // <- Si se proporciona explícitamente, usarlo
    : undefined;
  
  // Si NO se proporciona → intentar heredar del mes anterior
  if (saldoInicial === undefined) {
    const mesAnterior = new Date(fechaNormalizada);
    mesAnterior.setMonth(mesAnterior.getMonth() - 1);
    
    const inicioMesAnterior = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1);
    const inicioMesActual = new Date(fechaNormalizada.getFullYear(), fechaNormalizada.getMonth(), 1);
    
    // Buscar cajas CERRADAS del mes anterior
    const qMesAnterior = query(
      cajasRef,
      where('fecha', '>=', inicioMesAnterior),
      where('fecha', '<', inicioMesActual),
      where('estado', '==', 'CERRADA')
    );
    
    const snapMesAnterior = await getDocs(qMesAnterior);
    if (!snapMesAnterior.empty) {
      // Obtener la más reciente (última del mes anterior)
      const cajasOrdenadas = snapMesAnterior.docs
        .map(doc => doc.data() as CajaBanco)
        .sort((a, b) => (b.fecha as any).toMillis() - (a.fecha as any).toMillis());
      
      // Usar su saldo_actual como saldo_inicial de la nueva
      if (cajasOrdenadas.length > 0) {
        saldoInicial = cajasOrdenadas[0].saldo_actual || 0;
      }
    }
  }
  
  // Si aún no hay saldo → usar 0
  if (saldoInicial === undefined) {
    saldoInicial = 0;
  }
  
  // 4. Crear nueva caja con saldo_inicial determinado
  const nuevaCaja: CajaBanco = {
    fecha: fechaNormalizada,
    saldo_inicial: saldoInicial,     // <- Final del mes anterior O valor proporcionado
    saldo_actual: saldoInicial,
    estado: 'ABIERTA',
    usuario_id: caja.usuario_id,
    usuario_nombre: caja.usuario_nombre,
    observacion: caja.observacion || '',
    activo: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  const docRef = await addDoc(cajasRef, nuevaCaja);
  return docRef.id;
}
```

**Lógica de decisión de `saldo_inicial`**:
1. ✅ Si `caja.saldo_inicial` se proporciona explícitamente → **USAR ESE VALOR**
2. ❌ Si NO se proporciona → Buscar mes anterior cerrado → **HEREDAR su `saldo_actual`**
3. ❌ Si no hay mes anterior → **USAR 0**

### `cerrarMesCompleto(year: number, monthIndex: number)`

```typescript
async cerrarMesCompleto(year: number, monthIndex0: number): Promise<void> {
  // 1. Obtener todas las cajas del mes especificado
  const inicioMes = new Date(year, monthIndex0, 1);
  const inicioSiguienteMes = new Date(year, monthIndex0 + 1, 1);
  
  const q = query(
    cajasRef,
    where('fecha', '>=', inicioMes),
    where('fecha', '<', inicioSiguienteMes)
  );
  
  const snapshot = await getDocs(q);
  
  // 2. Guardar referencia a la caja que se va a cerrar
  let cajaCerrada: CajaBanco | null = null;
  
  // 3. Cerrar todas las cajas ABIERTA del mes
  const promises = snapshot.docs
    .filter(docSnap => {
      const caja = docSnap.data() as CajaBanco;
      return caja.activo !== false && caja.estado === 'ABIERTA';
    })
    .map(async (docSnap) => {
      const caja = docSnap.data() as CajaBanco;
      cajaCerrada = caja;  // <- Guardar para usar luego
      await this.cerrarCajaBanco(docSnap.id, caja.saldo_actual);
    });
  
  await Promise.all(promises);
  
  // 4. Crear automáticamente nueva caja para el MES SIGUIENTE
  if (cajaCerrada) {
    const hoy = new Date();
    const siguienteMes = new Date(year, monthIndex0 + 1, 1);
    const inicioDiaSiguienteMes = new Date(
      siguienteMes.getFullYear(), 
      siguienteMes.getMonth(), 
      1, 
      0, 0, 0, 0
    );
    
    // Verificar si ya existe caja para primer día del mes siguiente
    const qProximaMes = query(
      cajasProximaMesRef,
      where('fecha', '>=', inicioDiaSiguienteMes),
      where('fecha', '<', new Date(inicioDiaSiguienteMes.getTime() + 86400000))
    );
    
    const snapshotProximaMes = await getDocs(qProximaMes);
    const cajasProximaMes = snapshotProximaMes.docs.filter(doc => {
      const caja = doc.data() as CajaBanco;
      return caja.activo !== false;
    });
    
    // Si NO existe → crear nueva con saldo heredado
    if (cajasProximaMes.length === 0) {
      const saldoInicial = cajaCerrada.saldo_actual || 0;
      
      await this.abrirCajaBanco({
        fecha: inicioDiaSiguienteMes,
        saldo_inicial: saldoInicial,  // <- Heredar el saldo final del mes
        saldo_actual: saldoInicial,
        estado: 'ABIERTA',
        usuario_id: usuarioActual?.id,
        usuario_nombre: usuarioActual?.nombre || 'Sistema',
        observacion: `Caja banco creada automáticamente. Saldo anterior: ${saldoInicial}`
      } as CajaBanco);
    }
  }
}
```

## 📊 Ejemplo Completo

**Día 1 de Enero: Usuario crea primera caja**
```
✅ Crear → saldo_inicial: $1000
```

**5-31 Enero: Se registran movimientos**
```
Ingreso 1: +$500
Ingreso 2: +$200
Egreso 1: -$300
Egreso 2: -$100
→ saldo_actual = $1000 + $500 + $200 - $300 - $100 = $1300
```

**31 Enero: Usuario presiona "Cerrar Mes"**
```
1. Obtener caja ENERO (estado=ABIERTA, saldo_actual=$1300)
2. Cambiar estado a CERRADA
3. Crear automáticamente CAJA FEBRERO con:
   - fecha: 2025-02-01
   - saldo_inicial: $1300  (← del saldo_actual de ENERO)
   - estado: ABIERTA
```

**1 Febrero: Sistema se reinicia**
```
✅ Nueva caja FEBRERO abierta con saldo_inicial=$1300
   (Usuario NO necesita hacer nada)
```

**5-28 Febrero: Más movimientos**
```
Ingreso: +$150
Egreso: -$50
→ saldo_actual = $1300 + $150 - $50 = $1400
```

**28 Febrero: Cerrar mes nuevamente**
```
1. FEBRERO cambia a CERRADA (saldo_actual=$1400)
2. MARZO se crea automáticamente con saldo_inicial=$1400
```

## 🎯 Flujo Visual

```
┌─────────────────────────────────────────────────────────┐
│                   ENERO (CERRADA)                       │
│  saldo_inicial: $1000                                   │
│  + Ingresos: $700                                       │
│  - Egresos: $400                                        │
│  saldo_actual: $1300                                    │
└─────────────────────┬───────────────────────────────────┘
                      │ (Hereda saldo_actual)
                      ↓
┌─────────────────────────────────────────────────────────┐
│                   FEBRERO (ABIERTA)                      │
│  saldo_inicial: $1300  ← AUTOMÁTICO                     │
│  + Ingresos: [pendiente]                                │
│  - Egresos: [pendiente]                                 │
│  saldo_actual: [por calcular]                           │
└─────────────────────────────────────────────────────────┘
```

## ✅ Checklist de Verificación

- [ ] Crear primera caja con saldo inicial $X
- [ ] Registrar ingresos y egresos
- [ ] Ver-caja muestra resumen correcto
- [ ] Cerrar mes desde botón "Cerrar Mes"
- [ ] Confirmación SweetAlert
- [ ] Nueva caja se crea automáticamente
- [ ] Nueva caja tiene saldo_inicial = saldo_anterior
- [ ] Volver a listar-cajas → ambas cajas aparecen
- [ ] Cajas antiguas están CERRADAS
- [ ] Nueva caja está ABIERTA

## 🔧 Testing

### Test 1: Primera Caja
```typescript
it('debe crear primera caja con saldo_inicial especificado', async () => {
  const caja = {
    fecha: new Date(2025, 0, 1),
    saldo_inicial: 1000,
    saldo_actual: 1000,
    estado: 'ABIERTA',
    usuario_nombre: 'Test'
  };
  
  const id = await service.abrirCajaBanco(caja);
  expect(id).toBeTruthy();
  
  const cajaBD = await service.getCajaBancoById(id).toPromise();
  expect(cajaBD?.saldo_inicial).toBe(1000);
});
```

### Test 2: Herencia de Saldo
```typescript
it('debe heredar saldo del mes anterior al crear nueva caja', async () => {
  // Crear y cerrar caja de Enero
  const cajaEnero = await createAndCloseCaja(2025, 0, 1300);
  
  // Crear caja de Febrero sin especificar saldo_inicial
  const cajaFebrero = {
    fecha: new Date(2025, 1, 1),
    // NO especificar saldo_inicial
    estado: 'ABIERTA'
  };
  
  const id = await service.abrirCajaBanco(cajaFebrero);
  const cajaFebreoBD = await service.getCajaBancoById(id).toPromise();
  
  // Debe heredar $1300 de Enero
  expect(cajaFebreoBD?.saldo_inicial).toBe(1300);
});
```

### Test 3: Cierre Automático
```typescript
it('debe crear nueva caja al cerrar mes', async () => {
  // Crear y dejar ABIERTA caja de Enero
  await createOpenCaja(2025, 0, 1500);
  
  // Cerrar mes
  await service.cerrarMesCompleto(2025, 0);
  
  // Verificar Enero está CERRADA
  const cajaEnero = await getCajasByMonth(2025, 0);
  expect(cajaEnero.estado).toBe('CERRADA');
  
  // Verificar Febrero existe y está ABIERTA
  const cajaFebrero = await getCajasByMonth(2025, 1);
  expect(cajaFebrero.estado).toBe('ABIERTA');
  expect(cajaFebrero.saldo_inicial).toBe(1500);
});
```

---

**Última actualización**: 2025-01-27  
**Estado**: ✅ Sistema implementado y funcional
