# 🚀 QUICK START - Optimización de Reportes

## ✅ Pasos para Activar las Optimizaciones

### 1️⃣ Crear Índices en Firestore (OBLIGATORIO)

Ve a [Firebase Console](https://console.firebase.google.com) → Tu proyecto → Firestore Database → Indexes

**Crea estos 4 índices compuestos:**

#### Índice 1: Facturas
```
Colección: facturas
Campos:
  - fecha: Ascendente
  - metodoPago: Ascendente
  - __name__: Ascendente
```

#### Índice 2: Facturas Deudas
```
Colección: facturas_deudas
Campos:
  - fechaPago: Ascendente
  - __name__: Ascendente
```

#### Índice 3: Movimientos Caja Chica
```
Colección: movimientos_cajas_chicas
Campos:
  - fecha: Ascendente
  - tipo: Ascendente
  - __name__: Ascendente
```

#### Índice 4: Movimientos Caja Banco
```
Colección: movimientos_cajas_banco
Campos:
  - fecha: Ascendente
  - tipo: Ascendente
  - __name__: Ascendente
```

⏳ **Los índices tardan unos minutos en construirse**. Espera a que aparezcan con estado "Enabled" antes de usar los reportes.

---

### 2️⃣ Generar Resúmenes Históricos (Recomendado)

Para que los dashboards sean ultra-rápidos, genera resúmenes mensuales:

```bash
# Ejecutar script
node generar-resumenes-mensuales.js
```

**Dentro del script**, edita la función `main()` para configurar qué meses generar:

```javascript
// Opción 1: Solo el mes anterior
await generarResumenMesAnterior();

// Opción 2: Solo el mes actual
await generarResumenMesActual();

// Opción 3: Rango de meses (Ejemplo: todo el 2024)
await generarResumenesRango(2024, 1, 2024, 12);

// Opción 4: Un mes específico
await generarResumenMensual(2024, 11); // Noviembre 2024
```

---

### 3️⃣ Probar los Reportes Optimizados

1. Ejecuta tu app Angular:
   ```bash
   npm start
   ```

2. Ve al módulo de **Informes/Reportes**

3. Verifica que:
   - ✅ NO se cargan datos al entrar (pantalla vacía)
   - ✅ Solo carga al presionar "Mostrar"
   - ✅ Muestra máximo 100 registros por página
   - ✅ Hay botón "Cargar más" si hay más datos
   - ✅ En consola aparece: `📊 Reporte inicializado. Presione "Mostrar" para cargar datos.`

---

### 4️⃣ Verificar Reducción de Lecturas

**Antes de la optimización:**
- Firebase Console → Firestore → Usage
- Tomar nota del número de "Document Reads" actual

**Después de usar reportes por 1 día:**
- Volver a Firebase Console → Firestore → Usage
- Comparar número de lecturas

**Resultado esperado:** Reducción de ~80% en lecturas.

---

## 🔧 Configuración Opcional

### Programar Generación Automática de Resúmenes

#### Opción A: Cloud Functions (Firebase)

Crear archivo `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.generarResumenMensual = functions.pubsub
  .schedule('0 0 1 * *') // Primer día de cada mes a medianoche
  .timeZone('America/Guayaquil') // Ajustar tu zona horaria
  .onRun(async (context) => {
    // Copiar lógica de generarResumenMesAnterior() aquí
    console.log('Generando resumen mensual automático...');
  });
```

Deploy:
```bash
firebase deploy --only functions
```

#### Opción B: Cron Job (Linux/Mac)

```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar el 1 de cada mes a medianoche)
0 0 1 * * cd /ruta/a/tu/proyecto && node generar-resumenes-mensuales.js
```

---

## 📊 Monitoreo

### Ver Cache en Acción

Abre la consola del navegador (F12) y busca estos mensajes:

```
✅ Usando cache para clave: facturas_...
🔍 Cargando datos optimizados: { fechaDesde, fechaHasta, ... }
✅ Facturas cargadas: { cantidad: 85, hayMas: false }
```

### Limpiar Cache Manualmente

Si actualizas datos y ves información vieja:

```typescript
// En cualquier componente
this.reportesService.clearCache();
```

O espera 5 minutos (el cache se limpia automáticamente).

---

## ⚡ Ajustes de Rendimiento

### Cambiar Límite de Paginación

En `reportes.service.ts`:

```typescript
// Default: 100 docs por página
limitDocs = 100

// Más rápido pero más páginas
limitDocs = 50

// Más lento pero menos páginas
limitDocs = 200
```

### Cambiar Duración del Cache

En `reportes.service.ts`:

```typescript
// Default: 5 minutos
private readonly CACHE_DURATION = 5 * 60 * 1000;

// 10 minutos
private readonly CACHE_DURATION = 10 * 60 * 1000;

// 1 minuto (para datos que cambian frecuentemente)
private readonly CACHE_DURATION = 1 * 60 * 1000;
```

---

## 🆘 Troubleshooting

### Error: "Missing index for query"

**Solución:** Crear el índice compuesto que indica el error en Firebase Console.

El error te mostrará un link directo para crear el índice.

### Los datos no se actualizan

**Solución:** Limpiar cache:
```typescript
this.reportesService.clearCache();
```

### Reportes muy lentos

**Posibles causas:**
1. Índices aún no construidos (esperar)
2. Rango de fechas muy amplio (reducir a 1 mes)
3. Límite de docs muy alto (reducir a 50)

---

## 📚 Documentación Completa

Ver: `OPTIMIZACION-REPORTES-COMPLETA.md`

---

## ✅ Checklist Final

- [ ] Crear 4 índices en Firestore Console
- [ ] Esperar a que índices estén "Enabled"
- [ ] Ejecutar `generar-resumenes-mensuales.js`
- [ ] Verificar colección `resumenes` en Firestore
- [ ] Probar reportes en navegador
- [ ] Verificar que no carga datos al iniciar
- [ ] Verificar reducción de lecturas en Firebase Console
- [ ] (Opcional) Configurar generación automática de resúmenes

---

**¡Listo! Tu módulo de reportes ahora está optimizado.** 🎉

**Resultado esperado:**
- 80% menos lecturas de Firestore
- 80% más rápido
- 80% menos uso de memoria
- Cache automático
