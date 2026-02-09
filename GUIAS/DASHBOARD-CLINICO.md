# 📊 Sistema de Análisis Clínico - Dashboard de Historiales

Sistema de análisis clínico que genera métricas, KPIs y datos para gráficos a partir de los historiales clínicos de un cliente en el sistema de óptica.

## 🎨 Diseño Actualizado

El dashboard utiliza **el mismo estilo visual que cuentas-por-pagar** para mantener consistencia en toda la aplicación:

### Características del Diseño:
- ✅ **Tarjetas stat-card** con gradientes sutiles
- ✅ **Iconos SVG grandes** (48x48px) con colores temáticos
- ✅ **Grid responsivo** de 3 columnas (se adapta a 2 o 1 en móviles)
- ✅ **Efectos hover** con transform y sombra
- ✅ **Colores consistentes:** primary (azul), success (verde), warning (amarillo), secondary (gris)
- ✅ **Tipografía optimizada:** valores grandes (1.5rem), labels pequeños (0.85rem)

---

## 📦 Componentes Creados

### 1. **AnalisisClinicoService** 
`src/app/core/services/analisis-clinico.service.ts`

Servicio que procesa un array de historiales clínicos y genera un objeto `DashboardClinico` con:
- **Tarjetas (KPIs):** Evolución de graduación, tipos de lente, tiempo entre visitas
- **Datos para gráficos:** Línea de evolución, barras de tipos, donut de estabilidad

### 2. **DashboardClinicoComponent**
`src/app/modules/clientes/components/dashboard-clinico/`

Componente standalone que visualiza el dashboard con tarjetas y tablas de datos preparados para gráficos.

---

## 🚀 Uso Rápido

### 1️⃣ En un componente (TypeScript):

```typescript
import { AnalisisClinicoService, DashboardClinico } from '../../../../core/services/analisis-clinico.service';

export class MiComponente {
  dashboard: DashboardClinico | null = null;

  constructor(private analisisSrv: AnalisisClinicoService) {}

  generarDashboard(historiales: HistoriaClinica[]): void {
    // Los historiales DEBEN estar ordenados por fecha ASCENDENTE (más antiguos primero)
    const historialesOrdenados = historiales.sort((a, b) => {
      const fechaA = this.parseFecha(a.createdAt);
      const fechaB = this.parseFecha(b.createdAt);
      return (fechaA?.getTime() || 0) - (fechaB?.getTime() || 0);
    });

    this.dashboard = this.analisisSrv.generarDashboard(historialesOrdenados);
  }

  private parseFecha(createdAt: any): Date | null {
    if (createdAt?.toDate) return createdAt.toDate();
    if (createdAt instanceof Date) return createdAt;
    return null;
  }
}
```

### 2️⃣ En el template (HTML):

```html
<app-dashboard-clinico [dashboard]="dashboard"></app-dashboard-clinico>
```

### 3️⃣ Importar el componente:

```typescript
import { DashboardClinicoComponent } from '../components/dashboard-clinico/dashboard-clinico.component';

@Component({
  imports: [CommonModule, DashboardClinicoComponent],
  // ...
})
```

---

## 📋 Estructura del Objeto `DashboardClinico`

```typescript
{
  "tarjetas": {
    "evolucionGraduacion": {
      "valorPromedio": 0.35,
      "estado": "PROGRESIVO"  // "ESTABLE" | "PROGRESIVO" | "NO APLICA"
    },
    "tiposLente": {
      "MONOFOCAL": 60,
      "PROGRESIVO": 30,
      "BIFOCAL": 10
    },
    "tiempoPromedioEntreVisitasMeses": 8.5
  },
  "graficos": {
    "lineaGraduacion": [
      { "fecha": "12/01/2024", "od": -2.00, "oi": -1.75 },
      { "fecha": "15/05/2024", "od": -2.25, "oi": -2.00 }
    ],
    "barrasTiposLente": [
      { "tipo": "MONOFOCAL", "cantidad": 6 },
      { "tipo": "PROGRESIVO", "cantidad": 3 }
    ],
    "donutEstabilidad": [
      { "tipo": "ESTABLE", "porcentaje": 0 },
      { "tipo": "PROGRESIVO", "porcentaje": 100 }
    ]
  }
}
```

