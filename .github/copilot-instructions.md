# Copilot / AI agent instructions for OpticaAngular

Quick reference for AI coding agents working on this repository.

## Big picture
- Angular 20 SPA using a hybrid of lazy-loaded NgModules (under `src/app/modules/*`) and many **standalone components** (`standalone: true`). Main routes are in `src/app/app.routes.ts` and modules are lazy-loaded via `loadChildren`.
- Data layer: Firebase Firestore via `@angular/fire` (see `src/app/app.config.ts` for providers; `src/environments/environment.ts` holds firebase config).
- UI: simple Bootstrap-based CSS with a theme system documented in `GUIA-TEMAS.md` and persisted using `ThemeService` (signals + localStorage).

## Key files & directories (where to look first)
- `src/app/app.config.ts` — app-level providers (Firebase, Router, global error listeners).
- `src/app/app.routes.ts` — app entry/route configuration (lazy loading).
- `src/environments/environment.ts` — firebase credentials and flags.
- `src/app/modules/*` — feature modules and pages (follow existing module structure when adding features).
- `src/app/core/services/*` — Firestore-backed services (pattern for CRUD operations).
- `GUIA-TEMAS.md` — canonical UI variables, colors and spacing conventions.
- `package.json` & `angular.json` — scripts and build/test configuration.

## Project-specific conventions & patterns
- Use standalone components where existing pages do (look for `standalone: true`). Standalone components declare `imports: [...]` (e.g., `CommonModule`, `ReactiveFormsModule`).
- Firestore usage:
  - Collections: `collection(this.firestore, 'clientes')` and `collectionData(..., { idField: 'id' })` to include the Firestore doc id.
  - Documents: `doc(this.fs, 'clientes/${id}/historialClinico/main')` — note a single `main` document per client used for clinical history.
  - Timestamps: `createdAt: new Date()` (client) or `serverTimestamp()` (server-side consistent timestamps).
- Services return Observables for reads (`collectionData`, `docData`) and Promises for writes (`addDoc`, `updateDoc`, `setDoc`/`getDoc`).
- Reactive forms are used (FormBuilder/ReactiveFormsModule) in pages like `crear-historial-clinico`.
- Naming: models live in `src/app/core/models/*.model.ts` and typically mirror Firestore shapes.

## Workflows & commands (how to run things)
- Start dev server: `npm start` (runs `ng serve`) — opens on `http://localhost:4200/` by default.
- Build: `npm run build` (uses Angular CLI building; watch mode: `npm run watch`).
- Unit tests: `npm test` (Karma + Jasmine). Tests for components exist next to each page (e.g., `*.spec.ts`).
- VS Code: recommended extension `angular.ng-template` and workspace tasks/launch configs are in `.vscode` (see `tasks.json` / `launch.json`).

## Testing & mocking guidance (practical tips)
- Tests are Karma/Jasmine based. Components often import standalone modules — in tests include same `imports` used by the component (or use `TestBed.overrideComponent` for compatibility).
- Services that call Firestore should be stubbed/mocked in tests (use AngularFire testing helpers or provide small stubs for `Firestore` to avoid hitting real backend during unit tests).

## Examples/recipes (copyable)
- Read all clients (service):
```ts
this.clientesSrv.getClientes().subscribe(list => ...);
```

- Save clinical history (service + single doc per client):
```ts
await historialSrv.guardarHistorial(clienteId, form.value);
```

- Add a new standalone page with a reactive form:
  1. Create component with `standalone: true` and add `imports: [CommonModule, ReactiveFormsModule]`.
  2. Add a route under `src/app/modules/<feature>/<feature>-routing-module.ts` or create a new module and lazy load in `app.routes.ts`.

## Notable decisions / gotchas
- Clinical history is stored as a single document at `clientes/{id}/historialClinico/main` — changing to multiple entries requires updating services and consumers.
- `environment.ts` contains firebase config (public keys). For local testing, avoid writing to production Firestore unless intended.
- Global app providers include `provideZoneChangeDetection` and `provideBrowserGlobalErrorListeners` — edits here affect global error handling and change detection behavior.

## Style & formatting
- Prettier settings are in `package.json` (note `singleQuote: true` and `html` parser for template formatting).
- Follow CSS variables in `GUIA-TEMAS.md` for colors & spacings.

---
If any section is unclear or you'd like me to add examples for testing Firestore, or describe how to mock `Firestore` in unit tests, tell me which part to expand. Thanks! 🎯
