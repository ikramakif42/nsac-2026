# ORBIT-LENS — Build Prompt

> **What to build:** A public-facing web tool that displays time-series near-infrared sky images from NASA's SPHEREx mission, letting anyone spot moving objects (asteroids, brown dwarfs, potential "Planet X") and variable stars by watching how a patch of sky changes across observation epochs.

**Team:** Schwarzschildren · **Event:** NASA Space Apps Challenge 2026 — *Planet X and SPHEREx*  
**Tagline:** *Explore the sky through time.*

---

## The Core Task

The user enters sky coordinates (Right Ascension + Declination). The app retrieves every SPHEREx observation of that region, then plays them back as a blink comparator — a looping sequence of images where moving or brightening objects jump out visually. That's the product.

Everything else (spectral analysis, 3D spacetime cube, Gaia overlays, difference imaging) is an enhancement layered on top of that core loop.

---

## Stack

| Layer | Choice |
| :--- | :--- |
| Frontend | React 19 + TypeScript + Vite 6 |
| State | Zustand 5 (with bi-directional URL query sync) |
| 2D Canvas (Primary) | WebGL 2.0 (custom GLSL shaders for blink, dynamic asinh stretch, diff) |
| 3D Engine (Lazy-Loaded) | Three.js / React Three Fiber (Spacetime volume cube & celestial footprint) |
| Backend | Python 3.12 / FastAPI |
| Science Engine | Astropy & NumPy (WCS, FITS parsing, spherical coordinate transforms) |
| Styling | Tailwind CSS v4 (dark theme, design tokens below) |
| Charts | uPlot (102-band SED curve with molecular spans) |

**Design tokens (dark workspace):**
```css
--ol-bg: #0b1020;  --ol-surface: #141d2e;  --ol-accent: #67e8f9;
--ol-warning: #fcd34d;  --ol-danger: #fda4af;  --ol-focus: #facc15;
```

---

## What About Three.js?

**The Rule:** Three.js is for **presentation only**; all coordinate math, WCS projection, and scientific calculations belong in the Python/Astropy backend. Never let Three.js perform celestial trigonometry.

Three.js powers two high-impact visual features (lazy-loaded, toggled from the viewport):
1. **3D Spacetime Volume Cube ($(x, y, t)$ Stack):** Stacks the multi-epoch cutouts along a $Z$-axis of observation time. Static stars form vertical columns, while moving objects (Planet X, brown dwarfs) trace **diagonal trajectory lines** through the volume, making discoveries instantly intuitive for judges.
2. **3D Celestial Sphere & Survey Footprint:** A 3D interactive celestial sphere showing SPHEREx's 6-month survey scan circles, polar orbit precession, and the user's FOV cone on the sky.

> **Implementation Guardrail:** The 2D WebGL2 canvas is the primary, fail-safe viewer that loads first (<100 ms). Three.js is loaded dynamically via `import()` and gracefully degrades if WebGL context is lost.

---

## Routes

| Route | Purpose |
| :--- | :--- |
| `/` | Landing — project purpose, source transparency, "Start exploring" CTA |
| `/explore` | **Primary workbench** — search, 2D/3D viewer, timeline, metadata, SED |
| `/about` | Team, independent status, mandatory disclaimer |
| `/methodology` | Data sources, LVF calibration, known limitations, simulation policy |
| `/terms`, `/privacy` | Legal pages |

> `/explore` must be directly linkable (`/explore?ra=...&dec=...&fov=...`). Never require visiting `/` first.

---

## `/explore` Layout

