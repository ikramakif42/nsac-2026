import asyncio
import io

import numpy as np
import pytest
from astropy.io import fits
from astropy.table import Table
from fastapi import HTTPException

from app.connectors.qr3 import QR3Connector
from app.connectors.qr3_archive import (
    ArchiveError,
    FitsCache,
    make_cutout,
    read_mef,
    read_rows,
    validate_url,
)
from app.models.cids import SearchQuery


def run(coro):
    return asyncio.run(coro)


def product():
    header = fits.Header({
        "CTYPE1": "RA---TAN",
        "CTYPE2": "DEC--TAN",
        "CRPIX1": 16.5,
        "CRPIX2": 16.5,
        "CRVAL1": 269.4521,
        "CRVAL2": 4.6934,
        "CDELT1": -0.001,
        "CDELT2": 0.001,
        "CUNIT1": "deg",
        "CUNIT2": "deg",
    })
    stream = io.BytesIO()
    fits.HDUList([
        fits.PrimaryHDU(),
        fits.ImageHDU(np.full((32, 32), 100, dtype=np.float32), header=header),
        fits.ImageHDU(np.full((32, 32), 25, dtype=np.float32)),
        fits.ImageHDU(np.zeros((32, 32), dtype=np.uint16)),
    ]).writeto(stream, checksum=True)
    return stream.getvalue()


def votable():
    table = Table({
        "obs_id": ["observation-1"],
        "array_id": ["Array1"],
        "wavelength_um": [0.9],
        "epoch_mjd": [61000.0],
        "access_url": ["https://irsa.ipac.caltech.edu/data/observation-1.fits"],
        "access_format": ["application/fits"],
    })
    stream = io.BytesIO()
    table.write(stream, format="votable")
    return stream.getvalue()


@pytest.fixture
def connector(tmp_path):
    instance = QR3Connector()
    instance.cache = FitsCache(tmp_path)
    return instance


def test_real_record_mapping_and_fits_cache(connector, monkeypatch):
    calls = []

    async def get(url, *, params=None, fits_file=False):
        calls.append((url, params, fits_file))
        return product() if fits_file else votable()

    monkeypatch.setattr(connector.transport, "get", get)
    query = SearchQuery(ra=269.4521, dec=4.6934, source="qr3")
    first = run(connector.search(query))
    second = run(connector.search(query))

    assert first.source_used == "qr3"
    assert first.total == 1
    record = first.records[0]
    assert record.source == "qr3"
    assert record.array_id == "Array1"
    assert record.snr == pytest.approx(20)
    assert record.quality_ok is True
    assert record.id == second.records[0].id
    assert sum(fits_file for _, _, fits_file in calls) == 1
    assert calls[0][1]["POS"].startswith("CIRCLE ")


def test_archive_failure_never_becomes_synthetic(connector, monkeypatch):
    async def fail(*args, **kwargs):
        raise ArchiveError("archive offline")

    monkeypatch.setattr(connector.transport, "get", fail)
    with pytest.raises(HTTPException) as caught:
        run(connector.search(SearchQuery(ra=10, dec=20, source="qr3")))
    assert caught.value.status_code == 502
    assert "archive offline" in caught.value.detail


def test_cutout_preserves_mef_and_backend_wcs():
    payload = make_cutout(product(), 269.4521, 4.6934, 0.01)
    _, _, science, variance, mask, wcs = read_mef(payload)
    assert science.shape == variance.shape == mask.shape == (10, 10)
    assert mask.dtype == np.uint16
    ra, dec = wcs.pixel_to_world_values(4.5, 4.5)
    assert ra == pytest.approx(269.4521, abs=0.001)
    assert dec == pytest.approx(4.6934, abs=0.001)


def test_cutout_metadata_points_to_actual_fits(connector, monkeypatch):
    async def get(url, *, params=None, fits_file=False):
        return product() if fits_file else votable()

    monkeypatch.setattr(connector.transport, "get", get)
    result = run(connector.search(
        SearchQuery(ra=269.4521, dec=4.6934, source="qr3")
    ))
    record = run(connector.fetch_cutout(
        result.records[0].id, 269.4521, 4.6934, "Array1"
    ))
    assert record.fits_url.startswith("/cutout/fits?")
    assert record.wcs.naxis1 < 32
    assert record.snr == pytest.approx(20)


