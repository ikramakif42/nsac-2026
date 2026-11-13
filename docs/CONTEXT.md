# ORBIT-LENS — Build Context & Live State Tracker

## Project Overview
- **Name:** ORBIT-LENS
- **Hackathon:** 2026 NASA Space Apps Challenge — *Planet X and SPHEREx*
- **Team:** Schwarzschildren
- **Version:** `0.2.0` (Staged for 6 Detector Arrays, Progressive 5° Tiling, Wheel Time Scrubbing, and 3D Time-Cube)
- **Status:** **All Schemas, Endpoints & Tests Updated and Passing (16 / 16 Tests Passed)**
- **Last Updated:** 2026-11-13 16:47 (Local / UTC+6)

---

## Architectural Enhancements Staged

1. **Physical 6-Detector Focal Plane Calibration:**
   - Calibrated optical parameters across all 6 arrays:
     - Array 1 ($0.75 - 1.11\ \mu\text{m}$, $R \approx 41$)
     - Array 2 ($1.11 - 1.64\ \mu\text{m}$, $R \approx 41$)
     - Array 3 ($1.64 - 2.42\ \mu\text{m}$, $R \approx 41$)
     - Array 4 ($2.42 - 3.82\ \mu\text{m}$, $R \approx 35$)
     - Array 5 ($3.82 - 4.42\ \mu\text{m}$, $R \approx 110$, $H_2O$ and $CO_2$ ice)
     - Array 6 ($4.42 - 5.00\ \mu\text{m}$, $R \approx 130$, $CO$ ice)
   - Continuous 102-band spectral axis ($6 \times 17$ channels) spanning $0.75 - 5.00\ \mu\text{m}$.

2. **Progressive 5° FOV Tiling & Predictive Prefetching:**
   - Added `POST /tiles` endpoint and CIDS `TileChunk` / `TileResponse` interfaces.
   - Snaps celestial coordinates to a 5-degree grid.
   - Computes forward neighbor chunks biased along the user's pan velocity vector $(\Delta \text{RA}, \Delta \text{Dec})$ for prefetching.

3. **Smooth Wheel/Trackpad Temporal Scrubbing:**
   - Integrated wheel and gesture handling directly into `WebGL2Canvas.tsx`.
   - Connected to Zustand `stepEpoch(delta, maxFrames)` action with boundary clamping.
   - Compliant with WCAG 2.2 AA photosensitivity rules (smooth scrub instead of seizure-inducing flash cuts).

4. **Interactive 3D Time-Cube / Spectral-Cube:**
   - Added `GET /cube` endpoint and CIDS `TimeCubeMetadata` model.
   - Supports Dual-Z axes: `axis="time"` ($(x, y, t)$ to visualize proper motion worldlines) and `axis="wavelength"` ($(x, y, \lambda)$ to visualize spectral absorption slabs).

5. **CDS / Partner Dataset Overlay Protocol:**
   - Staged CIDS `CDSOverlay` type (`none`, `gaia_dr3`, `2mass`, `allwise`, `panstarrs`) ready for Aladin Lite / HiPS tile streaming.

---

## Verification & Status Matrix

| Component | Status | Verification Detail |
|---|---|---|
| **Backend Unit Tests** | ✅ **9 / 9 Passed** | `pytest -v` in `backend/` passes health, 6-array search (24 records), QR3 gate, tiles, cube, WCS, SNR, bitmask decoder, 102-channel LVF model |
| **Frontend Unit Tests** | ✅ **7 / 7 Passed** | `vitest run` in `frontend/` passes playback defaults, 3.0 Hz ceiling, wheel scrubbing, 5 benchmark targets, 6-array synthetic search, 5° tiles, 3D cube metadata |
| **Frontend Bundle & Build** | ✅ **Passed (1.17s)** | `tsc && vite build` transforms 2,162 modules with clean code-splitting for `SphereViewer` and `CubeViewer` |
| **FastAPI Server** | ✅ **Passed** | Imports and mounts 7 routers (`search`, `cutout`, `spectrum`, `quality`, `compare`, `tiles`, `cube`) |
| **Git Working Tree** | ✅ **Clean** | Ready for push or feature branching |

---

## Monorepo Directory Tree

```
D:\Programming\NSAC 2026\
├── .gitignore
├── README.md
├── docs/
│   ├── CONTEXT.md               ← Live build state tracker (this file)
│   ├── Prompt.md                ← Build specification & design prompt
│   ├── Solution.md              ← Architecture & implementation strategy
│   ├── Challenge.md             ← NASA Space Apps Challenge details
│   ├── Guidance.md              ← Technical guidance & data access
│   ├── UI_guide.md              ← UI behavior contract & review rules
│   ├── Aesthetics_guideline.md  ← Design tokens, color system, branding
│   ├── NASA_Policies.md         ← Legal, branding, resource register
│   ├── Terms_of_service.md      ← Terms of service
│   └── tests.md                 ← Comprehensive test reports
├── frontend/
│   ├── package.json
│   ├── vite.config.ts           ← Proxies /search, /cutout, /spectrum, /quality, /compare, /tiles, /cube
│   ├── tsconfig.json
│   ├── index.html               ← Fixed entry to /src/main.tsx
│   └── src/
│       ├── types/cids.ts        ← ObservationRecord, TileChunk, TimeCubeMetadata, CDSOverlay
│       ├── store/useStore.ts    ← Zustand store with stepEpoch, FOVState, cubeAxis
│       ├── connectors/
│       │   ├── index.ts         ← IConnector interface with fetchTiles & fetchCube
│       │   ├── qr3.ts           ← Real IRSA API connector
│       │   └── synthetic.ts     ← 6-array synthetic multi-epoch generator
│       ├── components/
│       │   ├── TopBar/
│       │   ├── SkyViewer/       ← WebGL2Canvas (wheel time-scrub), ViewportTabs, SphereViewer, CubeViewer
│       │   ├── Timeline/        ← TimelineControls
│       │   ├── SEDDrawer/
│       │   ├── MetadataPanel/
│       │   └── StatusNotice.tsx
│       ├── pages/
│       └── __tests__/store.test.ts
└── backend/
    ├── requirements.txt
    ├── pytest.ini
    ├── tests/test_sanity.py     ← 9 automated backend test cases
    └── app/
        ├── main.py              ← FastAPI entry with 7 mounted routers
        ├── models/cids.py       ← Pydantic CIDS models
        ├── routers/
        │   ├── search.py
        │   ├── cutout.py
        │   ├── spectrum.py
        │   ├── quality.py
        │   ├── compare.py
        │   ├── tiles.py         ← POST /tiles (5° FOV chunking & directional prefetch)
        │   └── cube.py          ← GET /cube (3D Time-Cube & Spectral-Cube metadata)
        ├── connectors/
        │   ├── base.py
        │   ├── qr3.py
        │   └── synthetic.py
        └── science/
            ├── fits_engine.py
            ├── wcs_engine.py
            └── lvf_model.py     ← Official 6-detector array optical calibration
```
