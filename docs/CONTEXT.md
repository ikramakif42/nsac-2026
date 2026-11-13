# ORBIT-LENS — Build Context & Live State Tracker

## Project Overview
- **Name:** ORBIT-LENS
- **Hackathon:** 2026 NASA Space Apps Challenge — *Planet X and SPHEREx*
- **Team:** Schwarzschildren
- **Status:** **Skeleton Foundation Complete — Awaiting Review before Phase 1**
- **Last Updated:** 2026-11-13 16:19 (Local / UTC+6)

---

## Architecture Summary
- **Frontend:** React 19 + TypeScript 5.6 + Vite 8 + Zustand 5 + Tailwind CSS v4 + Lucide React + uPlot + Three.js / R3F (lazy)
- **Backend:** Python 3.12 (Native Windows x64 venv) + FastAPI + Astropy 8.0 + NumPy 2.5 + PyVO 1.10 + Uvicorn + HTTPX
- **Contract:** Cross-modal Interoperability Data Schema (CIDS) shared between frontend TypeScript types (`frontend/src/types/cids.ts`) and backend Pydantic models (`backend/app/models/cids.py`).

---

## Verification & Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend Structure | ✅ Complete | Full page routing, CIDS types, Zustand store, UI components |
| Frontend Typecheck & Build | ✅ Pass | `npm run build` passes in 164ms cleanly with zero errors |
| Frontend Dev Server Config | ✅ Configured | Vite proxy configured for `/search`, `/cutout`, `/spectrum`, `/quality`, `/compare` |
| Backend Structure | ✅ Complete | FastAPI app, CIDS Pydantic models, 5 routers, connector abstraction, science stubs |
| Backend Dependencies | ✅ Pass | Astropy 8, NumPy 2.5, PyVO, FastAPI, Uvicorn, HTTPX installed in `.venv` |
| Backend App Import | ✅ Pass | `from app.main import app` passes cleanly |
| Environment Config | ✅ Complete | `.env.example` and `.env` configured |
| Root Setup | ✅ Complete | `.gitignore`, `README.md`, `docs/CONTEXT.md` |

---

## Monorepo Directory Tree

```
D:\Programming\NSAC 2026\
├── .gitignore
├── README.md
├── docs/
│   ├── CONTEXT.md               ← Live build state tracker (this file)
│   ├── Prompt.md                ← Build specification & instructions
│   ├── Solution.md              ← Architecture & implementation strategy
│   ├── Challenge.md             ← NASA Space Apps Challenge details
│   ├── Guidance.md              ← Technical guidance & data access
│   ├── UI_guide.md              ← UI behavior contract & review rules
│   ├── Aesthetics_guideline.md  ← Design tokens, color system, branding
│   ├── NASA_Policies.md         ← Legal, branding, resource register
│   └── Terms_of_service.md      ← Terms of service
├── frontend/
│   ├── package.json             ← Dependencies & scripts
│   ├── vite.config.ts           ← Vite 8 config with Tailwind & proxy
│   ├── tsconfig.json            ← TypeScript config (with React JSX)
│   ├── index.html               ← SPA HTML entry
│   └── src/
│       ├── types/cids.ts        ← ObservationRecord, WCSParameters, CIDS interfaces
│       ├── store/useStore.ts    ← Zustand store (query, playback, display, viewMode)
│       ├── connectors/
│       │   ├── index.ts         ← Connector registry & IConnector interface
│       │   ├── qr3.ts           ← IRSA API connector
│       │   └── synthetic.ts     ← Synthetic demo connector (no silent fallback)
│       ├── components/
│       │   ├── TopBar/          ← TopBar, CoordinateForm, SourceBadge
│       │   ├── SkyViewer/       ← WebGL2Canvas (2D), ViewportTabs, SphereViewer, CubeViewer
│       │   ├── Timeline/        ← TimelineControls (0.5 fps default, 3.0 Hz cap)
│       │   ├── SEDDrawer/       ← Collapsible 102-band SED drawer skeleton
│       │   ├── MetadataPanel/   ← FITS header & WCS inspector drawer
│       │   └── StatusNotice.tsx ← Idle, searching, error, empty state messages
│       ├── pages/
│       │   ├── Landing.tsx      ← / route (Hero + benchmark quick-launch)
│       │   ├── Explore.tsx      ← /explore route (Deep-linkable sky explorer)
│       │   ├── About.tsx        ← /about route (Project & disclaimer)
│       │   ├── Methodology.tsx  ← /methodology route (Science methods & pipeline)
│       │   ├── Terms.tsx        ← /terms route (Terms of use)
│       │   └── Privacy.tsx      ← /privacy route (No tracking / open data)
│       ├── index.css            ← Design tokens & theme
│       ├── App.tsx              ← Router & QueryClientProvider
│       └── main.tsx             ← Entry point
└── backend/
    ├── requirements.txt         ← FastAPI, Astropy, NumPy, PyVO, Uvicorn, HTTPX
    ├── .env.example             ← IRSA_API_KEY, RELEASE=qr3, CORS_ORIGINS
    ├── .env                     ← Local environment file
    ├── .venv/                   ← Python 3.12 64-bit virtual environment
    └── app/
        ├── main.py              ← FastAPI app entry & CORS configuration
        ├── models/cids.py       ← Pydantic CIDS models matching frontend types
        ├── routers/
        │   ├── search.py        ← POST /search
        │   ├── cutout.py        ← GET /cutout
        │   ├── spectrum.py      ← GET /spectrum
        │   ├── quality.py       ← GET /quality
        │   └── compare.py       ← POST /compare
        ├── connectors/
        │   ├── __init__.py      ← Registry
        │   ├── base.py          ← Abstract connector
        │   ├── qr3.py           ← IRSA SIA v2 / IBE connector (stub -> Phase 1)
        │   └── synthetic.py     ← Synthetic test connector
        └── science/
            ├── fits_engine.py   ← Astropy MEF FITS parser, SNR calculation
            ├── wcs_engine.py    ← Astropy WCS / TAN projection engine
            └── lvf_model.py     ← SPHEREx LVF pixel-to-wavelength model
```

---

## Non-Negotiable Contract Checkpoints
- [x] **No silent fallback:** Real IRSA archive queries never fall back to synthetic data automatically.
- [x] **Playback safety:** Starts paused, defaults to 0.5 fps, strict 3.0 Hz upper limit.
- [x] **Source badge:** Always visible in UI, indicating `SPHEREx QR3`, `SYNTHETIC`, `MAST`, or `VizieR`.
- [x] **Science authority:** Astropy owns all WCS transformations and FITS data parsing; WebGL/Three.js render only.
- [x] **Legal disclaimer:** Prominently featured on all pages and README.

---

## Next Steps (Phased Roadmap)
- **Phase 1:** Real IRSA SIA2 cone search & IBE Level 2 MEF cutout retrieval (Gate 1 validation against benchmark targets).
- **Phase 2:** CIDS live pipeline integration & real FITS array serialization.
- **Phase 3:** WebGL2 custom fragment shaders for FITS rendering (asinh, log, linear colormaps).
- **Phase 4:** Science quality gating (HDU 3 bitmask decoding & HDU 2 variance SNR filtering).
- **Phase 5:** 102-band SED interactive uPlot drawer with LVF wavelength calibration.
- **Phase 6:** Three.js 3D sphere & data cube viewer implementations.
- **Phase 7:** Gaia DR3 star overlay & deep-link synchronization.
- **Phase 8:** Multi-epoch difference imaging, accessibility (WCAG 2.2 AA) audit & video demo asset preparation.

