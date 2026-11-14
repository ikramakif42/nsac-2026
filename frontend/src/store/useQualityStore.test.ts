import { beforeEach, describe, expect, it } from "vitest";
import { useQualityStore } from "./useQualityStore";
import type { QualityProducts } from "../types/quality";

const products: QualityProducts = {
  version: 1,
  record_id: "one",
  source: "qr3",
  width: 1,
  height: 1,
  orientation: "fits-row-zero-bottom",
  status: "fail",
  policy: "Reject all nonzero bits.",
  notes: "No eligible pixels.",
  flags_decoded: ["BIT_15"],
  summary: {
    snr: null,
    quality_flags: 32768,
    quality_ok: false,
  },
  report: null,
  eligible_pixels: 0,
  rejected_pixels: 1,
  eligible_fraction: 0,
  eligible_base64: "AA==",
  snr_map: [null],
  science_rgba_base64: "AAAAAA==",
  snr_rgba_base64: "AAAAAA==",
  science_display: {
    stretch: "asinh",
    percentile_low: 1,
    percentile_high: 99,
    low: null,
    high: null,
  },
  snr_display: {
    low: -10,
    high: 10,
    negative: "blue",
    zero: "white",
    positive: "red",
  },
};

beforeEach(() => {
  useQualityStore.getState().clear();
});

describe("M3 request lifecycle", () => {
  it("does not display previous products while a new record loads", () => {
    const first = useQualityStore.getState().begin("one");
    useQualityStore.getState().resolve("one", first, products);
    useQualityStore.getState().begin("two");

    expect(useQualityStore.getState().products).toBeNull();
    expect(useQualityStore.getState().status).toBe("loading");
  });

  it("ignores out-of-order successful responses", () => {
    const first = useQualityStore.getState().begin("one");
    const second = useQualityStore.getState().begin("two");

    expect(
      useQualityStore.getState().resolve("one", first, products),
    ).toBe(false);
    expect(useQualityStore.getState().revision).toBe(second);
    expect(useQualityStore.getState().key).toBe("two");
  });

  it("ignores out-of-order errors", () => {
    const first = useQualityStore.getState().begin("one");
    useQualityStore.getState().begin("two");
    useQualityStore.getState().reject("one", first, "old failure");

    expect(useQualityStore.getState().error).toBeNull();
    expect(useQualityStore.getState().status).toBe("loading");
  });

  it("invalidates responses after reset", () => {
    const revision = useQualityStore.getState().begin("one");
    useQualityStore.getState().clear();

    expect(
      useQualityStore.getState().resolve("one", revision, products),
    ).toBe(false);
    expect(useQualityStore.getState().status).toBe("idle");
  });

  it("keeps failures explicit and clears science products", () => {
    const revision = useQualityStore.getState().begin("one");
    useQualityStore.getState().reject("one", revision, "FITS unavailable");

    expect(useQualityStore.getState().status).toBe("error");
    expect(useQualityStore.getState().products).toBeNull();
    expect(useQualityStore.getState().error).toBe("FITS unavailable");
  });
});