"""
SPHEREx LVF (Linear Variable Filter) Optical Model.
Models the true 6-detector array focal plane architecture of the SPHEREx mission.

Detector Array Specifications:
- Array 1: 0.75 - 1.11 μm (R ≈ 41, 17 channels)
- Array 2: 1.11 - 1.64 μm (R ≈ 41, 17 channels)
- Array 3: 1.64 - 2.42 μm (R ≈ 41, 17 channels)
- Array 4: 2.42 - 3.82 μm (R ≈ 35, 17 channels)
- Array 5: 3.82 - 4.42 μm (R ≈ 110, 17 channels - H2O/CO2 ice features)
- Array 6: 4.42 - 5.00 μm (R ≈ 130, 17 channels - CO ice & continuum)
Total spectral channels = 6 × 17 = 102 continuous bands.
"""

from typing import Dict, Any, List

# Official SPHEREx 6-detector focal plane calibration constants
SPHEREX_ARRAYS: Dict[str, Dict[str, Any]] = {
    "Array1": {"wl_min": 0.75, "wl_max": 1.11, "resolving_power": 41,  "channels": 17, "nrows": 2048},
    "Array2": {"wl_min": 1.11, "wl_max": 1.64, "resolving_power": 41,  "channels": 17, "nrows": 2048},
    "Array3": {"wl_min": 1.64, "wl_max": 2.42, "resolving_power": 41,  "channels": 17, "nrows": 2048},
    "Array4": {"wl_min": 2.42, "wl_max": 3.82, "resolving_power": 35,  "channels": 17, "nrows": 2048},
    "Array5": {"wl_min": 3.82, "wl_max": 4.42, "resolving_power": 110, "channels": 17, "nrows": 2048},
    "Array6": {"wl_min": 4.42, "wl_max": 5.00, "resolving_power": 130, "channels": 17, "nrows": 2048},
}


def row_to_wavelength(array_id: str, row: int) -> float:
    """
    Convert a detector row index to central wavelength in μm.
    Linear Variable Filter: wavelength is a monotonic function of detector row coordinate.
    """
    arr = SPHEREX_ARRAYS.get(array_id)
    if arr is None:
        raise ValueError(f"Unknown SPHEREx detector array: {array_id}")
    frac = max(0.0, min(1.0, row / arr["nrows"]))
    return arr["wl_min"] + frac * (arr["wl_max"] - arr["wl_min"])


def build_array_wavelengths(array_id: str) -> List[float]:
    """Return calibrated central wavelengths for an array's channels."""
    arr = SPHEREX_ARRAYS.get(array_id)
    if arr is None:
        raise ValueError(f"Unknown SPHEREx detector array: {array_id}")
    n = arr["channels"]
    step = (arr["wl_max"] - arr["wl_min"]) / n
    return [arr["wl_min"] + (i + 0.5) * step for i in range(n)]


def all_bands_wavelength_axis() -> List[float]:
    """
    Return the concatenated 102-band wavelength axis across all 6 SPHEREx detector arrays.
    Covers 0.75 μm through 5.00 μm continuously.
    """
    full_axis: List[float] = []
    for array_id in ["Array1", "Array2", "Array3", "Array4", "Array5", "Array6"]:
        full_axis.extend(build_array_wavelengths(array_id))
    return full_axis


def get_array_for_wavelength(wavelength_um: float) -> str:
    """Find which of the 6 detector arrays captures a given wavelength."""
    for array_id, specs in SPHEREX_ARRAYS.items():
        if specs["wl_min"] <= wavelength_um <= specs["wl_max"]:
            return array_id
    if wavelength_um < 0.75:
        return "Array1"
    return "Array6"
