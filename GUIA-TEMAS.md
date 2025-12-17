# Guía de Uso del Sistema de Temas

## 🎨 Sistema de Temas Claro/Oscuro

Tu aplicación de óptica ahora cuenta con un sistema completo de temas con soporte para modo claro y oscuro.

### Características Principales

✅ **Tema Claro y Oscuro** - Cambia entre temas con un solo clic  
✅ **Variables CSS Globales** - Más de 100 variables CSS reutilizables  
✅ **Persistencia** - El tema seleccionado se guarda en localStorage  
✅ **Detección Automática** - Respeta la preferencia del sistema operativo  
✅ **Transiciones Suaves** - Cambios de tema con animaciones fluidas  

---

## 🚀 Cómo Usar

### Cambiar de Tema

El botón para cambiar de tema está ubicado en el **navbar** (esquina superior derecha):
- 🌙 = Cambiar a tema oscuro
- ☀️ = Cambiar a tema claro

### Usar Variables CSS en tus Componentes

En lugar de usar colores fijos, usa las variables CSS del tema:

```css
/* ❌ Evitar colores fijos */
.mi-componente {
  background-color: #ffffff;
  color: #2c3e50;
}

/* ✅ Usar variables del tema */
.mi-componente {
  background-color: var(--bg-card);
  color: var(--text-primary);
}
```

---

## 📚 Variables CSS Disponibles

### Colores Principales
```css
--primary-color
--primary-dark
--primary-light
--secondary-color
--accent-color
--success-color
--warning-color
--danger-color
--info-color
```

### Colores de Fondo
```css
--bg-primary       /* Fondo principal */
--bg-secondary     /* Fondo secundario */
--bg-tertiary      /* Fondo terciario */
--bg-card          /* Fondo de tarjetas */
--bg-hover         /* Fondo en hover */
--bg-active        /* Fondo activo */
```

### Colores de Texto
```css
--text-primary     /* Texto principal */
--text-secondary   /* Texto secundario */
--text-tertiary    /* Texto terciario */
--text-inverse     /* Texto inverso */
--text-muted       /* Texto apagado */
```

### Bordes y Sombras
```css
--border-color
--border-light
--border-dark
--shadow-sm
--shadow-md
--shadow-lg
--shadow-xl
```

### Espaciado
```css
--spacing-xs      /* 0.25rem */
--spacing-sm      /* 0.5rem */
--spacing-md      /* 1rem */
--spacing-lg      /* 1.5rem */
--spacing-xl      /* 2rem */
--spacing-xxl     /* 3rem */
```

### Border Radius
```css
--radius-sm       /* 4px */
--radius-md       /* 8px */
--radius-lg       /* 12px */
--radius-xl       /* 16px */
--radius-full     /* 9999px */
```

### Transiciones
```css
--transition-fast    /* 0.15s */
--transition-normal  /* 0.3s */
--transition-slow    /* 0.5s */
```

---

## 🎯 Clases Utilitarias

### Botones
```html
<button class="btn btn-primary">Primario</button>
<button class="btn btn-secondary">Secundario</button>
<button class="btn btn-success">Éxito</button>
<button class="btn btn-danger">Peligro</button>
<button class="btn btn-sm">Pequeño</button>
<button class="btn btn-lg">Grande</button>
```

### Tarjetas
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Título</h3>
  </div>
  <div class="card-body">
    Contenido de la tarjeta
  </div>
  <div class="card-footer">
    Footer
  </div>
</div>
```

### Formularios
```html
<div class="form-group">
  <label class="form-label">Nombre</label>
  <input type="text" class="form-control" placeholder="Ingrese nombre">
  <span class="form-text">Texto de ayuda</span>
</div>
```

### Badges
```html
<span class="badge badge-primary">Nuevo</span>
<span class="badge badge-success">Activo</span>
<span class="badge badge-warning">Pendiente</span>
<span class="badge badge-danger">Cancelado</span>
```

### Tablas
```html
<table class="table">
  <thead>
    <tr>
      <th>Columna 1</th>
      <th>Columna 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Dato 1</td>
      <td>Dato 2</td>
    </tr>
  </tbody>
</table>
```

### Utilidades de Espaciado
```html
<div class="mt-3">Margin top</div>
<div class="mb-4">Margin bottom</div>
<div class="p-3">Padding</div>
```

### Utilidades de Texto
```html
<p class="text-center">Centrado</p>
<p class="text-primary">Color primario</p>
<p class="text-success">Color éxito</p>
<p class="text-danger">Color peligro</p>
```

### Utilidades de Display
```html
<div class="d-flex justify-center align-center gap-3">
  Flexbox centrado con gap
</div>
```

---

## 💻 Uso Programático del Tema

### En TypeScript

```typescript
import { ThemeService } from './core/services/theme.service';

export class MyComponent {
  constructor(public themeService: ThemeService) {}

  cambiarTema() {
    this.themeService.toggleTheme();
  }

  esTemaOscuro() {
    return this.themeService.isDark();
  }

  establecerTema(tema: 'light' | 'dark') {
    this.themeService.setTheme(tema);
  }
}
```

### En HTML

```html
<button (click)="themeService.toggleTheme()">
  {{ themeService.isDark() ? 'Modo Claro' : 'Modo Oscuro' }}
</button>

<div [class.dark-mode]="themeService.isDark()">
  Contenido
</div>
```

---

## 🎨 Personalización

Para personalizar los colores del tema, edita el archivo `src/styles.css`:

```css
/* Tema Claro */
:root {
  --primary-color: #TU_COLOR;
  /* ... más variables */
}

/* Tema Oscuro */
[data-theme="dark"] {
  --primary-color: #TU_COLOR_OSCURO;
  /* ... más variables */
}
```

---

## 📱 Responsive

Todos los componentes son completamente responsive. Los breakpoints son:

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

---

## ✨ Mejores Prácticas

1. **Siempre usa variables CSS** en lugar de colores fijos
2. **Usa clases utilitarias** cuando sea posible
3. **Mantén consistencia** con el sistema de diseño
4. **Prueba ambos temas** al crear nuevos componentes
5. **Usa transiciones** para cambios suaves

---

¡Disfruta del nuevo sistema de temas! 🎉
