"""Source-explicit SED delivery. All spectrum generation stays on the backend."""

import hashlib
import logging
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from app.connectors import get_connector
from app.models.cids import DataSource, SpectrumResponse
from app.science.lvf_model import (
    SPHEREX_ARRAYS,
    all_bands_wavelength_axis,
    build_array_wavelengths,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def synthetic_spectrum(record_id: str) -> SpectrumResponse:
    """Deterministic, explicitly synthetic 102-channel demonstration spectrum."""
    wavelengths = np.asarray(all_bands_wavelength_axis(), dtype=np.float64)
    digest = hashlib.sha256(record_id.encode("utf-8")).digest()
    phase = int.from_bytes(digest[:8], "big") / float(2**64)
    amplitude = 1.0e-17 * (0.85 + 0.3 * phase)

    continuum = amplitude * (wavelengths / 2.0) ** -0.7
    transmission = np.ones_like(wavelengths)

    # Demonstration features, not scientific classification or fitted detections.
    for center, width, depth in (
        (1.66, 0.045, 0.15),
        (3.05, 0.12, 0.35),
        (4.27, 0.035, 0.25),
        (4.67, 0.035, 0.20),
    ):
        transmission *= 1.0 - depth * np.exp(
            -0.5 * ((wavelengths - center) / width) ** 2
        )

    flux = continuum * transmission
    variance = (0.04 * continuum) ** 2
    contributions: dict[str, list[int]] = {}
    offset = 0
    for array_id in SPHEREX_ARRAYS:
        count = len(build_array_wavelengths(array_id))
        contributions[array_id] = list(range(offset, offset + count))
        offset += count

    return SpectrumResponse(
        wavelengths=wavelengths.tolist(),
        flux=flux.tolist(),
        variance=variance.tolist(),
        array_contributions=contributions,
    )


def validate_spectrum(
    response: SpectrumResponse, source: DataSource
) -> SpectrumResponse:
    """Reject invalid science payloads without interpolation or invented samples."""
    wavelengths = np.asarray(response.wavelengths, dtype=np.float64)
    flux = np.asarray(response.flux, dtype=np.float64)
    variance = np.asarray(response.variance, dtype=np.float64)

    if not (len(wavelengths) == len(flux) == len(variance)):
        raise ValueError("Spectrum columns have unequal lengths")
    if not all(np.all(np.isfinite(column)) for column in (wavelengths, flux, variance)):
        raise ValueError("Spectrum contains non-finite values")
    if np.any(wavelengths <= 0) or np.any(np.diff(wavelengths) <= 0):
        raise ValueError("Wavelengths must be positive and strictly increasing")
    if np.any(variance < 0):
        raise ValueError("Variance must be nonnegative")

    contributions: Optional[dict[str, list[int]]] = response.array_contributions
    if contributions is not None:
        assigned: set[int] = set()
        for array_id, indices in contributions.items():
            if array_id not in SPHEREX_ARRAYS:
                raise ValueError("Unknown detector array")
            for index in indices:
                if index < 0 or index >= len(wavelengths) or index in assigned:
                    raise ValueError("Invalid or duplicate array contribution index")
                assigned.add(index)

    # Only SPHEREx sources receive SPHEREx detector attribution.
    # Missing observations remain missing; no channels are resampled or filled.
    if contributions is None and source in ("qr3", "synthetic"):
        contributions = {array_id: [] for array_id in SPHEREX_ARRAYS}
        arrays = list(SPHEREX_ARRAYS.items())
        for index, wavelength in enumerate(wavelengths):
            for array_number, (array_id, spec) in enumerate(arrays):
                upper_inclusive = array_number == len(arrays) - 1
                if spec["wl_min"] <= wavelength and (
                    wavelength < spec["wl_max"]
                    or (upper_inclusive and wavelength <= spec["wl_max"])
                ):
                    contributions[array_id].append(index)
                    break

    return SpectrumResponse(
        wavelengths=response.wavelengths,
        flux=response.flux,
        variance=response.variance,
        array_contributions=contributions,
    )


@router.get("/spectrum", response_model=SpectrumResponse)
async def spectrum(
    record_id: str = Query(..., min_length=1, max_length=1024),
    source: DataSource = Query("qr3"),
) -> SpectrumResponse:
    """
    Return native spectrum samples, variances, and backend detector attribution.

    The default remains QR3 for compatibility with existing connector calls.
    Synthetic generation occurs only after an explicit synthetic request.
    """
    if source == "synthetic":
        return validate_spectrum(synthetic_spectrum(record_id), source)

    connector = get_connector(source)
    if connector is None:
        raise HTTPException(
            status_code=503, detail=f"{source} connector not available"
        )

    try:
        result = await connector.fetch_spectrum(record_id)
        if not isinstance(result, SpectrumResponse):
            result = SpectrumResponse(**result)
        return validate_spectrum(result, source)
    except HTTPException:
        raise
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=501,
            detail=f"{source} does not support spectrum retrieval",
        ) from exc
    except Exception as exc:
        logger.exception("Spectrum retrieval failed for source %s", source)
        raise HTTPException(
            status_code=502,
            detail=f"{source} returned no usable spectrum; no fallback was used",
        ) from exc