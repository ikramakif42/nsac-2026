import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.connectors.qr3 import QR3Connector
from app.connectors.qr3_archive import ArchiveError
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
    response = client.post("/search", json={
        "ra": 269.4521,
        "dec": 4.6934,
        "radius_arcsec": 30.0,
        "source": "synthetic",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["source_used"] == "synthetic"
    assert data["total"] == 24
    assert len(data["records"]) == 24
    assert {record["band"] for record in data["records"]} == {
        f"Array{i}" for i in range(1, 7)
    }


def test_qr3_archive_failure_is_explicit(monkeypatch):
    async def fail(self, query):
        raise ArchiveError("test archive unavailable")

    monkeypatch.setattr(QR3Connector, "_discover", fail)
    response = client.post("/search", json={
        "ra": 269.4521,
        "dec": 4.6934,
        "radius_arcsec": 30,
        "source": "qr3",
    })
    assert response.status_code == 502
    assert "test archive unavailable" in response.json()["detail"]
    assert "records" not in response.json()


def test_tiles_endpoint():
    response = client.post("/tiles", json={
        "ra": 269.4521,
        "dec": 4.6934,
        "fov_deg": 5.0,
        "velocity_dra": 1.2,
        "velocity_ddec": 0.5,
        "source": "synthetic",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["active_tile"]["fov_deg"] == 5
    assert len(data["prefetch_tiles"]) > 0


def test_cube_endpoint():
    response = client.get("/cube?record_id=test_1&axis=time&source=synthetic")
    assert response.status_code == 200
    assert response.json()["axis"] == "time"
    assert len(response.json()["slices"]) == 6

    response = client.get("/cube?record_id=test_1&axis=wavelength&source=synthetic")
    assert response.status_code == 200
    assert response.json()["axis"] == "wavelength"
    assert len(response.json()["slices"]) == 102


def test_wcs_transforms():
    wcs = build_wcs({
        "naxis1": 256,
        "naxis2": 256,
        "crpix1": 128,
        "crpix2": 128,
        "crval1": 269.4521,
        "crval2": 4.6934,
        "cdelt1": -0.000277,
        "cdelt2": 0.000277,
    })
    assert wcs is not None
    ra, dec = pixel_to_sky(wcs, 127, 127)
    assert ra == pytest.approx(269.4521, abs=0.01)
    assert dec == pytest.approx(4.6934, abs=0.01)
    px, py = sky_to_pixel(wcs, ra, dec)
    assert px == pytest.approx(127, abs=1e-4)
    assert py == pytest.approx(127, abs=1e-4)


def test_snr_computation():
    science = np.full((10, 10), 100, dtype=np.float32)
    variance = np.full((10, 10), 25, dtype=np.float32)
    assert compute_snr(science, variance) == pytest.approx(20, abs=1e-3)


def test_quality_flag_decoding():
    flags = decode_quality_flags(np.array([[5]], dtype=np.uint16))
    assert "BAD_PIXEL" in flags
    assert "COSMIC_RAY" in flags
    assert len(flags) == 2


def test_6_array_lvf_model():
    assert len(SPHEREX_ARRAYS) == 6
    assert row_to_wavelength("Array1", 0) == pytest.approx(0.75, abs=1e-4)
    assert row_to_wavelength("Array1", 2048) == pytest.approx(1.11, abs=1e-4)
    assert row_to_wavelength("Array6", 2048) == pytest.approx(5, abs=1e-4)
    axis = all_bands_wavelength_axis()
    assert len(axis) == 102
    assert axis[0] > 0.74
    assert axis[-1] < 5.01
    assert get_array_for_wavelength(0.85) == "Array1"
    assert get_array_for_wavelength(3.10) == "Array4"
    assert get_array_for_wavelength(4.60) == "Array6"