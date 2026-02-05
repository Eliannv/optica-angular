# ✅ Solución: Renovación Automática del Token JWT

## 🔍 Problema Identificado

El JWT de Firebase se emitía una sola vez al hacer login y expiraba después de un tiempo fijo (típicamente 1 hora), sin importar si el usuario estaba activo o no. Esto causaba que la aplicación cerrara sesión automáticamente aunque el usuario estuviera trabajando.

**Síntoma**: La sesión se cerraba automáticamente después de cierto tiempo desde el login, incluso si el usuario seguía interactuando con la aplicación.

## ✨ Solución Implementada

### Sistema de Renovación Dual

Implementado un sistema que combina dos mecanismos:

1. **Auto-logout por inactividad** (30 minutos sin actividad)
2. **Renovación automática de token JWT** (cada 25 minutos si hay actividad)

### Cambios en `session.service.ts`

#### 1. Nuevas Propiedades

```typescript
// Renovar token cada 25 minutos de actividad (antes de que expire el de 30 min)
private readonly TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000;

private tokenRefreshTimer: any;
private lastActivityTime: number = Date.now();
```

#### 2. Método `startTokenRefresh()`

Inicia un intervalo que renueva el token cada 25 minutos **solo si ha habido actividad reciente**:

```typescript
private startTokenRefresh(): void {
  this.tokenRefreshTimer = setInterval(async () => {
    const currentTime = Date.now();
    const timeSinceLastActivity = currentTime - this.lastActivityTime;

    // Solo renovar si ha habido actividad en los últimos 25 minutos
    if (timeSinceLastActivity < this.TOKEN_REFRESH_INTERVAL) {
      await this.refreshAuthToken();
    }
  }, this.TOKEN_REFRESH_INTERVAL);

  // Renovación inicial al restaurar sesión
  this.refreshAuthToken();
}
```

#### 3. Método `refreshAuthToken()`

Renueva el token de Firebase de forma forzada:

```typescript
private async refreshAuthToken(): Promise<void> {
  try {
    const user = this.auth.currentUser;
    if (!user) return;

    // Forzar renovación del token (force refresh = true)
    await user.getIdToken(true);
    
    console.log('✅ Token JWT renovado exitosamente');
    
    const tokenResult = await user.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime);
    console.log(`📅 Token expira en: ${expirationTime.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error al renovar token:', error);
  }
}
```

#### 4. Tracking de Actividad

Cada vez que se detecta actividad del usuario, se actualiza `lastActivityTime`:

```typescript
events$.pipe(
  throttleTime(1000),
  takeUntil(this.destroy$)
).subscribe(() => {
  this.lastActivityTime = Date.now();  // ✅ Registra actividad
  this.resetInactivityTimer();
});
```

## 🎯 Comportamiento Resultante

### Escenario 1: Usuario Activo
- **Actividad continua**: Token se renueva cada 25 minutos
- **Sesión**: Permanece activa indefinidamente mientras haya interacción
- **Resultado**: ✅ Usuario puede trabajar sin interrupciones

### Escenario 2: Usuario Inactivo
- **Sin actividad por 30 minutos**: 
  - No se renueva el token
  - Timer de inactividad expira
  - Sesión se cierra automáticamente
- **Resultado**: 🔒 Cierre por seguridad

### Escenario 3: Usuario Intermitente
- **Actividad cada 20 minutos**:
  - Token se renueva antes de expirar
  - Timer de inactividad se reinicia
- **Resultado**: ✅ Sesión se mantiene activa

## 🔧 Configuración

### Tiempos Configurables

```typescript
// Tiempo máximo sin actividad antes de cerrar sesión
private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 min

// Intervalo de renovación de token (debe ser < INACTIVITY_TIMEOUT)
private readonly TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 min
```

**Recomendación**: `TOKEN_REFRESH_INTERVAL` debe ser 5 minutos menor que `INACTIVITY_TIMEOUT` para dar margen de renovación antes del cierre.

## 📊 Logs de Monitoreo

El sistema muestra en consola información útil:

```
✅ Token JWT renovado exitosamente
📅 Token expira en: 4/2/2026, 15:45:30
```

Esto permite verificar que el sistema está funcionando correctamente.

## ⚡ Optimizaciones

1. **Throttling**: Eventos de usuario procesados máximo 1 vez por segundo
2. **Condicional**: Solo renueva token si hay actividad reciente
3. **Limpieza**: Timers se limpian apropiadamente al cerrar sesión
4. **Renovación inicial**: Se renueva token al restaurar sesión guardada

## 🧪 Cómo Probar

1. **Iniciar sesión** y abrir consola del navegador
2. **Interactuar** con la aplicación (mover mouse, hacer clicks)
3. **Esperar 25 minutos** con actividad continua
4. **Verificar** en consola: "✅ Token JWT renovado exitosamente"
5. **Dejar inactivo 30 minutos** → Debe cerrar sesión automáticamente

## 🔐 Seguridad

Esta solución mantiene la seguridad del sistema:
- ✅ Cierra sesión si no hay actividad
- ✅ Mantiene sesión activa solo si hay uso real
- ✅ No permite sesiones abandonadas indefinidas
- ✅ Token siempre está actualizado mientras hay actividad

---

**Fecha**: 4 de febrero de 2026
**Archivos Modificados**: 
- `src/app/core/services/session.service.ts`

**Estado**: ✅ Implementado y probado
