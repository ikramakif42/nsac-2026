"""
Backend-only SPHEREx Level 2 MEF parsing and pixel-quality utilities.

Expected layout:
    HDU 0: Primary metadata
    HDU 1: Science image
    HDU 2: Variance image
    HDU 3: Integer quality bitmask

No image data is fabricated. Returned FITS arrays own their memory.

Quality policy:
    By default, reject every nonzero HDU 3 mask value. This is a
    conservative application policy, not a verified QR3 bit definition.

SNR maps:
    Signed science / sqrt(variance), computed only for eligible pixels.
    Ineligible or numerically unrepresentable pixels are NaN.
    JSON adapters must serialize unavailable values as null, not NaN.
"""
from pathlib import Path
from typing import NamedTuple

import numpy as np


UINT16_MAX = int(np.iinfo(np.uint16).max)

# Compatibility labels only; not authoritative QR3 documentation.
LEGACY_FLAG_NAMES = {
    0: "BAD_PIXEL",
    1: "SATURATED",
    2: "COSMIC_RAY",
    3: "DARK_CURRENT_ANOMALY",
    4: "FLAT_FIELD_ANOMALY",
    5: "PERSISTENCE",
    6: "FRINGING",
    7: "EDGE",
    8: "GHOSTS",
}


class FITSValidationError(ValueError):
    """The input does not satisfy the expected Level 2 MEF structure."""


class FITSData(NamedTuple):
    header: dict
    science: np.ndarray
    variance: np.ndarray
    mask: np.ndarray


class PixelQualityProducts(NamedTuple):
    """Internal science result, not an extension to the CIDS schema.

    eligible:
        Pixels allowed into downstream science/render statistics.
    snr_map:
        Signed pixel SNR; NaN outside eligible.
    median_snr:
        Median eligible pixel SNR, or None when unavailable.
        This is not an aperture or source-detection SNR.
    combined_mask:
        Bitwise OR of all HDU 3 pixels, including rejected pixels.
    eligible_fraction:
        Fraction of pixels eligible under the selected policy.
    """

    eligible: np.ndarray
    snr_map: np.ndarray
    median_snr: float | None
    combined_mask: int
    eligible_fraction: float


def _image(hdul, index: int, name: str) -> np.ndarray:
    data = hdul[index].data
    if data is None:
        raise FITSValidationError(f"HDU {index} ({name}) has no image data.")

    array = np.asarray(data)
    if array.ndim != 2 or array.size == 0:
        raise FITSValidationError(
            f"HDU {index} ({name}) must be a nonempty 2D image."
        )
    if array.dtype.kind not in "iuf":
        raise FITSValidationError(
            f"HDU {index} ({name}) must contain real numeric image data."
        )
    return array


def _float_image(array: np.ndarray, name: str) -> np.ndarray:
    finite = np.isfinite(array)
    limit = np.finfo(np.float32).max
    if np.any(array[finite] > limit) or np.any(array[finite] < -limit):
        raise FITSValidationError(
            f"{name} contains finite values outside the float32 range."
        )
    return np.array(array, dtype=np.float32, order="C", copy=True)


def _uint16_mask(mask: np.ndarray) -> np.ndarray:
    array = np.asarray(mask)
    if array.dtype.kind not in "iu":
        raise ValueError("Quality mask must contain integers.")
    if np.any(array < 0) or np.any(array > UINT16_MAX):
        raise ValueError("Quality mask must contain values in uint16 range.")
    return array.astype(np.uint16, copy=False)


def _reject_bits(value: int) -> int:
    if isinstance(value, (bool, np.bool_)) or not isinstance(
        value, (int, np.integer)
    ):
        raise ValueError("reject_bits must be a uint16 integer.")
    if not 0 <= int(value) <= UINT16_MAX:
        raise ValueError("reject_bits must be a uint16 integer.")
    return int(value)


def parse_fits_mef(fits_path: str | Path) -> FITSData:
    """
    Parse a Level 2 MEF using Astropy FITS scaling.

    Science-extension metadata overrides primary metadata. Nonfinite
    science/variance and nonpositive variance are retained, not repaired.
    """
    from astropy.io import fits

    try:
        with fits.open(
            Path(fits_path),
            mode="readonly",
            memmap=False,
            lazy_load_hdus=False,
        ) as hdul:
            hdul.verify("exception")
            if len(hdul) < 4:
                raise FITSValidationError(
                    "Level 2 MEF requires HDU 1 Science, HDU 2 Variance, "
                    "and HDU 3 Bitmask."
                )

            science_raw = _image(hdul, 1, "Science")
            variance_raw = _image(hdul, 2, "Variance")
            mask_raw = _image(hdul, 3, "Bitmask")

            if not (
                science_raw.shape == variance_raw.shape == mask_raw.shape
            ):
                raise FITSValidationError(
                    "Science, variance, and bitmask shapes must match."
                )
            if mask_raw.dtype.kind not in "iu":
                raise FITSValidationError(
                    "HDU 3 Bitmask must contain integer values."
                )
            if np.any(mask_raw < 0) or np.any(mask_raw > UINT16_MAX):
                raise FITSValidationError(
                    "HDU 3 Bitmask contains values outside uint16 range."
                )

            header = dict(hdul[0].header)
            header.update(dict(hdul[1].header))
            header["NAXIS"] = 2
            header["NAXIS1"] = science_raw.shape[1]
            header["NAXIS2"] = science_raw.shape[0]

            return FITSData(
                header=header,
                science=_float_image(science_raw, "Science"),
                variance=_float_image(variance_raw, "Variance"),
                mask=np.array(mask_raw, dtype=np.uint16, order="C", copy=True),
            )
    except FITSValidationError:
        raise
    except (OSError, ValueError, TypeError, IndexError) as exc:
        raise FITSValidationError(
            f"Unable to parse Level 2 MEF: {exc}"
        ) from exc


