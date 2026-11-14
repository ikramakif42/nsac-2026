"""Backend-owned display preparation for ORBIT-LENS.

Call after FITS parsing, quality-mask handling, and WCS registration.

Products contain normalized display pixels, not calibrated measurements.
Registration IDs must identify the same registered output grid.
Photometric IDs must identify compatible units and normalization.
Spectral IDs must identify compatible channels, not merely detector arrays.

Rows retain FITS/NumPy ordering: row zero is displayed at the image bottom.
Optional orientation and scale annotations are calculated here using Astropy.
"""

from __future__ import annotations

import numpy as np


def _plane(science, valid):
    raw = np.asarray(science)
    if np.iscomplexobj(raw):
        raise ValueError("Science pixels must be real")

    image = np.asarray(raw, dtype=np.float64)
    raw_mask = np.asarray(valid)

    if image.ndim != 2 or image.size == 0:
        raise ValueError("Science must be a nonempty 2-D image")
    if raw_mask.shape != image.shape:
        raise ValueError("Validity mask must match science")
    if not np.all((raw_mask == 0) | (raw_mask == 1)):
        raise ValueError("Validity mask must contain only boolean or 0/1 values")

    return image, raw_mask.astype(bool) & np.isfinite(image)


def _percentiles(values, percentiles):
    """Avoid intermediate overflow for large, finite float64 values."""
    magnitude = float(np.max(np.abs(values)))
    if magnitude == 0:
        return np.zeros(len(percentiles), dtype=np.float64)
    return np.percentile(values / magnitude, percentiles) * magnitude


def _normalize(image, good, lo, hi):
    normalized = np.zeros_like(image)
    if hi <= lo:
        return normalized

    magnitude = max(abs(float(lo)), abs(float(hi)))
    if magnitude == 0:
        return normalized

    # Clipping before division prevents extreme outliers from overflowing.
    clipped = np.clip(image[good], lo, hi) / magnitude
    lower = lo / magnitude
    upper = hi / magnitude
    normalized[good] = np.clip((clipped - lower) / (upper - lower), 0, 1)
    return normalized


def _annotations(wcs, width, height):
    """Calculate local compass directions and a center-field angular scale.

    `wcs` is an Astropy WCS describing the registered output grid.
    Directions use screen coordinates: positive x right, positive y down.
    The scale bar is explicitly a local scale at the image center.
    """
    import astropy.units as u
    from astropy.wcs.utils import pixel_to_skycoord, skycoord_to_pixel

    celestial = wcs.celestial
    if not celestial.has_celestial:
        raise ValueError("Annotation WCS must contain celestial axes")

    x = (width - 1) / 2
    y = (height - 1) / 2
    center = pixel_to_skycoord(x, y, celestial, origin=0)

    def screen_vector(position_angle, arcsec):
        destination = center.directional_offset_by(
            position_angle * u.deg, arcsec * u.arcsec
        )
        px, py = skycoord_to_pixel(destination, celestial, origin=0)
        vector = np.array([float(px) - x, -(float(py) - y)])
        length = float(np.hypot(*vector))
        if not np.all(np.isfinite(vector)) or length <= 0:
            raise ValueError("WCS cannot provide a finite local annotation")
        return vector, length

    north, north_length = screen_vector(0, 1)
    east, east_length = screen_vector(90, 1)

    # Choose a readable 1/2/5 scale near one fifth of the image width.
    desired_arcsec = width * 0.2 / east_length
    exponent = int(np.floor(np.log10(desired_arcsec)))
    candidates = [
        multiplier * 10.0**power
        for power in range(exponent - 1, exponent + 2)
        for multiplier in (1, 2, 5)
    ]
    candidates = [value for value in candidates if 0 < value <= 18000]
    if not candidates:
        raise ValueError("WCS scale is outside the annotation range")

    angular_size = min(
        candidates,
        key=lambda value: abs(np.log(value / desired_arcsec)),
    )
    _, scale_pixels = screen_vector(90, angular_size)

    if angular_size >= 3600:
        label = f"{angular_size / 3600:g}°"
    elif angular_size >= 60:
        label = f"{angular_size / 60:g} arcmin"
    else:
        label = f"{angular_size:g} arcsec"

    return {
        "north": (north / north_length).tolist(),
        "east": (east / east_length).tolist(),
        "scalePixels": scale_pixels,
        "scaleLabel": f"{label} at field center",
    }


