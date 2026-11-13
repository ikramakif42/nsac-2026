# ORBIT-LENS — Master Build Context & Complete Execution Blueprint

> **Hackathon:** 2026 NASA Space Apps Challenge — *Planet X and SPHEREx*  
> **Team:** Schwarzschildren  
> **Repository:** `D:\Programming\NSAC 2026`  
> **Current Version:** `0.2.1`  
> **Last Verified:** 2026-11-13 17:38 (UTC+6)  
> **Build & Test Status:** ✅ **16 / 16 Automated Tests Passing** (9 Backend pytest + 7 Frontend vitest) | Bundle: Clean (771ms)

---

## 1. Executive Summary & Core Contract

ORBIT-LENS is a high-performance web tool that enables astronomers and citizen scientists to explore time-series near-infrared sky observations from NASA's SPHEREx mission. It allows users to spot moving solar system bodies (asteroids, Kuiper belt objects, brown dwarfs, Planet X candidates) and variable stars by watching celestial regions evolve across survey epochs.

### Non-Negotiable System Contracts
1. **Science Authority Separation:** The Astropy & NumPy Python backend owns all coordinate transformations (WCS-TAN), MEF FITS parsing, flux calibration, and quality bitmask decodings. The WebGL2 / Three.js frontend acts solely as a rendering presentation layer.
2. **Photosensitivity Safety (WCAG 2.2 AA):** Playback strictly initializes in a paused state (`isPlaying = false`), defaults to 0.5 fps, and enforces a hard ceiling at 3.0 Hz. Time scrubbing is performed smoothly via mousewheel/trackpad gestures with GPU temporal crossfades.
3. **No Silent Fallbacks:** Real IRSA archive queries never fall back silently to synthetic data on failure. The UI explicitly flags data provenance via an ever-present `SourceBadge` (`SPHEREx QR3`, `SYNTHETIC`, `MAST`, `VizieR`).
4. **Deep-Link Portability:** The explore workbench (`/explore`) is completely stateless and shareable via bi-directional URL query parameters (`ra`, `dec`, `fov`, `source`, `epoch`, `embed`). It must load without requiring a prior visit to `/`.
5. **Mandatory NASA Disclaimer:** Displayed on all pages and footers:  
   *"ORBIT-LENS is an independent open-source project by Team Schwarzschildren. Not affiliated with, sponsored by, or endorsed by NASA, JPL, or the SPHEREx mission team."*

---

## 2. Environment & Machine-Specific Gotchas

| Item | Specification / Requirement | Gotchas & Solutions |
|---|---|---|
| **Python** | Python 3.12 (64-bit native Windows) | **CRITICAL:** Do NOT use MSYS2 / UCRT64 Python (`C:\msys64\ucrt64\bin\python.exe`). MSYS2 lacks precompiled `win_amd64` wheels for numpy/astropy and triggers SSL build failures. Always use Native Python launcher: `py -3.12 -m venv backend\.venv`. |
| **Node.js** | Node.js v22.12.0 / npm 10.9.0 | Project uses modern ES Modules (`"type": "module"`). |
| **Vite & Bundler** | Vite 8 + Rolldown | In `vite.config.ts`, `rollupOptions.output.manualChunks` MUST be declared as a function, not an object dictionary. |
| **PowerShell** | Windows PowerShell 5.1 | Do NOT use `&&` statement separators in single command strings. Use `;` instead. For inline python scripts, never pass complex regex inline; write to `.py` script files. |
| **Network & SSL** | Corporate/School firewall or proxy | When executing python web requests or pip, if SSL verification issues occur, pass `--trusted-host pypi.org --trusted-host files.pythonhosted.org`. For `curl.exe`, use `-k -L`. |

---

## 3. Five Benchmark Challenge Targets

These verified targets are embedded into the preset launcher to validate all pipeline phases:

| Target Name | Right Ascension (RA) | Declination (Dec) | Astrophysical Classification & Expected Signal |
|---|---|---|---|
| **Barnard's Star** | `269.4521°` | `+4.6934°` | M4.0V High Proper Motion red dwarf ($10.3''/\text{yr}$ fast diagonal drift across epochs) |
| **Epsilon Indi B** | `331.0438°` | `−56.7828°` | Nearest T-type brown dwarf (strong methane $CH_4$ & water absorption) |
| **WISE 0855** | `133.7951°` | `−7.2451°` | Coldest known Y-dwarf ($T \approx 250\ \text{K}$, deep $H_2O$ ice absorption at 3.05 $\mu\text{m}$) |
| **RW Aurigae** | `76.9564°` | `+30.4014°` | T Tauri pre-main-sequence variable star with circumstellar dust obscuration |
| **R Draconis** | `248.1676°` | `+66.7551°` | Mira-type pulsating AGB variable (amplitude $> 5$ mag across multi-month epochs) |

---

## 4. Optical Specifications: 6 SPHEREx Detector Arrays

