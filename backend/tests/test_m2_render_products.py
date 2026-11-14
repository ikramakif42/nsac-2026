import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest
from astropy.wcs import WCS


MODULE_PATH = Path(__file__).resolve().parents[1] / "render_products.py"
SPEC = importlib.util.spec_from_file_location("orbit_lens_m2_products", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
prepare_render_frame = MODULE.prepare_render_frame


def product(science, valid=None, **kwargs):
    image = np.asarray(science, dtype=float)
    arguments = {
        "record_id": "current",
        "science": image,
        "valid": np.ones(image.shape, dtype=bool) if valid is None else valid,
        "registration_id": "grid-1",
        "photometric_id": "MJy-sr-v1",
        "spectral_id": "Array6-channel-8",
        "low_percentile": 0,
        "high_percentile": 100,
    }
    arguments.update(kwargs)
    return prepare_render_frame(**arguments)


def reference(image, **kwargs):
    arguments = {
        "reference_id": "reference",
        "reference_science": image,
        "reference_valid": np.ones(np.asarray(image).shape, dtype=bool),
        "reference_registration_id": "grid-1",
        "reference_photometric_id": "MJy-sr-v1",
        "reference_spectral_id": "Array6-channel-8",
    }
    arguments.update(kwargs)
    return arguments


def test_intensity_normalization_and_dimensions():
    frame = product([[0, 2, 4], [6, 8, 10]])
    assert frame["width"] == 3
    assert frame["height"] == 2
    assert frame["intensity"] == pytest.approx([0, 0.2, 0.4, 0.6, 0.8, 1])
    assert frame["valid"] == [1] * 6
    assert frame["difference"] is None


def test_constant_plane_is_black():
    frame = product(np.full((3, 3), 17.0))
    assert frame["intensity"] == [0.0] * 9


def test_invalid_pixels_never_enter_percentiles_or_json_as_nan():
    frame = product(
        [[0, np.nan], [10, 100000]],
        valid=[[1, 1], [1, 0]],
    )
    assert frame["intensity"] == [0, 0, 1, 0]
    assert frame["valid"] == [1, 0, 1, 0]
    json.dumps(frame, allow_nan=False)


def test_signed_difference_and_stationary_source_cancellation():
    background = np.array([[2, 3, 4], [5, 6, 7]], dtype=float)
    old = background.copy()
    new = background.copy()
    old[0, 0] += 8
    new[0, 2] += 8

    frame = product(new, **reference(old))
    difference = np.array(frame["difference"]).reshape(2, 3)

    assert difference[0, 0] == -1
    assert difference[0, 2] == 1
    assert np.count_nonzero(difference) == 2
    assert frame["differenceScale"] == 8
    assert frame["referenceId"] == "reference"


def test_identical_reference_has_zero_residual():
    image = np.array([[1, 2], [3, 4]], dtype=float)
    frame = product(image, **reference(image))
    assert frame["difference"] == [0.0] * 4
    assert frame["differenceScale"] == 0


def test_difference_uses_intersection_of_validity_masks():
    frame = product(
        [[1, 2], [3, 4]],
        valid=[[1, 1], [0, 1]],
        **reference(
            [[0, 0], [0, 0]],
            reference_valid=[[1, 0], [1, 1]],
        ),
    )
    assert frame["differenceValid"] == [1, 0, 0, 1]
    assert frame["difference"][1:3] == [0, 0]


@pytest.mark.parametrize(
    "field",
    [
        "reference_registration_id",
        "reference_photometric_id",
        "reference_spectral_id",
    ],
)
def test_incompatible_reference_is_rejected(field):
    with pytest.raises(ValueError, match="incompatible"):
        product(
            [[1, 2]],
            **reference([[1, 2]], **{field: "different"}),
        )


def test_partial_reference_is_rejected():
    with pytest.raises(ValueError, match="complete reference"):
        product([[1, 2]], reference_id="reference")


def test_disjoint_validity_is_rejected():
    with pytest.raises(ValueError, match="overlapping"):
        product(
            [[1, 2]],
            valid=[[1, 0]],
            **reference([[1, 2]], reference_valid=[[0, 1]]),
        )


def test_sparse_signal_uses_nonzero_scale():
    current = np.zeros((20, 20))
    current[10, 10] = 3
    frame = product(
        current,
        high_percentile=90,
        **reference(np.zeros_like(current)),
    )
    assert frame["differenceScale"] == 3
    assert max(frame["difference"]) == 1


def test_shared_difference_scale_preserves_relative_amplitudes():
    first = product(
        [[0, 2]],
        difference_scale=8,
        **reference([[0, 0]]),
    )
    second = product(
        [[0, 4]],
        difference_scale=8,
        **reference([[0, 0]]),
    )
    assert first["difference"] == [0, 0.25]
    assert second["difference"] == [0, 0.5]
    assert first["differenceScaleMode"] == "shared"


def test_large_finite_science_normalizes_without_overflow():
    frame = product([[-1e308, 0, 1e308]])
    assert frame["intensity"] == pytest.approx([0, 0.5, 1])
    json.dumps(frame, allow_nan=False)


@pytest.mark.parametrize(
    "low, high",
    [(99, 1), (1, 1), (-1, 99), (1, 101), (np.nan, 99)],
)
def test_invalid_percentiles_are_rejected(low, high):
    with pytest.raises(ValueError, match="low < high"):
        product([[1, 2]], low_percentile=low, high_percentile=high)


@pytest.mark.parametrize("scale", [0, -1, np.nan, np.inf])
def test_invalid_shared_scale_is_rejected(scale):
    with pytest.raises(ValueError, match="finite and positive"):
        product([[1, 2]], difference_scale=scale, **reference([[0, 0]]))


def test_nonboolean_validity_is_rejected():
    with pytest.raises(ValueError, match="0/1"):
        product([[1, 2]], valid=[[1, np.nan]])


def test_all_invalid_science_is_rejected():
    with pytest.raises(ValueError, match="No valid science"):
        product([[np.nan, np.inf]])


def test_backend_wcs_generates_compass_and_scale():
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [64.5, 64.5]
    wcs.wcs.crval = [269.4521, 4.6934]
    wcs.wcs.cdelt = [-1 / 3600, 1 / 3600]
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]

    frame = product(np.ones((128, 128)), wcs=wcs)
    annotation = frame["annotations"]

    assert annotation["north"] == pytest.approx([0, -1], abs=1e-5)
    assert annotation["east"] == pytest.approx([-1, 0], abs=1e-5)
    assert annotation["scalePixels"] > 0
    assert "field center" in annotation["scaleLabel"]
    json.dumps(frame, allow_nan=False)


def test_rotated_wcs_changes_compass_in_backend():
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [32.5, 32.5]
    wcs.wcs.crval = [120, 30]
    wcs.wcs.cd = np.array([[0, -1], [1, 0]], dtype=float) / 3600
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]

    frame = product(np.ones((64, 64)), wcs=wcs)
    assert frame["annotations"]["north"] == pytest.approx([1, 0], abs=1e-5)
    assert frame["annotations"]["east"] == pytest.approx([0, 1], abs=1e-5)