# OpticaAngular

Sistema de gestión para ópticas desarrollado con Angular 20 y Firebase.

## 🚀 Características

- ✅ Autenticación con Firebase Auth
- ✅ Base de datos Firestore
- ✅ Gestión de clientes
- ✅ Gestión de productos
- ✅ Gestión de proveedores
- ✅ Control de roles (Admin/Empleado)
- ✅ Sistema de facturas y fichas médicas

## 📋 Requisitos Previos

- Node.js (v18 o superior)
- npm o yarn
- Angular CLI (`npm install -g @angular/cli`)
- Cuenta de Firebase

## 🔧 Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/Eliannv/optica-angular.git
cd optica-angular
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar Firebase**
   - Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
   - Habilita Authentication (Email/Password)
   - Crea una base de datos Firestore
   - Copia las credenciales en `src/environments/environment.ts`

4. **Crear usuarios iniciales**
   - Descarga la clave privada de Firebase Admin SDK
   - Guárdala como `serviceAccountKey.json` en la raíz
   - Ejecuta: `node crear-usuarios-iniciales.js`

📖 **Ver [AUTH-README.md](AUTH-README.md) para más detalles sobre autenticación**

## 🏃 Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Importar Datos a Firebase

Para importar datos de productos y proveedores desde archivos JSON a Firebase:

### Importar Productos

```bash
npm run import:productos
```

### Importar Proveedores

```bash
npm run import:proveedores
```

**Requisitos:**

- Tener configurado el archivo `serviceAccountKey.json` con las credenciales de Firebase
- Tener los archivos `productosOptica.json` y `proveedoresOptica.json` en la raíz del proyecto

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
