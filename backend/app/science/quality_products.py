"""Backend-owned M3 quality products and display textures.

Policy:
* Reject every nonzero HDU 3 bit, including undocumented bits.
* Reject nonfinite science, nonfinite/nonpositive variance, and invalid SNR.
* Observation quality_ok is true only when every image pixel is eligible.
* Summary SNR is median signed eligible pixel SNR, not detection SNR.
* Science display percentiles use eligible pixels only.
* No celestial calculations or FITS parsing are delegated to the browser.

Textures are unsigned RGBA bytes in FITS row order, with row zero at the
bottom when rendered on the detector plane. They are not sky reprojections.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Literal

import numpy as np
from astropy.io import fits

from app.science.fits_engine import (
    FITSValidationError,
    compute_quality_products,
    parse_fits_mef,
)

DataSource = Literal["qr3", "synthetic", "mast", "vizier"]

MAX_UPLOAD_BYTES = 64 * 1024 * 1024
MAX_IMAGE_PIXELS = 1024 * 1024
MAX_IMAGE_SIDE = 4096

POLICY = (
    "Reject all nonzero HDU 3 bits, nonfinite science, nonfinite or "
    "nonpositive variance, and numerically unavailable signed pixel SNR. "
    "Observation quality passes only when every image pixel is eligible."
)


def _preflight(path: Path) -> None:
    """Bound allocations before accessing any FITS image data.

    This upload endpoint accepts uncompressed image MEFs. Compressed FITS
    inputs are rejected explicitly rather than decompressed without bounds.
    """
    size = path.stat().st_size
    if size == 0:
        raise FITSValidationError("The FITS upload is empty.")
    if size > MAX_UPLOAD_BYTES:
        raise FITSValidationError("The FITS upload exceeds 64 MiB.")

    with path.open("rb") as handle:
        if handle.read(9) != b"SIMPLE  =":
            raise FITSValidationError(
                "Expected an uncompressed FITS primary header."
            )

    with fits.open(
        path,
        mode="readonly",
        memmap=False,
        lazy_load_hdus=True,
    ) as hdul:
        shapes: list[tuple[int, int]] = []
        for index in (1, 2, 3):
            try:
                hdu = hdul[index]
            except IndexError as exc:
                raise FITSValidationError(
                    "HDU 1 Science, HDU 2 Variance, and HDU 3 Bitmask "
                    "are required."
                ) from exc

            if isinstance(hdu, fits.CompImageHDU) or not isinstance(
                hdu, fits.ImageHDU
            ):
                raise FITSValidationError(
                    f"HDU {index} must be an uncompressed image extension."
                )

            header = hdu.header
            if header.get("NAXIS") != 2:
                raise FITSValidationError(
                    f"HDU {index} must be a two-dimensional image."
                )

            width = header.get("NAXIS1")
            height = header.get("NAXIS2")
            if (
                isinstance(width, bool)
                or isinstance(height, bool)
                or not isinstance(width, int)
                or not isinstance(height, int)
                or width <= 0
                or height <= 0
            ):
                raise FITSValidationError(
                    f"HDU {index} has invalid image dimensions."
                )

            if (
                width > MAX_IMAGE_SIDE
                or height > MAX_IMAGE_SIDE
                or width * height > MAX_IMAGE_PIXELS
            ):
                raise FITSValidationError(
                    "Quality inspection supports at most 1,048,576 pixels "
                    "and 4,096 pixels per side. Request a smaller cutout."
                )

            if header.get("BITPIX") not in (8, 16, 32, 64, -32, -64):
                raise FITSValidationError(
                    f"HDU {index} has unsupported BITPIX."
                )
            shapes.append((height, width))

        if len(set(shapes)) != 1:
            raise FITSValidationError(
                "Science, variance, and bitmask shapes must match."
            )


def _encode_bytes(array: np.ndarray) -> str:
    return base64.b64encode(
        np.ascontiguousarray(array).tobytes()
    ).decode("ascii")


def _science_texture(
    science: np.ndarray,
    eligible: np.ndarray,
) -> tuple[np.ndarray, float | None, float | None]:
    """Asinh display, with percentiles calculated only from gated science."""
    rgba = np.zeros((*science.shape, 4), dtype=np.uint8)
    if not np.any(eligible):
        return rgba, None, None

    values = science[eligible].astype(np.float64)
    low, high = np.percentile(values, [1.0, 99.0])
    if high > low:
        normalized = np.clip((values - low) / (high - low), 0.0, 1.0)
    else:
        normalized = np.full(values.shape, 0.5, dtype=np.float64)

    display = np.arcsinh(10.0 * normalized) / np.arcsinh(10.0)
    intensity = np.rint(display * 255.0).astype(np.uint8)
    rgba[eligible, :3] = intensity[:, None]
    rgba[eligible, 3] = 255
    return rgba, float(low), float(high)


def _snr_texture(
    snr_map: np.ndarray,
    eligible: np.ndarray,
) -> np.ndarray:
    """Blue/white/red signed SNR display, saturated at -10 and +10."""
    rgba = np.zeros((*snr_map.shape, 4), dtype=np.uint8)
    if not np.any(eligible):
        return rgba

    values = np.clip(snr_map[eligible] / 10.0, -1.0, 1.0)
    white = np.array([245.0, 245.0, 245.0])
    blue = np.array([35.0, 95.0, 220.0])
    red = np.array([205.0, 45.0, 45.0])

    endpoints = np.where((values < 0)[:, None], blue, red)
    rgb = white + np.abs(values)[:, None] * (endpoints - white)
    rgba[eligible, :3] = np.rint(rgb).astype(np.uint8)
    rgba[eligible, 3] = 255
    return rgba


def build_quality_payload(
    path: str | Path,
    *,
    record_id: str,
    source: DataSource,
) -> dict:
    """Produce JSON-safe M3 data without changing any CIDS model."""
    path = Path(path)
    _preflight(path)
    data = parse_fits_mef(path)
    products = compute_quality_products(
        data.science,
        data.variance,
        data.mask,
    )

    eligible_count = int(np.count_nonzero(products.eligible))
    total_pixels = int(products.eligible.size)
    rejected_count = total_pixels - eligible_count

    quality_ok = (
        eligible_count == total_pixels and products.combined_mask == 0
    )
    status = (
        "fail"
        if eligible_count == 0
        else "pass"
        if quality_ok
        else "warn"
    )

    # Bit positions are authoritative representations of the received mask.
    # Mission-specific semantic labels are intentionally not invented.
    flags = [
        f"BIT_{bit}"
        for bit in range(16)
        if products.combined_mask & (1 << bit)
    ]

    science_rgba, low, high = _science_texture(
        data.science, products.eligible
    )
    snr_rgba = _snr_texture(products.snr_map, products.eligible)

    flat_snr = products.snr_map.ravel()
    snr_values = [
        float(value) if np.isfinite(value) else None
        for value in flat_snr
    ]

    notes = (
        f"{eligible_count} of {total_pixels} pixels are eligible. "
        "SNR is signed science divided by the square root of variance; "
        "the summary is its eligible-pixel median, not source-detection "
        "or aperture SNR. Bit labels identify raw bit positions, not "
        "verified release-specific flag meanings."
    )

    # CIDS QualityReport.snr is required and non-nullable. When SNR is
    # unavailable, omit the entire optional report rather than invent zero.
    report = None
    if products.median_snr is not None:
        report = {
            "status": status,
            "flags_decoded": flags,
            "snr": products.median_snr,
            "notes": notes,
        }

    height, width = data.science.shape
    return {
        "version": 1,
        "record_id": record_id,
        "source": source,
        "width": width,
        "height": height,
        "orientation": "fits-row-zero-bottom",
        "status": status,
        "policy": POLICY,
        "notes": notes,
        "flags_decoded": flags,
        "summary": {
            "snr": products.median_snr,
            "quality_flags": products.combined_mask,
            "quality_ok": quality_ok,
        },
        "report": report,
        "eligible_pixels": eligible_count,
        "rejected_pixels": rejected_count,
        "eligible_fraction": products.eligible_fraction,
        "eligible_base64": _encode_bytes(
            products.eligible.astype(np.uint8)
        ),
        "snr_map": snr_values,
        "science_rgba_base64": _encode_bytes(science_rgba),
        "snr_rgba_base64": _encode_bytes(snr_rgba),
        "science_display": {
            "stretch": "asinh",
            "percentile_low": 1,
            "percentile_high": 99,
            "low": low,
            "high": high,
        },
        "snr_display": {
            "low": -10,
            "high": 10,
            "negative": "blue",
            "zero": "white",
            "positive": "red",
        },
    }