---

## 📊 Descripción de Métricas

### 🔹 Tarjeta 1: Evolución de Graduación

**¿Qué mide?**
- Cambio promedio de esfera entre historiales consecutivos
- Usa el promedio de OD (ojo derecho) y OI (ojo izquierdo)

**Clasificación:**
- **ESTABLE:** Cambio promedio ≤ 0.25 dioptrías
- **PROGRESIVO:** Cambio promedio > 0.25 dioptrías
- **NO APLICA:** Solo existe 1 historial (sin comparación)

**Ejemplo:**
```
Historial 1: OD=-2.00, OI=-1.75 → Promedio: -1.875
Historial 2: OD=-2.25, OI=-2.00 → Promedio: -2.125
Diferencia: |−1.875 − (−2.125)| = 0.25 → ESTABLE
```

### 🔹 Tarjeta 2: Tipos de Lente

**¿Qué mide?**
- Distribución porcentual de los tipos de lente usados por el cliente

**Tipos reconocidos:**
- MONOFOCAL
- BIFOCAL
- PROGRESIVO
- MULTIFOCAL
- (Otros se muestran tal como aparecen en el campo `de`)

**Ejemplo:**
```
10 historiales:
- 6 MONOFOCAL → 60%
- 3 PROGRESIVO → 30%
- 1 BIFOCAL → 10%
```

### 🔹 Tarjeta 3: Tiempo entre Visitas

**¿Qué mide?**
- Tiempo promedio en meses entre historiales consecutivos

**Cálculo:**
```
Historial 1: 01/01/2024
Historial 2: 01/05/2024 → 4 meses
Historial 3: 01/10/2024 → 5 meses
Promedio: (4 + 5) / 2 = 4.5 meses
```

---

## 📈 Datos para Gráficos

### 4️⃣ Gráfico de Línea – Evolución de Esfera

**Propósito:** Visualizar la evolución de la graduación (esfera) de ambos ojos a lo largo del tiempo.

**Datos generados:**
```json
[
  { "fecha": "12/01/2024", "od": -2.00, "oi": -1.75 },
  { "fecha": "15/05/2024", "od": -2.25, "oi": -2.00 },
  { "fecha": "20/10/2024", "od": -2.50, "oi": -2.25 }
]
```

**Uso con Chart.js:**
```typescript
const ctx = document.getElementById('lineChart');
new Chart(ctx, {
  type: 'line',
  data: {
    labels: dashboard.graficos.lineaGraduacion.map(d => d.fecha),
    datasets: [
      {
        label: 'OD (Ojo Derecho)',
        data: dashboard.graficos.lineaGraduacion.map(d => d.od),
        borderColor: 'rgb(75, 192, 192)'
      },
      {
        label: 'OI (Ojo Izquierdo)',
        data: dashboard.graficos.lineaGraduacion.map(d => d.oi),
        borderColor: 'rgb(255, 99, 132)'
      }
    ]
  }
});
```

### 5️⃣ Gráfico de Barras – Tipos de Lente

**Propósito:** Mostrar la cantidad total de cada tipo de lente usado.

**Datos generados:**
```json
[
  { "tipo": "MONOFOCAL", "cantidad": 6 },
  { "tipo": "PROGRESIVO", "cantidad": 3 },
  { "tipo": "BIFOCAL", "cantidad": 1 }
]
```

**Uso con Chart.js:**
```typescript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: dashboard.graficos.barrasTiposLente.map(d => d.tipo),
    datasets: [{
      label: 'Cantidad',
      data: dashboard.graficos.barrasTiposLente.map(d => d.cantidad),
      backgroundColor: 'rgba(54, 162, 235, 0.5)'
    }]
  }
});
```

