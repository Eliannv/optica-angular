# 📊 Informe de Cobros Cliente - Guía Rápida

## ✅ Implementado Exitosamente

El **Informe de Cobros Cliente** está listo y funcional. Este es el primer informe del sistema de reportes.

---

## 🎯 ¿Qué hace este informe?

Muestra un listado detallado de **todos los cobros realizados** a las facturas de venta, permitiendo:

- ✅ Ver todos los cobros registrados en el sistema
- ✅ Filtrar por fechas, cliente, método de pago
- ✅ Ver totales por método de pago (Efectivo, Transferencia, Tarjeta)
- ✅ Imprimir reporte profesional en formato A4
- ✅ Diferenciar entre créditos personales y ventas normales

---

## 🚀 Acceso al Informe

### Ruta en el navegador:
```
/informes/cobros-cliente
```

### Usuarios con acceso:
- ✅ **Operadores**
- ✅ **Administradores**

---

## 🔍 Filtros Disponibles

### 1. **Rango de Fechas**
- Fecha Inicio
- Fecha Fin
- Filtra cobros entre esas fechas

### 2. **Búsqueda de Cliente/Factura**
- Busca por nombre de cliente
- Busca por número de factura
- Búsqueda en tiempo real

### 3. **Método de Pago**
- Todos
- Efectivo
- Transferencia
- Tarjeta

### 4. **Estado de Pago**
- Todas
- Pendientes (facturas con saldo pendiente)
- Pagadas (facturas completamente pagadas)

### 5. **Solo Crédito Personal**
- Checkbox para filtrar únicamente créditos personales

---

## 📋 Información Mostrada

### En la Tabla:
| Columna | Descripción |
|---------|-------------|
| **Factura** | Número de factura (ID personalizado) |
| **Fecha** | Fecha y hora del cobro |
| **Cliente** | Nombre del cliente |
| **Total Factura** | Monto total de la factura |
| **Cobrado** | Monto total abonado (acumulado) |
| **Saldo** | Saldo pendiente por cobrar |
| **Método** | Método de pago utilizado |
| **Estado** | PAGADA o PENDIENTE |
| **Crédito** | SÍ/NO - Indica si es crédito personal |

### Resumen Rápido (Cards superiores):
- 💰 **Total Cobrado**: Suma total de cobros
- 💵 **Efectivo**: Total cobrado en efectivo
- 💳 **Transferencia**: Total cobrado por transferencia
- 💳 **Tarjeta**: Total cobrado con tarjeta

---

## 🖨️ Impresión del Reporte

### Características del reporte impreso:
- ✅ Formato A4 profesional
- ✅ Encabezado con nombre de la empresa
- ✅ Filtros aplicados claramente indicados
- ✅ Tabla completa con todos los cobros
- ✅ Resumen financiero con totales
- ✅ Totales desglosados por método de pago
- ✅ Fecha y hora de generación del reporte

### Cómo imprimir:
1. Aplicar los filtros deseados
2. Click en el botón **"🖨️ Imprimir Reporte"**
3. Se abre ventana de impresión automáticamente
4. Revisar vista previa
5. Imprimir o guardar como PDF

---

## 📊 Datos Importantes

### ⚠️ Nota sobre el campo "Cobrado":
El campo **"Cobrado"** muestra el **total acumulado de todos los abonos** realizados a la factura, NO el monto del último cobro individual.

**Ejemplo:**
- Factura total: $100
- Primer cobro: $40
- Segundo cobro: $30
- En el informe aparecerá: **Cobrado = $70** (suma de ambos cobros)

### 💡 Para un historial detallado de cada abono individual:
Se requeriría implementar un sistema de historial de movimientos de abonos (funcionalidad futura).

---

## 🎨 Características de la Interfaz

### ✅ Diseño Responsivo:
- Se adapta a diferentes tamaños de pantalla
- Optimizado para desktop y tablet
- Scrollable horizontal en móviles

