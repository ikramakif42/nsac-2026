// CIDS — Cross-modal Interoperability Data Schema
// Single contract between frontend and backend

export type DataSource = "qr3" | "synthetic" | "mast" | "vizier";

// Real SPHEREx Focal Plane: 6 Detector Arrays
export type ArrayId = "Array1" | "Array2" | "Array3" | "Array4" | "Array5" | "Array6";
export type Band = ArrayId | string;

export type CDSOverlay = "none" | "gaia_dr3" | "2mass" | "allwise" | "panstarrs";
export type CubeAxis = "time" | "wavelength";

export interface SkyCoordinate {
  ra: number;   // decimal degrees J2000
  dec: number;  // decimal degrees J2000
}

export interface WCSParameters {
  naxis1: number;
  naxis2: number;
  crpix1: number;
  crpix2: number;
  crval1: number;  // RA ref (deg)
  crval2: number;  // Dec ref (deg)
  cdelt1: number;  // deg/pixel
  cdelt2: number;  // deg/pixel
  crota2?: number; // rotation (deg)
  cd1_1?: number;  cd1_2?: number;
  cd2_1?: number;  cd2_2?: number;
}

export interface FITSHDUs {
  hdu0_header: Record<string, string | number | boolean>;
  hdu1_science: Float32Array;   // 2-D flattened row-major
  hdu2_variance?: Float32Array;
  hdu3_mask?: Uint16Array;      // bitmask per pixel
}

export interface ObservationRecord {
  id: string;                 // unique: `${source}_${band}_${epoch}`
  source: DataSource;
  band: Band;
  array_id?: ArrayId;
  wavelength_um: number;      // central wavelength μm
  epoch_mjd: number;          // Modified Julian Date
  epoch_label: string;        // human: "2024-03-01"
  ra_center: number;
  dec_center: number;
  wcs: WCSParameters;
  fits_url: string;           // signed/direct URL for cutout fetch
  fits_hdus?: FITSHDUs;       // populated after fetch
  snr?: number;               // from HDU 2
  quality_flags?: number;     // raw bitmask from HDU 3
  quality_ok?: boolean;       // derived: HDU 3 == 0 for science pixels
}

export interface SearchQuery {
  ra: number;
  dec: number;
  radius_arcsec?: number;     // default 30, up to 18000 (5 deg)
  bands?: Band[];
  epoch_range?: [number, number]; // MJD range
  source?: DataSource;
}

export interface SearchResult {
  query: SearchQuery;
  records: ObservationRecord[];
  total: number;
  source_used: DataSource;
  warning?: string;
}

// Progressive 5-degree FOV Tiling
export interface TileChunk {
  tile_id: string;
  ra_min: number;
  ra_max: number;
  dec_min: number;
  dec_max: number;
  center_ra: number;
  center_dec: number;
  fov_deg: number;
  record_count: number;
  is_prefetched: boolean;
  neighbor_ids: string[];
}

export interface TileQuery {
  ra: number;
  dec: number;
  fov_deg?: number;
  velocity_dra?: number;
  velocity_ddec?: number;
  source?: DataSource;
}

export interface TileResponse {
  active_tile: TileChunk;
  prefetch_tiles: TileChunk[];
  source_used: DataSource;
}

// Interactive 3D Time-Cube
export interface TimeCubeSlice {
  slice_index: number;
  label: string;
  z_value: number;
  min_flux: number;
  max_flux: number;
}

export interface TimeCubeMetadata {
  record_id: string;
  axis: CubeAxis;
  dimensions: [number, number, number];
  ra_range: [number, number];
  dec_range: [number, number];
  z_values: number[];
  slices: TimeCubeSlice[];
  source: DataSource;
}

export interface SEDPoint {
  wavelength_um: number;
  flux: number;
  variance: number;
  band: Band;
  epoch_mjd: number;
}

export interface SpectrumResponse {
  wavelengths: number[];
  flux: number[];
  variance: number[];
  array_contributions?: Record<string, number[]>;
}

export interface QualityReport {
  status: "pass" | "warn" | "fail";
  flags_decoded: string[];
  snr: number;
  notes: string;
}

export interface CompareResult {
  status: "match" | "mismatch" | "insufficient";
  reasons: string[];
}

// Benchmark presets
export interface BenchmarkTarget {
  label: string;
  ra: number;
  dec: number;
  description: string;
}

export const BENCHMARK_TARGETS: BenchmarkTarget[] = [
  { label: "Barnard's Star",  ra: 269.4521, dec:  +4.6934, description: "High-PM M4 red dwarf (proper motion tracer)" },
  { label: "Epsilon Indi B",  ra: 331.0438, dec: -56.7828, description: "Nearest T-type brown dwarf (methane/ice bands)" },
  { label: "WISE 0855",       ra: 133.7951, dec:  -7.2451, description: "Coldest known brown dwarf (water clouds)" },
  { label: "RW Aurigae",      ra:  76.9564, dec: +30.4014, description: "T Tauri variable star (circumstellar disk)" },
  { label: "R Draconis",      ra: 248.1676, dec: +66.7551, description: "Mira-type AGB variable (pulsational variability)" },
];
