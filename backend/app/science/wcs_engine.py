"""WCS engine — Astropy-based TAN projection (Phase 1 stub)."""
from typing import Tuple

try:
    import numpy as np
    from astropy.wcs import WCS as AstropyWCS
    _ASTROPY_AVAILABLE = True
except ImportError:
    _ASTROPY_AVAILABLE = False


def build_wcs(wcs_params: dict) -> "AstropyWCS | None":
    """Build an Astropy WCS object from CIDS WCSParameters dict."""
    if not _ASTROPY_AVAILABLE:
        return None
    from astropy.wcs import WCS
    w = WCS(naxis=2)
    w.wcs.crpix = [wcs_params["crpix1"], wcs_params["crpix2"]]
    w.wcs.crval = [wcs_params["crval1"], wcs_params["crval2"]]
    w.wcs.cdelt = [wcs_params["cdelt1"], wcs_params["cdelt2"]]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    if wcs_params.get("crota2") is not None:
        w.wcs.crota = [0, wcs_params["crota2"]]
    w.wcs.set()
    return w


def pixel_to_sky(w, x: float, y: float) -> Tuple[float, float]:
    """Convert 0-indexed pixel (x,y) → (RA, Dec) in degrees."""
    if w is None:
        raise RuntimeError("Astropy WCS not available")
    ra, dec = w.all_pix2world([[x, y]], 0)[0]
    return float(ra), float(dec)


def sky_to_pixel(w, ra: float, dec: float) -> Tuple[float, float]:
    """Convert (RA, Dec) → 0-indexed pixel (x, y)."""
    if w is None:
        raise RuntimeError("Astropy WCS not available")
    x, y = w.all_world2pix([[ra, dec]], 0)[0]
    return float(x), float(y)

