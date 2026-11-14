"""Backend-owned registration, quality gating, and geometry for M5."""

from __future__ import annotations

import base64
import binascii
import io
from typing import Literal

import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS
from pydantic import BaseModel, Field

from app.models.cids import (
    CubeAxis,
    DataSource,
    ObservationRecord,
    TimeCubeMetadata,
    TimeCubeSlice,
)

MAX_FRAMES = 128
MAX_IMAGE_PIXELS = 4_194_304
MAX_FITS_BYTES = 32 * 1024 * 1024
MAX_TOTAL_PIXELS = 33_554_432


class CubeInputError(ValueError):
    pass


class LoadedHDUs(BaseModel):
    science: list[float | None]
    variance: list[float | None] | None = None
    mask: list[int] | None = None
    header: dict[str, str | float | int | bool] = Field(default_factory=dict)


class CubeFrameInput(BaseModel):
    record: ObservationRecord
    fits_base64: str | None = Field(default=None, max_length=45_000_000)
    hdus: LoadedHDUs | None = None


class CubeRenderRequest(BaseModel):
    axis: CubeAxis
    source: DataSource
    anchor_id: str
    frames: list[CubeFrameInput] = Field(min_length=1, max_length=MAX_FRAMES)
    size: int = Field(default=96, ge=16, le=128)
    stretch: Literal["linear", "sqrt", "log", "asinh"] = "asinh"
    colormap: Literal["inferno", "viridis", "gray"] = "inferno"
    contrast_low: float = Field(default=1, ge=0, le=100)
    contrast_high: float = Field(default=99, ge=0, le=100)


def _record_wcs(record: ObservationRecord) -> WCS:
    p = record.wcs
    header = fits.Header()
    header["NAXIS"] = 2
    header["NAXIS1"] = p.naxis1
    header["NAXIS2"] = p.naxis2
    header["CTYPE1"] = "RA---TAN"
    header["CTYPE2"] = "DEC--TAN"
    header["CUNIT1"] = "deg"
    header["CUNIT2"] = "deg"
    header["CRPIX1"] = p.crpix1
    header["CRPIX2"] = p.crpix2
    header["CRVAL1"] = p.crval1
    header["CRVAL2"] = p.crval2

    matrix = (p.cd1_1, p.cd1_2, p.cd2_1, p.cd2_2)
    if any(v is not None for v in matrix):
        if not all(v is not None for v in matrix):
            raise CubeInputError("A WCS CD matrix must contain all four entries.")
        for key, value in zip(
            ("CD1_1", "CD1_2", "CD2_1", "CD2_2"), matrix
        ):
            header[key] = value
    else:
        header["CDELT1"] = p.cdelt1
        header["CDELT2"] = p.cdelt2
        if p.crota2 is not None:
            header["CROTA2"] = p.crota2
    return WCS(header).celestial


def _checked_shape(nx: int, ny: int) -> tuple[int, int]:
    if nx < 2 or ny < 2 or nx * ny > MAX_IMAGE_PIXELS:
        raise CubeInputError(
            f"Each image must be two-dimensional and contain "
            f"between 4 and {MAX_IMAGE_PIXELS} pixels."
        )
    return ny, nx


def _flat_array(
    values: list[float | None] | list[int],
    shape: tuple[int, int],
    name: str,
) -> np.ndarray:
    if len(values) != shape[0] * shape[1]:
        raise CubeInputError(f"{name} length does not match its image dimensions.")
    return np.asarray(values, dtype=np.float64).reshape(shape)


