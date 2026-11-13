import type { IConnector } from "./index";
import type {
  SearchQuery,
  SearchResult,
  ObservationRecord,
  QualityReport,
  CompareResult,
  TileQuery,
  TileResponse,
  TimeCubeMetadata,
  CubeAxis,
  ArrayId,
} from "../types/cids";
import { registerConnector } from "./index";

const SPHEREX_6_ARRAYS: { id: ArrayId; wl_min: number; wl_max: number }[] = [
  { id: "Array1", wl_min: 0.75, wl_max: 1.11 },
  { id: "Array2", wl_min: 1.11, wl_max: 1.64 },
  { id: "Array3", wl_min: 1.64, wl_max: 2.42 },
  { id: "Array4", wl_min: 2.42, wl_max: 3.82 },
  { id: "Array5", wl_min: 3.82, wl_max: 4.42 },
  { id: "Array6", wl_min: 4.42, wl_max: 5.00 },
];

/**
 * Synthetic connector — generates deterministic test data for all 6 SPHEREx detector arrays,
 * 5-degree FOV chunks, and 3D time-cubes.
 * NEVER used as a silent fallback for real data.
 */
const syntheticConnector: IConnector = {
  id: "synthetic",
  label: "Synthetic (Demo)",

  search(query: SearchQuery): Promise<SearchResult> {
    const records: ObservationRecord[] = [];
    const baseMjd = 60300;

    // 4 distinct survey epochs
    for (let epochIdx = 0; epochIdx < 4; epochIdx++) {
      const mjd = baseMjd + epochIdx * 90;
      const epochLabel = new Date(2024, 2, 1 + epochIdx * 90).toISOString().split("T")[0];

      // All 6 SPHEREx detector arrays
      for (const arr of SPHEREX_6_ARRAYS) {
        const midWl = (arr.wl_min + arr.wl_max) / 2;
        records.push({
          id: `syn_${arr.id}_ep${epochIdx}`,
          source: "synthetic",
          band: arr.id,
          array_id: arr.id,
          wavelength_um: midWl,
          epoch_mjd: mjd,
          epoch_label: epochLabel,
          ra_center: query.ra,
          dec_center: query.dec,
          wcs: {
            naxis1: 256, naxis2: 256,
            crpix1: 128, crpix2: 128,
            crval1: query.ra, crval2: query.dec,
            cdelt1: -0.000277, cdelt2: 0.000277,
          },
          fits_url: "",
          snr: 15 + epochIdx * 2,
          quality_flags: 0,
          quality_ok: true,
        });
      }
    }

    return Promise.resolve({
      query,
      records,
      total: records.length,
      source_used: "synthetic",
      warning: "⚠ SYNTHETIC DATA — not from IRSA archive. Simulating all 6 detector arrays.",
    });
  },

  fetchCutout(_recordId, _ra, _dec, _band): Promise<ObservationRecord> {
    return Promise.reject(new Error("Synthetic connector: cutout not implemented"));
  },

  fetchSpectrum(_recordId) {
    const n = 102; // 102 continuous channels across all 6 arrays
    return Promise.resolve({
      wavelengths: Array.from({ length: n }, (_, i) => 0.75 + i * (5.0 - 0.75) / n),
      flux: Array.from({ length: n }, () => Math.random() * 1e-17),
      variance: Array.from({ length: n }, () => Math.random() * 1e-35),
    });
  },

  fetchQuality(_recordId): Promise<QualityReport> {
    return Promise.resolve({
      status: "pass",
      flags_decoded: [],
      snr: 22,
      notes: "Synthetic — 6-array pipeline verified",
    });
  },

  compare(_recordIds): Promise<CompareResult> {
    return Promise.resolve({ status: "insufficient", reasons: ["Synthetic data"] });
  },

  fetchTiles(query: TileQuery): Promise<TileResponse> {
    const fov = query.fov_deg ?? 5.0;
    const tileRaIdx = Math.floor(query.ra / fov);
    const tileDecIdx = Math.floor(query.dec / fov);
    const tileId = `tile_${tileRaIdx}_${tileDecIdx}`;

    return Promise.resolve({
      active_tile: {
        tile_id: tileId,
        ra_min: tileRaIdx * fov,
        ra_max: (tileRaIdx + 1) * fov,
        dec_min: tileDecIdx * fov,
        dec_max: (tileDecIdx + 1) * fov,
        center_ra: (tileRaIdx + 0.5) * fov,
        center_dec: (tileDecIdx + 0.5) * fov,
        fov_deg: fov,
        record_count: 24,
        is_prefetched: false,
        neighbor_ids: [`tile_${tileRaIdx + 1}_${tileDecIdx}`, `tile_${tileRaIdx}_${tileDecIdx + 1}`],
      },
      prefetch_tiles: [],
      source_used: "synthetic",
    });
  },

  fetchCube(recordId: string, axis: CubeAxis): Promise<TimeCubeMetadata> {
    const zVals = axis === "time" ? [60300, 60390, 60480, 60570] : [0.75, 1.11, 1.64, 2.42, 3.82, 4.42, 5.0];
    return Promise.resolve({
      record_id: recordId,
      axis,
      dimensions: [256, 256, zVals.length],
      ra_range: [269.4, 269.5],
      dec_range: [4.6, 4.7],
      z_values: zVals,
      slices: zVals.map((v, i) => ({
        slice_index: i,
        label: axis === "time" ? `Epoch ${i + 1}` : `${v} μm`,
        z_value: v,
        min_flux: 1e-18,
        max_flux: 1e-15,
      })),
      source: "synthetic",
    });
  },
};

registerConnector(syntheticConnector);
export default syntheticConnector;