```
┌─ Top Bar ──────────────────────────────────────────────────────────────┐
│  [RA] [Dec] [Format ▾] [FOV ▾] [Source ▾] [Release ▾]  [Search]  [⤴] │
│  Source Badge: ◉ SPHEREx QR3   [Barnard's ▾] [ε Indi B ▾] …presets   │
└────────────────────────────────────────────────────────────────────────┘
┌─ Viewport (Tabs: [2D Blink] [3D Spacetime Cube] [3D Footprint]) ───────┐
│                                    ┌─ Metadata Inspector ──────────┐   │
│   [crosshair + RA/Dec readout]     │  Observation / Spectral /     │   │
│   [scale bar + North arrow]        │  Coordinates / Quality /      │   │
│   [source badge — always visible]  │  Processing / Provenance      │   │
│                                    │  [copy IDs] [source URL link] │   │
└────────────────────────────────────┴───────────────────────────────┴───┘
┌─ Timeline ─────────────────────────────────────────────────────────────┐
│  ◀  ▶  ▌▌   [●────────────────────────]   0.5 fps ▾   [obs list ▾]   │
│  Epoch 1 / 7 · 2025-05-14 UTC · Index-spaced (irregular gaps shown)   │
└────────────────────────────────────────────────────────────────────────┘
┌─ SED Drawer (collapsible) ─────────────────────────────────────────────┐
│  Flux (MJy/sr) vs λ (0.75–5.0 μm) · 102 bands · H₂O CO₂ CO CH₄ ▾   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Backend API Endpoints

```
POST /search        body: {ra, dec, fov_deg, release, filters?}
                    → ObservationRecord[] (time-sorted)

GET  /cutout        ?productId=...&ra=...&dec=...&fov_deg=...
                    → CIDS ObservationRecord (flux + variance + flags)

GET  /spectrum      ?ra=...&dec=...&epochId=...
                    → {wavelengths: float[], flux: float[], variance: float[]}

GET  /quality       ?productId=...&pixelX=...&pixelY=...
                    → {status, flags_decoded, snr, notes}

POST /compare       body: {productIdA, productIdB, mode}
                    → {status: 'compatible'|'warning'|'incompatible'|'unknown', reasons[]}
```

---

## Data Sources & Cutouts

| Source | Access Method | Priority |
| :--- | :--- | :---: |
| SPHEREx QR3 | IRSA SIA v2: `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_qr3` | Primary |
| SPHEREx QR2 | IRSA SIA v2: `COLLECTION=spherex_qr2` | Fallback |
| Official Event Dataset | Local file store / API (Nov 13 kickoff delivery) | Switch via config |
| Synthetic FITS | Bundled test fixtures (known movers/variables) | Dev / fallback |
| Gaia DR3 | ESA / STScI TAP — proper motion vector overlay | Context overlay |
| WISE / NEOWISE | IRSA cutouts — infrared multi-year baseline | Context overlay |
| NEOSSat / CADC | Canadian Space Agency archive (`cadc-ccda.hia-iha.nrc-cnrc.gc.ca`) | Asteroid cross-match |

**Cutout Query Format:**
`GET https://irsa.ipac.caltech.edu/ibe/data/spherex/{release}/level2/{path}.fits?center=RA,DEC&size=DEG`

**FITS Structure (Level 2 MEF):**
- HDU 0 — Primary Header (pointing geometry, epoch, detector array)
- HDU 1 — IMAGE: calibrated flux in MJy/sr ← **Primary display**
- HDU 2 — VARIANCE: $\sigma^2$ per pixel ← **Error bars and SNR calculation**
- HDU 3 — FLAGS: bitmask (cosmic rays, saturation, stray light) ← **Quality gate**
- HDU 4 — ZODIACAL: diffuse background model
- HDU 5 — EPSF: effective point spread function

---

## Common Internal Data Structure (CIDS)

```typescript
interface ObservationRecord {
  id: string;
  sourceRelease: 'QR3' | 'QR2' | 'EVENT_NOV13' | 'SYNTHETIC';
  targetCoordinates: { ra: number; dec: number };       // ICRS decimal degrees
  epochTime: { utc: string; mjd: number; epochIndex: number };
  instrument: {
    detectorArray: 1 | 2 | 3 | 4 | 5 | 6;               // D1–D6
    fpa: 'Short-Wavelength' | 'Long-Wavelength';
    nominalBandpass: string;                             // e.g. 'SPHEREx-D2'
  };
  cutout: {
    pixelWidth: number; pixelHeight: number;
    fovDeg: number;                                      // Square angular width in degrees
    wcs: WCSParameters;                                  // CRVAL, CRPIX, CDELT, CTYPE
  };
  dataPlanes: {
    flux: Float32Array;                                  // HDU 1
    variance: Float32Array;                              // HDU 2
    flags: Uint32Array;                                  // HDU 3
    zodiacal?: Float32Array; epsf?: Float32Array;
  };
  wavelengthMap: Float32Array;                           // Per-pixel λ in μm (from LVF model)
  qualityAssessment: 'compatible' | 'warning' | 'incompatible' | 'unknown';
}
```