def test_tap_uses_adql_and_votable(connector, monkeypatch):
    connector.discovery = "tap"
    captured = []

    async def get(url, *, params=None, fits_file=False):
        captured.append((url, params))
        return product() if fits_file else votable()

    monkeypatch.setattr(connector.transport, "get", get)
    result = run(connector.search(SearchQuery(
        ra=269.4521,
        dec=4.6934,
        source="qr3",
        epoch_range=(60999, 61001),
    )))
    assert result.total == 1
    params = captured[0][1]
    assert params["LANG"] == "ADQL"
    assert params["FORMAT"] == "votable"
    assert "FROM spherex_qr3" in params["QUERY"]
    assert "CONTAINS" in params["QUERY"]
    assert "t_max >= 60999" in params["QUERY"]


def test_ibe_cutout_is_product_specific(connector, monkeypatch):
    descriptor = connector._descriptor({
        "obs_id": "ibe-observation",
        "array_id": "Array1",
        "wavelength_um": 0.9,
        "epoch_mjd": 61000,
        "file_path": "qr3/observation.fits",
    })
    captured = []

    async def get(url, *, params=None, fits_file=False):
        captured.append((url, params))
        return product()

    monkeypatch.setattr(connector.transport, "get", get)
    payload = run(connector._cutout_bytes(descriptor, 269.4521, 4.6934))
    read_mef(payload)
    assert captured[0][0].endswith("/enhanced/qr3/observation.fits")
    assert captured[0][1]["CTYPE"] == "TAN"


@pytest.mark.parametrize("url", [
    "http://irsa.ipac.caltech.edu/file.fits",
    "https://localhost/file.fits",
    "https://127.0.0.1/file.fits",
    "https://irsa.ipac.caltech.edu.evil.example/file.fits",
    "https://user:password@irsa.ipac.caltech.edu/file.fits",
])
def test_rejects_unsafe_product_urls(url):
    with pytest.raises(ArchiveError):
        validate_url(url)


def test_html_and_invalid_mef_are_rejected():
    with pytest.raises(ArchiveError):
        read_rows(b"<html>Service unavailable</html>")
    with pytest.raises(ArchiveError):
        read_mef(b"not a FITS file")


def test_dal_query_error_is_not_an_empty_success():
    payload = b"""<?xml version="1.0"?>
    <VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">
      <RESOURCE type="results">
        <INFO name="QUERY_STATUS" value="ERROR">Unknown table</INFO>
      </RESOURCE>
    </VOTABLE>"""
    with pytest.raises(ArchiveError, match="Unknown table"):
        read_rows(payload)


def test_missing_scientific_metadata_is_not_invented(connector):
    with pytest.raises(ArchiveError):
        connector._descriptor({
            "access_url": "https://irsa.ipac.caltech.edu/data/file.fits"
        })


def test_unknown_record_has_explicit_error(connector):
    with pytest.raises(HTTPException) as caught:
        run(connector.fetch_cutout("unknown", 10, 20, "Array1"))
    assert caught.value.status_code == 404


def test_cache_budget_and_expiration(tmp_path):
    cache = FitsCache(tmp_path)
    cache.budget = 10
    first = cache.key("first")
    second = cache.key("second")
    cache.put(first, b"123456")
    cache.put(second, b"abcdef")
    assert sum(path.stat().st_size for path in tmp_path.glob("*.fits")) <= 10
    cache.ttl = -1
    assert cache.get(second) is None


def test_empty_archive_is_explicit_qr3(connector, monkeypatch):
    table = Table(
        names=["array_id", "access_url"],
        dtype=["U10", "U100"],
    )
    stream = io.BytesIO()
    table.write(stream, format="votable")

    async def get(*args, **kwargs):
        return stream.getvalue()

    monkeypatch.setattr(connector.transport, "get", get)
    result = run(connector.search(SearchQuery(ra=10, dec=20, source="qr3")))
    assert result.total == 0
    assert result.records == []
    assert result.source_used == "qr3"