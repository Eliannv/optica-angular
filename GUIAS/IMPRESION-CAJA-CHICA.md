# 🖨️ Impresión de Reporte de Cierre de Caja Chica

## Descripción

Sistema de impresión de reportes de cierre de caja chica en formato A4 para impresoras Epson (y cualquier impresora estándar).

## Características

### ✅ Lo que incluye el reporte

1. **Encabezado**
   - Nombre de la empresa (ÓPTICA MACÍAS)
   - Título del reporte
   - Fecha y hora de impresión

2. **Información General**
   - Fecha de apertura de caja
   - Fecha de cierre de caja
   - Usuario responsable
   - Estado de la caja

3. **Resumen Financiero** (destacado en recuadro)
   - Monto inicial
   - Total de ingresos con cantidad de movimientos
   - Total de egresos
   - **Saldo final** (destacado)

4. **Detalle de Movimientos** (tabla completa)
   - Fecha y hora de cada movimiento
   - Tipo (INGRESO/EGRESO) con colores:
     - Verde para ingresos
     - Rojo para egresos
   - Descripción
   - Monto
   - Saldo después del movimiento
   - Número de comprobante (si aplica)

5. **Sección de Firmas**
   - Línea para firma del responsable de caja
   - Línea para firma de supervisor/gerente

6. **Footer**
   - Nota aclaratoria del documento
   - Nombre del sistema

## Cómo Usar

### Opción 1: Al cerrar la caja (automático)

1. Ir a **Ver Detalles** de la caja abierta
2. Hacer clic en el botón **"Cerrar Caja"** (botón rojo con candado)
3. Confirmar el cierre
4. Se muestra una confirmación con opción: **"¿Deseas imprimir el reporte de cierre?"**
5. Hacer clic en **"Sí, imprimir"**
6. Se abre el diálogo de impresión del navegador
7. Seleccionar impresora Epson (o la que tengas configurada)
8. Verificar:
   - Tamaño: **A4**
   - Orientación: **Vertical (Portrait)**
   - Márgenes: Predeterminados (10mm)
9. Hacer clic en **Imprimir**

### Opción 2: Reimprimir una caja cerrada

1. Ir a **Caja Chica** → Lista de cajas
2. Hacer clic en **Ver Detalles** de una caja cerrada
3. Hacer clic en el botón **"Imprimir"** (botón azul con ícono de impresora)
4. Se abre el diálogo de impresión
5. Seleccionar impresora y opciones
6. Hacer clic en **Imprimir**

## Configuración de Impresora

### Para Impresoras Epson

La mayoría de impresoras Epson modernas soportan impresión A4 automáticamente. Solo asegúrate de:

1. **En el sistema operativo:**
   - Panel de Control → Dispositivos e Impresoras
   - Clic derecho en tu impresora Epson → Preferencias de impresión
   - Configurar tamaño de papel: **A4 (210 x 297 mm)**

2. **En el diálogo de impresión:**
   - Tamaño: **A4**
   - Orientación: **Vertical**
   - Escala: **100%** (o "Ajustar al tamaño de página")
   - Color: Blanco y Negro (para ahorrar tinta) o Color

### Modelos Epson Compatibles

- Serie L (L3110, L3150, L3250, L4150, L4160, L6191, etc.)
- Serie EcoTank (ET-2720, ET-2760, ET-3760, ET-4700, etc.)
- Serie WorkForce (WF-2830, WF-2850, WF-7720, etc.)
- Serie Expression (XP-2100, XP-4100, etc.)

## Solución de Problemas

### El reporte no se imprime completo

**Solución:**
- Verificar que el tamaño de papel esté configurado en **A4**
- Revisar que los márgenes no sean muy grandes
- Usar la opción "Ajustar al tamaño de página" si está disponible

### Los colores no se ven (ingresos/egresos)

**Solución:**
- En el diálogo de impresión, cambiar de "Blanco y Negro" a "Color"
- Si no tienes tinta de color, los montos se verán en diferentes tonos de gris

### La tabla de movimientos se corta

