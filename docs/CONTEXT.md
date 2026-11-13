# ORBIT-LENS — Build Context & Live State Tracker

## Project Overview
- **Name:** ORBIT-LENS
- **Hackathon:** 2026 NASA Space Apps Challenge — *Planet X and SPHEREx*
- **Team:** Schwarzschildren
- **Version:** `0.2.1` (Bi-directional URL sync, Embed Mode, Share Link, 6-Array Optics)
- **Status:** **Core Architecture Stable — Interactive Explorer Live & Shareable**
- **Last Updated:** 2026-11-13 16:56 (Local / UTC+6)

---

## 📋 Comprehensive TODO — Path to 100% Polish

### Phase 1: Real IRSA SIA v2 / IBE / TAP Archive Retrieval
- [ ] Connect `qr3.py` to live NASA IRSA SIA v2 cone search endpoint using PyVO / HTTPX.
- [ ] Implement Level 2 Multi-Extension FITS cutout fetcher (`/cutout`) querying IRSA IBE API for SPHEREx Quick Release 3.
- [ ] Authenticate with optional `IRSA_API_KEY` while gracefully handling public open-access rate limits.
- [ ] Add disk/memory caching for downloaded `.fits` cutouts to ensure instantaneous subsequent visits.

### Phase 2: WebGL2 Custom Shaders & Multi-Epoch Blink Blending (Phase 3 in Rubric)
- [ ] Write GLSL fragment shaders in `WebGL2Canvas.tsx` for dynamic FITS pixel stretching:
  - Linear, Square Root, Logarithmic, and inverse hyperbolic sine (`asinh`).
- [ ] Colormap lookups via 1D/2D textures (Viridis, Inferno, Magma, Cool-Warm, Greyscale).
- [ ] Implement difference imaging fragment shader: $I_{\text{diff}} = I(t_2) - I(t_1)$ normalized by $\sqrt{\sigma_1^2 + \sigma_2^2}$.
- [ ] Add interactive WCS coordinate grid overlay and pixel crosshair with live (RA, Dec, Flux) hover readout.

### Phase 3: Science Quality Gating (HDU 3 Bitmask & HDU 2 Variance)
- [ ] Parse HDU 3 bitmask per pixel: automatically flag saturated pixels, bad pixels, and cosmic ray hits in the UI.
- [ ] Compute per-pixel Signal-to-Noise Ratio (SNR) maps from HDU 1 (Science) and HDU 2 (Variance).
- [ ] Add quality badge indicators in the timeline and metadata inspector drawer.

### Phase 4: Interactive 102-Band SED Drawer (uPlot)
- [ ] Integrate uPlot inside `SEDDrawer.tsx` plotting calibrated Flux ($\text{MJy/sr}$) vs. Wavelength ($\mu\text{m}$).
- [ ] Overlay SPHEREx 6 detector array spans and color-coded boundaries.
- [ ] Annotate molecular absorption bands:
  - $H_2O$ ice (3.05 $\mu\text{m}$)
  - $CO_2$ ice (4.27 $\mu\text{m}$)
  - $CO$ ice (4.67 $\mu\text{m}$)
  - $CH_4$ methane (1.66 $\mu\text{m}$ & 3.3 $\mu\text{m}$)
- [ ] Allow clicking a point on the SED to automatically switch the 2D viewer to the corresponding detector array image.

### Phase 5: Three.js Interactive 3D Time-Cube & Celestial Footprint
- [ ] Implement `CubeViewer.tsx` in React Three Fiber:
  - **Time Mode:** Stack multi-epoch cutouts along the $Z$-axis. Highlight moving objects tracing diagonal trajectories.
  - **Spectral Mode:** Stack 102 wavelength slices along the $Z$-axis.
  - Interactive slicing/clipping plane with slider or drag handle.
- [ ] Implement `SphereViewer.tsx`:
  - 3D interactive celestial sphere showing celestial equator, ecliptic plane, SPHEREx scan circles, and user's 5° FOV cone.

