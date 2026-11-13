import type { IConnector } from "./index";
import type { SearchQuery, SearchResult, ObservationRecord, QualityReport, CompareResult } from "../types/cids";
import { registerConnector } from "./index";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** IRSA SIA v2 / IBE connector — routes through FastAPI backend */
const qr3Connector: IConnector = {
  id: "qr3",
  label: "SPHEREx QR3 (IRSA)",

  search(query: SearchQuery): Promise<SearchResult> {
    return apiFetch<SearchResult>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
  },

  fetchCutout(recordId, ra, dec, band): Promise<ObservationRecord> {
    const params = new URLSearchParams({
      record_id: recordId,
      ra: String(ra),
      dec: String(dec),
      band,
    });
    return apiFetch<ObservationRecord>(`/cutout?${params}`);
  },

  fetchSpectrum(recordId) {
    return apiFetch<{ wavelengths: number[]; flux: number[]; variance: number[] }>(
      `/spectrum?record_id=${encodeURIComponent(recordId)}`
    );
  },

  fetchQuality(recordId): Promise<QualityReport> {
    return apiFetch<QualityReport>(`/quality?record_id=${encodeURIComponent(recordId)}`);
  },

  compare(recordIds): Promise<CompareResult> {
    return apiFetch<CompareResult>("/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_ids: recordIds }),
    });
  },
};

registerConnector(qr3Connector);
export default qr3Connector;

