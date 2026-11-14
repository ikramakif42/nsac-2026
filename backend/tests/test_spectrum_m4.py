import asyncio

import numpy as np
import pytest
from fastapi import HTTPException

from app.models.cids import SpectrumResponse
from app.routers import spectrum as module
from app.science.lvf_model import all_bands_wavelength_axis


def test_synthetic_is_deterministic_and_uses_backend_lvf():
    first = module.synthetic_spectrum("syn_Array1_ep0")
    second = module.synthetic_spectrum("syn_Array1_ep0")
    assert first == second
    assert first.wavelengths == all_bands_wavelength_axis()
    assert len(first.flux) == len(first.variance) == 102
    assert np.all(np.asarray(first.variance) >= 0)
    assert set(first.array_contributions) == {
        f"Array{number}" for number in range(1, 7)
    }
    assert all(len(indices) == 17 for indices in first.array_contributions.values())
    assert sorted(
        index
        for indices in first.array_contributions.values()
        for index in indices
    ) == list(range(102))


def test_synthetic_record_identity_changes_demo_spectrum():
    assert (
        module.synthetic_spectrum("syn_Array1_ep0").flux
        != module.synthetic_spectrum("syn_Array1_ep1").flux
    )


@pytest.mark.parametrize(
    "response",
    [
        SpectrumResponse(wavelengths=[1], flux=[], variance=[1]),
        SpectrumResponse(wavelengths=[1, 1], flux=[1, 2], variance=[1, 1]),
        SpectrumResponse(wavelengths=[1], flux=[float("nan")], variance=[1]),
        SpectrumResponse(wavelengths=[1], flux=[1], variance=[-1]),
        SpectrumResponse(
            wavelengths=[1],
            flux=[1],
            variance=[1],
            array_contributions={"Array1": [1]},
        ),
        SpectrumResponse(
            wavelengths=[1],
            flux=[1],
            variance=[1],
            array_contributions={"Array1": [0], "Array2": [0]},
        ),
    ],
)
def test_invalid_science_payloads_are_rejected(response):
    with pytest.raises(ValueError):
        module.validate_spectrum(response, "qr3")


def test_partial_spectrum_is_not_resampled():
    response = SpectrumResponse(
        wavelengths=[1.66, 3.05, 4.27, 4.67],
        flux=[-1, 0, 2, 3],
        variance=[1, 0, 1, 1],
    )
    result = module.validate_spectrum(response, "qr3")
    assert result.flux == [-1, 0, 2, 3]
    assert result.wavelengths == response.wavelengths
    assert result.array_contributions["Array3"] == [0]
    assert result.array_contributions["Array4"] == [1]
    assert result.array_contributions["Array5"] == [2]
    assert result.array_contributions["Array6"] == [3]


def test_non_spherex_sources_do_not_receive_invented_array_attribution():
    result = module.validate_spectrum(
        SpectrumResponse(wavelengths=[1], flux=[2], variance=[1]), "mast"
    )
    assert result.array_contributions is None


def test_explicit_synthetic_request_does_not_consult_archive(monkeypatch):
    def forbidden(_source):
        pytest.fail("Explicit synthetic request must not consult archive connector")

    monkeypatch.setattr(module, "get_connector", forbidden)
    result = asyncio.run(module.spectrum(record_id="demo", source="synthetic"))
    assert len(result.wavelengths) == 102


def test_requested_source_is_dispatched(monkeypatch):
    requested = []

    class Connector:
        async def fetch_spectrum(self, record_id):
            assert record_id == "record"
            return SpectrumResponse(wavelengths=[1], flux=[2], variance=[1])

    def get_connector(source):
        requested.append(source)
        return Connector()

    monkeypatch.setattr(module, "get_connector", get_connector)
    result = asyncio.run(module.spectrum(record_id="record", source="vizier"))
    assert requested == ["vizier"]
    assert result.flux == [2]


def test_unavailable_archive_never_falls_back(monkeypatch):
    monkeypatch.setattr(module, "get_connector", lambda _source: None)
    with pytest.raises(HTTPException) as error:
        asyncio.run(module.spectrum(record_id="record", source="qr3"))
    assert error.value.status_code == 503


def test_failed_archive_never_falls_back(monkeypatch):
    class Connector:
        async def fetch_spectrum(self, _record_id):
            raise RuntimeError("Archive unavailable")

    monkeypatch.setattr(module, "get_connector", lambda _source: Connector())
    with pytest.raises(HTTPException) as error:
        asyncio.run(module.spectrum(record_id="record", source="qr3"))
    assert error.value.status_code == 502
    assert "no fallback" in error.value.detail