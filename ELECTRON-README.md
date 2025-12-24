# 🚀 INSTRUCCIONES PARA GENERAR EL INSTALADOR

## 📋 Pasos para crear el ejecutable de PASAJE

### 1️⃣ Compilar Angular en producción
```bash
npm run build
```
Esto genera la carpeta `dist/` con la aplicación optimizada.

### 2️⃣ Generar el instalador
```bash
npm run electron:build
```

O solo el empaquetado sin instalador:
```bash
npm run pack
```

### 3️⃣ Resultado
Encontrarás el instalador en la carpeta `release/`:
- `SistemaOptica-PASAJE Setup X.X.X.exe` (instalador completo)

## 🔐 CONFIGURACIÓN DE SEGURIDAD

### Paso 1: Obtener el Machine ID de la PC de PASAJE

1. Ejecuta el programa en modo desarrollo en la PC de PASAJE:
```bash
npm run electron:dev
```

2. Abre las DevTools (F12) y busca en la consola:
```
🔐 Verificación de sucursal:
  - Hostname: NOMBRE-PC
  - Username: USUARIO
  - Machine ID: abc123def456
```

3. Copia el **Machine ID** mostrado

### Paso 2: Configurar IDs permitidos

Edita `electron/main.js` y agrega el Machine ID en la línea 27:

```javascript
const idsPermitidos = [
  'abc123def456'  // ← Pega aquí el Machine ID de la PC de PASAJE
];
```

### Paso 3: Activar validación

En `electron/main.js` línea 37, cambia:
```javascript
// DE ESTO:
if (idsPermitidos.length > 0 && !idsPermitidos.includes(machineId)) {

// A ESTO:
if (!idsPermitidos.includes(machineId)) {
```

### Paso 4: Recompilar
```bash
npm run electron:build
```

## ✅ SEGURIDAD IMPLEMENTADA

✔️ **Validación por Machine ID** - Solo corre en PCs autorizadas
✔️ **Reglas Firestore** - Solo sucursal PASAJE puede acceder a datos
✔️ **Código ofuscado** - En el .exe nadie puede ver el código fuente
✔️ **Sin hosting** - Todo funciona local sin servidor web
✔️ **Instalador profesional** - Doble clic para instalar

## 📦 COMANDOS DISPONIBLES

```bash
# Desarrollo (con hot reload de Angular)
npm run electron:dev

# Solo abrir Electron (necesitas ng serve corriendo)
npm run electron

# Build completo + instalador
npm run electron:build

# Solo empaquetar (sin instalador)
npm run pack

# Compilar Angular solamente
npm run build
```

## 🔧 PERSONALIZACIÓN ADICIONAL

### Cambiar icono
Reemplaza `public/icono/icon.png` con tu icono (256x256 px recomendado)

### Cambiar nombre del instalador
Edita `package.json` → `build.productName`

### Agregar más PCs autorizadas
Agrega más Machine IDs al array `idsPermitidos` en `electron/main.js`

## ⚠️ IMPORTANTE

- Las reglas de Firestore ya están configuradas para PASAJE
- El programa NO funcionará en otras PCs sin el Machine ID correcto
- Aunque copien el .exe, Firebase rechazará las peticiones

## 🎯 DISTRIBUCIÓN

1. Genera el instalador con `npm run electron:build`
2. Comparte `release/SistemaOptica-PASAJE Setup X.X.X.exe`
3. Instala en la PC de PASAJE
4. ✅ Listo para usar