### 6️⃣ Gráfico Donut – Estabilidad Visual

**Propósito:** Clasificar la estabilidad visual general del cliente.

**Datos generados:**
```json
[
  { "tipo": "ESTABLE", "porcentaje": 0 },
  { "tipo": "PROGRESIVO", "porcentaje": 100 }
]
```

**Uso con Chart.js:**
```typescript
new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: ['ESTABLE', 'PROGRESIVO'],
    datasets: [{
      data: [
        dashboard.graficos.donutEstabilidad.find(d => d.tipo === 'ESTABLE')?.porcentaje || 0,
        dashboard.graficos.donutEstabilidad.find(d => d.tipo === 'PROGRESIVO')?.porcentaje || 0
      ],
      backgroundColor: ['#28a745', '#ffc107']
    }]
  }
});
```

---

## ⚠️ Consideraciones Importantes

### ✅ Orden de los Historiales

El servicio **requiere** que los historiales estén ordenados por fecha **ASCENDENTE** (del más antiguo al más reciente).

Si tus historiales vienen ordenados DESC (como en `seleccionar-historial`), debes invertirlos:

```typescript
const historialesAsc = [...historiales].reverse();
const dashboard = this.analisisSrv.generarDashboard(historialesAsc);
```

### ✅ Manejo de Fechas

El servicio soporta múltiples formatos de fecha:
- `Date` nativo de JavaScript
- `Timestamp` de Firestore (con método `.toDate()`)
- String ISO (`"2024-01-12T10:30:00.000Z"`)

### ✅ Valores Nulos

El servicio maneja correctamente valores `null` en campos de esfera, cilindro, etc.
- Si ambos ojos tienen `null` en esfera, se excluye ese historial del cálculo de evolución
- Si solo un ojo tiene valor, se usa ese valor

### ✅ Casos Especiales

**Sin historiales:**
```typescript
dashboard = {
  tarjetas: { evolucionGraduacion: { valorPromedio: 0, estado: "NO APLICA" }, ... },
  graficos: { lineaGraduacion: [], ... }
}
```

**Un solo historial:**
```typescript
dashboard = {
  tarjetas: { evolucionGraduacion: { valorPromedio: 0, estado: "NO APLICA" }, ... },
  graficos: { lineaGraduacion: [{ fecha: "...", od: -2.00, oi: -1.75 }], ... }
}
```

---

## 🎨 Personalización de Estilos

El componente usa **las mismas clases CSS que cuentas-por-pagar** para mantener consistencia:

### Clases Principales:
```css
.stat-card           /* Tarjeta base */
.stat-card-primary   /* Color azul */
.stat-card-success   /* Color verde */
.stat-card-warning   /* Color amarillo */
.stat-card-secondary /* Color gris */

.stat-icon           /* Contenedor de icono (48px) */
.stat-content        /* Contenedor de texto */
.stat-label          /* Label superior (0.85rem) */
.stat-value          /* Valor principal (1.5rem, bold) */
.stat-sublabel       /* Texto inferior (0.75rem) */
```

### Variables CSS Usadas:
```css
--primary-color      /* Color principal del tema */
--text-primary       /* Color de texto principal */
--text-secondary     /* Color de texto secundario */
--border-color       /* Color de bordes */
--card-bg            /* Fondo de tarjetas */
--secondary-bg       /* Fondo secundario */
--radius-lg          /* Radio de bordes (8px) */
```

### Gradientes:
- **Primary:** `linear-gradient(135deg, rgba(52, 152, 219, 0.08) 0%, rgba(52, 152, 219, 0.04) 100%)`
- **Success:** `linear-gradient(135deg, rgba(39, 174, 96, 0.08) 0%, rgba(39, 174, 96, 0.04) 100%)`
- **Warning:** `linear-gradient(135deg, rgba(241, 196, 15, 0.08) 0%, rgba(241, 196, 15, 0.04) 100%)`

### Responsive Breakpoints:
```css
@media (max-width: 1024px)  /* 2 columnas */
@media (max-width: 768px)   /* 1 columna */
```

