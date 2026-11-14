import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

from app.science.fits_engine import (
    FITSValidationError,
    compute_snr,
    decode_quality_flags,
    parse_fits_mef,
)


def write_mef(path, science=None, variance=None, mask=None):
    shape = (4, 5)
    if science is None:
        science = np.full(shape, 100.0, dtype=np.float32)
    if variance is None:
        variance = np.full(shape, 25.0, dtype=np.float32)
    if mask is None:
        mask = np.zeros(shape, dtype=np.uint16)

    primary = fits.PrimaryHDU()
    primary.header["ORIGIN"] = "test fixture"
    primary.header["CRVAL1"] = 1.0

    image = fits.ImageHDU(science, name="SCI")
    image.header["CTYPE1"] = "RA---TAN"
    image.header["CTYPE2"] = "DEC--TAN"
    image.header["CRPIX1"] = 3.0
    image.header["CRPIX2"] = 2.0
    image.header["CRVAL1"] = 269.4521
    image.header["CRVAL2"] = 4.6934
    image.header["CDELT1"] = -0.000277
    image.header["CDELT2"] = 0.000277

    fits.HDUList([
        primary,
        image,
        fits.ImageHDU(variance, name="VAR"),
        fits.ImageHDU(mask, name="MASK"),
    ]).writeto(path)


def test_parse_preserves_science_wcs_and_owned_arrays(tmp_path):
    path = tmp_path / "valid.fits"
    write_mef(path)

    result = parse_fits_mef(path)
    path.unlink()

    assert result.science.dtype == np.float32
    assert result.variance.dtype == np.float32
    assert result.mask.dtype == np.uint16
    assert result.science.flags.owndata
    assert result.variance.flags.owndata
    assert result.mask.flags.owndata
    assert result.header["ORIGIN"] == "test fixture"
    assert result.header["NAXIS1"] == 5
    assert result.header["NAXIS2"] == 4
    assert compute_snr(result.science, result.variance) == 20.0

    wcs = WCS(result.header).celestial
    ra, dec = wcs.pixel_to_world_values(2.0, 1.0)
    assert ra == pytest.approx(269.4521)
    assert dec == pytest.approx(4.6934)


def test_missing_extensions_never_fabricate_science(tmp_path):
    path = tmp_path / "primary-only.fits"
    fits.PrimaryHDU().writeto(path)
    with pytest.raises(FITSValidationError, match="requires HDU"):
        parse_fits_mef(path)


@pytest.mark.parametrize(
    "overrides",
    [
        {"science": np.ones(5, dtype=np.float32)},
        {"variance": np.ones((2, 2), dtype=np.float32)},
        {"mask": np.zeros((4, 5), dtype=np.float32)},
        {"mask": np.full((4, 5), -1, dtype=np.int16)},
        {"mask": np.full((4, 5), 65536, dtype=np.int32)},
        {"science": np.full((4, 5), 1e100, dtype=np.float64)},
    ],
)
def test_malformed_images_are_rejected(tmp_path, overrides):
    path = tmp_path / "invalid.fits"
    write_mef(path, **overrides)
    with pytest.raises(FITSValidationError):
        parse_fits_mef(path)


def test_unsigned_high_mask_bit_is_preserved(tmp_path):
    path = tmp_path / "unsigned.fits"
    write_mef(path, mask=np.full((4, 5), 32768, dtype=np.uint16))
    result = parse_fits_mef(path)
    assert np.all(result.mask == 32768)
    assert decode_quality_flags(result.mask) == ["UNKNOWN_BIT_15"]


def test_non_fits_input_is_rejected(tmp_path):
    path = tmp_path / "error-page.fits"
    path.write_text("<html>Archive unavailable</html>")
    with pytest.raises(FITSValidationError):
        parse_fits_mef(path)


def test_snr_excludes_invalid_variances_and_nonfinite_science():
    science = np.array([100, 100, 100, 100, 100, np.nan])
    variance = np.array([25, 0, -1, np.inf, np.nan, 25])
    assert compute_snr(science, variance) == 20.0


def test_snr_unavailable_and_shape_mismatch():
    assert np.isnan(compute_snr(np.ones(2), None))
    assert np.isnan(compute_snr(np.ones(2), np.zeros(2)))
    with pytest.raises(ValueError, match="shapes must match"):
        compute_snr(np.ones((2, 2)), np.ones(2))


def test_empty_quality_mask():
    assert decode_quality_flags(np.empty((0, 0), dtype=np.uint16)) == []