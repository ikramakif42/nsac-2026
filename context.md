# ORBIT-LENS — Project Context & TODO
_Last reviewed: 2026-11-13_

---

## Project

**ORBIT-LENS** — 2026 NASA Space Apps Challenge, theme: *Planet X and SPHEREx*.  
Multi-epoch infrared sky explorer with 3D Time-Cube visualization, built to identify cold, slow-moving brown dwarfs and hypothetical Planet 9 candidates by detecting proper motion across SPHEREx survey epochs.

**Stack:** FastAPI (Python 3.12) · React 19 + Vite 8 · Zustand 5 · WebGL2 · Three.js · Astropy

---

## Dev Commands

```powershell
# Terminal 1 — Backend
& "backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload

# Terminal 2 — Frontend
cd frontend; npx vite --host 127.0.0.1 --port 5173
```

**URLs:** `http://127.0.0.1:5173/explore` · `http://127.0.0.1:8000/docs`

---

## Test Status

| Suite | Count | Status |
|---|---|---|
| `backend/tests` (pytest) | 132 | ✅ All pass |
| `frontend/src` (vitest) | 124 | ✅ All pass |
| `npm run build` | — | ✅ Clean (0 TS errors) |

---

## Architecture

```
frontend/
  src/
    pages/        Explore.tsx (main app), Landing, About, Methodology
    store/        useStore.ts (Zustand persist + immer), useQualityStore.ts
    connectors/   qr3.ts, wiseview.ts, gaia.ts, synthetic.ts → all POST to backend
    components/
      SkyViewer/  SkyMapViewer.tsx (all-sky canvas), WebGL2Canvas.tsx, CubeViewer.tsx
      TopBar/     CoordinateForm.tsx (source picker, RA/Dec, FOV)
      Timeline/   TimelineControls.tsx
      MetadataPanel/ QualityInspector.tsx
      SEDDrawer/  SEDChart.tsx
    accessibility/ M7Inspector.tsx, deepLink.ts

backend/
  app/
    connectors/  qr3.py (IRSA SIA→TAP), wiseview.py (sim), gaia.py (sim), synthetic.py
    routers/     search, cutout, spectrum, quality, compare, tiles, cube
    science/     fits_engine.py, cube_render.py, lvf_model.py, wcs_engine.py
    models/      cids.py (shared schema)
```

---

## Data Fetching Reality Check

> **IMPORTANT: Only `qr3` (SPHEREx) attempts real HTTP requests.**
> `wiseview` and `gaia` connectors return deterministic **simulated** records (correct schema, hardcoded epochs/bands). Real AllWISE and Gaia TAP queries are not yet implemented.

| Source | Real Data? | Notes |
|---|---|---|
| `qr3` | ⚠️ Attempted | IRSA `134.4.54.42` unreachable on Cloudflare WARP. SIA tries first, falls back to ADQL TAP — both fail if network-blocked. Backend returns 502. |
| `wiseview` | ❌ Simulated | Returns hardcoded 4-epoch W1/W2 records centered on query RA/Dec |
| `gaia` | ❌ Simulated | Returns hardcoded 3-epoch G/BP/RP records |
| `synthetic` | ✅ Works | Full 24-record (6 arrays × 4 epochs) synthetic pipeline, always works |

**Current workaround applied:** `/explore` and the store now default to `synthetic` so the page always loads. Users can manually switch to other sources via the source dropdown. `CODE_BUILD_SIG` bumped to `orbit-lens-v1.6.0-default-synthetic` to wipe stale cache.

---

## TODOs

### 🔴 Critical — Real Data

- [x] **WiseView real data:** Implemented real AllWISE ADQL TAP queries in `backend/app/connectors/wiseview.py` querying `II/328/allwise` (CDS/IRSA) with multi-epoch annual projections (2010–2024) across W1 (3.4 μm) and W2 (4.6 μm).
- [x] **Gaia real data:** Implemented real Gaia DR3 ADQL TAP queries in `backend/app/connectors/gaia.py` querying `I/355/gaiadr3` with proper motion vector projection across J2016.0–J2024.0.
- [x] **SkyMapViewer canvas resize & cursor tracking:** Added `ResizeObserver` maintaining 1:1 pixel aspect ratio, eliminating cursor drift.
- [x] **Schema Enum & TimeCube Alignment:** Fixed `QualityStatus.PASS`, `CompareStatus.MATCH`, and aligned `TimeCubeMetadata` slices across all connectors.

