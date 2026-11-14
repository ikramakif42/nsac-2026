import { describe, expect, it } from "vitest";
import {
  assertObservationSourceAvailable,
  boundEpoch,
  parseExploreLocation,
  validateSearchQuery,
  writeExploreLocation,
} from "./exploreState";

describe("M8 URL and source invariants", () => {
  it("preserves an explicit QR3 deep link without substituting synthetic", () => {
    const parsed = parseExploreLocation(new URLSearchParams(
      "ra=269.452123456&dec=4.693456789&fov=0.012345&source=qr3&epoch=7&embed=true",
    ));
    expect(parsed.query.source).toBe("qr3");
    expect(parsed.query.ra).toBe(269.452123456);
    expect(parsed.epoch).toBe(7);
    expect(parsed.embed).toBe(true);
  });

  it("uses synthetic only when explicitly requested or configured", () => {
    expect(parseExploreLocation(new URLSearchParams()).query.source).toBe("qr3");
    expect(parseExploreLocation(
      new URLSearchParams(), "synthetic",
    ).query.source).toBe("synthetic");
    expect(parseExploreLocation(
      new URLSearchParams("source=qr3"), "synthetic",
    ).query.source).toBe("qr3");
  });

  it.each([
    "ra=NaN",
    "ra=360",
    "ra=-1",
    "dec=91",
    "dec=-91",
    "fov=0",
    "fov=11",
    "source=unknown",
    "epoch=-1",
    "epoch=1.5",
    "ra=",
  ])("rejects invalid URL state: %s", (search) => {
    expect(() => parseExploreLocation(new URLSearchParams(search))).toThrow();
  });

  it("round trips precision and preserves embed and unrelated parameters", () => {
    const query = validateSearchQuery({
      ra: 123.123456789,
      dec: -45.987654321,
      radius_arcsec: 22.222222,
      source: "qr3",
    });
    const encoded = writeExploreLocation(
      new URLSearchParams("embed=true&campaign=apps"),
      query,
      4,
    );
    const decoded = parseExploreLocation(encoded);
    expect(decoded.query.ra).toBe(query.ra);
    expect(decoded.query.dec).toBe(query.dec);
    expect(decoded.query.radius_arcsec).toBeCloseTo(query.radius_arcsec!, 10);
    expect(decoded.epoch).toBe(4);
    expect(decoded.embed).toBe(true);
    expect(encoded.get("campaign")).toBe("apps");
  });

  it("bounds epochs after data arrive", () => {
    expect(boundEpoch(99, 4)).toBe(3);
    expect(boundEpoch(99, 0)).toBe(0);
    expect(boundEpoch(-4, 5)).toBe(0);
    expect(boundEpoch(Number.NaN, 5)).toBe(0);
  });

  it("rejects fabricated observation connectors instead of relabeling them", () => {
    expect(() => assertObservationSourceAvailable("wiseview")).toThrow();
    expect(() => assertObservationSourceAvailable("gaia")).toThrow();
    expect(() => assertObservationSourceAvailable("qr3")).not.toThrow();
    expect(() => assertObservationSourceAvailable("synthetic")).not.toThrow();
  });

  it("validates epoch ordering", () => {
    expect(() => validateSearchQuery({
      ra: 0,
      dec: 0,
      epoch_range: [60001, 60000],
    })).toThrow();
  });
});