---

## 🧪 Ejemplo Completo en `seleccionar-historial`

```typescript
// seleccionar-historial.ts
import { AnalisisClinicoService, DashboardClinico } from '../../../../core/services/analisis-clinico.service';
import { DashboardClinicoComponent } from '../../components/dashboard-clinico/dashboard-clinico.component';

@Component({
  imports: [CommonModule, DashboardClinicoComponent],
  // ...
})
export class SeleccionarHistorialComponent {
  dashboard: DashboardClinico | null = null;
  mostrarDashboard = false;

  constructor(private analisisSrv: AnalisisClinicoService) {}

  generarDashboard(): void {
    // Los historiales vienen DESC, necesitamos ASC
    const historialesAsc = [...this.historiales].reverse();
    this.dashboard = this.analisisSrv.generarDashboard(historialesAsc);
  }

  toggleDashboard(): void {
    this.mostrarDashboard = !this.mostrarDashboard;
    if (this.mostrarDashboard && !this.dashboard) {
      this.generarDashboard();
    }
  }
}
```

```html
<!-- seleccionar-historial.html -->
<button class="btn btn-info" (click)="toggleDashboard()">
  {{ mostrarDashboard ? 'Ocultar' : 'Ver' }} Dashboard Clínico
</button>

<app-dashboard-clinico 
  *ngIf="mostrarDashboard" 
  [dashboard]="dashboard">
</app-dashboard-clinico>
```

---

## 📚 Archivos Creados

1. **Servicio:**
   - `src/app/core/services/analisis-clinico.service.ts`

2. **Componente:**
   - `src/app/modules/clientes/components/dashboard-clinico/dashboard-clinico.component.ts`
   - `src/app/modules/clientes/components/dashboard-clinico/dashboard-clinico.component.html`
   - `src/app/modules/clientes/components/dashboard-clinico/dashboard-clinico.component.css`

3. **Integración:**
   - Modificado: `src/app/modules/clientes/pages/seleccionar-historial/seleccionar-historial.ts`

4. **Documentación:**
   - `GUIAS/DASHBOARD-CLINICO.md` (este archivo)

---

## 🎯 Próximos Pasos

1. **Integrar librerías de gráficos:**
   - Chart.js: `npm install chart.js`
   - ng2-charts: `npm install ng2-charts`

2. **Crear componentes de gráficos visuales:**
   - `LineChartComponent` para evolución de esfera
   - `BarChartComponent` para tipos de lente
   - `DonutChartComponent` para estabilidad visual

3. **Exportar dashboard a PDF:**
   - Usar jsPDF + html2canvas para generar reportes

4. **Agregar filtros:**
   - Filtrar por rango de fechas
   - Filtrar por tipo de lente
   - Comparar periodos

---

## 🔄 Changelog de Diseño

### v2.0 - Rediseño con estilo de cuentas-por-pagar
**Fecha:** 8 de febrero de 2026

**Cambios principales:**
- ✅ Reemplazadas `tarjeta-kpi` por `stat-card` (estilo estándar)
- ✅ Iconos SVG de 48x48px en lugar de emojis
- ✅ Grid de 3 columnas responsivo
- ✅ Gradientes sutiles por tipo de tarjeta
- ✅ Efectos hover mejorados (transform + sombra)
- ✅ Tipografía más grande y legible
- ✅ Separación visual mejorada con el wrapper del dashboard
- ✅ Consistencia total con el resto de la aplicación

**Mejoras visuales:**
- Tarjetas más grandes y espaciosas
- Iconos con colores temáticos según el tipo
- Mejor jerarquía visual (label → valor → sublabel)
- Animaciones suaves en hover
- Responsive real (3 → 2 → 1 columnas)

---

✅ **Sistema de análisis clínico completado y listo para usar con diseño estandarizado.**

¿Necesitas ayuda con la integración de gráficos visuales o exportación a PDF? ¡Avísame! 🚀