The focal plane of SPHEREx contains **6 individual $2k \times 2k$ H2RG detector arrays** fitted with Linear Variable Filters (LVF). Total = **102 continuous spectral bands**:

| Array ID | Wavelength Range ($\mu\text{m}$) | Resolving Power ($R$) | Channels | Physical Tracers & Features |
|---|---|---|---|---|
| **Array 1** | $0.75 - 1.11$ | $\approx 41$ | 17 | Near-infrared continuum, stellar photospheres |
| **Array 2** | $1.11 - 1.64$ | $\approx 41$ | 17 | 1.66 $\mu\text{m}$ Methane ($CH_4$) in brown dwarfs |
| **Array 3** | $1.64 - 2.42$ | $\approx 41$ | 17 | $K$-band continuum, circumstellar dust extinction |
| **Array 4** | $2.42 - 3.82$ | $\approx 35$ | 17 | Interstellar $H_2O$ water ice feature at 3.05 $\mu\text{m}$ |
| **Array 5** | $3.82 - 4.42$ | $\approx 110$ | 17 | Solid-state $CO_2$ ice absorption at 4.27 $\mu\text{m}$ |
| **Array 6** | $4.42 - 5.00$ | $\approx 130$ | 17 | Interstellar $CO$ ice absorption at 4.67 $\mu\text{m}$ |

---

## 5. Phase-by-Phase Implementation Blueprint

### Phase 1: Live IRSA SIA v2 / IBE / TAP Integration
- **Objective:** Connect `backend/app/connectors/qr3.py` to the real NASA IPAC Infrared Science Archive.
- **Protocol:**
  - **SIA v2 Query:** Query `https://irsa.ipac.caltech.edu/SCS?POS=CIRCLE+{ra}+{dec}+{radius}` or TAP `https://irsa.ipac.caltech.edu/TAP/sync` with table `spherex_qr3`.
  - **IBE Level 2 MEF Fetcher:** Retrieve signed FITS cutouts from `https://irsa.ipac.caltech.edu/ibe/data/spherex/enhanced`.
  - **FITS Parser:** Astropy `fits.open()` parses:
    - HDU 0: Header & WCS metadata.
    - HDU 1: Science pixel array (`float32`).
    - HDU 2: Per-pixel variance array (`float32`).
    - HDU 3: Quality bitmask (`uint16`).
  - **Local Disk Cache:** Store downloaded cutouts in `backend/cache/fits/{record_id}.fits` to avoid redundant network transfers.

### Phase 2: WebGL2 Custom Shaders & Difference Blinking
- **Objective:** Ultra-fast GPU pixel rendering with dynamic non-linear stretching.
- **Shader Pipeline (`WebGL2Canvas.tsx`):**
  - Textures: Upload Float32 pixel arrays to WebGL2 textures using `gl.R32F` format.
  - GLSL Vertex Shader: Fullscreen quad rendering.
  - GLSL Fragment Shader:
    - Dynamic stretch algorithm: $\text{asinh}(x) = \ln\left(x + \sqrt{x^2 + 1}\right)$ scaled by user contrast percentiles.
    - Colormap lookup: 256-entry 1D texture for Inferno, Viridis, Magma, Cool-Warm.
    - Temporal Crossfade: When scrubbing epochs, cross-dissolve between $I(t_1)$ and $I(t_2)$ to guarantee zero flashing.
    - Difference Mode: Compute $\Delta I = \frac{I_2 - I_1}{\sqrt{\sigma_1^2 + \sigma_2^2}}$ to illuminate moving or variable pixels against stationary background.

### Phase 3: Science Quality Gating
- **Objective:** Enforce data integrity standards.
- **Rules:**
  - Decode HDU 3 bitmask:
    - Bit 0 (`0x0001`): Bad pixel
    - Bit 1 (`0x0002`): Saturated
    - Bit 2 (`0x0004`): Cosmic ray hit
    - Bit 5 (`0x0020`): Persistence artifact
  - Derive SNR map: $\text{SNR} = \text{HDU 1} / \sqrt{\text{HDU 2}}$.
  - If target central pixel has bitmask $\neq 0$, display prominent amber warning in Metadata Panel and Timeline.

### Phase 4: Interactive 102-Band SED Drawer (uPlot)
- **Objective:** Continuous spectral energy distribution plotting.
- **Implementation (`SEDDrawer.tsx`):**
  - Mount `uPlot` canvas plotting Flux ($\text{MJy/sr}$) vs. $\lambda$ ($\mu\text{m}$).
  - Display color-coded bands for all 6 detector arrays.
  - Plot vertical translucent reference bands for volatile ices:
    - $H_2O$ ice (3.05 $\mu\text{m}$)
    - $CO_2$ ice (4.27 $\mu\text{m}$)
    - $CO$ ice (4.67 $\mu\text{m}$)
    - $CH_4$ ice (1.66 $\mu\text{m}$ & 3.32 $\mu\text{m}$)
  - Interactive click listener: Clicking on any wavelength band automatically jumps the 2D viewer to the corresponding detector array cutout.