### ✅ Experiencia de Usuario:
- Búsqueda en tiempo real
- Paginación (20 cobros por página)
- Botón "Limpiar Filtros" para resetear
- Loading spinner durante carga
- Mensaje amigable cuando no hay resultados

### ✅ Código de Colores:
- 🟢 **Verde**: Estado PAGADA, Método Efectivo
- 🟡 **Amarillo**: Estado PENDIENTE, Saldos pendientes
- 🔵 **Azul**: Método Transferencia, Crédito Personal
- 🟣 **Púrpura**: Método Tarjeta

---

## 🏗️ Arquitectura Técnica

### Archivos creados:

```
src/app/
├── core/
│   ├── models/
│   │   └── cobro.model.ts              # Modelo de datos
│   └── services/
│       └── cobros.service.ts           # Servicio de consultas
│
└── modules/
    └── informes/
        ├── informes-module.ts          # Módulo principal
        ├── informes-routing-module.ts  # Configuración de rutas
        └── pages/
            └── cobros-cliente/
                ├── cobros-cliente.ts   # Componente TypeScript
                ├── cobros-cliente.html # Template HTML
                └── cobros-cliente.css  # Estilos CSS
```

### Tecnologías utilizadas:
- ✅ **Angular 20** (standalone components)
- ✅ **Firestore** (consultas en tiempo real)
- ✅ **RxJS** (Observables para datos reactivos)
- ✅ **SweetAlert2** (alertas elegantes)
- ✅ **CSS Grid/Flexbox** (diseño responsivo)

---

## 🔄 Flujo de Datos

```
1. Usuario accede a /informes/cobros-cliente
   ↓
2. CobrosService consulta Firestore
   ↓
3. Filtra facturas con abonado > 0
   ↓
4. Transforma cada factura a objeto Cobro
   ↓
5. Componente aplica filtros seleccionados
   ↓
6. Muestra resultados paginados
   ↓
7. Usuario puede imprimir reporte
```

---

## ✨ Próximos Pasos

Ya tienes implementado:
✅ **Informe de Cobros Cliente**

Faltan por implementar:
❌ **Informe de Egreso de Mercadería**
❌ **Informe de Facturas de Compras** (ya cubierto por módulo de Ingresos)
❌ **Informe de Facturas de Ventas** (ya existe impresión individual)
❌ **Informe de Ingreso de Mercadería** (ya existe impresión individual)

---

## 🐛 Solución de Problemas

### Problema: No aparecen cobros
- ✅ Verificar que existan facturas con `abonado > 0`
- ✅ Revisar los filtros aplicados (quizás son muy restrictivos)
- ✅ Usar "Limpiar Filtros" para resetear

### Problema: No se puede imprimir
- ✅ Verificar que el navegador no esté bloqueando ventanas emergentes
- ✅ Asegurarse de que haya datos para imprimir
- ✅ Permitir ventanas emergentes para el sitio

### Problema: Carga lenta
- ✅ Normal en sistemas con muchas facturas
- ✅ Usar filtros de fecha para reducir dataset
- ✅ La paginación ayuda con rendimiento

---

## 📞 Notas para el Desarrollador

### Extensiones futuras posibles:
1. **Exportar a Excel**: Agregar botón para exportar datos a CSV/Excel
2. **Gráficos**: Añadir charts con estadísticas visuales
3. **Historial de Abonos**: Sistema detallado de cada abono individual
4. **Envío por Email**: Opción para enviar reporte por correo
5. **Comparativas**: Comparar períodos (mes vs mes, año vs año)

### Performance:
- Actualmente consulta todas las facturas con abonos
- Para datasets muy grandes, considerar paginación en servidor
- Implementar caché local si es necesario

---

**✅ Informe de Cobros Cliente implementado exitosamente!**

¿Listo para implementar el siguiente informe? 🚀