def prepare_render_frame(
    *,
    record_id: str,
    science,
    valid,
    registration_id: str,
    photometric_id: str,
    spectral_id: str,
    low_percentile: float = 1,
    high_percentile: float = 99,
    reference_id: str | None = None,
    reference_science=None,
    reference_valid=None,
    reference_registration_id: str | None = None,
    reference_photometric_id: str | None = None,
    reference_spectral_id: str | None = None,
    difference_scale: float | None = None,
    wcs=None,
):
    """Return a JSON-serializable rendering sidecar without changing CIDS.

    Difference = current - reference, on a backend-registered grid.

    This function does not register images, match PSFs, calculate SNR, or
    establish calibration compatibility. Its caller must complete those
    operations or validations first.

    Pass the same positive `difference_scale` across a sequence to obtain
    a shared difference stretch. Otherwise each difference product receives
    its own robust scale, recorded in `differenceScale`.

    `wcs`, when supplied, must describe the registered output pixels.
    """
    if not isinstance(record_id, str) or not record_id.strip():
        raise ValueError("record_id is required")
    if not registration_id or not photometric_id or not spectral_id:
        raise ValueError("Registration, photometric and spectral IDs are required")
    if not (
        np.isfinite(low_percentile)
        and np.isfinite(high_percentile)
        and 0 <= low_percentile < high_percentile <= 100
    ):
        raise ValueError("Require 0 <= low < high <= 100")

    if difference_scale is not None and (
        not np.isfinite(difference_scale) or difference_scale <= 0
    ):
        raise ValueError("difference_scale must be finite and positive")

    image, good = _plane(science, valid)
    if not good.any():
        raise ValueError("No valid science pixels")

    lo, hi = _percentiles(image[good], [low_percentile, high_percentile])
    normalized = _normalize(image, good, lo, hi)

    result = {
        "recordId": record_id,
        "width": image.shape[1],
        "height": image.shape[0],
        "lowPercentile": float(low_percentile),
        "highPercentile": float(high_percentile),
        "intensity": normalized.ravel().tolist(),
        "valid": good.astype(np.uint8).ravel().tolist(),
        "referenceId": None,
        "difference": None,
        "differenceValid": None,
        "differenceScale": None,
    }

    if wcs is not None:
        result["annotations"] = _annotations(
            wcs, image.shape[1], image.shape[0]
        )

    reference_arguments = (
        reference_id,
        reference_science,
        reference_valid,
        reference_registration_id,
        reference_photometric_id,
        reference_spectral_id,
    )
    if all(value is None for value in reference_arguments):
        if difference_scale is not None:
            raise ValueError("difference_scale requires a reference product")
        return result
    if any(value is None for value in reference_arguments):
        raise ValueError("A complete reference product is required")
    if not isinstance(reference_id, str) or not reference_id.strip():
        raise ValueError("reference_id must be nonempty")

    if (
        reference_registration_id != registration_id
        or reference_photometric_id != photometric_id
        or reference_spectral_id != spectral_id
    ):
        raise ValueError("Reference grid, calibration or channel is incompatible")

    reference, reference_good = _plane(reference_science, reference_valid)
    if reference.shape != image.shape:
        raise ValueError("Registered image shapes differ")

    overlap = good & reference_good
    if not overlap.any():
        raise ValueError("No valid overlapping pixels")

    with np.errstate(over="ignore", invalid="ignore"):
        residual = image - reference
    overlap &= np.isfinite(residual)
    if not overlap.any():
        raise ValueError("No finite difference pixels")

    if difference_scale is None:
        scale = float(
            _percentiles(np.abs(residual[overlap]), [high_percentile])[0]
        )
        if scale == 0:
            scale = float(np.max(np.abs(residual[overlap])))
        scale_mode = "per-frame"
    else:
        scale = float(difference_scale)
        scale_mode = "shared"

    difference = np.zeros_like(image)
    if scale > 0:
        # Clip before division to avoid overflow with a small shared scale.
        difference[overlap] = (
            np.clip(residual[overlap], -scale, scale) / scale
        )

    result.update(
        referenceId=reference_id,
        difference=difference.ravel().tolist(),
        differenceValid=overlap.astype(np.uint8).ravel().tolist(),
        differenceScale=scale,
        differenceScaleMode=scale_mode,
    )
    return result