---

## Critical Behaviors (Non-Negotiable)

**Playback:**
- Starts **paused**. Never autoplays.
- Default speed: **0.5 transitions/sec**. Max: 3.0 Hz (photosensitivity safety cap).
- Stops at the last frame. Does not loop by default.
- Pauses when the browser tab is hidden, or if the user changes query/source.
- If a frame fails: pause + retry/skip choice (retained in export log).

**Timeline:**
- Shows **retrieved observations only** — never continuous fabricated coverage.
- **Index-spaced** by default (explicitly labeled). Irregular time gaps indicated textually.

**Source Badge — Always Visible:**
- 🔵 Cyan outline = SPHEREx archive data
- 🟡 Amber outline = Simulated / synthetic demo data
- 🟣 Lavender outline = External survey (Gaia / WISE)
- ⚪ Neutral = Unknown source

**Quality Gate on Click:**
- Decode HDU 3 bitmask at clicked pixel before confirming a candidate.
- Flag set → amber warning ("Artifact Detected"), not a detection.
- SNR calculation: $\text{SNR} = \text{Flux}/\sqrt{\text{Variance}}$.

**Coordinate Input:**
- Accept decimal degrees and sexagesimal. Show parsed values before search.
- RA: $[0, 360)$ — reject 360 with inline help. Dec: $[-90, +90]$.
- Preserve `-00:30:00` negative sign.

**Archive Failure:**
- Never silently fall back to synthetic data. Surface error openly.

**Difference Imaging:**
- Hidden/disabled until the backend subtraction pipeline is verified.

---

## 5 Required Benchmark Targets

| Name | RA | Dec | Validation Purpose |
| :--- | :--- | :--- | :--- |
| **Barnard's Star** | 269.4521° | +4.6934° | Fastest stellar proper motion ($\mu \approx 10.3''/\text{yr}$) — clear epoch displacement. |
| **Epsilon Indi B** | 331.0438° | −56.7828° | Brown dwarf binary companion with deep methane absorption bands. |
| **WISE 0855** | 133.7951° | −7.2451° | Coldest sub-stellar Y-dwarf ($T \sim 250\,\text{K}$); high proper motion mover. |
| **RW Aurigae** | 76.9564° | +30.4014° | Eruptive T Tauri variable with dramatic IR circumstellar disk occultations. |
| **R Draconis** | 248.1676° | +66.7551° | Mira-type pulsating giant with massive multi-magnitude IR variability. |

---

## Hackathon Timeline & Judging Deadlines

*Local Event: Bangladesh (Friday 13 – Saturday 14 Nov 2026)*

1. **Friday Nov 13 (6:30 PM) — Video 2 Due (240 sec):** Local judging cut. Must demonstrate a working prototype on camera and name NASA SPHEREx datasets out loud.
2. **Saturday Nov 14 (12:00 PM) — Video 3 Due (30 sec):** Global judging video. Fast, high-impact storytelling for global NASA judges.
3. **Saturday Nov 14 (Evening) — Project Submission:** Final NASA project page submitted with public GitHub repository, open-source license, and AI disclosure.

---

## Build Order

1. Fetch real SPHEREx cutout via IRSA SIA2/IBE → parse Level 2 MEF HDU 0–5. (**Gate 1**)
2. CIDS layer + swappable connectors (QR3, QR2 fallback, synthetic).
3. 2D WebGL2 blink viewer — paused, 0.5 fps, index-spaced timeline, source badge.
4. Quality gate on click (HDU 3 bitmask + HDU 2 variance).
5. 102-band SED drawer + LVF wavelength mapping.
6. **Three.js 3D Viewers (lazy-loaded):** Spacetime Volume Cube ($(x, y, t)$ stack) & Celestial Footprint.
7. Gaia DR3 proper motion overlay + deep link URL sync.
8. Difference imaging backend, WCAG 2.2 AA audit, video demo recording.

---

## Mandatory Site Disclaimer

> *ORBIT-LENS is an independent project by Team Schwarzschildren. It uses publicly accessible astronomical resources and is not operated or endorsed by NASA, Caltech/IPAC, or the SPHEREx mission.*
