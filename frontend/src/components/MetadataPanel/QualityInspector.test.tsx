import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { qualityStatusLabel, SourceBadge } from "./QualityInspector";

describe("M3 quality presentation", () => {
  it("does not classify missing quality as failure or success", () => {
    expect(qualityStatusLabel(undefined)).toBe("UNAVAILABLE");
    expect(qualityStatusLabel(null)).toBe("UNAVAILABLE");
    expect(qualityStatusLabel(false)).toBe("FAIL");
    expect(qualityStatusLabel(true)).toBe("PASS");
  });

  it.each([
    ["qr3", "SPHEREx QR3"],
    ["synthetic", "SYNTHETIC"],
    ["mast", "MAST"],
    ["vizier", "VizieR"],
  ] as const)("labels %s explicitly", (source, label) => {
    const html = renderToStaticMarkup(<SourceBadge source={source} />);
    expect(html).toContain(label);
    expect(html).toContain("Data source:");
  });
});