import asyncio
import json

import httpx
import numpy as np
import pytest
from astropy.wcs import WCS
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.cids import WCSParameters
from app.routers import cds


@pytest.fixture
def client():
    cds._cache.clear()
    app = FastAPI()
    app.include_router(cds.router, prefix="/api")
    with TestClient(app) as test_client:
        yield test_client
    cds._cache.clear()


def test_default_tan_center():
    header = cds.target_header(cds.ReferenceRequest(overlay="2mass"))
    center = WCS(header).all_pix2world([[383.5, 383.5]], 0)[0]
    np.testing.assert_allclose(center, [269.4521, 4.6934], atol=1e-9)
    assert header["NAXIS1"] == 768
    assert header["NAXIS2"] == 768


def test_cd_matrix_and_reference_pixel_preserved():
    supplied = WCSParameters(
        naxis1=100,
        naxis2=80,
        crpix1=40,
        crpix2=35,
        crval1=359.99,
        crval2=88,
        cdelt1=-0.001,
        cdelt2=0.001,
        cd1_1=-0.001,
        cd1_2=0.0002,
        cd2_1=0.0002,
        cd2_2=0.001,
    )
    header = cds.target_header(
        cds.ReferenceRequest(overlay="gaia_dr3", wcs=supplied)
    )
    wcs = WCS(header)
    np.testing.assert_allclose(
        wcs.pixel_scale_matrix,
        [[-0.001, 0.0002], [0.0002, 0.001]],
    )
    np.testing.assert_allclose(
        wcs.all_pix2world([[39, 34]], 0)[0],
        [359.99, 88],
        atol=1e-9,
    )


@pytest.mark.parametrize("overlay", ["none", "panstarrs", "https://example.com"])
def test_rejects_unconfigured_surveys(client, overlay):
    response = client.post("/api/cds/render", json={"overlay": overlay})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "patch",
    [{"ra": 360}, {"dec": 91}, {"fov_deg": 0}, {"width": 4096}],
)
def test_request_limits(client, patch):
    response = client.post(
        "/api/cds/render", json={"overlay": "2mass", **patch}
    )
    assert response.status_code == 422


def test_metadata_preserves_reference_provenance(client):
    response = client.post("/api/cds/metadata", json={"overlay": "allwise"})
    assert response.status_code == 200
    data = response.json()
    assert data["hips_url"] == cds.SURVEYS["allwise"]["url"]
    assert "proper-motion" in data["warning"]
    assert set(data["links"]) == {"simbad", "vizier", "aladin"}


def test_render_uses_backend_wcs_and_cache(client, monkeypatch):
    calls = []

    async def fetch(parameters):
        calls.append(parameters)
        return b"\xff\xd8reference-test\xff\xd9"

    monkeypatch.setattr(cds, "fetch_image", fetch)
    for _ in range(2):
        response = client.post("/api/cds/render", json={"overlay": "2mass"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert response.headers["x-orbit-lens-reference"] == "2mass"
    assert len(calls) == 1
    assert calls[0]["hips"] == cds.SURVEYS["2mass"]["url"]
    header = json.loads(calls[0]["wcs"])
    assert header["CTYPE1"] == "RA---TAN"


def test_upstream_failure_never_substitutes_data(client, monkeypatch):
    async def fail(_parameters):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(cds, "fetch_image", fail)
    response = client.post("/api/cds/render", json={"overlay": "gaia_dr3"})
    assert response.status_code == 502
    assert "no substitute" in response.json()["detail"]
    assert not cds._cache


def test_timeout_is_explicit(client, monkeypatch):
    async def fail(_parameters):
        raise httpx.ReadTimeout("timeout")

    monkeypatch.setattr(cds, "fetch_image", fail)
    response = client.post("/api/cds/render", json={"overlay": "2mass"})
    assert response.status_code == 504


def test_singular_wcs_rejected(client):
    response = client.post("/api/cds/render", json={
        "overlay": "2mass",
        "wcs": {
            "naxis1": 16,
            "naxis2": 16,
            "crpix1": 8.5,
            "crpix2": 8.5,
            "crval1": 10,
            "crval2": 20,
            "cdelt1": 0,
            "cdelt2": 0,
        },
    })
    assert response.status_code == 422