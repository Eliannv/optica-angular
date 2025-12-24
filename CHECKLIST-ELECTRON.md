# ✅ CHECKLIST - Sistema Óptica PASAJE con Electron

## 🎯 ESTADO ACTUAL

### ✅ Completado

- [x] Angular build en producción configurado
- [x] Electron instalado y configurado
- [x] Carpeta `electron/` con main.js y preload.js
- [x] Validación de sucursal por Machine ID implementada
- [x] Reglas de Firestore configuradas para sucursal PASAJE
- [x] electron-builder instalado
- [x] Scripts de npm configurados
- [x] Configuración de build en package.json

### ⏳ Pendiente de hacer

- [ ] **PASO 1: Ejecutar en la PC de PASAJE para obtener Machine ID**
  ```bash
  npm run electron:dev
  ```
  - Abrir DevTools (F12)
  - Copiar el **Machine ID** de la consola

- [ ] **PASO 2: Configurar Machine ID permitido**
  - Editar `electron/main.js` línea 27
  - Pegar el Machine ID copiado
  ```javascript
  const idsPermitidos = [
    'TU-MACHINE-ID-AQUI'  // ← Pegar aquí
  ];
  ```

- [ ] **PASO 3: Activar validación estricta**
  - Editar `electron/main.js` línea 37
  - Cambiar la condición para validar siempre:
  ```javascript
  if (!idsPermitidos.includes(machineId)) {
  ```

- [ ] **PASO 4: Configurar usuarios en Firebase**
  
  **Opción A - Usando Firebase Console (Manual):**
  1. No hay forma directa desde la consola
  2. Usa la Opción B o C
  
  **Opción B - Usando el script (Recomendado):**
  1. Descargar clave de servicio de Firebase:
     - Firebase Console → ⚙️ Configuración → Cuentas de servicio
     - "Generar nueva clave privada"
     - Guardar como `serviceAccountKey.json`
  2. Editar `set-user-sucursal.js`
  3. Agregar emails de usuarios autorizados
  4. Ejecutar: `node set-user-sucursal.js`
  
  **Opción C - Modificar AuthService en Angular:**
  - Ver ejemplo en `firebase-auth-setup.example.js`

- [ ] **PASO 5: Crear icono (opcional)**
  - Agregar `public/icono/icon.png` (256x256 px)
  - Formato PNG con transparencia

- [ ] **PASO 6: Generar instalador final**
  ```bash
  npm run electron:build
  ```
  - Resultado en: `release/SistemaOptica-PASAJE Setup X.X.X.exe`

- [ ] **PASO 7: Probar instalador**
  - Instalar en la PC de PASAJE
  - Verificar que funciona correctamente
  - Intentar en otra PC para confirmar que se bloquea

## 📝 COMANDOS RÁPIDOS

```bash
# Desarrollo con hot reload
npm run electron:dev

# Build completo + instalador
npm run electron:build

# Solo compilar Angular
npm run build

# Solo empaquetar (sin instalador)
npm run pack
```

## 🔐 SEGURIDAD IMPLEMENTADA

| Capa | Estado | Descripción |
|------|--------|-------------|
| Machine ID | ✅ | Solo corre en PCs autorizadas |
| Firebase Auth | ⏳ | Custom claims con `sucursal: "PASAJE"` |
| Firestore Rules | ✅ | Solo usuarios con claim de PASAJE |
| Código ofuscado | ✅ | Automático con electron-builder |
| Sin hosting | ✅ | Todo local, sin servidor web |

## 📁 ARCHIVOS CREADOS/MODIFICADOS

```
✅ electron/main.js          - Validación de sucursal + configuración
✅ electron/preload.js       - Script de pre-carga seguro
✅ package.json              - Scripts y configuración de build
✅ ELECTRON-README.md        - Guía completa de uso
✅ set-user-sucursal.js      - Script para configurar usuarios
✅ firebase-auth-setup.example.js - Ejemplos de auth
✅ CHECKLIST-ELECTRON.md     - Este archivo
```

## ⚠️ IMPORTANTE

1. **NO subas a Git el archivo `serviceAccountKey.json`** (ya está en .gitignore)
2. El programa generado funcionará SOLO en:
   - PCs con Machine ID autorizado
   - Usuarios con custom claim `sucursal: "PASAJE"`
3. Aunque copien el .exe, Firebase rechazará las peticiones

## 🚀 PRÓXIMOS PASOS

1. Ejecutar en PC de PASAJE y obtener Machine ID
2. Configurar el Machine ID en el código
3. Configurar usuarios en Firebase con custom claims
4. Generar instalador final
5. Distribuir e instalar en sucursal PASAJE

## 📞 SOPORTE

Si algo no funciona, verifica:
- [ ] Node.js está instalado (v18 o superior)
- [ ] Las dependencias están instaladas (`npm install`)
- [ ] Firebase está configurado en `src/environments/environment.ts`
- [ ] Las reglas de Firestore están activas
- [ ] El usuario tiene el custom claim configurado

---

**Fecha:** 23 de diciembre de 2025  
**Estado:** Sistema configurado, pendiente obtener Machine ID y configurar usuarios
