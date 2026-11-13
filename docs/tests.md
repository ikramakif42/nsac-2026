# ORBIT-LENS — Test Suite & Sanity Check Report

## Executive Summary
This document records the automated sanity checks and test suite verification for ORBIT-LENS, including the 6-detector focal plane calibration, progressive 5-degree FOV tile index, wheel temporal scrubbing, and 3D time-cube endpoints.

---

## 1. Test Summary Matrix

| Scope | Suite | Tests Run | Passed | Failed | Execution Time |
|---|---|---|---|---|---|
| **Backend** | `pytest` | 9 | 9 | 0 | ~1.8s |
| **Frontend** | `vitest` | 7 | 7 | 0 | ~0.3s |
| **TypeScript / Bundler** | `tsc && vite build` | 1 | 1 | 0 | ~1.1s |
| **Total** | | **17** | **17** | **0** | **~3.2s** |

---

## 2. Backend Test Specifications (`backend/tests/test_sanity.py`)

### Test Cases

1. **`test_health_check`**
   - **Endpoint:** `GET /health`
   - **Verification:** Verifies server returns status `"ok"`, release `"qr3"`, `"arrays": 6`, and `"spectral_channels": 102`.
   - **Result:** `PASSED`

2. **`test_synthetic_search_6_arrays`**
   - **Endpoint:** `POST /search` with `source="synthetic"`
   - **Verification:** Returns 24 multi-epoch records across all 6 physical detector arrays (`Array1` through `Array6`).
   - **Result:** `PASSED`

3. **`test_qr3_search_phase1_gate`**
   - **Endpoint:** `POST /search` with `source="qr3"`
   - **Verification:** Enforces that unintegrated real archive requests return HTTP 503 rather than silently falling back to synthetic test data.
   - **Result:** `PASSED`

4. **`test_tiles_endpoint`**
   - **Endpoint:** `POST /tiles`
   - **Verification:** Returns 5.0-degree active FOV chunk with directionally biased prefetch neighbor chunks along velocity vector $(\Delta \text{RA}, \Delta \text{Dec})$.
   - **Result:** `PASSED`

5. **`test_cube_endpoint`**
   - **Endpoint:** `GET /cube`
   - **Verification:** Validates dual-axis slicing metadata for `axis="time"` (6 temporal slices) and `axis="wavelength"` (102 spectral channels).
   - **Result:** `PASSED`

6. **`test_wcs_transforms`**
   - **Module:** `app.science.wcs_engine`
   - **Verification:** Astropy TAN projection forward and reverse transforms within $10^{-4}$ pixel tolerance.
   - **Result:** `PASSED`

7. **`test_snr_computation`**
   - **Module:** `app.science.fits_engine`
   - **Verification:** Formula $\text{SNR} = \frac{\text{Science}}{\sqrt{\text{Variance}}}$ matches known input.
   - **Result:** `PASSED`

8. **`test_quality_flag_decoding`**
   - **Module:** `app.science.fits_engine`
   - **Verification:** Bitwise decoding of HDU 3 quality bitmasks.
   - **Result:** `PASSED`

9. **`test_6_array_lvf_model`**
   - **Module:** `app.science.lvf_model`
   - **Verification:** Validates all 6 physical detector arrays (Array 1–6), exact 102-point continuous spectral axis ($0.75 - 5.00\ \mu\text{m}$), and wavelength-to-array mapping.
   - **Result:** `PASSED`

---

## 3. Frontend Test Specifications (`frontend/src/__tests__/store.test.ts`)

### Test Cases

1. **`enforces playback safety defaults`**
   - **Verification:** Playback initializes paused (`isPlaying: false`), default speed is 0.5 fps, default FOV is 5.0 degrees.
   - **Result:** `PASSED`

2. **`caps playback speed strictly at 3.0 Hz`**
   - **Verification:** Enforces photosensitivity safety ceiling at 3.0 Hz.
   - **Result:** `PASSED`

3. **`performs smooth wheel scrubbing through epochs`**
   - **Verification:** `stepEpoch` smoothly steps forward/backward with boundary clamping across multi-epoch stacks.
   - **Result:** `PASSED`

4. **`contains all 5 NASA challenge benchmark targets`**
   - **Verification:** Confirms Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, and R Draconis.
   - **Result:** `PASSED`

5. **`retrieves synthetic observations across all 6 detector arrays`**
   - **Verification:** Synthetic query yields 24 records spanning `Array1` through `Array6`.
   - **Result:** `PASSED`

6. **`calculates 5-degree active and prefetch tiles`**
   - **Verification:** Validates tile ID generation and 5-degree bounding boxes.
   - **Result:** `PASSED`

7. **`retrieves 3D Time-Cube metadata`**
   - **Verification:** Returns 3D datacube dimensions and slice metadata.
   - **Result:** `PASSED`
