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
| `live-server.js` | Dependency-free Node bridge + static server for the IBOS live data **and the shared GPS tag store**. |
| `qrcode.js` | Local QR-code generator (MIT, Kazuhiko Arase) used for printable workcenter labels. |
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
- `GET /api/tags` → shared workcenter tags + map calibration (`tags.json`)
- `PUT /api/tags` → replace the tag list (`{tags:[...], meta:{...}}`)
- `POST /api/tags` → upsert one tag (`{tag:{...}}`)
- `DELETE /api/tags?id=…` → delete one tag

> Opening `index.html` directly (`file://`) also works as long as `live-server.js` is running —
> it reads from `http://localhost:8787`. If the bridge is **not** running, the silos and live TPH show
> **"waiting for IBOS…"** (that is the only reason they appear offline).

## Live values (IBOS `milldata`)
| Key | Meaning | Shown on |
|-----|---------|----------|
| `loesche_TPH` | Loesche mill throughput (TPH) | `WC-GR-01` VRM-1 — Loesche Mill |
| `fls_TPH` | FLS mill throughput (TPH) | `WC-GR-02` VRM-2 — FLS Mill |
| `SILO-1` / `SILO-2` | PCC cement silo fill (%) | `WC-ST-03` PCC Silo 1 / `WC-ST-05` PCC Silo 2 |
| `OPC-1` / `OPC-2` | OPC silo fill (%) | `WC-ST-02` OPC Silo 1 / `WC-ST-04` OPC Silo 2 |
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
- **3D interactive scene** (three.js) — orbit (drag), zoom (wheel), auto-rotate, reset view.
- **Workcenters as status dots** — each work center has a small colour-coded marker (green / amber / red)
  floating above it (no cards cluttering the model). **Click/tap a work center to open its details**;
  hover (desktop) shows a quick tooltip with the current value.
- **Walk in Floor** tab — first-person Gemba walk-through: **W A S D / arrow keys** to move, **Shift** to
  run, **drag** to look, **Esc** to exit; the status dots stay visible as you walk the plant.
- **Mobile friendly** — responsive layout, touch orbit + pinch-zoom, tap-to-open bottom-sheet details,
  and a **Hide panels** button to clear the overlays for a full-screen map.
- **Silo fill colours in 3D** — each silo is a translucent tank whose coloured fill rises with the live
  level, shaded **green → yellow → red** (low = green, nearly full = red) so the level reads at a glance.
- **Material-flow pipes** — the connectors from the plant flowsheet are drawn as 3D pipes with
  **animated flow markers** running along them, so the process (clinker → mills → silos → packers →
  dispatch) reads like the drawing.
- **Tag metric selector**: **Live TPH / Silo %** (default) · **OEE %** · **Production MT** · **Downtime min**.
- **RAG logic**
  - Mills (OEE): green ≥ 75 %, amber 60–75 %, red < 60 %. Production achievement: ≥100 / 85–100 / <85 %.
  - Equipment: unplanned NPT → green ≤ 5 min, amber < 60 min, red ≥ 60 min.
  - Silos (live): ≥ 90 % red (nearly full), 75–90 % amber. Clinker silo (live): ≤ 15 % red (feed risk).
- **HUD** — **Net Production · Today** (good MT; sub-line shows gross, wastage and % of target),
  Live FLS/Loesche TPH + silo levels, plant OEE, and a green · amber · red workcenter count.
- **Machine Status panel** (bottom-left) — ON/OFF for LOESCHE, FLS, Packer 1–5, Grid supply.
- **Silo Levels panel** (bottom-right) — every silo listed with a live fill bar, % and **quantity in MT**
  (level × capacity): Clinker 50,000 MT; OPC 1–2 1,000 MT each; PCC 1–2 10,000 MT each.
  The drill panel also shows Level / Quantity / Capacity.
