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
} from "../types/cids";
import { registerConnector } from "./index";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Gaia API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

const gaiaConnector: IConnector = {
  id: "gaia",
  label: "ESA Gaia DR3",

  search(query: SearchQuery): Promise<SearchResult> {
    return apiFetch<SearchResult>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...query, source: "gaia" }),
    });
  },

  fetchCutout(recordId, ra, dec, band): Promise<ObservationRecord> {
    const params = new URLSearchParams({
      record_id: recordId,
      ra: String(ra),
      dec: String(dec),
      band,
      source: "gaia",
    });
    return apiFetch<ObservationRecord>(`/cutout?${params}`);
  },

  fetchSpectrum(recordId) {
    return apiFetch<{ wavelengths: number[]; flux: number[]; variance: number[] }>(
      `/spectrum?record_id=${encodeURIComponent(recordId)}&source=gaia`
    );
  },

  fetchQuality(recordId): Promise<QualityReport> {
    return apiFetch<QualityReport>(`/quality?record_id=${encodeURIComponent(recordId)}&source=gaia`);
  },

  compare(recordIds): Promise<CompareResult> {
    return apiFetch<CompareResult>("/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_ids: recordIds }),
    });
  },

  fetchTiles(query: TileQuery): Promise<TileResponse> {
    return apiFetch<TileResponse>("/tiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...query, source: "gaia" }),
    });
  },

  fetchCube(recordId: string, axis: CubeAxis): Promise<TimeCubeMetadata> {
    return apiFetch<TimeCubeMetadata>(
      `/cube?record_id=${encodeURIComponent(recordId)}&axis=${axis}&source=gaia`
    );
  },
};

registerConnector(gaiaConnector);
export default gaiaConnector;