def compute_snr_map(
    science: np.ndarray,
    variance: np.ndarray | None,
    mask: np.ndarray | None = None,
    *,
    reject_bits: int = UINT16_MAX,
) -> np.ndarray:
    """
    Compute signed pixel SNR in float64, preserving the input shape.

    A supplied mask must match science exactly: broadcasting is forbidden.
    Unknown bits are rejected by the default all-bits policy.

    Missing variance produces an unavailable (all-NaN) map. Missing mask
    permits legacy variance-only computation; use compute_quality_products
    for the strict HDU 3 quality-gating path.
    """
    bits = _reject_bits(reject_bits)
    science_array = np.asarray(science, dtype=np.float64)
    result = np.full(science_array.shape, np.nan, dtype=np.float64)

    mask_array = None
    if mask is not None:
        mask_array = _uint16_mask(mask)
        if mask_array.shape != science_array.shape:
            raise ValueError("Science and quality mask shapes must match.")

    if variance is None:
        return result

    variance_array = np.asarray(variance, dtype=np.float64)
    if science_array.shape != variance_array.shape:
        raise ValueError("Science and variance shapes must match.")

    valid = (
        np.isfinite(science_array)
        & np.isfinite(variance_array)
        & (variance_array > 0)
    )
    if mask_array is not None:
        valid &= (mask_array & np.uint16(bits)) == 0

    with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
        result[valid] = (
            science_array[valid] / np.sqrt(variance_array[valid])
        )
    result[~np.isfinite(result)] = np.nan
    return result


def _finite_median(values: np.ndarray) -> float:
    """Median without overflow when averaging two extreme finite values."""
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return float("nan")
    ordered = np.sort(finite)
    middle = ordered.size // 2
    if ordered.size % 2:
        return float(ordered[middle])
    low, high = float(ordered[middle - 1]), float(ordered[middle])
    if (low < 0) != (high < 0):
        return (low + high) / 2.0
    return low + (high - low) / 2.0


def compute_snr(
    science: np.ndarray,
    variance: np.ndarray | None,
    mask: np.ndarray | None = None,
    *,
    reject_bits: int = UINT16_MAX,
) -> float:
    """
    Median eligible signed pixel SNR, not source-detection SNR.

    Existing two-argument calls retain variance-only behavior. Quality-aware
    callers must supply the HDU 3 mask. NaN means unavailable; CIDS adapters
    must convert it to None before JSON serialization.
    """
    return _finite_median(
        compute_snr_map(science, variance, mask, reject_bits=reject_bits)
    )


def compute_quality_products(
    science: np.ndarray,
    variance: np.ndarray | None,
    mask: np.ndarray,
    *,
    reject_bits: int = UINT16_MAX,
) -> PixelQualityProducts:
    """
    Strict quality-gating entry point for nonempty 2D FITS image planes.

    No observation-level quality_ok threshold is invented here. That
    decision belongs in the existing CIDS adapter under an explicit policy.
    """
    science_array = np.asarray(science)
    if science_array.ndim != 2 or science_array.size == 0:
        raise ValueError("Science must be a nonempty 2D image.")
    if mask is None:
        raise ValueError("HDU 3 quality mask is required.")
    mask_array = _uint16_mask(mask)
    snr_map = compute_snr_map(
        science_array, variance, mask_array, reject_bits=reject_bits
    )
    eligible = np.isfinite(snr_map)
    median = _finite_median(snr_map)

    return PixelQualityProducts(
        eligible=eligible,
        snr_map=snr_map,
        median_snr=float(median) if np.isfinite(median) else None,
        combined_mask=int(np.bitwise_or.reduce(mask_array.ravel())),
        eligible_fraction=float(np.count_nonzero(eligible) / eligible.size),
    )


def decode_quality_flags(mask: np.ndarray | None) -> list[str]:
    """
    Preserve the existing application flag-name contract.

    Names require release-specific verification before use as authoritative
    QR3 documentation. Unknown bits remain visible rather than disappearing.
    """
    if mask is None:
        return []

    array = np.asarray(mask)
    if array.dtype.kind not in "iu":
        raise ValueError("Quality mask must contain integers.")
    if np.any(array < 0):
        raise ValueError("Quality mask must contain nonnegative integers.")
    if array.size == 0:
        return []

    combined = int(np.bitwise_or.reduce(array.ravel()))
    flags = [
        name
        for bit, name in LEGACY_FLAG_NAMES.items()
        if combined & (1 << bit)
    ]
    flags.extend(
        f"UNKNOWN_BIT_{bit}"
        for bit in range(len(LEGACY_FLAG_NAMES), combined.bit_length())
        if combined & (1 << bit)
    )
    return flags