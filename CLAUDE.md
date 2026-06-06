# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

PediApp es una PWA (Progressive Web App) de historia clínica pediátrica, desplegada en GitHub Pages en `https://diegoastein.github.io/pediapp/`. No tiene build step — `index.html` es el único artefacto de la app.

## Desarrollo local

Levantar servidor estático desde la raíz del repo:

```bash
python3 -m http.server 8080
# Abrir: http://localhost:8080/index.html
```

El Service Worker registra el scope `/pediapp/`, por lo que en localhost puede aparecer un warning en consola — es ignorable, la app funciona igual.

## Arquitectura

Todo el código vive en `index.html` como un único archivo con tres secciones:

1. **Script de registro del SW** (`<script>` clásico) — se ejecuta antes que Firebase para máxima compatibilidad. Omite el registro si el protocolo no es `http/https`.

2. **Script de Firebase** (`<script type="module">`) — inicializa Firebase Auth y Firestore con `persistentLocalCache` (IndexedDB), lo que habilita el modo offline. Expone todo en `window.firebaseData` para que el script de React lo consuma. Despacha `firebase-ready` cuando termina.

3. **Script de React** (`<script type="text/babel">`) — app completa en React 18 vía CDN + Babel standalone (sin bundler). Contiene todos los componentes, helpers y lógica de negocio.

### Estructura de componentes React (en orden de definición)

- **Iconos** — SVG inline wrapeados en un componente `Icon` base.
- **Helpers** — `calculateAge`, `calculateAgeAtDate`, `formatDate`, `generatePatientSummary`, etc.
- **UI base** — `Card`, `Button`, `Modal`, `ConfirmModal`, `TagInput`.
- **`App`** — componente raíz. Maneja auth, estado global, listeners de Firestore.
- **`SettingsView`** — configuración de listas (obras sociales, planes) y acceso a Finanzas.
- **`FinanzasView`** — registro de ingresos/egresos por consultorio (Ramos, San Martín, Wenceslao de Tata), navegación mensual y resumen histórico.
- **`ListManager`** — editor de listas reutilizable usado dentro de SettingsView.
- **`PatientForm`** — formulario completo de paciente: datos personales, obra social, antecedentes, consultas, fotos, pendientes.

### Firestore — estructura de datos

```
artifacts/historia-clinica-v1/users/{uid}/
  patients/{patientId}        — fichas de pacientes
  settings/lists              — { healthInsurances: [], plans: [] }
  settings/finanzas           — { "YYYY-MM": { ramos: {alquiler, obraSocial, particular}, sanMartin: {...}, wenceslao: {...} } }
```

### Vistas (`view` state)

`"list"` → `"form"` → volver a `"list"`  
`"list"` → `"settings"` → `"finanzas"` → volver a `"settings"`

## Service Worker (`sw.js`)

- Cache name: `pediapp-v5` — **incrementar** al hacer cambios que deban invalidar el caché del browser.
- Estrategia: Cache First para recursos propios y CDNs; bypass total para todos los hosts de Firebase (Firebase maneja su propio offline con IndexedDB).

## Deploy

Push a `main` → GitHub Pages publica automáticamente desde la raíz del repo.
El remote SSH está configurado: `git@github.com:diegoastein/pediapp.git`
