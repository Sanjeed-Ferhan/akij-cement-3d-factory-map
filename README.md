# Akij Cement — 3D Factory Map (Workcenter Tags)

Interactive **3D factory floor map** for **Akij Cement (ACCL — Cement Grinding / VRM plant)**.
Each machine / area on the floor is a **workcenter tag** showing **RAG status + live values**, with click-through to the full OEE dashboard.

Live data comes from **two sources**:
- **IBOS** `ops.ibos.io:12081` (FlowFuse / Node-RED) → silo levels + mill TPH, streamed over Socket.IO.
- **Google Sheets** (ACCL VRM Production Report + VRM Breakdown) → OEE, output, downtime.

## Files
| File | Purpose |
|------|---------|
| `index.html` | The 3D dashboard (three.js, single file). |
| `live-server.js` | Dependency-free Node bridge + static server for the IBOS live data. |
| `start-bridge.bat` | Windows one-click launcher for `live-server.js`. |

## Quick start
IBOS is behind HTTP Basic auth and streams over Socket.IO, which a browser page cannot read
cross-origin — so `live-server.js` connects to it, caches the latest `milldata`, exposes it as
JSON, and serves the dashboard **same-origin**:

```powershell
node live-server.js
# then open http://localhost:8787/
```

**Easiest on Windows:** double-click **`start-bridge.bat`** — it starts the bridge and keeps the
window open.

> The bridge must be **running continuously** for live data. If you close the window (or the PC
> sleeps/reboots), the dashboard shows **OFFLINE / "waiting for IBOS…"**. Just start it again.

`live-server.js` connects with Basic auth, auto-reconnects on drop, and exposes:
- `GET /api/milldata` → latest silo levels + mill TPH
- `GET /api/live` → same + all topics + connection status
- `GET /api/sheets?gid=N` → Google Sheets CSV proxy (so the dashboard works from `file://` too, no CORS)

> Opening `index.html` directly (`file://`) also works as long as `live-server.js` is running —
> it reads from `http://localhost:8787`. If the bridge is **not** running, the silos and live TPH show
> **"waiting for IBOS…"** (that is the only reason they appear offline).

## Live values (IBOS `milldata`)
| Key | Meaning | Shown on |
|-----|---------|----------|
| `loesche_TPH` | Loesche mill throughput (TPH) | `WC-GR-01` VRM-1 — Loesche Mill |
| `fls_TPH` | FLS mill throughput (TPH) | `WC-GR-02` VRM-2 — FLS Mill |
| `SILO-1` / `SILO-2` | PCC cement silo fill (%) | `WC-ST-01` / `WC-ST-02` |
| `OPC-1` / `OPC-2` | OPC silo fill (%) | `WC-ST-03` / `WC-ST-04` |
| `CLNK-SILO` | Clinker silo fill (%) | `WC-RM-03` Clinker Silo |

## Machine status (IBOS)
Pushed by the IBOS flow on topics `loesche.status`, `fls.status`, `P1`–`P5` (packers), `GRID.status`.
The bridge maps these into `/api/live` → `status` and the dashboard shows a **Machine Status** panel
(bottom-left) with **ON / OFF** pills for LOESCHE Mill, FLS Mill, Packer 1–5 and Grid supply, plus
**RUNNING / STOPPED** on the two mill tags (a STOPPED mill turns its tag red).

> Note: the mill/grid statuses stream continuously; the packer statuses are **event-driven** (the IBOS
> flow only pushes them when they change), so a packer that hasn't changed shows **—** until its next update.

## Workcenters
`WC-RM-03` Clinker Silo · `WC-RM-01` Clinker Hopper · `WC-RM-02` Belt Conveyor 511WF150 ·
`WC-TR-01` Bucket Elevator 513 BE · `WC-GR-01` VRM-1 (Loesche) · `WC-GR-03` Rotary Feeder 531 RF506 ·
`WC-GR-02` VRM-2 (FLS) · `WC-GR-04` Rotary Feeder 531 RF503 · `WC-TR-02` Bucket Elevator 514 BE ·
`WC-ST-01/02` Cement Silos · `WC-ST-03/04` OPC Silos · `WC-DP-01` Packing Plant & Dispatch.

## Features
- **3D interactive scene** (three.js) — orbit (drag), zoom (wheel), auto-rotate, reset view;
  workcenter tags are anchored in 3D and projected to screen each frame, with collision avoidance.
- **Walk in Floor** tab — first-person Gemba walk-through: **W A S D / arrow keys** to move, **Shift** to
  run, **drag** to look, **Esc** to exit; workcenter tags stay visible as you walk the plant.
- **Silo fill colours in 3D** — each silo is a translucent tank whose coloured fill rises with the live
  level, shaded **green → yellow → red** (low = green, nearly full = red) so the level reads at a glance.
- **Tag metric selector**: **Live TPH / Silo %** (default) · **OEE %** · **Production MT** · **Downtime min**.
- **RAG logic**
  - Mills (OEE): green ≥ 75 %, amber 60–75 %, red < 60 %. Production achievement: ≥100 / 85–100 / <85 %.
  - Equipment: unplanned NPT → green ≤ 5 min, amber < 60 min, red ≥ 60 min.
  - Silos (live): ≥ 90 % red (nearly full), 75–90 % amber. Clinker silo (live): ≤ 15 % red (feed risk).
- **HUD** — **Net Production · Today** (good MT; sub-line shows gross, wastage and % of target),
  Live FLS/Loesche TPH + silo levels, plant OEE, and a green · amber · red workcenter count.
- **Machine Status panel** (bottom-left) — ON/OFF for LOESCHE, FLS, Packer 1–5, Grid supply.
- **Silo Levels panel** (bottom-right) — every silo listed with a live fill bar and %:
  Clinker Silo, Cement Silo 1–2 (PCC), OPC Silo 1–2, colour-coded by RAG.
- **Day / MTD toggle** for the sheets-based metrics.
- **Click a tag** → drill panel (live value, output, achievement, OEE factors, NPT, top downtime
  reasons, IBOS last-updated) plus a link to the full OEE dashboard.
- **Fallbacks** — sheets unavailable → offline snapshot; IBOS bridge not running → tags fall back to
  downtime and the HUD shows the bridge as offline.

## Configuration
- **Google Sheet / targets / dashboard link** — `CFG` object in `index.html`.
- **Workcenters, positions, live-key mapping** — `WC` array in `index.html`
  (`live` = key in the IBOS payload, `liveKind` = `mill` | `silo` | `clinker`).
- **IBOS host / credentials / port** — `CFG` at the top of `live-server.js`.

## Notes
- Requires Node.js (no npm packages needed — the Engine.IO polling client is pure `http`).
- Served over `http://localhost:8787` so the dashboard can read `/api/live` same-origin.
  Opening `index.html` directly via `file://` also works, falling back to `http://localhost:8787/api/live`.

## GitHub Pages deployment
This repo is deployed as a **static** site on GitHub Pages — open it directly, no bridge needed:

**https://sanjeed-ferhan.github.io/akij-cement-3d-factory-map/**

> On GitHub Pages the **Google Sheets** metrics (Net Production, OEE, downtime) load directly, but the
> **IBOS live data** (silo levels, mill TPH, machine status) needs the local Node bridge — so those
> panels show *offline* on the public site. Run `live-server.js` locally for the full live view.

`live-server.js` / `start-bridge.bat` are **not** published (they contain the IBOS credentials) and are
listed in `.gitignore`.
