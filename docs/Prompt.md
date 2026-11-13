# ORBIT-LENS — Build Prompt

> **What to build:** A public-facing, highly interactive web application that displays multi-epoch infrared sky observations from NASA's SPHEREx mission. Users can explore all-sky maps, pan/zoom through progressive 5-degree field-of-view (FOV) chunks with predictive prefetching, smoothly scroll through time like a video scrubber, and inspect celestial targets in an interactive 3D Time-Cube or 102-band spectral energy distribution.

**Team:** Schwarzschildren · **Event:** NASA Space Apps Challenge 2026 — *Planet X and SPHEREx*  
**Tagline:** *Explore the sky through time and spectrum.*

---

## The Core Task & Vision

The user enters sky coordinates or selects a benchmark target. The app retrieves multi-epoch SPHEREx observations across all **6 physical detector arrays** in the focal plane. 
The user can:
1. **Pan & Zoom with Progressive 5° Tiling:** Seamlessly navigate the sky. When panning across 5° FOV chunks, the app directionally preloads adjacent tiles along the velocity vector.
2. **Scroll for Time:** Use two-finger trackpad or Shift+Wheel gestures directly over the sky canvas to scrub forward and backward across survey passes, with smooth GPU temporal cross-dissolving (preventing photosensitive flashing).
3. **Inspect the 3D Time-Cube / Spectral-Cube:** Jump into a 3D volumetric space ($(x, y, t)$ or $(x, y, \lambda)$) using React Three Fiber to visualize moving targets (high proper motion stars, asteroids, Planet X candidates) tracing diagonal 3D trajectory lines.
4. **Overlay Partner Datasets via CDS Tools:** Toggle HiPS layers from 2MASS ($J/H/K_s$), AllWISE ($W1/W2$), and Gaia DR3.
5. **Inspect 102-Band SEDs:** Combine data from all 6 detector arrays into a continuous 0.75–5.00 μm Spectral Energy Distribution with molecular ice absorption flags ($H_2O$, $CO_2$, $CO$, $CH_4$).

---

## Stack

| Layer | Choice |
| :--- | :--- |
| Frontend | React 19 + TypeScript 5.6 + Vite 8 |
| State | Zustand 5 (with bi-directional URL query sync & gesture scrubbing) |
| 2D Canvas (Primary) | WebGL 2.0 (custom GLSL shaders for blink, dynamic asinh stretch, temporal crossfade) |
| 3D Engine (Lazy-Loaded) | Three.js / React Three Fiber (3D Time-Cube, Spectral-Cube & celestial sphere) |
| Backend | Python 3.12 (64-bit native Windows/Linux venv) / FastAPI |
| Science Engine | Astropy 8.0 & NumPy 2.5 (WCS TAN-projection, MEF FITS parser, LVF model) |
| Astronomical Protocols | PyVO 1.10 (IRSA SIA v2 / TAP / IBE) + CDS HiPS / Aladin Lite v3 protocol |
| Styling | Tailwind CSS v4 (dark workspace theme, design tokens below) |
| Charts | uPlot (102-band SED curve with molecular absorption bands) |

**Design tokens (dark workspace):**
```css
--ol-bg: #0b1020;  --ol-surface: #141d2e;  --ol-surface2: #1c2840;  --ol-border: #2a3a52;
--ol-accent: #67e8f9;  --ol-warning: #fcd34d;  --ol-danger: #fda4af;  --ol-focus: #facc15;
```

---

## Instrument Ground Truth: 6 SPHEREx Detector Arrays

The focal plane of SPHEREx houses **6 individual $2k \times 2k$ H2RG detector arrays** fitted with Linear Variable Filters (LVF). Each array captures 17 spectral channels for a total of 102 continuous bands:
- **Array 1:** $0.75 - 1.11\ \mu\text{m}$ ($R \approx 41$)
- **Array 2:** $1.11 - 1.64\ \mu\text{m}$ ($R \approx 41$)
- **Array 3:** $1.64 - 2.42\ \mu\text{m}$ ($R \approx 41$)
- **Array 4:** $2.42 - 3.82\ \mu\text{m}$ ($R \approx 35$)
- **Array 5:** $3.82 - 4.42\ \mu\text{m}$ ($R \approx 110$ — Interstellar $H_2O$ and $CO_2$ ice absorption)
- **Array 6:** $4.42 - 5.00\ \mu\text{m}$ ($R \approx 130$ — Solid-phase $CO$ ice feature)

---

## 3D Time-Cube & Celestial Sphere Architecture

**The Rule:** Three.js is for **presentation only**; all coordinate math, WCS projection, and scientific calculations belong in the Python/Astropy backend. Never let Three.js perform celestial trigonometry.