- [ ] **WiseView/Gaia placeholder frames look identical to synthetic:** Differentiate placeholder visuals per source (e.g. infrared-orange palette for WiseView, astrometric crosshairs for Gaia).

- [ ] **SED drawer empty / wrong for WiseView/Gaia:** 2-point spectrum (W1/W2) renders but axis labels say "μm" without indicating WISE bandpasses. Add source-aware axis labeling.

- [ ] **QualityInspector empty for Gaia/WiseView:** Hardcodes SPHEREx quality flags. Add a simple `notes` field pass-through for non-qr3 sources.

### 🟢 Submission Polish

- [ ] **Fill in `docs/submission.md`:** Complete "Use of AI" (Claude Sonnet 4.6, Gemini Flash, Astra pipeline) and "References" (SPHEREx papers, IRSA TAP docs, ESA Gaia archive, AllWISE catalog, WCAG 2.2).

- [ ] **Record demo video:** Use `/demo` route (always works, no network needed). Show: All-Sky Map → 5° chunk click → 3D Time-Cube → play multi-epoch Barnard's Star drift → difference view → SED drawer.

- [ ] **Accessibility audit:** Run `axe-core` on `/demo`. Known gaps: (a) canvas lacks live-region for epoch changes, (b) `SkyMapViewer` no keyboard navigation, (c) `--ol-muted` contrast at small sizes.

- [ ] **Git commit all M1-M8 changes:** Large working-tree with ~50 modified/untracked files. Commit before submission.

- [ ] **Backend env example:** Create `backend/.env.example` with `QR3_DISCOVERY`, `IRSA_SIA_URL`, `IRSA_TAP_URL`, `CORS_ORIGINS`, `RELEASE`, `QR3_MAX_RECORDS`.

- [ ] **Confirm `astra/` in .gitignore:** Verify API keys and output dumps won't be pushed.

---

## Known Bugs

| Bug | File | Fix |
|---|---|---|
| `QualityReport` in `gaia.py`/`wiseview.py` passes `status="pass"` (string) instead of `QualityStatus.PASS` enum | `gaia.py:100`, `wiseview.py:103` | Use `QualityStatus.PASS` |
| `CompareResult.status = "optimal"` in `gaia.py`/`wiseview.py` — not a valid `CompareStatus` enum | `gaia.py:110`, `wiseview.py:112` | Use `CompareStatus.MATCH` |
| `fetch_cube` in `wiseview.py`/`gaia.py` previously used wrong schema fields | Fixed in this session | Restart backend if cube returns 500 |
| `CoordinateForm.tsx` still has stale import of `Compass, Orbit, Flame, Cpu` from lucide-react despite being removed | Cleaned — was fixed twice | Watch for it re-appearing after merges |

---

## Completed Milestones

- ✅ **M1** — QR3 IRSA connector, SIA→TAP discovery, FITS MEF parsing, CIDS schema  
- ✅ **M2** — WebGL2 rendering pipeline, synthetic Gaussian PSF frames, difference mode  
- ✅ **M3** — Quality flags, QualityInspector, QualityMapCanvas  
- ✅ **M4** — SED spectrum extraction, SEDChart (102 SPHEREx channels)  
- ✅ **M5** — 3D Time-Cube, CubeViewer, cubeModel, spectral axis, WCAG playback limits  
- ✅ **M6** — CDS cross-match overlay (SIMBAD/VizieR/HiPS), CDSReferencePanel  
- ✅ **M7** — WCAG 2.2 AA: deep links, M7Inspector, photosafety (0.5 fps, 3 Hz ceiling), keyboard scrub  
- ✅ **M8** — Interactive All-Sky Map (SkyMapViewer), WiseView + Gaia connectors, modern glassmorphism UI, localStorage persistence with auto-wipe, ADQL TAP fallback for QR3

