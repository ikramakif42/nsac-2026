import type { DataSource, SearchQuery } from "../types/cids";

export const SOURCE_LABELS: Record<DataSource, string> = {
  qr3: "SPHEREx QR3",
  synthetic: "SYNTHETIC",
  wiseview: "WiseView",
  gaia: "ESA Gaia DR3",
  mast: "MAST",
  vizier: "VizieR",
};

const SOURCES = new Set<string>(Object.keys(SOURCE_LABELS));

export interface ExploreLocation {
  query: SearchQuery;
  epoch: number;
  embed: boolean;
}

function numericParameter(
  params: URLSearchParams,
  name: string,
  fallback: number,
): number {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (raw.trim() === "") throw new Error(`${name} must not be empty.`);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return value;
}

export function validateSearchQuery(
  query: SearchQuery,
  fallbackSource: DataSource = "qr3",
): SearchQuery {
  if (!Number.isFinite(query.ra) || query.ra < 0 || query.ra >= 360) {
    throw new Error("RA must be in [0, 360) degrees.");
  }
  if (!Number.isFinite(query.dec) || query.dec < -90 || query.dec > 90) {
    throw new Error("Declination must be in [-90, 90] degrees.");
  }

  const radius = query.radius_arcsec ?? 30;
  if (!Number.isFinite(radius) || radius < 1 || radius > 18000) {
    throw new Error("Search radius must be between 1 and 18000 arcseconds.");
  }

  const source = query.source ?? fallbackSource;
  if (!SOURCES.has(source)) throw new Error("Unsupported data source.");

  if (query.epoch_range) {
    const [start, end] = query.epoch_range;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
      throw new Error("Epoch range must contain finite, ordered MJD values.");
    }
  }

  return { ...query, radius_arcsec: radius, source };
}

export function parseExploreLocation(
  params: URLSearchParams,
  defaultSource: DataSource = "qr3",
): ExploreLocation {
  const source = params.get("source") ?? defaultSource;
  if (!SOURCES.has(source)) throw new Error("Unsupported data source.");

  const fov = numericParameter(params, "fov", 5);
  const epoch = numericParameter(params, "epoch", 0);
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new Error("Epoch must be a nonnegative integer frame index.");
  }

  return {
    query: validateSearchQuery({
      ra: numericParameter(params, "ra", 269.4521),
      dec: numericParameter(params, "dec", 4.6934),
      radius_arcsec: fov * 1800,
      source: source as DataSource,
    }),
    epoch,
    embed: params.get("embed") === "true",
  };
}

export function writeExploreLocation(
  previous: URLSearchParams,
  query: SearchQuery,
  epoch: number,
): URLSearchParams {
  const validated = validateSearchQuery(query);
  const next = new URLSearchParams(previous);
  next.set("ra", String(validated.ra));
  next.set("dec", String(validated.dec));
  next.set("fov", String(validated.radius_arcsec! / 1800));
  next.set("source", validated.source!);
  next.set("epoch", String(Math.max(0, Math.trunc(epoch))));
  return next;
}

export function boundEpoch(epoch: number, count: number): number {
  if (!Number.isFinite(epoch) || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(epoch)));
}

export function assertObservationSourceAvailable(source: DataSource): void {
  if (source === "gaia" || source === "wiseview") {
    throw new Error(
      `${SOURCE_LABELS[source]} observation playback is disabled: the supplied ` +
      "connector generates unverified observations rather than retrieving measured " +
      "archive products. Use its catalog/HiPS overlay separately, or explicitly " +
      "select SYNTHETIC.",
    );
  }
}