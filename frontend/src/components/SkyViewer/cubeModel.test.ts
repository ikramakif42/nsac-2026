import { describe, expect, it } from "vitest";
import type { ObservationRecord } from "../../types/cids";
import {
  frameIndex,
  MIN_FRAME_INTERVAL_MS,
  safeFps,
  selectCubeRecords,
  SliceGate,
  SOURCE_LABELS,
  wheelPixels,
} from "./cubeModel";

function record(
  id: string,
  epoch = 60000,
  wavelength = 1,
  patch: Partial<ObservationRecord> = {},
): ObservationRecord {
  return {
    id,
    source: "synthetic",
    band: "Array1",
    array_id: "Array1",
    wavelength_um: wavelength,
    epoch_mjd: epoch,
    epoch_label: String(epoch),
    ra_center: 0,
    dec_center: 0,
    fits_url: "",
    wcs: {
      naxis1: 4,
      naxis2: 4,
      crpix1: 2.5,
      crpix2: 2.5,
      crval1: 0,
      crval2: 0,
      cdelt1: -0.001,
      cdelt2: 0.001,
    },
    ...patch,
  };
}

describe("M5 metadata selection", () => {
  it("orders time slices while holding channel and source fixed", () => {
    const records = [
      record("b", 60002),
      record("a", 60000),
      record("other-channel", 60001, 1.1),
      record("other-source", 60001, 1, { source: "mast" }),
    ];
    expect(
      selectCubeRecords(records, "a", "time", "synthetic").map((item) => item.id),
    ).toEqual(["a", "b"]);
  });

  it("orders supplied co-epoch spectral channels without inventing channels", () => {
    const records = [
      record("b", 60000, 1.1),
      record("a", 60000, 0.9),
      record("other-epoch", 60001, 1.2),
    ];
    expect(
      selectCubeRecords(records, "a", "wavelength", "synthetic")
        .map((item) => item.wavelength_um),
    ).toEqual([0.9, 1.1]);
  });

  it("does not silently choose between duplicate exposures", () => {
    expect(() =>
      selectCubeRecords([record("a"), record("b")], "a", "time", "synthetic"),
    ).toThrow(/Multiple observations/);
  });

  it("does not silently change sources", () => {
    expect(() =>
      selectCubeRecords([record("a")], "a", "time", "qr3"),
    ).toThrow(/active source/);
  });

  it("labels every supported provenance explicitly", () => {
    expect(SOURCE_LABELS).toEqual({
      qr3: "SPHEREx QR3",
      synthetic: "SYNTHETIC",
      mast: "MAST",
      vizier: "VizieR",
      wiseview: "WiseView",
      gaia: "Gaia DR3",
    });
  });
});

describe("M5 playback and scrubbing limits", () => {
  it("caps rates and handles non-finite values", () => {
    expect(safeFps(10)).toBe(3);
    expect(safeFps(-1)).toBe(0.1);
    expect(safeFps(Number.NaN)).toBe(0.5);
    expect(safeFps(Number.POSITIVE_INFINITY)).toBe(0.5);
  });

  it("allows no visible transition faster than 3 Hz", () => {
    const gate = new SliceGate();
    expect(gate.accept(0)).toBe(true);
    expect(gate.accept(100)).toBe(false);
    expect(gate.accept(333)).toBe(false);
    expect(gate.accept(MIN_FRAME_INTERVAL_MS)).toBe(true);
    expect(gate.accept(400)).toBe(false);
    expect(gate.accept(2 * MIN_FRAME_INTERVAL_MS)).toBe(true);
  });

  it("clamps URL and slider indices safely", () => {
    expect(frameIndex(Number.NaN, 10)).toBe(0);
    expect(frameIndex(-3, 10)).toBe(0);
    expect(frameIndex(50, 10)).toBe(9);
    expect(frameIndex(2.9, 10)).toBe(2);
    expect(frameIndex(5, 0)).toBe(0);
  });

  it("normalizes wheel input and bounds large gestures", () => {
    expect(wheelPixels(2, 1, 600)).toBe(32);
    expect(wheelPixels(1, 2, 600)).toBe(240);
    expect(wheelPixels(-1000, 0, 600)).toBe(-240);
    expect(wheelPixels(Number.NaN, 0, 600)).toBe(0);
  });
});