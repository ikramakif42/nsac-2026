# ORBIT-LENS

> Explore the sky through time.  
> NASA Space Apps Challenge 2026 — Planet X and SPHEREx  
> Developed by Team Schwarzschildren

ORBIT-LENS is an interactive time-series infrared blink comparator for
investigating moving objects and variable stars across observation epochs.
It supports image comparison, quality inspection, spectral energy
distributions, and optional 3D views.

Changes visible in a comparison are investigation candidates, not confirmed
discoveries. Wavelength, registration, coverage, quality flags, and processing
must be checked before interpreting a difference.

## Independent project disclaimer

ORBIT-LENS is an independent open-source challenge project. It is not
affiliated with, sponsored by, or endorsed by NASA, JPL, or the SPHEREx
mission team. Archive attribution does not imply endorsement.

## Scientific architecture

- **Frontend:** React, TypeScript, Zustand, WebGL2, Three.js / React Three
  Fiber, and uPlot. The frontend renders backend-produced science products
  and exposes inspection controls.
- **Backend:** Python, FastAPI, Astropy, NumPy, and PyVO. The backend owns
  celestial mathematics, WCS-TAN transformations, FITS parsing, and SNR
  computation.
- **Contract:** Cross-modal Interoperability Data Schema (CIDS).

SPHEREx has **6 physical detector arrays**, Array 1 through Array 6,
covering **102 continuous spectral channels from 0.75 to 5.00 μm**.
Spectral channels are not separate physical detectors.

Level 2 MEF processing uses HDU 1 for Science, HDU 2 for Variance, and
HDU 3 for Bitmask. Scientific processing remains in the Python backend.

## Data transparency

The active source must remain visible through its SourceBadge:

- `SPHEREx QR3`
- `SYNTHETIC`
- `MAST`
- `VizieR`

An archive failure must be reported explicitly. The application must never
silently replace unavailable observations with synthetic data.

A badge identifies provenance, not scientific quality. External overlays
must retain their own attribution and must not relabel the base observation.

## Playback and accessibility

Required playback behavior:

- Start paused, including shared links and embedded views.
- Default to **0.5 fps**.
- Enforce a hard ceiling of **3.0 Hz**.
- Keep pause available while playback is active.
- Support smooth mousewheel/trackpad epoch scrubbing on the canvas.
- Provide keyboard-operable epoch selection and a non-animated inspection
  workflow.

The rate ceiling alone does not establish flashing safety or WCAG
conformance. ORBIT-LENS targets WCAG 2.2 AA; a completed accessibility audit
has not yet been recorded.

See [Accessibility audit and release gates](docs/accessibility-audit.md).

## Shareable state

The public deep-link contract is:

    ?ra=...&dec=...&fov=...&source=...&epoch=...&embed=true

Links preserve the requested sky position, field of view, source, selected
epoch, and embedding mode. Playback must not be activated by URL state.
Invalid or unavailable state must produce an understandable message, not
silent source substitution.

## Getting started

### Prerequisites

- Node.js >= 20.x and npm >= 10.x
- Python 3.12, 64-bit

### Backend

    cd backend
    python -m venv .venv

Activate the environment:

Windows:

    .\.venv\Scripts\activate

Linux/macOS:

    source .venv/bin/activate

Install and run:

    pip install -r requirements.txt
    cp .env.example .env
    uvicorn app.main:app --reload --port 8000

API: http://localhost:8000  
API documentation: http://localhost:8000/docs

### Frontend

    cd frontend
    npm install
    npm run dev

Development server: http://localhost:5173

## Verification

From the repository root:

    cd backend
    python -m pytest
    cd ../frontend
    npm run test -- --run
    npm run build

See [Test evidence and verification plan](docs/tests.md) for the distinction
between supplied results and checks still required for M7.

## Project status

M0–M6 are reported complete:

- Foundation, six-array staging, and canvas renderer
- Archive connectors and FITS cache
- Display shaders and difference comparison
- Quality gating and SNR maps
- 102-band SED drawer
- 3D time-cube and sphere views
- CDS tools and HiPS overlays

M7 documentation preparation is available below. Runtime accessibility
verification, any resulting fixes, and the final demo recording remain
release gates.

- [Accessibility audit](docs/accessibility-audit.md)
- [Demo script and recording checklist](docs/demo-video.md)
- [Submission copy and release checklist](docs/submission.md)

## License

Open source under the [Apache-2.0 License](LICENSE).