### Phase 5: Three.js Interactive 3D Time-Cube & Celestial Footprint
- **Objective:** Immersive volumetric presentation for hackathon judges.
- **Implementation (`CubeViewer.tsx`):**
  - Built with `@react-three/fiber` and `@react-three/drei`.
  - **Time Mode ($(x, y, t)$):** Stack epochs along $Z$-axis. Stationary stars form straight vertical columns; moving solar system bodies or Planet X candidates form slanted 3D worldlines.
  - **Spectral Mode ($(x, y, \lambda)$):** Stack 102 wavelength channels. Molecular absorption appears as dark horizontal slabs.
  - OrbitControls (free 3D tilt, rotate, pan) + interactive clipping plane along $Z$-axis.
- **Implementation (`SphereViewer.tsx`):**
  - 3D celestial sphere showing coordinate grid, celestial equator, ecliptic plane, SPHEREx sun-synchronous orbit scan path, and 5° FOV cone.

### Phase 6: CDS Tools & Partner HiPS Overlays
- **Objective:** Cross-catalog multi-wavelength comparison.
- **Implementation:**
  - Integrate CDS HiPS protocol or Aladin Lite v3 WebGL canvas.
  - Overlays:
    - 2MASS All-Sky Data ($J, H, K_s$ bands)
    - AllWISE / NEOWISE ($W1$ 3.4 $\mu\text{m}$, $W2$ 4.6 $\mu\text{m}$)
    - ESA Gaia DR3 point sources with proper motion vector arrows ($\mu_\alpha \cos \delta, \mu_\delta$).

### Phase 7: Accessibility & Final Submission Polish
- **Auditing:** WCAG 2.2 AA compliant focus rings, ARIA roles (`role="toolbar"`, `role="region"`, `role="tablist"`), screen reader text for celestial coordinates.
- **Video Demo Assets:** 7-minute presentation walkthrough highlighting:
  1. The core challenge (Planet X / SPHEREx time-domain variability).
  2. The 6-array optical architecture & 102-band SEDs.
  3. Interactive wheel time-scrubbing.
  4. 3D Time-Cube discovery workflow.
  5. Scientific integrity & Astropy validation.

---

## 6. How to Run & Verify Locally

### Terminal 1: Backend
```powershell
cd "D:\Programming\NSAC 2026\backend"
.\.venv\Scripts\activate
# Run test suite (9 tests)
pytest -v
# Start server
uvicorn app.main:app --reload --port 8000
```
- API Health: `http://localhost:8000/health`
- Interactive Swagger API Docs: `http://localhost:8000/docs`

### Terminal 2: Frontend
```powershell
cd "D:\Programming\NSAC 2026\frontend"
# Run unit tests (7 tests)
npm test
# Run TypeScript compilation & production bundle
npm run build
# Start dev server
npm run dev
```
- Web Application: `http://localhost:5173/explore`
- Direct Deep-Link Example: `http://localhost:5173/explore?ra=269.4521&dec=4.6934&fov=5.0&source=synthetic&epoch=0`
- Embed Mode Example: `http://localhost:5173/explore?ra=269.4521&dec=4.6934&embed=true`

---

## 7. Deployment Runbook

### A. Instant Zero-Config Live Demo (For Testing Right Now)
Share what is running locally with judges or teammates in 10 seconds:
```powershell
npx localtunnel --port 5173
```
Or via Cloudflare Tunnel:
```powershell
npx cloudflared tunnel --url http://localhost:5173
```

### B. Permanent Free Cloud Hosting

#### 1. Frontend on Vercel
1. Push repo to GitHub:
   ```powershell
   git remote add origin https://github.com/YOUR_USER/orbit-lens.git
   git push -u origin main
   ```
2. Log in to [vercel.com](https://vercel.com) $\to$ **Add New Project** $\to$ Select repo.
3. Configure settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Environment Variable:** `VITE_API_URL` = `https://your-backend.onrender.com` (or Railway URL).
4. Click **Deploy**.

#### 2. Backend on Render or Railway
- **On Render (`render.com`):**
  1. Click **New Web Service** $\to$ Connect GitHub repo.
  2. Set **Root Directory** to `backend`.
  3. Environment: `Python 3`.
  4. Build Command: `pip install -r requirements.txt`.
  5. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  6. Environment Variables:
     - `RELEASE`: `qr3`
     - `CORS_ORIGINS`: `https://your-frontend.vercel.app,http://localhost:5173`
- **On Railway (`railway.app`):**
  1. Click **New Project** $\to$ **Deploy from GitHub repo**.
  2. Set Root Directory to `/backend`.
  3. Railway automatically detects Python, installs `requirements.txt`, and runs Uvicorn.
