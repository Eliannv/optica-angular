# 🚀 GUÍA RÁPIDA: Sistema Multi-Sucursal

## ✅ Checklist de Instalación

### 1. Dependencias (Ya instaladas)
- [x] `firebase-admin` en package.json
- [x] `serviceAccountKey.json` en raíz del proyecto

### 2. Archivos Creados
- [x] Modelo: `maquina-autorizada.model.ts`
- [x] Servicio: `maquinas-autorizadas.service.ts`
- [x] Componente admin: `gestionar-maquinas/`
- [x] Scripts auxiliares: `get-current-machine-id.js`, `registrar-maquinas-iniciales.js`

### 3. Archivos Modificados
- [x] `electron/main.js` → Consulta Firestore
- [x] `firestore.rules` → Reglas multi-sucursal
- [x] `app.routes.ts` → Ruta `/gestionar-maquinas`
- [x] `empleados.component.html` → Botón de acceso

---

## 🔧 Pasos de Configuración

### Paso 1: Desplegar Reglas de Firestore

```bash
cd "c:\Users\ASUS VIVOBOOK\Documents\Programación\Angular\optica-angular"
firebase deploy --only firestore:rules
```

### Paso 2: Registrar Máquinas Iniciales

**Opción A: Desde la aplicación web (Recomendado)**
1. Iniciar sesión como administrador
2. Ir a Empleados → Gestionar Máquinas
3. Clic en "Registrar Máquinas Iniciales"

**Opción B: Script directo**
```bash
node registrar-maquinas-iniciales.js
```

### Paso 3: Probar Sistema

1. **Ejecutar en máquina autorizada:**
   ```bash
   npm run electron
   ```
   → Debe permitir acceso y mostrar sucursal en título

2. **Ejecutar en máquina NO autorizada:**
   - Mostrará error con Machine ID
   - Copiar ese ID
   - Registrarlo en panel de admin

---

## 📋 Uso Diario

### Agregar Nueva Máquina

1. **Obtener Machine ID:**
   ```bash
   node get-current-machine-id.js
   ```
   O ejecutar Electron y copiar ID del error

2. **Registrar en sistema:**
   - Login como admin → Gestionar Máquinas
   - Nueva Máquina
   - Pegar Machine ID
   - Seleccionar sucursal
   - Nombre descriptivo
   - Guardar

### Desactivar Máquina

1. Gestionar Máquinas
2. Localizar la máquina
3. Clic en botón toggle (🔄)
4. Confirmar desactivación

### Activar Máquina

1. Gestionar Máquinas
2. Localizar la máquina desactivada
3. Clic en botón toggle (🔄)
4. Confirmar activación

---

## 🔍 Verificación

### Comprobar que funciona:

1. **Firestore tiene la colección:**
   - Firebase Console → Firestore
   - Debe existir colección `maquinas_autorizadas`
   - Con 4 documentos (las máquinas iniciales)

2. **Las reglas están actualizadas:**
   ```bash
   firebase deploy --only firestore:rules
   ```
   Verificar que no hay errores

3. **Electron puede leer Firestore:**
   - Abrir Electron en máquina autorizada
   - Debe iniciar sin errores
   - Título debe mostrar la sucursal correcta

4. **El panel admin funciona:**
   - Login como admin
   - Ir a Empleados
   - Debe aparecer botón "Gestionar Máquinas"
   - Al hacer clic, debe cargar la lista de máquinas

---

## 🆘 Solución de Problemas

### Error: "No se pudo conectar a Firestore"
```
❌ Causa: serviceAccountKey.json no encontrado o credenciales incorrectas
✅ Solución:
   1. Verificar que existe: serviceAccountKey.json en raíz
   2. Regenerar desde Firebase Console si es necesario
   3. Revisar que el archivo tiene el formato JSON correcto
```

### Error: "Machine ID no autorizado"
```
❌ Causa: Esta máquina no está registrada en maquinas_autorizadas
✅ Solución:
   1. Copiar el Machine ID del mensaje de error
   2. Ir a Gestionar Máquinas (como admin)
   3. Nueva Máquina → Pegar ID → Seleccionar sucursal → Guardar
```

