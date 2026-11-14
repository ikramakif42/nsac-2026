import type {
  ArrayId,
  DataSource,
  SpectrumResponse,
} from "../../types/cids";

export const ARRAY_IDS: ArrayId[] = [
  "Array1",
  "Array2",
  "Array3",
  "Array4",
  "Array5",
  "Array6",
];

export const SOURCE_LABELS: Record<DataSource, string> = {
  qr3: "SPHEREx QR3",
  synthetic: "SYNTHETIC",
  mast: "MAST",
  vizier: "VizieR",
  wiseview: "WiseView",
  gaia: "Gaia DR3",
};

export const FEATURES = [
  { wavelength: 1.66, label: "CH₄", color: "#c4b5fd" },
  { wavelength: 3.05, label: "H₂O ice", color: "#67e8f9" },
  { wavelength: 4.27, label: "CO₂ ice", color: "#fcd34d" },
  { wavelength: 4.67, label: "CO ice", color: "#fda4af" },
] as const;

function numericColumn(value: unknown, name: string): number[] {
  if (
    !Array.isArray(value) ||
    !value.every((item: unknown) =>
      typeof item === "number" && Number.isFinite(item)
    )
  ) {
    throw new Error(`Invalid spectrum ${name}`);
  }
  return value as number[];
}

/** Validate transport structure only; do not calibrate or resample science data. */
export function parseSpectrum(value: unknown): SpectrumResponse {
  if (value === null || typeof value !== "object") {
    throw new Error("Invalid spectrum response");
  }
  const input = value as Record<string, unknown>;
  const wavelengths = numericColumn(input.wavelengths, "wavelengths");
  const flux = numericColumn(input.flux, "flux");
  const variance = numericColumn(input.variance, "variance");

  if (
    wavelengths.length !== flux.length ||
    wavelengths.length !== variance.length
  ) {
    throw new Error("Spectrum columns have unequal lengths");
  }
  if (
    wavelengths.some((wavelength, index) =>
      wavelength <= 0 ||
      (index > 0 && wavelength <= wavelengths[index - 1])
    )
  ) {
    throw new Error("Spectrum wavelengths are not strictly increasing");
  }
  if (variance.some((value) => value < 0)) {
    throw new Error("Spectrum variance is negative");
  }

  let array_contributions: SpectrumResponse["array_contributions"];
  const raw = input.array_contributions;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Invalid detector contributions");
    }
    array_contributions = {};
    const assigned = new Set<number>();
    for (const [array, value] of Object.entries(raw)) {
      if (!ARRAY_IDS.includes(array as ArrayId)) {
        throw new Error("Unknown detector array");
      }
      const indices = numericColumn(value, "detector indices");
      for (const index of indices) {
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= wavelengths.length ||
          assigned.has(index)
        ) {
          throw new Error("Invalid or duplicate detector contribution");
        }
        assigned.add(index);
      }
      array_contributions[array] = indices;
    }
  }
  return { wavelengths, flux, variance, array_contributions };
}

export function sampleOwners(
  spectrum: SpectrumResponse,
): (ArrayId | null)[] {
  const owners: (ArrayId | null)[] = spectrum.wavelengths.map(() => null);
  for (const array of ARRAY_IDS) {
    for (const index of spectrum.array_contributions?.[array] ?? []) {
      owners[index] = array;
    }
  }
  return owners;
}

export function visibleFlux(
  spectrum: SpectrumResponse,
  enabled: ReadonlySet<ArrayId>,
): (number | null)[] {
  const owners = sampleOwners(spectrum);
  return spectrum.flux.map((flux, index) =>
    owners[index] === null || enabled.has(owners[index]!) ? flux : null
  );
}

export function spectrumCSV(
  spectrum: SpectrumResponse,
  source: DataSource,
  recordId: string,
  epochMjd: number,
): string {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const owners = sampleOwners(spectrum);
  const rows = [
    "source,record_id,epoch_mjd,array,wavelength_um,flux_backend_units,variance_backend_units_squared",
    ...spectrum.wavelengths.map((wavelength, index) =>
      [
        quote(SOURCE_LABELS[source]),
        // Neutralize spreadsheet formula interpretation of external identifiers.
        quote(/^[=+\-@\t\r]/.test(recordId) ? `'${recordId}` : recordId),
        epochMjd,
        quote(owners[index] ?? "unattributed"),
        wavelength,
        spectrum.flux[index],
        spectrum.variance[index],
      ].join(",")
    ),
  ];
  return rows.join("\r\n");
}