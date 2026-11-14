import { describe, expect, it } from "vitest";
import {
  checkedResponse,
  overlayURL,
  readOverlay,
  scienceRGBA,
  supportedOverlay,
} from "./cdsReference";

describe("M6 CDS reference contract", () => {
  it("accepts only configured surveys", () => {
    expect(supportedOverlay("2mass")).toBe(true);
    expect(supportedOverlay("allwise")).toBe(true);
    expect(supportedOverlay("gaia_dr3")).toBe(true);
    expect(supportedOverlay("panstarrs")).toBe(false);
    expect(supportedOverlay("https://example.com")).toBe(false);
  });

  it("restores valid URL state and rejects unknown overlays", () => {
    expect(readOverlay("?overlay=gaia_dr3")).toBe("gaia_dr3");
    expect(readOverlay("?overlay=unknown")).toBe("none");
    expect(readOverlay("")).toBe("none");
  });

  it("preserves all existing deep-link parameters", () => {
    const initial =
      "https://orbit.example/explore?ra=10&dec=-20&fov=5&source=qr3&epoch=3&embed=true";
    const url = overlayURL(initial, "allwise");
    expect(url.searchParams.get("overlay")).toBe("allwise");
    expect(url.searchParams.get("ra")).toBe("10");
    expect(url.searchParams.get("dec")).toBe("-20");
    expect(url.searchParams.get("fov")).toBe("5");
    expect(url.searchParams.get("source")).toBe("qr3");
    expect(url.searchParams.get("epoch")).toBe("3");
    expect(url.searchParams.get("embed")).toBe("true");
    expect(overlayURL(url.href, "none").searchParams.has("overlay")).toBe(false);
  });

  it("reverses FITS rows without coordinate calculations", () => {
    const result = scienceRGBA(new Float32Array([0, 1, 2, 3]), 2, 2);
    expect(result[0]).toBeGreaterThan(result[8]);
    expect(result[4]).toBeGreaterThan(result[12]);
    expect(result[3]).toBe(255);
  });

  it("renders nonfinite science pixels as transparent", () => {
    const result = scienceRGBA(new Float32Array([NaN, Infinity]), 2, 1);
    expect(result[3]).toBe(0);
    expect(result[7]).toBe(0);
  });

  it("rejects mismatched science dimensions", () => {
    expect(() => scienceRGBA(new Float32Array(3), 2, 2)).toThrow(
      "Science pixels do not match",
    );
  });

  it("surfaces backend errors rather than substituting data", async () => {
    const response = {
      ok: false,
      status: 502,
      json: async () => ({ detail: "CDS unavailable; no substitute was used." }),
    } as Response;
    await expect(checkedResponse(response)).rejects.toThrow("no substitute");
  });

  it("preserves successful responses", async () => {
    const response = { ok: true } as Response;
    await expect(checkedResponse(response)).resolves.toBe(response);
  });
});