### Máquina sigue bloqueada después de activarla
```
❌ Causa: Electron tiene la verificación en caché
✅ Solución:
   1. Cerrar COMPLETAMENTE Electron
   2. Volver a abrir (consultará Firestore de nuevo)
```

### Reglas de Firestore: "Permission denied"
```
❌ Causa: Las reglas no se desplegaron correctamente
✅ Solución:
   firebase deploy --only firestore:rules
   Verificar que el comando terminó sin errores
```

---

## 🎯 Casos de Uso

### Caso 1: Nueva PC en Pasaje
```
1. Llevar PC nueva a sucursal Pasaje
2. Instalar/copiar la aplicación
3. Ejecutar: npm run electron
4. Copiar Machine ID del error
5. Desde Machala (admin):
   - Gestionar Máquinas → Nueva
   - Machine ID: [pegar]
   - Sucursal: PASAJE
   - Nombre: PC Caja Pasaje
   - Guardar
6. En Pasaje: Cerrar y volver a abrir Electron
7. ✅ Listo
```

### Caso 2: Reemplazar PC en Machala
```
1. En PC nueva ejecutar: node get-current-machine-id.js
2. Copiar Machine ID
3. Gestionar Máquinas
4. Desactivar la PC antigua de Machala
5. Nueva Máquina con el nuevo Machine ID
6. Sucursal: MACHALA
7. Guardar
8. ✅ PC nueva autorizada
```

### Caso 3: PC robada o extraviada
```
1. Gestionar Máquinas
2. Localizar la máquina extraviada
3. DESACTIVAR inmediatamente
4. La máquina ya no podrá acceder al sistema
5. Registrar en observaciones: "Extraviada - [fecha]"
```

---

## 📊 Datos de las Máquinas Iniciales

| Machine ID         | Sucursal       | Nombre                       | Estado |
|--------------------|----------------|------------------------------|--------|
| 858744ddedd2fca1   | DESARROLLO_1   | PC Desarrollo 1              | Activa |
| e1561953fadb3e82   | DESARROLLO_2   | PC Desarrollo 2              | Activa |
| 45dfe499c7a935ed   | PASAJE         | PC Sucursal Pasaje           | Activa |
| d87cced3d5d6611b   | MACHALA        | PC Sede Principal Machala    | Activa |

---

## 🔐 Seguridad

### Mejores Prácticas:
1. ✅ Solo el admin puede modificar `maquinas_autorizadas`
2. ✅ Desactivar en lugar de eliminar (mantiene historial)
3. ✅ Revisar "Último Acceso" regularmente
4. ✅ Machine ID es único por hardware (difícil de falsificar)
5. ✅ Cada inicio de Electron actualiza `ultimoAcceso`

### Auditoría:
- Revisar panel de máquinas semanalmente
- Verificar que solo máquinas conocidas están activas
- Monitorear `ultimoAcceso` para detectar anomalías

---

## 📱 Acceso al Panel de Administración

### Ruta Web:
```
http://localhost:4200/gestionar-maquinas
```

### Acceso Directo:
1. Login como administrador
2. Menú → Empleados
3. Botón "Gestionar Máquinas" (arriba a la derecha)

### Permisos Requeridos:
- Rol: ADMINISTRADOR
- Estado: activo
- Sucursal: cualquiera (MACHALA recomendado para control central)

---

## 🎨 Interfaz del Panel

El panel muestra:
- ✅ Lista completa de máquinas
- ✅ Estado (Activa/Inactiva)
- ✅ Sucursal con colores distintivos
- ✅ Fecha de registro
- ✅ Último acceso
- ✅ Observaciones
- ✅ Acciones: Editar, Activar/Desactivar, Eliminar

Resumen en la parte inferior:
- Total de máquinas
- Activas vs Inactivas
- Cantidad de sucursales

---

¿Listo para empezar? Ejecuta:
```bash
firebase deploy --only firestore:rules
node registrar-maquinas-iniciales.js
npm run electron
```