- **Day / MTD toggle** for the sheets-based metrics.
- **Click a work center** → drill panel (live value, output, achievement, OEE factors, NPT, top downtime
  reasons, IBOS last-updated) plus a link to the full OEE dashboard.
- **Fallbacks** — sheets unavailable → offline snapshot; IBOS bridge not running → markers fall back to
  downtime and the HUD shows the bridge as offline.

## Workcenter tagging (GPS survey)
Use **Tag Workcenter** to walk the plant and fix a location to each workcenter.

1. Open the dashboard, tap **Tag Workcenter**, and allow location access.
2. Stand at the workcenter and tap **Use my location**. Wait for a fix; the accuracy
   (`± m`) turns green ≤8 m, amber ≤20 m, red above that. The app averages recent fixes
   before saving, so give it a few seconds.
3. Type the **workcenter name** (existing names autocomplete), optionally set a code, zone and note.
4. **Confirm & fix location** → the tag is saved, a pin is placed on the 3D map (after calibration),
   and a **QR label** is generated. Print it or download it as PNG.
5. **Tags (n)** lists every saved tag with Locate / QR / Delete and JSON export/import.

### One-time map calibration
GPS gives latitude/longitude, but the 3D map uses the plant flow-sheet coordinates. Calibrate once:

1. Stand at a known workcenter, open **Calibrate map**, select that workcenter and tap
   **Capture GPS here (10 s)**.
2. Move to a second known workcenter and repeat. A **third anchor** is recommended
   (it enables a full affine fit and handles the drawing's rotation/mirroring).
3. Check the **fit error** and **scale**, then **Save calibration**. Existing and new tags
   are re-projected onto the map automatically.

Tags are stored in `tags.json` through `live-server.js` (`/api/tags`). The panel badge shows
**shared** when the bridge is reachable, or **local** when the browser is offline — local edits
are queued in `localStorage` and pushed when the bridge comes back. `tags.json` is git-ignored
because it contains site coordinates.

> **GPS + HTTPS:** browsers block geolocation on insecure LAN addresses (`http://192.168.x.x`).
> For phone use, either open the dashboard through an **HTTPS tunnel** to this machine
> (e.g. `cloudflared tunnel --url http://localhost:8787`) so GPS **and** `/api/tags` work
> same-origin, or use the GitHub Pages URL (GPS works; tags stay on the phone until exported).
> `localhost` also counts as secure on the PC running the bridge.

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
Deployed as a **static** site on GitHub Pages — anyone can open it, from anywhere:

**https://sanjeed-ferhan.github.io/akij-cement-3d-factory-map/**

### Tags on GitHub Pages
The static site reads a `tags.json` placed next to `index.html` (use **Download tags.json** in
the **Tags** dialog and commit it to publish the pins). Pages cannot write, so on the public site
new tags stay in that phone's `localStorage`. For live shared tagging use the local bridge over
HTTPS, as described in **Workcenter tagging** above.

### Live data from anywhere (no server needed)
The IBOS feed is published to the site by a **GitHub Action** (`.github/workflows/live.yml`) that runs
on GitHub's cloud every ~5 minutes and, within each run, re-publishes about once a minute:

1. `collect-live.mjs` connects to IBOS (credentials from repo **secrets** `IBOS_USER` / `IBOS_PASS`),
   gathers `milldata` (silo levels + mill TPH) and the machine status topics.
2. It writes `live.json` to the repo (main branch), so GitHub Pages serves it same-origin.
3. The dashboard reads `live.json` (cache-busted) → **everyone sees live silo levels, mill TPH and
   machine status**, updating roughly every minute.

Statuses are carried forward between runs, so event-driven packer states don't flicker to “—”.

The dashboard tries sources in order: local bridge → public `live.json` (Pages) → Sheets.
So the owner gets the freshest data (local bridge, ~10 s) and everyone else gets the cloud feed.

`live-server.js` / `start-bridge.bat` are **not** published (they contain the IBOS credentials) and are
listed in `.gitignore`.