Three.js / React Three Fiber powers two high-impact visual features (lazy-loaded, toggled from the viewport):
1. **Interactive 3D Time-Cube ($(x, y, t)$ and $(x, y, \lambda)$):**
   - **Time Mode:** Stacks multi-epoch cutouts along a $Z$-axis of observation time. Static background stars form vertical columns; high proper-motion objects (Barnard's Star, brown dwarfs, Planet X candidates) trace **diagonal 3D world lines**.
   - **Spectral Mode:** Stacks 102 wavelength slices along the $Z$-axis. Deep absorption lines appear as dark horizontal slabs.
   - **Controls:** OrbitControls (rotate/pan/zoom) + interactive cross-section clipping plane + click-to-SED raycasting.
2. **3D Celestial Sphere & Survey Footprint:** Interactive celestial globe showing SPHEREx polar orbit precession, survey coverage, and active 5° FOV boundaries.

---

## Routes

| Route | Purpose |
| :--- | :--- |
| `/` | Landing — project purpose, benchmark launch, source transparency, "Open Explorer" CTA |
| `/explore` | **Primary workbench** — progressive 5° FOV map, 2D/3D viewer, wheel time scrubber, metadata inspector, SED drawer |
| `/about` | Team, independent status, mandatory NASA Space Apps disclaimer |
| `/methodology` | Data pipeline, 6-array LVF calibration, quality bitmask decoding, simulation policy |
| `/terms`, `/privacy` | Legal & open data terms |

> `/explore` must be directly linkable (`/explore?ra=...&dec=...&fov=5.0`). Never require visiting `/` first.

---

## `/explore` Layout

```
┌─ Top Bar ────────────────────────────────────────────────────────────────────────┐
│  [RA] [Dec] [FOV: 5.0° ▾] [Overlay: CDS 2MASS ▾] [Source: QR3 ▾] [Search]       │
│  Source Badge: ◉ SPHEREx QR3   [Barnard's ▾] [ε Indi B ▾] [WISE 0855 ▾] presets │
└──────────────────────────────────────────────────────────────────────────────────┘
┌─ Viewport (Tabs: [2D Image / Scroll Time] [3D Time-Cube] [3D Sphere]) ───────────┐
│                                                      ┌─ Metadata Inspector ───┐  │
│   [crosshair + RA/Dec readout]                       │  Observation / Array / │  │
│   [scale bar + North arrow + 5° chunk badge]         │  Coordinates / Quality │  │
│   [source badge — always visible]                    │  [copy IDs] [IRSA link]│  │
│   [Scroll mouse wheel / trackpad to scrub time]      └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
┌─ Timeline Controls ──────────────────────────────────────────────────────────────┐
│  ⏮  ◀  ▶  ⏭   [●─────────────────────────────]   0.5 fps ▾   Frame 1 / 4        │
│  Epoch 1 / 4 · 2024-03-01 · MJD 60300 · Array 1-6 Combined                        │
└──────────────────────────────────────────────────────────────────────────────────┘
┌─ SED Drawer (collapsible) ───────────────────────────────────────────────────────┐
│  Flux (MJy/sr) vs λ (0.75–5.0 μm) · 102 continuous bands across 6 arrays         │
│  Absorption markers: H₂O (3.05 μm) · CO₂ (4.27 μm) · CO (4.67 μm)                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Backend API Endpoints

```
POST /search        body: {ra, dec, radius_arcsec, bands?, epoch_range?, source?}
                    → SearchResult (time-sorted ObservationRecord[] across 6 arrays)

GET  /cutout        ?record_id=...&ra=...&dec=...&band=...
                    → ObservationRecord (Level 2 MEF: science, variance, mask)

GET  /spectrum      ?record_id=...
                    → SpectrumResponse (102 wavelengths, flux, variance, array_contributions)

GET  /quality       ?record_id=...
                    → QualityReport (pass/warn/fail, decoded HDU 3 flags, SNR)

POST /compare       body: {record_ids: string[]}
                    → CompareResult (variability match/mismatch reasons)

POST /tiles         body: {ra, dec, fov_deg: 5.0, velocity_dra, velocity_ddec, source?}
                    → TileResponse (active 5° chunk + predictive neighbor prefetch chunks)

GET  /cube          ?record_id=...&axis=time|wavelength&source=...
                    → TimeCubeMetadata (dimensions, z_values, slices, bounding box)
```

---

## Critical Science & UI Behaviors (Non-Negotiable)

1. **Playback Starts Paused:** Playback is always paused by default.
2. **Speed Limits:** Default speed is 0.5 fps. Hard ceiling at 3.0 Hz to protect photosensitive users.
3. **Smooth Wheel Scrubbing:** Direct trackpad / mousewheel scrolling across the 2D canvas steps through epochs with GPU shader cross-dissolve.
4. **Source Badge Always Visible:** Displays data origin (`SPHEREx QR3`, `SYNTHETIC`, `MAST`, `VizieR`).
5. **No Silent Fallback:** Real IRSA archive queries never fall back silently to synthetic data on failure.
6. **Scientific Authority:** Astropy owns all WCS transformations and coordinate math; WebGL and Three.js render only.
7. **Disclaimer on Every Page:** *"ORBIT-LENS is an independent project by Team Schwarzschildren. Not affiliated with NASA or the SPHEREx mission."*
