import type { IConnector } from "./index";
import type { SearchQuery, SearchResult, ObservationRecord, QualityReport, CompareResult } from "../types/cids";
import { registerConnector } from "./index";

/**
 * Synthetic connector — generates deterministic test data.
 * NEVER used as a silent fallback for real data.
 * Must be explicitly selected by user or test harness.
 * Archive failure throws; it does NOT fall back here.
 */
const syntheticConnector: IConnector = {
  id: "synthetic",
  label: "Synthetic (Demo)",

  search(query: SearchQuery): Promise<SearchResult> {
    // Generate N synthetic epochs across SPHEREx LVF bands
    const records: ObservationRecord[] = Array.from({ length: 8 }, (_, i) => ({
      id: `synthetic_SW${i % 4 + 1}_${i}`,
      source: "synthetic",
      band: `SW${(i % 4) + 1}`,
      wavelength_um: 0.75 + i * 0.1,
      epoch_mjd: 60300 + i * 30,
      epoch_label: new Date(2024, 2, 1 + i * 30).toISOString().split("T")[0],
      ra_center: query.ra,
      dec_center: query.dec,
      wcs: {
        naxis1: 256, naxis2: 256,
        crpix1: 128, crpix2: 128,
        crval1: query.ra, crval2: query.dec,
        cdelt1: -0.000277, cdelt2: 0.000277,
      },
      fits_url: "",
      snr: 10 + i * 2,
      quality_flags: 0,
      quality_ok: true,
    }));
    return Promise.resolve({
      query,
      records,
      total: records.length,
      source_used: "synthetic",
      warning: "⚠ Synthetic data — not from IRSA archive",
    });
  },

  fetchCutout(_recordId, _ra, _dec, _band): Promise<ObservationRecord> {
    return Promise.reject(new Error("Synthetic connector: cutout not implemented"));
  },

  fetchSpectrum(_recordId) {
    const n = 102;
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
      snr: 15,
      notes: "Synthetic — no real quality assessment",
    });
  },

  compare(_recordIds): Promise<CompareResult> {
    return Promise.resolve({ status: "insufficient", reasons: ["Synthetic data"] });
  },
};

registerConnector(syntheticConnector);
export default syntheticConnector;

