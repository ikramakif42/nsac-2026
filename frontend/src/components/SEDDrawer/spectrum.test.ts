import { describe, expect, it } from "vitest";
import {
  ARRAY_IDS,
  FEATURES,
  parseSpectrum,
  sampleOwners,
  spectrumCSV,
  visibleFlux,
} from "./spectrum";

const valid = () => ({
  wavelengths: [0.9, 1.4, 1.9],
  flux: [0, -2, 3],
  variance: [0, 4, 9],
  array_contributions: { Array1: [0], Array2: [1], Array3: [2] },
});

describe("M4 spectrum transport and presentation", () => {
  it("preserves zero and negative measured flux", () => {
    expect(parseSpectrum(valid()).flux).toEqual([0, -2, 3]);
  });

  it.each([
    { ...valid(), flux: [1] },
    { ...valid(), wavelengths: [0.9, 0.9, 1.9] },
    { ...valid(), wavelengths: [0.9, 0.8, 1.9] },
    { ...valid(), wavelengths: [0, 1.4, 1.9] },
    { ...valid(), flux: [1, Number.NaN, 3] },
    { ...valid(), variance: [0, -1, 9] },
    { ...valid(), array_contributions: { Array7: [0] } },
    { ...valid(), array_contributions: { Array1: [3] } },
    { ...valid(), array_contributions: { Array1: [0.5] } },
    { ...valid(), array_contributions: { Array1: [0], Array2: [0] } },
  ])("rejects invalid payload %#", (value) => {
    expect(() => parseSpectrum(value)).toThrow();
  });

  it("accepts empty spectra without manufacturing channels", () => {
    expect(parseSpectrum({
      wavelengths: [], flux: [], variance: [],
    }).wavelengths).toEqual([]);
  });

  it("uses backend attribution rather than frontend wavelength mapping", () => {
    const spectrum = parseSpectrum(valid());
    expect(sampleOwners(spectrum)).toEqual(["Array1", "Array2", "Array3"]);
    expect(visibleFlux(spectrum, new Set(["Array1", "Array3"])))
      .toEqual([0, null, 3]);
  });

  it("keeps unattributed samples visible", () => {
    const spectrum = parseSpectrum({
      wavelengths: [2],
      flux: [4],
      variance: [1],
    });
    expect(visibleFlux(spectrum, new Set())).toEqual([4]);
  });

  it("does not alter the input while filtering", () => {
    const spectrum = parseSpectrum(valid());
    visibleFlux(spectrum, new Set());
    expect(spectrum.flux).toEqual([0, -2, 3]);
    expect(visibleFlux(spectrum, new Set(ARRAY_IDS))).toEqual([0, -2, 3]);
  });

  it("exports source, epoch, native flux, and variance", () => {
    const csv = spectrumCSV(parseSpectrum(valid()), "qr3", "record", 60300);
    expect(csv).toContain('"SPHEREx QR3","record",60300,"Array2",1.4,-2,4');
    expect(csv.split("\r\n")).toHaveLength(4);
  });

  it("escapes CSV identifiers and neutralizes spreadsheet formulas", () => {
    const csv = spectrumCSV(parseSpectrum(valid()), "synthetic", '=A1"test', 60300);
    expect(csv).toContain(`"'=A1""test"`);
    expect(csv).toContain('"SYNTHETIC"');
  });

  it("provides all four reference markers without detection labels", () => {
    expect(FEATURES.map((feature) => feature.wavelength))
      .toEqual([1.66, 3.05, 4.27, 4.67]);
  });
});