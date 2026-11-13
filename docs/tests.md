# ORBIT-LENS — Test Suite & Sanity Check Report

## Executive Summary
This document records the automated sanity checks and test suite verification for the ORBIT-LENS foundation scaffold. All tests execute independently for the frontend and backend, validating the CIDS contracts, science mathematical functions, playback safety boundaries, and API interfaces.

---

## 1. Test Summary Matrix

| Scope | Suite | Tests Run | Passed | Failed | Execution Time |
|---|---|---|---|---|---|
| **Backend** | `pytest` | 7 | 7 | 0 | ~1.9s |
| **Frontend** | `vitest` | 4 | 4 | 0 | ~0.3s |
| **TypeScript / Bundler** | `tsc && vite build` | 1 | 1 | 0 | ~0.15s |
| **Total** | | **12** | **12** | **0** | **~2.4s** |

---

## 2. Backend Test Specifications (`backend/tests/test_sanity.py`)

### Test Cases

1. **`test_health_check`**
   - **Endpoint:** `GET /health`
   - **Verification:** Verifies server is online, returns HTTP 200, status is `"ok"`, and current release is `"qr3"`.
   - **Result:** `PASSED`

2. **`test_synthetic_search`**
   - **Endpoint:** `POST /search` with `source="synthetic"`
   - **Verification:** Verifies synthetic query returns CIDS-compliant `SearchResult` with populated `ObservationRecord` list, `wcs` parameters, and source tag `"synthetic"`.
   - **Result:** `PASSED`

3. **`test_qr3_search_phase1_gate`**
   - **Endpoint:** `POST /search` with `source="qr3"`
   - **Verification:** Enforces that unintegrated real archive requests return HTTP 503 rather than silently falling back to synthetic test data.
   - **Result:** `PASSED`

4. **`test_wcs_transforms`**
   - **Module:** `app.science.wcs_engine`
   - **Verification:** Validates Astropy WCS-TAN projection forward transform (pixel to sky RA/Dec) and reverse transform (sky to pixel coordinates) within $10^{-4}$ pixel tolerance.
   - **Result:** `PASSED`

5. **`test_snr_computation`**
   - **Module:** `app.science.fits_engine`
   - **Verification:** Verifies median Signal-to-Noise Ratio formula $\text{SNR} = \frac{\text{Science}}{\sqrt{\text{Variance}}}$ with known synthetic inputs ($100 / \sqrt{25} = 20.0$).
   - **Result:** `PASSED`

6. **`test_quality_flag_decoding`**
   - **Module:** `app.science.fits_engine`
   - **Verification:** Tests bitwise decoding of HDU 3 quality bitmasks (e.g., bit 0 for `BAD_PIXEL`, bit 2 for `COSMIC_RAY`).
   - **Result:** `PASSED`

7. **`test_lvf_model`**
   - **Module:** `app.science.lvf_model`
   - **Verification:** Validates linear variable filter (LVF) wavelength mapping across detector rows (0.75 μm to 1.10 μm for SW1) and 100-point full channel spectral sampling.
   - **Result:** `PASSED`

### How to Run Backend Tests
```bash
cd backend
.\.venv\Scripts\activate
pytest -v
```

---

## 3. Frontend Test Specifications (`frontend/src/__tests__/store.test.ts`)

### Test Cases

1. **`enforces playback safety defaults`**
   - **Target:** Zustand `useStore` playback state.
   - **Verification:** Playback strictly initializes with `isPlaying: false`, `fps: 0.5`, and `epochIndex: 0` to prevent user photosensitivity issues.
   - **Result:** `PASSED`

2. **`caps playback speed strictly at 3.0 Hz`**
   - **Target:** `setFps` action.
   - **Verification:** Restricts frame rates exceeding 3.0 Hz (e.g. attempting to set 10.0 fps caps to 3.0 fps; setting 0.01 fps floors to 0.1 fps).
   - **Result:** `PASSED`

3. **`contains all 5 NASA challenge benchmark targets`**
   - **Target:** `BENCHMARK_TARGETS` preset registry.
   - **Verification:** Confirms presence of Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, and R Draconis with verified celestial coordinates.
   - **Result:** `PASSED`

4. **`retrieves deterministic synthetic search records`**
   - **Target:** `syntheticConnector.search`.
   - **Verification:** Verifies synthetic connector returns 8 multi-epoch observations with warning banner and `source_used: "synthetic"`.
   - **Result:** `PASSED`

### How to Run Frontend Tests & Build
```bash
cd frontend
# Run unit tests
npm test

# Run TypeScript compilation and production bundle check
npm run build
```

---

## 4. End-to-End Sanity Check Protocol

When starting development or validating an environment:

1. **Start Backend Server:**
   ```bash
   cd backend
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```
   Open `http://localhost:8000/health` in your browser. Expected response: `{"status":"ok","release":"qr3"}`.

2. **Start Frontend Server:**
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173/explore` in your browser. Verify the coordinate inputs and benchmark preset buttons respond immediately.
