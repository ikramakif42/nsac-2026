from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Tuple
from enum import Enum

DataSource = Literal["qr3", "wiseview", "gaia", "synthetic", "mast", "vizier"]

# Real SPHEREx Focal Plane: 6 Detector Arrays
ArrayId = Literal["Array1", "Array2", "Array3", "Array4", "Array5", "Array6"]
CDSOverlay = Literal["none", "gaia_dr3", "2mass", "allwise", "panstarrs"]
CubeAxis = Literal["time", "wavelength"]


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
    band: str  # e.g., "Array1", "Array2", etc.
    array_id: Optional[ArrayId] = None
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
    radius_arcsec: float = Field(default=30.0, ge=1.0, le=18000.0)  # up to 5 deg radius
    bands: Optional[List[str]] = None
    epoch_range: Optional[Tuple[float, float]] = None
    source: Optional[DataSource] = None


class SearchResult(BaseModel):
    query: SearchQuery
    records: List[ObservationRecord]
    total: int
    source_used: DataSource
    warning: Optional[str] = None


# Progressive Tiling & 5-Degree Chunking
class TileChunk(BaseModel):
    tile_id: str
    ra_min: float
    ra_max: float
    dec_min: float
    dec_max: float
    center_ra: float
    center_dec: float
    fov_deg: float
    record_count: int
    is_prefetched: bool = False
    neighbor_ids: List[str] = Field(default_factory=list)


class TileQuery(BaseModel):
    ra: float
    dec: float
    fov_deg: float = 5.0
    velocity_dra: float = 0.0
    velocity_ddec: float = 0.0
    source: Optional[DataSource] = "synthetic"


class TileResponse(BaseModel):
    active_tile: TileChunk
    prefetch_tiles: List[TileChunk]
    source_used: DataSource


# Interactive 3D Time-Cube Schema
class TimeCubeSlice(BaseModel):
    slice_index: int
    label: str  # epoch date or wavelength string
    z_value: float  # MJD or wavelength in microns
    min_flux: float
    max_flux: float


class TimeCubeMetadata(BaseModel):
    record_id: str
    axis: CubeAxis
    dimensions: Tuple[int, int, int]  # (nx, ny, nz)
    ra_range: Tuple[float, float]
    dec_range: Tuple[float, float]
    z_values: List[float]
    slices: List[TimeCubeSlice]
    source: DataSource


class SpectrumResponse(BaseModel):
    wavelengths: List[float]
    flux: List[float]
    variance: List[float]
    array_contributions: Optional[dict[str, List[int]]] = None


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