**Solución:**
- El CSS está configurado para evitar cortes (`page-break-inside: avoid`)
- Si hay muchos movimientos, se distribuirán en varias páginas automáticamente
- Verificar que la escala de impresión sea 100%

### No aparece el diálogo de impresión

**Solución:**
- Verificar que el navegador tenga permisos de impresión
- Desactivar bloqueadores de ventanas emergentes para el sitio
- Probar con Ctrl+P manualmente cuando se muestre el reporte

## Detalles Técnicos

### Archivos Involucrados

1. **CSS de impresión:**
   - `src/styles/reporte-caja-chica.css` - Estilos específicos del reporte A4

2. **Componente:**
   - `src/app/modules/caja-chica/pages/ver-caja/ver-caja.ts`
     - Método `imprimirReporteCierre()` - Genera y imprime
     - Método `imprimirReporteManual()` - Para reimprimir

3. **Template:**
   - `src/app/modules/caja-chica/pages/ver-caja/ver-caja.html`
     - Sección `<div class="reporte-caja-chica">` - Template del reporte

### Configuración en angular.json

```json
"styles": [
  "src/styles.css",
  "src/styles/ticket.css",
  "src/styles/reporte-caja-chica.css"  // ← Estilo del reporte
]
```

### Media Query de Impresión

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  
  /* Oculta la interfaz normal y solo muestra el reporte */
  body * { display: none !important; }
  .reporte-caja-chica, .reporte-caja-chica * { display: block !important; }
}
```

## Personalización

### Cambiar el nombre de la empresa

Editar en: `ver-caja.html` línea del header:

```html
<h1>ÓPTICA MACÍAS</h1>  <!-- Cambiar aquí -->
```

### Agregar logo de la empresa

1. Guardar el logo en `public/img/logo-empresa.png`
2. Agregar en el header del reporte:

```html
<div class="reporte-header">
  <img src="/img/logo-empresa.png" alt="Logo" style="height: 60px;">
  <h1>ÓPTICA MACÍAS</h1>
  ...
</div>
```

### Modificar colores de ingresos/egresos

Editar en: `src/styles/reporte-caja-chica.css`

```css
.tipo-ingreso {
  color: #28a745;  /* Verde - cambiar aquí */
}

.tipo-egreso {
  color: #dc3545;  /* Rojo - cambiar aquí */
}
```

## Flujo Completo

```
📂 CAJA CHICA
   ↓
📖 Ver Detalles (caja abierta)
   ↓
🔴 Cerrar Caja
   ↓
✅ Confirmar cierre
   ↓
💾 Guardar en Firestore
   ↓
💵 Transferir a Caja Banco
   ↓
🖨️ ¿Imprimir reporte? → SÍ
   ↓
📄 Generar reporte (A4)
   ↓
🖨️ Abrir diálogo de impresión
   ↓
📋 Seleccionar impresora Epson
   ↓
✅ Imprimir
   ↓
🎯 Reporte físico listo
```

## Ventajas

✅ **Formato profesional** - Reporte estructurado y fácil de leer
✅ **Formato estándar** - Tamaño A4 compatible con cualquier impresora
✅ **Completo** - Incluye todos los detalles: movimientos, resumen, firmas
✅ **Colores** - Ingresos en verde, egresos en rojo (ayuda visual)
✅ **Reimprimir** - Posibilidad de reimprimir cualquier cierre anterior
✅ **Sin pérdida de información** - Se generan varias páginas si hay muchos movimientos
✅ **Compatible** - Funciona con impresoras Epson y cualquier marca estándar

## Notas Importantes

⚠️ **El reporte solo se genera cuando:**
- La caja está cerrada
- Se hace clic en "Imprimir" (manual) o al cerrar la caja (automático)

⚠️ **Verificar siempre:**
- Que la impresora esté encendida y con papel A4
- Que los datos del reporte sean correctos antes de imprimir
- Configurar correctamente el tamaño A4 en las preferencias de impresora

⚠️ **Guardar copias:**
- Los reportes se pueden reimprimir en cualquier momento
- No es necesario guardar PDFs, pero puedes usar "Guardar como PDF" en el diálogo de impresión

---

**Última actualización:** Enero 2026
**Versión:** 1.0
