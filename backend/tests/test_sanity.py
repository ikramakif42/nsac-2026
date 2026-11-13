import pytest
import numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.science.fits_engine import compute_snr, decode_quality_flags
from app.science.wcs_engine import build_wcs, pixel_to_sky, sky_to_pixel
from app.science.lvf_model import (
    row_to_wavelength,
    all_bands_wavelength_axis,
    SPHEREX_ARRAYS,
    get_array_for_wavelength,
)

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["release"] == "qr3"
    assert data["arrays"] == 6
    assert data["spectral_channels"] == 102


def test_synthetic_search_6_arrays():
    payload = {
        "ra": 269.4521,
        "dec": 4.6934,
        "radius_arcsec": 30.0,
        "source": "synthetic"
    }
    response = client.post("/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["source_used"] == "synthetic"
    assert data["total"] == 24  # 4 epochs * 6 arrays
    assert len(data["records"]) == 24
    
    bands = {r["band"] for r in data["records"]}
    for i in range(1, 7):
        assert f"Array{i}" in bands


def test_qr3_search_phase1_gate():
    payload = {
        "ra": 269.4521,
        "dec": 4.6934,
        "radius_arcsec": 30.0,
        "source": "qr3"
    }
    response = client.post("/search", json=payload)
    # Expected 503 until Phase 1 implementation completes
    assert response.status_code == 503
    assert "Phase 1" in response.json()["detail"]


def test_tiles_endpoint():
    payload = {
        "ra": 269.4521,
        "dec": 4.6934,
        "fov_deg": 5.0,
        "velocity_dra": 1.2,
        "velocity_ddec": 0.5,
        "source": "synthetic"
    }
    response = client.post("/tiles", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["active_tile"]["fov_deg"] == 5.0
    assert len(data["prefetch_tiles"]) > 0


def test_cube_endpoint():
    response = client.get("/cube?record_id=test_1&axis=time&source=synthetic")
    assert response.status_code == 200
    data = response.json()
    assert data["axis"] == "time"
    assert len(data["slices"]) == 6

    # Test spectral axis
    res_spectral = client.get("/cube?record_id=test_1&axis=wavelength&source=synthetic")
    assert res_spectral.status_code == 200
    data_spec = res_spectral.json()
    assert data_spec["axis"] == "wavelength"
    assert len(data_spec["slices"]) == 102


def test_wcs_transforms():
    wcs_params = {
        "naxis1": 256,
        "naxis2": 256,
        "crpix1": 128.0,
        "crpix2": 128.0,
        "crval1": 269.4521,
        "crval2": 4.6934,
        "cdelt1": -0.000277,
        "cdelt2": 0.000277,
    }
    wcs = build_wcs(wcs_params)
    assert wcs is not None

    ra, dec = pixel_to_sky(wcs, 127.0, 127.0)
    assert abs(ra - 269.4521) < 0.01
    assert abs(dec - 4.6934) < 0.01

    px, py = sky_to_pixel(wcs, ra, dec)
    assert abs(px - 127.0) < 1e-4
    assert abs(py - 127.0) < 1e-4


def test_snr_computation():
    science = np.ones((10, 10), dtype=np.float32) * 100.0
    variance = np.ones((10, 10), dtype=np.float32) * 25.0
    snr = compute_snr(science, variance)
    assert abs(snr - 20.0) < 1e-3


def test_quality_flag_decoding():
    mask = np.array([[5]], dtype=np.uint16)
    flags = decode_quality_flags(mask)
    assert "BAD_PIXEL" in flags
    assert "COSMIC_RAY" in flags
    assert len(flags) == 2


def test_6_array_lvf_model():
    # 6 arrays
    assert len(SPHEREX_ARRAYS) == 6
    
    # Array 1: 0.75 - 1.11 μm
    wl_row0 = row_to_wavelength("Array1", 0)
    wl_row2048 = row_to_wavelength("Array1", 2048)
    assert abs(wl_row0 - 0.75) < 1e-4
    assert abs(wl_row2048 - 1.11) < 1e-4

    # Array 6: 4.42 - 5.00 μm
    assert abs(row_to_wavelength("Array6", 2048) - 5.00) < 1e-4
    
    # All bands concatenated = exactly 102 channels (6 * 17)
    axis = all_bands_wavelength_axis()
    assert len(axis) == 102
    assert axis[0] > 0.74
    assert axis[-1] < 5.01

    # Wavelength mapping
    assert get_array_for_wavelength(0.85) == "Array1"
    assert get_array_for_wavelength(3.10) == "Array4"
    assert get_array_for_wavelength(4.60) == "Array6"
