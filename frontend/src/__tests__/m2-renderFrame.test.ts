import { describe, expect, it } from "vitest";
import {
  boundedIndex,
  MAX_FRAME_RATE,
  MIN_FRAME_INTERVAL_MS,
  nextDrawDelay,
  packRenderPlane,
  safeFps,
  validateRenderFrame,
  WheelAccumulator,
  wheelPixels,
  type RenderFrame,
} from "../components/SkyViewer/renderFrame";

function frame(patch: Partial<RenderFrame> = {}): RenderFrame {
  return {
    recordId: "qr3_Array6_epoch2",
    width: 2,
    height: 2,
    lowPercentile: 1,
    highPercentile: 99,
    intensity: [0, 0.25, 0.5, 1],
    valid: [1, 1, 0, 1],
    referenceId: null,
    difference: null,
    differenceValid: null,
    differenceScale: null,
    ...patch,
  };
}

describe("M2 render product contract", () => {
  it("accepts existing sidecars without optional annotations", () => {
    const product = frame();
    expect(validateRenderFrame(product, product.recordId)).toBe(product);
  });

  it("rejects an observation/product mismatch", () => {
    expect(() => validateRenderFrame(frame(), "another-record")).toThrow(
      /different observation/,
    );
  });

  it("rejects mismatched dimensions", () => {
    expect(() =>
      validateRenderFrame(frame({ width: 3 }), "qr3_Array6_epoch2"),
    ).toThrow(/dimensions/);
  });

  it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid dimensions: %s",
    (width) => {
      expect(() =>
        validateRenderFrame(frame({ width }), "qr3_Array6_epoch2"),
      ).toThrow();
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1.1])(
    "rejects unnormalized intensity: %s",
    (value) => {
      expect(() =>
        validateRenderFrame(
          frame({ intensity: [0, value, 0, 1] }),
          "qr3_Array6_epoch2",
        ),
      ).toThrow(/backend-normalized/);
    },
  );

  it("rejects nonboolean masks rather than guessing quality policy", () => {
    expect(() =>
      validateRenderFrame(
        frame({ valid: [1, 2, 0, 1] }),
        "qr3_Array6_epoch2",
      ),
    ).toThrow(/0 or 1/);
  });

  it("requires a complete backend difference product", () => {
    expect(() =>
      validateRenderFrame(
        frame({ referenceId: "reference" }),
        "qr3_Array6_epoch2",
      ),
    ).toThrow(/incomplete/);
  });

  it("preserves signed differences and backend overlap masks", () => {
    const product = frame({
      referenceId: "reference",
      difference: [-1, 0, 0.5, 1],
      differenceValid: [1, 0, 1, 1],
      differenceScale: 8,
    });
    validateRenderFrame(product, product.recordId);
    expect(Array.from(packRenderPlane(product, true))).toEqual([
      -1, 1,
      0, 0,
      0.5, 1,
      1, 1,
    ]);
  });

  it("does not subtract intensity planes in the frontend", () => {
    expect(() => packRenderPlane(frame(), true)).toThrow(
      /backend difference product/,
    );
  });

  it("packs intensity without changing pixel values or validity", () => {
    expect(Array.from(packRenderPlane(frame(), false))).toEqual([
      0, 1,
      0.25, 1,
      0.5, 0,
      1, 1,
    ]);
  });

  it("rejects nonzero residuals with zero scale", () => {
    expect(() =>
      validateRenderFrame(
        frame({
          referenceId: "reference",
          difference: [0, 0, 0, 1],
          differenceValid: [1, 1, 1, 1],
          differenceScale: 0,
        }),
        "qr3_Array6_epoch2",
      ),
    ).toThrow(/zero-scale/);
  });

  it("accepts backend-derived screen-space annotations", () => {
    const product = frame({
      annotations: {
        north: [0, -1],
        east: [-1, 0],
        scalePixels: 60,
        scaleLabel: "1 arcmin at field center",
      },
    });
    expect(validateRenderFrame(product, product.recordId)).toBe(product);
  });

  it("rejects invalid compass vectors", () => {
    expect(() =>
      validateRenderFrame(
        frame({
          annotations: {
            north: [0, -5],
            east: [-1, 0],
            scalePixels: 60,
            scaleLabel: "1 arcmin at field center",
          },
        }),
        "qr3_Array6_epoch2",
      ),
    ).toThrow(/compass/);
  });
});

describe("M2 temporal safety", () => {
  it("caps frame rate and handles nonfinite values", () => {
    expect(MAX_FRAME_RATE).toBe(3);
    expect(safeFps(100)).toBe(3);
    expect(safeFps(0)).toBe(0.1);
    expect(safeFps(0.5)).toBe(0.5);
    expect(safeFps(Number.NaN)).toBe(0.5);
    expect(safeFps(Number.POSITIVE_INFINITY)).toBe(0.5);
  });

  it("prevents new presentations inside the three-Hz interval", () => {
    expect(nextDrawDelay(100, 0)).toBeCloseTo(
      MIN_FRAME_INTERVAL_MS - 100,
    );
    expect(nextDrawDelay(500, 0)).toBe(0);
    expect(nextDrawDelay(0, Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("clamps epoch indices to available observations", () => {
    expect(boundedIndex(-20, 4)).toBe(0);
    expect(boundedIndex(20, 4)).toBe(3);
    expect(boundedIndex(2.9, 4)).toBe(2);
    expect(boundedIndex(Number.NaN, 4)).toBe(0);
    expect(boundedIndex(8, 0)).toBe(0);
  });

  it("normalizes pixel, line, and page wheel events", () => {
    expect(wheelPixels(10, 0, 512)).toBe(10);
    expect(wheelPixels(2, 1, 512)).toBe(32);
    expect(wheelPixels(1, 2, 512)).toBe(512);
    expect(wheelPixels(Number.NaN, 0, 512)).toBe(0);
  });

  it("accumulates small trackpad deltas instead of skipping epochs", () => {
    const wheel = new WheelAccumulator();
    expect(wheel.push(20)).toBe(0);
    expect(wheel.push(20)).toBe(0);
    expect(wheel.push(20)).toBe(0);
    expect(wheel.push(20)).toBe(1);
    expect(wheel.push(-40)).toBe(0);
    expect(wheel.push(-40)).toBe(-1);
  });

  it("retains fractional residuals and supports direction reversal", () => {
    const wheel = new WheelAccumulator();
    expect(wheel.push(100)).toBe(1);
    expect(wheel.push(-20)).toBe(0);
    expect(wheel.push(-160)).toBe(-2);
    wheel.reset();
    expect(wheel.push(79)).toBe(0);
  });
});