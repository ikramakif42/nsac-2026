import numpy as np
import pytest

from render_products import prepare_render_frame


def prepare(science, **kwargs):
    image = np.asarray(science, dtype=float)
    defaults = dict(
        record_id="current",
        science=image,
        valid=np.ones(image.shape, dtype=bool),
        registration_id="grid",
        photometric_id="MJy/sr",
        spectral_id="channel-17",
    )
    defaults.update(kwargs)
    return prepare_render_frame(**defaults)


def reference(image):
    return dict(
        reference_id="reference",
        reference_science=np.asarray(image, dtype=float),
        reference_valid=np.ones(np.shape(image), dtype=bool),
        reference_registration_id="grid",
        reference_photometric_id="MJy/sr",
        reference_spectral_id="channel-17",
    )


def test_signed_difference_and_stationary_cancellation():
    product = prepare([[3, 1, 5]], **reference([[1, 3, 5]]))
    assert product["difference"] == [1, -1, 0]
    assert product["differenceValid"] == [1, 1, 1]


def test_invalid_pixels_do_not_enter_limits():
    product = prepare([[1, 3, np.nan, 1e10]], valid=[[1, 1, 1, 0]])
    assert product["intensity"] == [0, 1, 0, 0]
    assert product["valid"] == [1, 1, 0, 0]


def test_constant_plane_is_finite():
    product = prepare([[7, 7]], **reference([[7, 7]]))
    assert product["intensity"] == [0, 0]
    assert product["difference"] == [0, 0]
    assert product["differenceScale"] == 0


@pytest.mark.parametrize(
    "key",
    [
        "reference_registration_id",
        "reference_photometric_id",
        "reference_spectral_id",
    ],
)
def test_incompatible_reference_rejected(key):
    args = reference([[1, 2]])
    args[key] = "incompatible"
    with pytest.raises(ValueError, match="incompatible"):
        prepare([[1, 2]], **args)


def test_no_overlap_rejected():
    args = reference([[1, 2]])
    args["reference_valid"] = [[False, False]]
    with pytest.raises(ValueError, match="overlapping"):
        prepare([[1, 2]], **args)


def test_invalid_percentiles_rejected():
    with pytest.raises(ValueError, match="low"):
        prepare([[1, 2]], low_percentile=float("nan"))


def test_partial_reference_rejected():
    with pytest.raises(ValueError, match="complete reference"):
        prepare([[1, 2]], reference_id="missing")