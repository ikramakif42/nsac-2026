import base64
import io

import numpy as np
import pytest
from astropy.io import fits

from app.science.cube_render import (
    CubeInputError,
    CubeRenderRequest,
    build_cube_render,
)


def record(identifier="a", epoch=60000.0, wavelength=1.0, source="synthetic"):
    return {
        "id": identifier,
        "source": source,
        "band": "Array1",
        "array_id": "Array1",
        "wavelength_um": wavelength,
        "epoch_mjd": epoch,
        "epoch_label": f"MJD {epoch}",
        "ra_center": 359.999,
        "dec_center": 4.0,
        "fits_url": "",
        "wcs": {
            "naxis1": 4,
            "naxis2": 4,
            "crpix1": 2.5,
            "crpix2": 2.5,
            "crval1": 359.999,
            "crval2": 4.0,
            "cdelt1": -0.001,
            "cdelt2": 0.001,
        },
    }


def frame(identifier="a", epoch=60000.0, wavelength=1.0, source="synthetic"):
    return {
        "record": record(identifier, epoch, wavelength, source),
        "hdus": {
            "science": list(range(1, 17)),
            "variance": [4.0] * 16,
            "mask": [0] * 16,
            "header": {"BUNIT": "MJy/sr"},
        },
    }


def request(frames=None, **patch):
    payload = {
        "axis": "time",
        "source": "synthetic",
        "anchor_id": "a",
        "frames": frames or [frame()],
        "size": 16,
    }
    payload.update(patch)
    return CubeRenderRequest.model_validate(payload)


def test_time_cube_is_sorted_and_cids_compatible():
    result = build_cube_render(request([
        frame("b", 60002),
        frame("a", 60000),
        frame("c", 60001),
    ]))
    assert result["record_ids"] == ["a", "c", "b"]
    assert result["metadata"]["dimensions"] == (4, 4, 3)
    assert result["metadata"]["z_values"] == [60000, 60001, 60002]
    assert result["cube"]["z_positions"] == [-0.8, 0.0, 0.8]
    assert result["metadata"]["source"] == "synthetic"


def test_mask_and_variance_gate_texture_and_backend_snr():
    item = frame()
    item["hdus"]["mask"][0] = 1
    item["hdus"]["variance"][1] = 0
    result = build_cube_render(request([item]))
    rgba = np.frombuffer(
        base64.b64decode(result["frames"][0]["rgba_base64"]),
        dtype=np.uint8,
    ).reshape(4, 4, 4)
    assert rgba[0, 0, 3] == 0
    assert rgba[0, 1, 3] == 0
    assert np.count_nonzero(rgba[..., 3]) == 14
    assert result["frames"][0]["median_snr"] == pytest.approx(4.75)


def test_sphere_geometry_is_unit_length_and_ra_wrap_is_continuous():
    result = build_cube_render(request())
    xyz = np.asarray(result["sphere"]["positions"]).reshape(-1, 3)
    assert np.allclose(np.linalg.norm(xyz, axis=1), 1)
    lower, upper = result["metadata"]["ra_range"]
    assert upper - lower < 0.01
    assert np.isfinite(result["sphere"]["north"]).all()


def test_wavelength_cube_keeps_only_supplied_channels():
    result = build_cube_render(request(
        [frame("a", wavelength=0.9), frame("b", wavelength=1.05)],
        axis="wavelength",
    ))
    assert result["metadata"]["z_values"] == [0.9, 1.05]
    assert len(result["frames"]) == 2


@pytest.mark.parametrize(
    "frames,patch,message",
    [
        (
            [frame(), frame("b", wavelength=1.1)],
            {},
            "central wavelength",
        ),
        (
            [frame(), frame("b", epoch=60001, wavelength=1.1)],
            {"axis": "wavelength"},
            "epoch fixed",
        ),
        (
            [frame(), frame("b", source="qr3")],
            {},
            "Mixed sources",
        ),
        (
            [frame(), frame("b")],
            {},
            "axis coordinate",
        ),
    ],
)
def test_incompatible_observations_are_rejected(frames, patch, message):
    with pytest.raises(CubeInputError, match=message):
        build_cube_render(request(frames, **patch))


def test_qr3_missing_quality_hdus_never_falls_back():
    item = frame(source="qr3")
    item["hdus"]["mask"] = None
    with pytest.raises(CubeInputError, match="HDU 3"):
        build_cube_render(request([item], source="qr3"))


def test_missing_data_never_generates_synthetic_pixels():
    item = {"record": record()}
    with pytest.raises(CubeInputError, match="exactly one"):
        build_cube_render(request([item]))


def test_invalid_overlap_is_an_explicit_error():
    item = frame()
    item["hdus"]["mask"] = [1] * 16
    with pytest.raises(CubeInputError, match="no valid overlapping pixels"):
        build_cube_render(request([item]))


def test_fits_mef_uses_science_hdu_wcs_and_quality_extensions():
    header = fits.Header()
    header["CTYPE1"] = "RA---TAN"
    header["CTYPE2"] = "DEC--TAN"
    header["CRPIX1"] = 2.5
    header["CRPIX2"] = 2.5
    header["CRVAL1"] = 120.0
    header["CRVAL2"] = -20.0
    header["CDELT1"] = -0.001
    header["CDELT2"] = 0.001
    header["BUNIT"] = "MJy/sr"

    hdul = fits.HDUList([
        fits.PrimaryHDU(),
        fits.ImageHDU(np.ones((4, 4), dtype=np.float32), header=header),
        fits.ImageHDU(np.ones((4, 4), dtype=np.float32)),
        fits.ImageHDU(np.zeros((4, 4), dtype=np.uint16)),
    ])
    stream = io.BytesIO()
    hdul.writeto(stream)
    item = {
        "record": record(source="qr3"),
        "fits_base64": base64.b64encode(stream.getvalue()).decode(),
    }
    result = build_cube_render(request([item], source="qr3"))
    low, high = result["metadata"]["ra_range"]
    assert low < 120 < high
    assert result["frames"][0]["median_snr"] == pytest.approx(1)


def test_cd_matrix_registration_handles_rotated_images():
    first = frame()
    second = frame("b", epoch=60001)
    second["record"]["wcs"].update({
        "cd1_1": 0.0,
        "cd1_2": -0.001,
        "cd2_1": -0.001,
        "cd2_2": 0.0,
    })
    result = build_cube_render(request([first, second]))
    assert len(result["frames"]) == 2
    assert result["frames"][1]["valid_fraction"] == pytest.approx(1)


def test_different_photometric_units_are_not_silently_combined():
    first = frame()
    second = frame("b", epoch=60001)
    second["hdus"]["header"]["BUNIT"] = "Jy"
    with pytest.raises(CubeInputError, match="BUNIT"):
        build_cube_render(request([first, second]))