import { describe, expect, it } from "vitest";
import { parseQualityProducts, qualityRecordKey } from "./qualityClient";
import type { QualityProducts } from "../types/quality";

function validPayload(): QualityProducts {
  return {
    version: 1,
    record_id: "qr3_Array1_1",
    source: "qr3",
    width: 1,
    height: 1,
    orientation: "fits-row-zero-bottom",
    status: "pass",
    policy: "Reject all nonzero mask bits.",
    notes: "Median signed pixel SNR.",
    flags_decoded: [],
    summary: {
      snr: -2,
      quality_flags: 0,
      quality_ok: true,
    },
    report: {
      status: "pass",
      snr: -2,
      flags_decoded: [],
      notes: "Median signed pixel SNR.",
    },
    eligible_pixels: 1,
    rejected_pixels: 0,
    eligible_fraction: 1,
    eligible_base64: "AQ==",
    snr_map: [-2],
    science_rgba_base64: "AAAA/w==",
    snr_rgba_base64: "AAAA/w==",
    science_display: {
      stretch: "asinh",
      percentile_low: 1,
      percentile_high: 99,
      low: -2,
      high: -2,
    },
    snr_display: {
      low: -10,
      high: 10,
      negative: "blue",
      zero: "white",
      positive: "red",
    },
  };
}

const identity = { id: "qr3_Array1_1", source: "qr3" as const };

describe("M3 quality transport", () => {
  it("preserves signed backend SNR", () => {
    const parsed = parseQualityProducts(validPayload(), identity);
    expect(parsed.snr_map).toEqual([-2]);
    expect(parsed.summary.snr).toBe(-2);
  });

  it("rejects stale or mismatched record identity", () => {
    expect(() =>
      parseQualityProducts(validPayload(), { ...identity, id: "another" }),
    ).toThrow(/identity/);
  });

  it("rejects a mismatched source", () => {
    expect(() =>
      parseQualityProducts(validPayload(), { ...identity, source: "synthetic" }),
    ).toThrow(/identity/);
  });

  it("rejects nonfinite JSON science values", () => {
    const payload = validPayload();
    payload.snr_map = [Number.NaN];
    expect(() => parseQualityProducts(payload, identity)).toThrow(/invalid values/);
  });

  it("accepts explicit unavailable SNR without inventing zero", () => {
    const payload = validPayload();
    payload.status = "fail";
    payload.summary.snr = null;
    payload.summary.quality_ok = false;
    payload.report = null;
    payload.snr_map = [null];
    payload.eligible_pixels = 0;
    payload.rejected_pixels = 1;
    payload.eligible_fraction = 0;
    payload.eligible_base64 = "AA==";
    payload.science_rgba_base64 = "AAAAAA==";
    payload.snr_rgba_base64 = "AAAAAA==";

    expect(parseQualityProducts(payload, identity).summary.snr).toBeNull();
  });

  it("rejects truncated display textures", () => {
    const payload = validPayload();
    payload.science_rgba_base64 = "AA==";
    expect(() => parseQualityProducts(payload, identity)).toThrow(/length/);
  });

  it("rejects corrupt eligibility bytes", () => {
    const payload = validPayload();
    payload.eligible_base64 = "Ag==";
    expect(() => parseQualityProducts(payload, identity)).toThrow(/eligibility/);
  });

  it("keys requests by identity, source, and FITS URL", () => {
    const record = {
      ...identity,
      fits_url: "/api/fits/one",
    };
    expect(qualityRecordKey(record)).not.toBe(
      qualityRecordKey({ ...record, fits_url: "/api/fits/two" }),
    );
    expect(qualityRecordKey(null)).toBeNull();
  });
});