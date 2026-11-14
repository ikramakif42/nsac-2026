import base64
import io
import json

import numpy as np
import pytest
from astropy.io import fits
from fastapi.testclient import TestClient

from app.quality_api import quality_app
from app.science.fits_engine import (
    FITSValidationError,
    compute_quality_products,
)
from app.science.quality_products import (
    MAX_UPLOAD_BYTES,
    build_quality_payload,
)


def mef_bytes(science, variance, mask):
    stream = io.BytesIO()
    fits.HDUList(
        [
            fits.PrimaryHDU(),
            fits.ImageHDU(np.asarray(science, dtype=np.float32)),
            fits.ImageHDU(np.asarray(variance, dtype=np.float32)),
            fits.ImageHDU(np.asarray(mask)),
        ]
    ).writeto(stream)
    return stream.getvalue()


def payload_from_planes(tmp_path, science, variance, mask):
    path = tmp_path / "cutout.fits"
    path.write_bytes(mef_bytes(science, variance, mask))
    return build_quality_payload(
        path,
        record_id="qr3_Array1_epoch",
        source="qr3",
    )


def test_signed_snr_rejects_unknown_bits_and_bad_variance(tmp_path):
    result = payload_from_planes(
        tmp_path,
        [[4, -6, 10], [5, 7, 9]],
        [[4, 9, 1], [0, -1, np.nan]],
        np.array([[0, 0, 1 << 15], [0, 0, 0]], dtype=np.uint16),
    )

    assert result["snr_map"] == [2.0, -2.0, None, None, None, None]
    assert result["summary"]["snr"] == 0.0
    assert result["summary"]["quality_flags"] == 1 << 15
    assert result["summary"]["quality_ok"] is False
    assert result["flags_decoded"] == ["BIT_15"]
    assert result["status"] == "warn"
    assert result["eligible_pixels"] == 2
    assert base64.b64decode(result["eligible_base64"]) == bytes([1, 1, 0, 0, 0, 0])
    json.dumps(result, allow_nan=False)


def test_all_rejected_does_not_invent_cids_snr(tmp_path):
    result = payload_from_planes(
        tmp_path,
        [[1, 2]],
        [[1, 1]],
        np.array([[1, 32768]], dtype=np.uint16),
    )

    assert result["status"] == "fail"
    assert result["report"] is None
    assert result["summary"]["snr"] is None
    assert result["snr_map"] == [None, None]
    assert result["science_display"]["low"] is None
    assert result["science_display"]["high"] is None
    assert not any(base64.b64decode(result["science_rgba_base64"]))
    assert not any(base64.b64decode(result["snr_rgba_base64"]))
    json.dumps(result, allow_nan=False)


def test_pass_and_texture_opacity(tmp_path):
    result = payload_from_planes(
        tmp_path,
        [[2, -2]],
        [[1, 1]],
        np.zeros((1, 2), dtype=np.uint16),
    )

    assert result["status"] == "pass"
    assert result["summary"]["quality_ok"] is True
    assert result["report"]["status"] == "pass"
    assert result["report"]["snr"] == 0.0

    rgba = np.frombuffer(
        base64.b64decode(result["snr_rgba_base64"]),
        dtype=np.uint8,
    ).reshape(1, 2, 4)
    assert np.all(rgba[..., 3] == 255)
    assert rgba[0, 0, 0] > rgba[0, 0, 2]
    assert rgba[0, 1, 2] > rgba[0, 1, 0]


def test_rejected_outlier_does_not_change_display_percentiles(tmp_path):
    result = payload_from_planes(
        tmp_path,
        [[0, 1, 1e20]],
        [[1, 1, 1]],
        np.array([[0, 0, 1]], dtype=np.uint16),
    )

    assert result["science_display"]["low"] == pytest.approx(0.01)
    assert result["science_display"]["high"] == pytest.approx(0.99)

    rgba = np.frombuffer(
        base64.b64decode(result["science_rgba_base64"]),
        dtype=np.uint8,
    ).reshape(1, 3, 4)
    assert rgba[0, 2, 3] == 0


def test_nonfinite_science_fails_even_with_clear_mask(tmp_path):
    result = payload_from_planes(
        tmp_path,
        [[np.nan, np.inf]],
        [[1, 1]],
        np.zeros((1, 2), dtype=np.uint16),
    )

    assert result["summary"]["quality_flags"] == 0
    assert result["summary"]["quality_ok"] is False
    assert result["status"] == "fail"


@pytest.mark.parametrize(
    "mask",
    [
        np.array([[-1]], dtype=np.int16),
        np.array([[65536]], dtype=np.int32),
        np.array([[0.0]], dtype=np.float32),
    ],
)
def test_invalid_mask_is_rejected(tmp_path, mask):
    with pytest.raises(FITSValidationError):
        payload_from_planes(tmp_path, [[1]], [[1]], mask)


def test_shape_mismatch_is_not_broadcast(tmp_path):
    with pytest.raises(FITSValidationError, match="shapes must match"):
        payload_from_planes(
            tmp_path,
            [[1, 2]],
            [[1]],
            np.zeros((1, 2), dtype=np.uint16),
        )


def test_missing_mask_never_passes_strict_products():
    with pytest.raises(ValueError, match="HDU 3"):
        compute_quality_products(
            np.ones((2, 2)),
            np.ones((2, 2)),
            None,
        )


def test_missing_variance_produces_no_eligible_pixels():
    products = compute_quality_products(
        np.ones((2, 2)),
        None,
        np.zeros((2, 2), dtype=np.uint16),
    )
    assert not np.any(products.eligible)
    assert products.median_snr is None


def test_api_returns_json_safe_products():
    with TestClient(quality_app) as client:
        response = client.post(
            "/api/quality",
            params={"record_id": "synthetic_Array6_1", "source": "synthetic"},
            content=mef_bytes(
                [[4, np.nan]],
                [[4, 1]],
                np.zeros((1, 2), dtype=np.uint16),
            ),
            headers={"Content-Type": "application/fits"},
        )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    payload = response.json()
    assert payload["source"] == "synthetic"
    assert payload["record_id"] == "synthetic_Array6_1"
    assert payload["snr_map"] == [2.0, None]
    assert "NaN" not in response.text
    assert "Infinity" not in response.text


def test_api_rejects_wrong_media_type():
    with TestClient(quality_app) as client:
        response = client.post(
            "/api/quality?record_id=x&source=qr3",
            json={"url": "http://localhost/private"},
        )
    assert response.status_code == 415


def test_api_rejects_oversized_declared_body():
    with TestClient(quality_app) as client:
        response = client.post(
            "/api/quality?record_id=x&source=qr3",
            content=b"x",
            headers={
                "Content-Type": "application/fits",
                "Content-Length": str(MAX_UPLOAD_BYTES + 1),
            },
        )
    assert response.status_code == 413


def test_api_rejects_invalid_fits_without_fallback():
    with TestClient(quality_app) as client:
        response = client.post(
            "/api/quality?record_id=x&source=qr3",
            content=b"not a FITS file",
            headers={"Content-Type": "application/fits"},
        )
    assert response.status_code == 422
    assert "uncompressed FITS" in response.json()["detail"]