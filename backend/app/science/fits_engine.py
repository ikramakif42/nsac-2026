"""
FITS engine — Astropy-based Level 2 MEF parser.
Phase 1 implementation stub.
"""
from pathlib import Path
from typing import NamedTuple
import numpy as np


class FITSData(NamedTuple):
    header: dict
    science: np.ndarray    # HDU 1: float32 2D
    variance: np.ndarray   # HDU 2: float32 2D (or None)
    mask: np.ndarray       # HDU 3: uint16 2D (or None)


def parse_fits_mef(fits_path: str | Path) -> FITSData:
    """
    Parse a SPHEREx Level 2 Multi-Extension FITS file.
    HDU 0: Primary (header only)
    HDU 1: Science image (float32)
    HDU 2: Variance image (float32)
    HDU 3: Quality bitmask (uint16)
    """
    from astropy.io import fits  # lazy import — only when called

    with fits.open(str(fits_path)) as hdul:
        header = dict(hdul[0].header)
        science  = hdul[1].data.astype(np.float32) if len(hdul) > 1 else np.zeros((256, 256), dtype=np.float32)
        variance = hdul[2].data.astype(np.float32) if len(hdul) > 2 else None
        mask     = hdul[3].data.astype(np.uint16)  if len(hdul) > 3 else None
    return FITSData(header=header, science=science, variance=variance, mask=mask)


def compute_snr(science: np.ndarray, variance: np.ndarray | None) -> float:
    """Median SNR = median(science / sqrt(variance)) for valid pixels."""
    if variance is None:
        return float("nan")
    with np.errstate(divide="ignore", invalid="ignore"):
        snr_map = science / np.sqrt(variance)
        valid = np.isfinite(snr_map)
        return float(np.median(snr_map[valid])) if valid.any() else float("nan")


def decode_quality_flags(mask: np.ndarray | None) -> list[str]:
    """
    Decode SPHEREx HDU 3 bitmask into human-readable flag labels.
    Bit definitions from SPHEREx Data Release documentation.
    """
    if mask is None:
        return []
    # Aggregate: OR all pixel flags
    combined = int(np.bitwise_or.reduce(mask.ravel()))
    FLAG_NAMES = {
        0:  "BAD_PIXEL",
        1:  "SATURATED",
        2:  "COSMIC_RAY",
        3:  "DARK_CURRENT_ANOMALY",
        4:  "FLAT_FIELD_ANOMALY",
        5:  "PERSISTENCE",
        6:  "FRINGING",
        7:  "EDGE",
        8:  "GHOSTS",
    }
    return [FLAG_NAMES[bit] for bit in FLAG_NAMES if combined & (1 << bit)]

