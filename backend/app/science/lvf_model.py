"""
LVF (Linear Variable Filter) wavelength model.
Maps detector row position to wavelength for SPHEREx.
Phase 5 implementation.
"""


# Approximate LVF calibration coefficients per channel
# Real values from SPHEREx calibration files
LVF_CHANNELS = {
    "SW1": {"wl_min": 0.75, "wl_max": 1.10, "nrows": 1024},
    "SW2": {"wl_min": 1.10, "wl_max": 1.70, "nrows": 1024},
    "LW1": {"wl_min": 1.70, "wl_max": 2.70, "nrows": 1024},
    "LW2": {"wl_min": 2.70, "wl_max": 5.00, "nrows": 1024},
}


def row_to_wavelength(band: str, row: int) -> float:
    """
    Convert a detector row index to wavelength in μm.
    Linear model: wl = wl_min + row * (wl_max - wl_min) / nrows
    """
    ch = LVF_CHANNELS.get(band)
    if ch is None:
        raise ValueError(f"Unknown SPHEREx band: {band}")
    frac = row / ch["nrows"]
    return ch["wl_min"] + frac * (ch["wl_max"] - ch["wl_min"])


def build_wavelength_axis(band: str, nrows: int | None = None) -> list[float]:
    """Return full wavelength axis for a band's detector rows."""
    ch = LVF_CHANNELS.get(band)
    if ch is None:
        raise ValueError(f"Unknown SPHEREx band: {band}")
    n = nrows or ch["nrows"]
    return [ch["wl_min"] + i * (ch["wl_max"] - ch["wl_min"]) / n for i in range(n)]


def all_bands_wavelength_axis(n_per_band: int = 25) -> list[float]:
    """Return concatenated wavelength axis across all 4 SPHEREx LVF channels (~100 points)."""
    result = []
    for ch in LVF_CHANNELS.values():
        result.extend(
            ch["wl_min"] + i * (ch["wl_max"] - ch["wl_min"]) / n_per_band
            for i in range(n_per_band)
        )
    return result