def _read_frame(
    frame: CubeFrameInput,
) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None, WCS, str]:
    if (frame.fits_base64 is None) == (frame.hdus is None):
        raise CubeInputError(
            "Supply exactly one of fits_base64 or populated CIDS HDUs per frame."
        )

    record = frame.record
    if frame.hdus is not None:
        h = frame.hdus
        shape = _checked_shape(record.wcs.naxis1, record.wcs.naxis2)
        science = _flat_array(h.science, shape, "Science")
        variance = (
            _flat_array(h.variance, shape, "Variance")
            if h.variance is not None
            else None
        )
        mask = (
            _flat_array(h.mask, shape, "Bitmask")
            if h.mask is not None
            else None
        )
        wcs = _record_wcs(record)
        unit = str(h.header.get("BUNIT", "")).strip()
    else:
        try:
            raw = base64.b64decode(frame.fits_base64 or "", validate=True)
        except (ValueError, binascii.Error) as exc:
            raise CubeInputError("Invalid FITS base64 payload.") from exc

        if len(raw) > MAX_FITS_BYTES:
            raise CubeInputError("A FITS payload exceeds the 32 MiB limit.")

        try:
            with fits.open(
                io.BytesIO(raw),
                memmap=False,
                lazy_load_hdus=True,
            ) as hdul:
                hdul.verify("exception")
                if len(hdul) < 2:
                    raise CubeInputError("HDU 1 Science is required.")

                science_hdu = hdul[1]
                if isinstance(science_hdu, fits.CompImageHDU):
                    raise CubeInputError(
                        "Send an uncompressed Level 2 MEF cutout or populated "
                        "CIDS HDUs; compressed image HDUs are not accepted."
                    )
                if science_hdu.header.get("NAXIS") != 2:
                    raise CubeInputError("HDU 1 Science must be a 2D image.")

                shape = _checked_shape(
                    int(science_hdu.header.get("NAXIS1", 0)),
                    int(science_hdu.header.get("NAXIS2", 0)),
                )
                science = np.array(science_hdu.data, dtype=np.float64, copy=True)

                def read_optional(index: int) -> np.ndarray | None:
                    if len(hdul) <= index:
                        return None
                    hdu = hdul[index]
                    if isinstance(hdu, fits.CompImageHDU):
                        raise CubeInputError("Compressed quality HDUs are not accepted.")
                    if (
                        hdu.header.get("NAXIS") != 2
                        or hdu.header.get("NAXIS1") != shape[1]
                        or hdu.header.get("NAXIS2") != shape[0]
                    ):
                        raise CubeInputError(
                            f"HDU {index} dimensions do not match Science."
                        )
                    return np.array(hdu.data, dtype=np.float64, copy=True)

                variance = read_optional(2)
                mask = read_optional(3)
                header = hdul[0].header.copy()
                header.extend(science_hdu.header, update=True)
                wcs = WCS(header).celestial
                unit = str(header.get("BUNIT", "")).strip()
        except CubeInputError:
            raise
        except Exception as exc:
            raise CubeInputError(f"Invalid Level 2 FITS: {exc}") from exc

    if science.ndim != 2 or wcs.pixel_n_dim != 2 or not wcs.has_celestial:
        raise CubeInputError("A two-dimensional celestial WCS is required.")
    if record.source == "qr3" and (variance is None or mask is None):
        raise CubeInputError("SPHEREx QR3 requires HDU 2 Variance and HDU 3 Bitmask.")
    if mask is not None:
        if (
            not np.isfinite(mask).all()
            or np.any(mask < 0)
            or np.any(mask > 65535)
            or np.any(mask != np.floor(mask))
        ):
            raise CubeInputError("HDU 3 must contain unsigned 16-bit integer flags.")

    return science, variance, mask, wcs, unit


def _validate_records(request: CubeRenderRequest) -> list[CubeFrameInput]:
    if request.contrast_low >= request.contrast_high:
        raise CubeInputError("contrast_low must be less than contrast_high.")

    records = [frame.record for frame in request.frames]
    if len({record.id for record in records}) != len(records):
        raise CubeInputError("Duplicate record IDs are not allowed.")
    if any(record.source != request.source for record in records):
        raise CubeInputError("Mixed sources are not allowed.")

    anchor = next(
        (record for record in records if record.id == request.anchor_id), None
    )
    if anchor is None:
        raise CubeInputError("The anchor must be included in the cube.")

    for record in records:
        if not np.isfinite([record.epoch_mjd, record.wavelength_um]).all():
            raise CubeInputError("Epoch and wavelength must be finite.")
        if record.wavelength_um <= 0:
            raise CubeInputError("Wavelength must be positive.")
        if request.axis == "time":
            if (
                record.band != anchor.band
                or record.array_id != anchor.array_id
                or not np.isclose(
                    record.wavelength_um,
                    anchor.wavelength_um,
                    rtol=1e-7,
                    atol=1e-8,
                )
            ):
                raise CubeInputError(
                    "A time cube must hold band, detector attribution, "
                    "and central wavelength fixed."
                )
        elif not np.isclose(
            record.epoch_mjd, anchor.epoch_mjd, rtol=0, atol=1e-7
        ):
            raise CubeInputError(
                "A wavelength cube must hold epoch fixed within 1e-7 MJD."
            )

    key = (
        (lambda frame: frame.record.epoch_mjd)
        if request.axis == "time"
        else (lambda frame: frame.record.wavelength_um)
    )
    frames = sorted(request.frames, key=lambda frame: (key(frame), frame.record.id))
    z_values = [key(frame) for frame in frames]
    if len(set(z_values)) != len(z_values):
        raise CubeInputError(
            "More than one observation occupies an axis coordinate. "
            "Select a single exposure per epoch/channel before building the cube."
        )
    return frames


