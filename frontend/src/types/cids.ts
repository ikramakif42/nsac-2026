// CIDS — Cross-modal Interoperability Data Schema
// Single contract between frontend and backend

export type DataSource = "qr3" | "synthetic" | "mast" | "vizier";
export type Band =
  | "SW1" | "SW2" | "LW1" | "LW2"       // SPHEREx science bands (aliases)
  | string;                               // allow raw band IDs

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
  wavelength_um: number;      // central wavelength μm
  epoch_mjd: number;          // Modified Julian Date
  epoch_label: string;        // human: "2025-03-14"
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
  radius_arcsec?: number;     // default 30
  bands?: Band[];
  epoch_range?: [number, number]; // MJD range
  source?: DataSource;
}

export interface SearchResult {
  query: SearchQuery;
  records: ObservationRecord[];
  total: number;
  source_used: DataSource;
  warning?: string;           // non-fatal (e.g. partial coverage)
}

export interface SEDPoint {
  wavelength_um: number;
  flux: number;
  variance: number;
  band: Band;
  epoch_mjd: number;
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
  { label: "Barnard's Star",  ra: 269.4521, dec:  +4.6934, description: "High-PM M4 red dwarf" },
  { label: "Epsilon Indi B",  ra: 331.0438, dec: -56.7828, description: "Nearest T-type brown dwarf" },
  { label: "WISE 0855",       ra: 133.7951, dec:  -7.2451, description: "Coldest known brown dwarf" },
  { label: "RW Aurigae",      ra:  76.9564, dec: +30.4014, description: "T Tauri variable star" },
  { label: "R Draconis",      ra: 248.1676, dec: +66.7551, description: "Mira-type AGB variable" },
];

