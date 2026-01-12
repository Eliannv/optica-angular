# Crear Proveedor desde el Formulario de Producto

## Descripción de la funcionalidad

Se ha mejorado el formulario de **Crear Producto** para permitir tanto la selección de proveedores existentes como la creación de nuevos proveedores sin salir del formulario.

## Características

### 1. Selector de Proveedores
- Lista desplegable con todos los proveedores existentes
- Muestra código y nombre del proveedor para fácil identificación
- Opción de seleccionar "ninguno" (vacío)

### 2. Botón "Nuevo Proveedor"
- Botón verde con icono ➕ ubicado junto al selector
- Al hacer clic, muestra un formulario completo para crear un proveedor

### 3. Formulario de Nuevo Proveedor
Incluye todos los campos necesarios:
- **Código** (opcional)
- **Nombre** * (obligatorio)
- **RUC** * (obligatorio)
- **Representante** (opcional)
- **Teléfono Principal** (opcional)
- **Teléfono Secundario** (opcional)
- **Dirección** (opcional)

### 4. Flujo de Trabajo
1. Usuario accede a "Crear Producto"
2. Al llegar al campo "Proveedor Principal", puede:
   - **Opción A**: Seleccionar un proveedor existente del dropdown
   - **Opción B**: Hacer clic en "Nuevo" para crear uno
3. Si crea uno nuevo:
   - Completa el formulario de proveedor
   - Hace clic en "Guardar Proveedor"
   - El proveedor se crea en Firestore
   - Se asigna automáticamente como proveedor principal del producto
   - El dropdown se actualiza con el nuevo proveedor
4. Continúa completando el formulario de producto
5. Guarda el producto completo

## Archivos Modificados

### `crear-producto.ts`
- Agregado `OnInit` para cargar proveedores al inicio
- Servicio `ProveedoresService` inyectado
- Propiedades agregadas:
  - `proveedores: Proveedor[]` - Lista de proveedores existentes
  - `mostrarFormNuevoProveedor: boolean` - Control de visibilidad del formulario
  - `nuevoProveedor: Proveedor` - Datos del proveedor a crear
- Métodos agregados:
  - `ngOnInit()` - Carga inicial de proveedores
  - `cargarProveedores()` - Obtiene proveedores de Firestore
  - `toggleFormNuevoProveedor()` - Muestra/oculta formulario
  - `guardarNuevoProveedor()` - Crea el proveedor y actualiza lista
  - `cancelarNuevoProveedor()` - Cierra formulario sin guardar
  - `getProveedorVacio()` - Retorna objeto proveedor vacío

### `crear-producto.html`
- Campo "Proveedor Principal" convertido de input a select
- Botón "Nuevo" agregado junto al selector
- Formulario completo de nuevo proveedor (mostrado condicionalmente)
- Tarjeta con estilo verde para distinguir el formulario de proveedor

### `crear-producto.css`
- Estilos para `.nuevo-proveedor-form`
- Estilos para botones y gaps (flexbox)
- Destacado visual del card de nuevo proveedor con borde verde

## Validaciones

- El proveedor requiere **Nombre** y **RUC** como campos obligatorios
- Se muestra alerta si faltan campos al intentar guardar
- Manejo de errores con console.error y alertas al usuario

## Ventajas

✅ **UX mejorada**: No es necesario salir del formulario de producto para crear un proveedor
✅ **Flujo continuo**: Se mantiene el contexto del usuario
✅ **Asignación automática**: El proveedor creado se asigna al producto
✅ **Actualización en tiempo real**: La lista de proveedores se actualiza inmediatamente
✅ **Flexibilidad**: Soporta tanto selección de existentes como creación de nuevos

## Posibles Mejoras Futuras

- Agregar validación de RUC (formato ecuatoriano)
- Implementar autocompletado para evitar duplicados
- Agregar opción de editar proveedor existente
- Permitir crear proveedores secundarios y terciarios también
- Implementar modal en lugar de formulario inline (para mejor UX en pantallas pequeñas)
