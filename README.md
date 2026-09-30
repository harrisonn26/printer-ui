# printer-ui

A small Klipper/Moonraker web UI, built to sit alongside OrcaSlicer: Orca
uploads and starts prints, this shows and controls the machine.

Svelte 5 + Vite, no UI framework. Scope is deliberately narrow — see
[Scope](#scope).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173, proxies Moonraker
npm test         # vitest
npm run check    # svelte-check + tsc
npm run build    # → dist/
```

The dev server proxies `/websocket` and Moonraker's HTTP API to
`MOONRAKER_TARGET` (default `http://192.168.0.140:7125`), so the app always
talks same-origin, exactly as it does behind nginx:

```bash
MOONRAKER_TARGET=http://printer.local:7125 npm run dev
```

## Which printer it connects to

1. An address saved in Settings (per browser)
2. `moonrakerUrl` in the deployed `config.json`
3. The page's own host, `/websocket`

## Deploy

```bash
./deploy/deploy.sh   # build, then copy to harrison@192.168.0.140:~/printer-ui
```

`deploy/nginx-printer-ui.conf` serves `~/printer-ui/dist` on port 4411 next
to the existing Fluidd install and proxies Moonraker, including the OctoPrint
compatibility API that Orca uploads through. Installing it is a one-time sudo
step; the script prints the commands. `deploy/nginx-printer-ui-ender5.conf`
serves the same app on port 4412 with Moonraker proxied to 7126 (the Ender 5),
so each Orca printer profile can point at its own printer's port. Override the target with `DEPLOY_HOST`
and `DEPLOY_DIR`.

## Design

Direction C, "job-first": the current print dominates — a large stage (the
layer preview, once it exists; the progress ring until then) beside the job
details — with a narrow right rail for temperatures, toolhead and macros.
Dark warm neutrals, one periwinkle accent, Archivo for text and JetBrains
Mono for every number (both bundled, so the UI works offline). Phones stack
the stage over the details and move navigation to a bottom tab bar. All
values live as tokens in `src/app.css`.

## Layout

```text
src/
├── lib/
│   ├── moonraker/   socket (JSON-RPC, retry, status batching), session state
│   │                machine, JWT tokens, printer objects store
│   ├── ui/          primitives: Button, Card, Pill, TextField, Icon, Toasts
│   ├── gcode.ts     G-code builders: moves, targets, Z offset, macro params
│   ├── config.ts    Moonraker URL resolution
│   └── router.svelte.ts  hash router
├── components/      app shell and dashboard cards
├── views/           Connecting, Login, Dashboard, Jobs, Console, Machine, Settings
├── workers/         G-code parsing off the main thread
├── typings/         Klipper/Moonraker types, from Fluidd
└── app.css          design tokens (light/dark)
```

`session` owns the connection lifecycle:
`initializing → connecting | disconnected → identifying → ready | authenticating`.
Printer objects live in a `SvelteMap`, one entry per Klipper object, so a
component reading `printer.get('extruder')` only re-renders when the extruder
changes.

## Scope

Done: connection and auth, job panel, temperatures with editable targets,
toolhead (jog, home, Z offset), macros with parameters, console, thermal
chart (uPlot, 20 min), camera (MJPEG stream, snapshot polling, iframe),
jobs (G-code files with thumbnails and search, print history, reprint),
G-code layer preview (worker-parsed, live front from file_position, arcs),
bed mesh heatmap (active mesh and saved profiles), fans/pins/LEDs, host
stats, services, updates, power devices, config warnings and SAVE_CONFIG,
extrude/retract, speed and flow overrides, temperature presets (stored in
Moonraker's database), exclude object, Z offset save, live tuning (pressure
advance, limits, firmware retraction), console autocomplete, bed screws. WebRTC/HLS cameras are not supported yet. Not planned: file
manager, config editor, MMU/AFC, Spoolman, timelapse.

## License

GPL-3.0. Parts are ported from [Fluidd](https://github.com/fluidd-core/fluidd)
(GPL-3.0): the `src/typings` declarations, the session state machine, the
token refresh policy and the JSON-RPC error helpers.