### Phase 6: CDS Tools & Partner Catalog Overlays
- [ ] Embed Aladin Lite v3 (WebGL/WebAssembly) or stream HiPS tiles directly:
  - 2MASS ($J, H, K_s$)
  - AllWISE / NEOWISE ($W1, W2$)
  - ESA Gaia DR3 point sources with proper motion vectors ($\mu_\alpha \cos \delta, \mu_\delta$)
- [ ] Allow cross-matching detected transients against SIMBAD / NED.

### Phase 7: Polish, Accessibility & Submission Assets
- [ ] Full WCAG 2.2 AA accessibility audit:
  - Screen reader announcements for coordinate searches and epoch playback.
  - High-contrast focus outlines for all buttons and sliders.
  - Strict preservation of the 3.0 Hz photosensitivity ceiling.
- [ ] Record Video Demo 2 (7-minute walkthrough):
  - Pitch, architecture, live 6-array demo, wheel time scrubbing, 3D time-cube, and science validation.
- [ ] Complete public GitHub repository documentation with Apache-2.0 license.

---

## Verification & Status Matrix

| Component | Status | Verification Detail |
|---|---|---|
| **Backend Unit Tests** | ✅ **9 / 9 Passed** | `pytest -v` in `backend/` passes health, 6-array search (24 records), QR3 gate, tiles, cube, WCS, SNR, bitmask decoder, 102-channel LVF model |
| **Frontend Unit Tests** | ✅ **7 / 7 Passed** | `vitest run` in `frontend/` passes playback defaults, 3.0 Hz ceiling, wheel scrubbing, 5 benchmark targets, 6-array synthetic search, 5° tiles, 3D cube metadata |
| **Frontend Bundle & Build** | ✅ **Passed (771ms)** | `tsc && vite build` compiles cleanly with code-split lazy chunks |
| **Deep-Link URL Sync** | ✅ **Complete** | Bi-directional synchronization of `ra`, `dec`, `fov`, `source`, `epoch`, and `embed` |
| **Embeddable Iframe Mode** | ✅ **Complete** | Responsive headless viewer triggered by `?embed=true` |
| **Git Working Tree** | ✅ **Committed** | Main branch clean (`9b31cba`) |

---

## Monorepo Directory Tree

```
D:\Programming\NSAC 2026\
├── .gitignore
├── README.md
├── docs/
│   ├── CONTEXT.md               ← Live build state tracker & TODO roadmap
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
│   ├── index.html
│   └── src/
│       ├── types/cids.ts        ← ObservationRecord, TileChunk, TimeCubeMetadata, CDSOverlay
│       ├── store/useStore.ts    ← Zustand store with stepEpoch, FOVState, cubeAxis
│       ├── connectors/
│       │   ├── index.ts         ← IConnector interface with fetchTiles & fetchCube
│       │   ├── qr3.ts           ← Real IRSA API connector
│       │   └── synthetic.ts     ← 6-array synthetic multi-epoch generator
│       ├── components/
│       │   ├── TopBar/          ← TopBar, CoordinateForm (FOV + source selector), SourceBadge
│       │   ├── SkyViewer/       ← WebGL2Canvas (wheel time-scrub), ViewportTabs, SphereViewer, CubeViewer
│       │   ├── Timeline/        ← TimelineControls
│       │   ├── SEDDrawer/
│       │   ├── MetadataPanel/
│       │   └── StatusNotice.tsx ← Error recovery with 1-click synthetic switch
│       ├── pages/
│       │   ├── Landing.tsx      ← Deep-link benchmark launcher
│       │   ├── Explore.tsx      ← Bi-directional URL sync & embeddable iframe mode
│       │   ├── About.tsx
│       │   ├── Methodology.tsx
│       │   ├── Terms.tsx
│       │   └── Privacy.tsx
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
