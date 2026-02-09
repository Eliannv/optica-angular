# 🔐 Quick Reference: Sistema "Recuérdame"

> Guía rápida para desarrolladores

---

## 🎯 Objetivo

Implementar persistencia de sesión segura con validación de dispositivo y sucursal.

---

## 📁 Archivos Modificados

```
src/
├── app/
│   ├── app.ts ✏️                                    [Auto-login en ngOnInit]
│   ├── core/
│   │   └── services/
│   │       └── auth.service.ts ✏️                  [setPersistence + validateRestoredSession]
│   └── shared/
│       └── components/
│           └── auth/
│               ├── auth-carousel.html ✏️           [Checkbox "Recuérdame"]
│               ├── auth-carousel.ts ✏️             [rememberMe en loginForm]
│               └── auth-carousel.scss ✏️           [Estilos del checkbox]
└── IMPLEMENTACION-REMEMBER-ME.md 🆕                [Documentación completa]
```

---

## 🔑 Componentes Clave

### 1. **Login Component** (auth-carousel.ts)

```typescript
// Formulario actualizado
loginForm = this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(6)]],
  rememberMe: [false] // ← NUEVO
});

// Login actualizado
onLogin(): void {
  const { email, password, rememberMe } = this.loginForm.value;
  this.authService.login(email, password, rememberMe).subscribe({ ... });
}
```

### 2. **Auth Service** (auth.service.ts)

```typescript
// Método login actualizado
login(email: string, password: string, rememberMe: boolean = false): Observable<Usuario> {
  const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
  
  return from(setPersistence(this.auth, persistence)).pipe(
    switchMap(() => signInWithEmailAndPassword(this.auth, email, password)),
    // ... validaciones
  );
}

// Nuevo método de validación
validateRestoredSession(): Observable<Usuario | null> {
  const currentUser = this.auth.currentUser;
  if (!currentUser) return of(null);
  
  return this.getUserData(currentUser.uid).pipe(
    switchMap(userData => {
      try {
        this.validarAccesoSucursal(userData); // ← Validación crítica
        return of(userData);
      } catch (error) {
        return from(signOut(this.auth)).pipe(map(() => null));
      }
    })
  );
}
```

### 3. **App Component** (app.ts)

```typescript
ngOnInit(): void {
  // Auto-login con validación
  this.authService.validateRestoredSession().subscribe({
    next: (usuario) => {
      if (usuario && !this.isAuthRoute()) {
        this.router.navigate(['/clientes/historial-clinico']);
      } else if (!usuario && !this.isAuthRoute()) {
        this.router.navigate(['/login']);
      }
    }
  });
}
```

---

## 🔒 Flujo de Seguridad

```
┌──────────────────────────────────────────────────────────┐
│ 1. USUARIO HACE LOGIN                                    │
├──────────────────────────────────────────────────────────┤
│ ┌─────────────┐                                          │
│ │ Marca       │ → browserLocalPersistence (persistente)  │
│ │ "Recuérdame"│                                          │
│ └─────────────┘                                          │
│                                                           │
│ ┌─────────────┐                                          │
│ │ NO marca    │ → browserSessionPersistence (temporal)   │
│ │ "Recuérdame"│                                          │
│ └─────────────┘                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 2. USUARIO REABRE LA APP                                 │
├──────────────────────────────────────────────────────────┤
│ App.ngOnInit() ejecuta:                                  │
│   ↓                                                       │
│ validateRestoredSession()                                │
│   ↓                                                       │
│ ┌───────────────────────────────────────────┐            │
│ │ ✅ Sesión existe en Firebase Auth?        │            │
│ └───────────────────────────────────────────┘            │
│   ↓ SÍ                        ↓ NO                       │
│   ↓                           └─→ Login                  │
│   ↓                                                       │
│ ┌───────────────────────────────────────────┐            │
│ │ ✅ Usuario existe en Firestore?           │            │
│ └───────────────────────────────────────────┘            │
│   ↓ SÍ                        ↓ NO                       │
│   ↓                           └─→ Logout + Login         │
│   ↓                                                       │
│ ┌───────────────────────────────────────────┐            │
│ │ ✅ Machine ID coincide?                   │            │
│ └───────────────────────────────────────────┘            │
│   ↓ SÍ                        ↓ NO                       │
│   ↓                           └─→ Logout + Error         │
│   ↓                                                       │
│ ┌───────────────────────────────────────────┐            │
│ │ ✅ Sucursal coincide?                     │            │
│ └───────────────────────────────────────────┘            │
│   ↓ SÍ                        ↓ NO                       │
│   ↓                           └─→ Logout + Error         │
│   ↓                                                       │
│ ✅ AUTO-LOGIN EXITOSO → Dashboard                        │
└──────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing

### Comando para probar

```bash
# Iniciar dev server
npm start

# Escenarios a probar:
# 1. Login sin checkbox → Cerrar app → Reabrir (debe pedir login)
# 2. Login con checkbox → Cerrar app → Reabrir (auto-login)
# 3. Login con checkbox → Cambiar Machine ID en código → Reabrir (debe rechazar)
```

### Mock de Machine ID (para testing)

```typescript
// En auth.service.ts, temporalmente modificar validarAccesoSucursal:
private validarAccesoSucursal(userData: Usuario): void {
  const electronApi = (window as any).electron;
  
  if (!electronApi) {
    console.warn('⚠️ Modo desarrollo');
    return; // ← Permite testing en navegador
  }
  // ... resto del código
}
```

---

## 📊 Estados de Persistencia

| Estado | Descripción | Cuando expira |
|--------|-------------|---------------|
| `browserLocalPersistence` | Sesión guardada localmente | Logout manual o validación fallida |
| `browserSessionPersistence` | Sesión temporal | Al cerrar pestaña/app |

---

## ⚠️ Notas Importantes

1. **NO se guarda contraseña**: Firebase maneja tokens internamente de forma segura
2. **Validación en cada restauración**: Machine ID y Sucursal se verifican siempre
3. **Auto-logout preventivo**: Cualquier falla de validación cierra sesión automáticamente
4. **Compatible con Electron**: Funciona tanto en desarrollo (navegador) como en app empaquetada

---

## 🐛 Troubleshooting

### "Sesión restaurada inválida" en consola

**Causa**: Machine ID o Sucursal no coinciden  
**Solución**: 
```bash
node set-user-machine-id.js <email> <machine-id> PASAJE
```

### Auto-login no funciona después de cerrar app

**Causa**: Usuario no marcó "Recuérdame"  
**Solución**: Volver a hacer login con checkbox marcado

### Error "Cannot find module '@angular/fire/auth'"

**Causa**: Dependencias no instaladas  
**Solución**:
```bash
npm install
```

---

## 📞 Soporte

Para dudas o issues:
1. Revisar [IMPLEMENTACION-REMEMBER-ME.md](IMPLEMENTACION-REMEMBER-ME.md)
2. Revisar [SEGURIDAD-MACHINE-ID.md](SEGURIDAD-MACHINE-ID.md)
3. Verificar logs en consola del navegador

---

**✅ Sistema listo para producción**
