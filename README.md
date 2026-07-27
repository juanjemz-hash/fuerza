# Fuerza — registro de entrenamiento

Tu app de registro de fuerza/hipertrofia. **Local-first**: los datos viven en tu iPhone (IndexedDB), funciona **sin conexión** y se instala en la pantalla de inicio como una app. Cero servidor, cero coste.

Esquema por serie: **Ejercicio · Peso · S1–S4 · RIR · Molestias · Nota** — el mismo que tenías en Notion.

---

## Qué hace distinta a esta app

- **Tarjeta "Última vez"**: al elegir un ejercicio, te muestra la última sesión (peso, series, RIR) y cuánto subiste respecto a la anterior. Respondes al instante a *"¿supero lo de la semana pasada?"* — el núcleo de la doble progresión.
- **RIR con color**: 0 fallo (rojo) · 1–2 productivo (verde) · 3 ligero (ámbar) · 4+ demasiado ligero (rojo). La propia interfaz te empuja a tu objetivo de RIR 1–2.
- **Fecha automática y fiable**: cada serie coge la fecha real del reloj del iPhone. Se acabó la ambigüedad de fechas que había en Notion.
- **Historial y progresión**: por día, y por ejercicio con una mini-gráfica de la evolución del peso.

---

## Probarla en el ordenador (30 segundos)

Los service workers **no funcionan abriendo `index.html` directamente** (`file://`). Hay que servirla por HTTP. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Y abre `http://localhost:8000` en el navegador. Ya está.

---

## Tenerla en el iPhone

### Opción rápida (para probar hoy) — Netlify Drop
1. Entra en **https://app.netlify.com/drop**
2. Arrastra la carpeta `fuerza-app` completa. Te da una URL `https://…netlify.app` al momento (HTTPS, que es lo que exige una PWA).
3. Abre esa URL en **Safari** en el iPhone → botón **Compartir** → **Añadir a pantalla de inicio**.
4. Ábrela desde el icono: se ve a pantalla completa, sin barras, y funciona sin conexión.

### Opción permanente — GitHub Pages
1. Sube la carpeta a un repo de GitHub.
2. Settings → Pages → Deploy from branch → `main` / root.
3. Tu app queda en `https://TU-USUARIO.github.io/TU-REPO/`. Las rutas ya son relativas, así que funciona en esa subcarpeta sin tocar nada.
4. Añádela a la pantalla de inicio igual que arriba.

> **iOS y descargas**: dentro de la app instalada, los botones "Exportar/CSV" a veces abren el archivo en vez de descargarlo limpio (limitación de Safari en modo standalone). Por eso está **"Copiar"**, que siempre funciona.

---

## El backup es tuyo (importante)

Local-first significa control total, pero **la responsabilidad de la copia es tuya**. Si borras los datos de Safari o pierdes el móvil, los registros se van con él. Por eso, en la pestaña **Historial**:

- **Copiar** → copia todo tu registro en JSON. Pégalo en el chat con tu coach para que lo analice, o guárdalo donde quieras.
- **Exportar** → descarga un `.json` de respaldo. Hazlo cada cierto tiempo.
- **CSV** → columnas compatibles con hojas de cálculo (o para reimportar a Notion).
- **Importar** → restaura desde un `.json` (sobrescribe por id, así que puedes fusionar sin duplicar).

**El bucle con tu coach**: pulsa *Copiar* → pega el JSON en el chat → se revisa igual que se hacía con Notion, sin depender de ninguna API.

---

## Estructura

```
fuerza-app/
├── index.html              → shell (topbar, vista, barra inferior)
├── css/styles.css          → diseño (tema oscuro cálido + latón)
├── js/db.js                → capa de datos IndexedDB + export/import
├── js/app.js               → vistas, lógica, sparkline
├── sw.js                   → service worker (offline)
├── manifest.webmanifest    → metadatos PWA (icono, standalone)
└── icons/                  → iconos (incl. maskable y apple-touch)
```

Sin dependencias, sin build. Es HTML/CSS/JS plano: se edita y se recarga.

## Ideas para ampliar (v2)

- Alertas de RIR (marcar ejercicios que arrastras a 3–4 cuando el objetivo es 1–2, como gemelos o zancadas).
- Plantillas de sesión por día (Push / Pull / Legs / Upper) para prerellenar los ejercicios.
- Peso por serie (ahora es un peso por ejercicio, como en tu esquema de Notion).
- Descanso entre series con cronómetro.

Cuando quieras cualquiera de estas, lo montamos sobre esta base.