def _colors(normalized: np.ndarray, name: str) -> np.ndarray:
    stops = {
        "gray": [
            (0.0, (0, 0, 0)),
            (1.0, (255, 255, 255)),
        ],
        "inferno": [
            (0.0, (0, 0, 4)),
            (0.2, (66, 10, 104)),
            (0.4, (147, 38, 103)),
            (0.6, (221, 81, 58)),
            (0.8, (252, 165, 10)),
            (1.0, (252, 255, 164)),
        ],
        "viridis": [
            (0.0, (68, 1, 84)),
            (0.2, (65, 68, 135)),
            (0.4, (42, 120, 142)),
            (0.6, (34, 168, 132)),
            (0.8, (122, 209, 81)),
            (1.0, (253, 231, 37)),
        ],
    }[name]
    xp = np.array([item[0] for item in stops])
    rgb = np.array([item[1] for item in stops], dtype=np.float64)
    return np.stack(
        [np.interp(normalized, xp, rgb[:, channel]) for channel in range(3)],
        axis=-1,
    ).astype(np.uint8)


def build_cube_render(request: CubeRenderRequest) -> dict:
    frames = _validate_records(request)
    warnings: set[str] = set()
    loaded = []
    total_pixels = 0

    for frame in frames:
        data = _read_frame(frame)
        total_pixels += data[0].size
        if total_pixels > MAX_TOTAL_PIXELS:
            raise CubeInputError(
                "The cube exceeds the decoded pixel budget. Request smaller cutouts."
            )
        loaded.append(data)

    units = {item[4] for item in loaded}
    if len(units) > 1:
        raise CubeInputError("Slice BUNIT values differ; units must be normalized first.")
    if not next(iter(units)):
        warnings.add("BUNIT is absent; cross-slice photometric units are unverified.")

    anchor_index = next(
        i for i, frame in enumerate(frames)
        if frame.record.id == request.anchor_id
    )
    reference_science, _, _, reference_wcs, _ = loaded[anchor_index]
    native_height, native_width = reference_science.shape
    scale = min(1.0, request.size / max(native_width, native_height))
    width = max(2, round(native_width * scale))
    height = max(2, round(native_height * scale))

    # Sample target pixel centers in the anchor's native pixel coordinate system.
    x = (np.arange(width) + 0.5) * native_width / width - 0.5
    y = (np.arange(height) + 0.5) * native_height / height - 0.5
    xx, yy = np.meshgrid(x, y)
    world = reference_wcs.pixel_to_world(xx, yy).icrs
    if not np.isfinite(world.cartesian.xyz.value).all():
        raise CubeInputError("The anchor WCS produces non-finite sky coordinates.")

    registered: list[np.ndarray] = []
    validity: list[np.ndarray] = []
    snr_values: list[float | None] = []

    for frame, (science, variance, mask, wcs, _) in zip(frames, loaded):
        try:
            px, py = wcs.world_to_pixel(world)
        except Exception as exc:
            raise CubeInputError(
                f"Cannot register observation {frame.record.id}: {exc}"
            ) from exc

        finite_coordinates = np.isfinite(px) & np.isfinite(py)
        ix = np.rint(np.where(finite_coordinates, px, 0)).astype(np.int64)
        iy = np.rint(np.where(finite_coordinates, py, 0)).astype(np.int64)
        inside = (
            finite_coordinates
            & (ix >= 0)
            & (iy >= 0)
            & (ix < science.shape[1])
            & (iy < science.shape[0])
        )
        cx = np.clip(ix, 0, science.shape[1] - 1)
        cy = np.clip(iy, 0, science.shape[0] - 1)
        flux = science[cy, cx]
        valid = inside & np.isfinite(flux)

        if mask is not None:
            valid &= mask[cy, cx] == 0
        else:
            warnings.add("Some slices have no bitmask; their mask quality is unknown.")

        if variance is not None:
            sampled_variance = variance[cy, cx]
            valid &= np.isfinite(sampled_variance) & (sampled_variance > 0)
            snr = (
                float(np.median(flux[valid] / np.sqrt(sampled_variance[valid])))
                if valid.any()
                else None
            )
        else:
            warnings.add("Some slices have no variance; their SNR is unavailable.")
            snr = None

        if not valid.any():
            raise CubeInputError(
                f"Observation {frame.record.id} has no valid overlapping pixels."
            )
        registered.append(flux)
        validity.append(valid)
        snr_values.append(snr)

    pooled = np.concatenate([
        flux[valid] for flux, valid in zip(registered, validity)
    ])
    low, high = np.percentile(
        pooled, [request.contrast_low, request.contrast_high]
    )
    span = float(high - low)
    if span <= 0:
        span = max(abs(float(low)) * 1e-6, 1.0)
        warnings.add("Constant-flux data uses a finite display interval.")

    z_values = [
        float(
            frame.record.epoch_mjd
            if request.axis == "time"
            else frame.record.wavelength_um
        )
        for frame in frames
    ]
    z_min, z_max = min(z_values), max(z_values)
    z_positions = [
        0.0 if z_max == z_min else -0.8 + 1.6 * (z - z_min) / (z_max - z_min)
        for z in z_values
    ]
    output_frames = []
    slices = []

    for index, (frame, flux, valid, snr) in enumerate(
        zip(frames, registered, validity, snr_values)
    ):
        normalized = np.clip(
            (np.where(valid, flux, low) - low) / span, 0, 1
        )
        if request.stretch == "sqrt":
            normalized = np.sqrt(normalized)
        elif request.stretch == "log":
            normalized = np.log1p(1000 * normalized) / np.log1p(1000)
        elif request.stretch == "asinh":
            normalized = np.arcsinh(10 * normalized) / np.arcsinh(10)

        rgba = np.zeros((height, width, 4), dtype=np.uint8)
        rgba[..., :3] = _colors(normalized, request.colormap)
        rgba[..., 3] = valid.astype(np.uint8) * 255
        label = (
            f"{frame.record.epoch_label} · MJD {z_values[index]:.8f}"
            if request.axis == "time"
            else f"{z_values[index]:.6f} μm · {frame.record.band}"
        )
        slices.append(TimeCubeSlice(
            slice_index=index,
            label=label,
            z_value=z_values[index],
            min_flux=float(flux[valid].min()),
            max_flux=float(flux[valid].max()),
        ))
        output_frames.append({
            "record_id": frame.record.id,
            "rgba_base64": base64.b64encode(rgba.tobytes()).decode("ascii"),
            "valid_fraction": float(valid.mean()),
            "median_snr": snr,
        })

    center = reference_wcs.pixel_to_world(
        (native_width - 1) / 2, (native_height - 1) / 2
    ).icrs
    ra = world.ra.wrap_at(center.ra + 180 * u.deg).degree
    dec = world.dec.degree

    # A shared celestial mesh suffices because all images use the same target WCS.
    mesh_width = min(width + 1, 25)
    mesh_height = min(height + 1, 25)
    mx, my = np.meshgrid(
        np.linspace(-0.5, native_width - 0.5, mesh_width),
        np.linspace(-0.5, native_height - 0.5, mesh_height),
    )
    mesh_world = reference_wcs.pixel_to_world(mx, my).icrs
    sphere_positions = np.moveaxis(
        mesh_world.cartesian.xyz.value, 0, -1
    ).reshape(-1, 3)
    if not np.isfinite(sphere_positions).all():
        raise CubeInputError("The celestial footprint crosses an invalid WCS region.")

    uu, vv = np.meshgrid(
        np.linspace(0, 1, mesh_width),
        np.linspace(0, 1, mesh_height),
    )
    uv = np.stack([uu, vv], axis=-1).reshape(-1, 2)
    indices = []
    for row in range(mesh_height - 1):
        for column in range(mesh_width - 1):
            a = row * mesh_width + column
            b = a + 1
            c = a + mesh_width
            d = c + 1
            indices.extend([a, b, d, a, d, c])

    direction = center.cartesian.xyz.value
    north_point = center.directional_offset_by(0 * u.deg, 0.01 * u.deg)
    north = north_point.cartesian.xyz.value - direction
    north -= np.dot(north, direction) * direction
    north /= np.linalg.norm(north)
    angular_radius = float(center.separation(mesh_world).max().radian)

    metadata = TimeCubeMetadata(
        record_id=request.anchor_id,
        axis=request.axis,
        dimensions=(width, height, len(frames)),
        ra_range=(float(ra.min()), float(ra.max())),
        dec_range=(float(dec.min()), float(dec.max())),
        z_values=z_values,
        slices=slices,
        source=request.source,
    )
    warnings.add(
        "Nearest-neighbor WCS registration is for visualization, not "
        "flux-conserving photometry or PSF-matched analysis."
    )
    if request.axis == "wavelength":
        warnings.add(
            "Only supplied co-epoch channels are shown; missing spectral "
            "channels are not interpolated or synthesized."
        )
    if len(frames) == 1:
        warnings.add("Only one matching slice is available.")

    return {
        "metadata": metadata.model_dump(),
        "record_ids": [frame.record.id for frame in frames],
        "texture_width": width,
        "texture_height": height,
        "frames": output_frames,
        "cube": {
            "width": 2.0,
            "height": 2.0 * height / width,
            "z_positions": z_positions,
        },
        "sphere": {
            "positions": sphere_positions.ravel().tolist(),
            "uv": uv.ravel().tolist(),
            "indices": indices,
            "center": direction.tolist(),
            "north": north.tolist(),
            "angular_radius_rad": angular_radius,
        },
        "display_range": [float(low), float(low + span)],
        "unit": next(iter(units)),
        "warnings": sorted(warnings),
    }