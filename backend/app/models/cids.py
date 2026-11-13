from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum


DataSource = Literal["qr3", "synthetic", "mast", "vizier"]


class WCSParameters(BaseModel):
    naxis1: int
    naxis2: int
    crpix1: float
    crpix2: float
    crval1: float  # RA deg
    crval2: float  # Dec deg
    cdelt1: float  # deg/pixel
    cdelt2: float  # deg/pixel
    crota2: Optional[float] = None
    cd1_1: Optional[float] = None
    cd1_2: Optional[float] = None
    cd2_1: Optional[float] = None
    cd2_2: Optional[float] = None


class ObservationRecord(BaseModel):
    id: str
    source: DataSource
    band: str
    wavelength_um: float
    epoch_mjd: float
    epoch_label: str
    ra_center: float
    dec_center: float
    wcs: WCSParameters
    fits_url: str
    snr: Optional[float] = None
    quality_flags: Optional[int] = None
    quality_ok: Optional[bool] = None


class SearchQuery(BaseModel):
    ra: float = Field(..., description="Right ascension (decimal degrees, J2000)")
    dec: float = Field(..., description="Declination (decimal degrees, J2000)")
    radius_arcsec: float = Field(default=30.0, ge=1.0, le=300.0)
    bands: Optional[List[str]] = None
    epoch_range: Optional[tuple[float, float]] = None
    source: Optional[DataSource] = None


class SearchResult(BaseModel):
    query: SearchQuery
    records: List[ObservationRecord]
    total: int
    source_used: DataSource
    warning: Optional[str] = None


class SpectrumResponse(BaseModel):
    wavelengths: List[float]
    flux: List[float]
    variance: List[float]


class QualityStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


class QualityReport(BaseModel):
    status: QualityStatus
    flags_decoded: List[str]
    snr: float
    notes: str


class CompareStatus(str, Enum):
    MATCH = "match"
    MISMATCH = "mismatch"
    INSUFFICIENT = "insufficient"


class CompareResult(BaseModel):
    status: CompareStatus
    reasons: List[str]


class CompareRequest(BaseModel):
    record_ids: List[str] = Field(..., min_length=2)

