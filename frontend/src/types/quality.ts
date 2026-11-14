import type { DataSource, QualityReport } from "./cids";

export interface QualityProducts {
  version: 1;
  record_id: string;
  source: DataSource;
  width: number;
  height: number;
  orientation: "fits-row-zero-bottom";
  status: "pass" | "warn" | "fail";
  policy: string;
  notes: string;
  flags_decoded: string[];
  summary: {
    snr: number | null;
    quality_flags: number;
    quality_ok: boolean;
  };
  report: QualityReport | null;
  eligible_pixels: number;
  rejected_pixels: number;
  eligible_fraction: number;
  eligible_base64: string;
  snr_map: Array<number | null>;
  science_rgba_base64: string;
  snr_rgba_base64: string;
  science_display: {
    stretch: "asinh";
    percentile_low: number;
    percentile_high: number;
    low: number | null;
    high: number | null;
  };
  snr_display: {
    low: number;
    high: number;
    negative: "blue";
    zero: "white";
    positive: "red";
  };
}

export type QualityLoadStatus = "idle" | "loading" | "ready" | "error";