import pytest
import numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.science.fits_engine import compute_snr, decode_quality_flags
from app.science.wcs_engine import build_wcs, pixel_to_sky, sky_to_pixel
from app.science.lvf_model import row_to_wavelength, all_bands_wavelength_axis

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["release"] == "qr3"


def test_synthetic_search():
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
    assert data["total"] > 0
    assert len(data["records"]) == data["total"]
    
    first = data["records"][0]
    assert first["source"] == "synthetic"
    assert "band" in first
    assert "wavelength_um" in first
    assert "wcs" in first
    assert first["wcs"]["naxis1"] == 256


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
    variance = np.ones((10, 10), dtype=np.float32) * 25.0  # std = 5.0 -> snr = 20.0
    snr = compute_snr(science, variance)
    assert abs(snr - 20.0) < 1e-3


def test_quality_flag_decoding():
    # Bit 0 (BAD_PIXEL) and Bit 2 (COSMIC_RAY) -> 1 | 4 = 5
    mask = np.array([[5]], dtype=np.uint16)
    flags = decode_quality_flags(mask)
    assert "BAD_PIXEL" in flags
    assert "COSMIC_RAY" in flags
    assert len(flags) == 2


def test_lvf_model():
    wl_row0 = row_to_wavelength("SW1", 0)
    wl_row1024 = row_to_wavelength("SW1", 1024)
    assert abs(wl_row0 - 0.75) < 1e-4
    assert abs(wl_row1024 - 1.10) < 1e-4
    
    axis = all_bands_wavelength_axis(n_per_band=25)
    assert len(axis) == 100
    assert axis[0] == 0.75
