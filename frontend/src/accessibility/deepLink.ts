import type { DataSource } from "../types/cids";

export interface DeepLinkState {
  ra: number;
  dec: number;
  fov: number;
  source: DataSource;
  epoch: number;
  embed: boolean;
}

export type DeepLinkResult =
  | { ok: true; state: DeepLinkState }
  | { ok: false; errors: string[] };

const SOURCES: readonly DataSource[] = [
  "qr3",
  "synthetic",
  "mast",
  "vizier",
];

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function isDataSource(value: string): value is DataSource {
  return SOURCES.some((source) => source === value);
}

export function validateDeepLink(state: DeepLinkState): string[] {
  const errors: string[] = [];

  if (!Number.isFinite(state.ra) || state.ra < 0 || state.ra >= 360) {
    errors.push("Right Ascension must be at least 0 and less than 360 degrees.");
  }
  if (!Number.isFinite(state.dec) || state.dec < -90 || state.dec > 90) {
    errors.push("Declination must be between −90 and 90 degrees.");
  }
  if (!Number.isFinite(state.fov) || state.fov <= 0 || state.fov > 5) {
    errors.push("Field of view must be greater than 0 and at most 5 degrees.");
  }
  if (!isDataSource(state.source)) {
    errors.push("Source must be qr3, synthetic, mast, or vizier.");
  }
  if (!Number.isSafeInteger(state.epoch) || state.epoch < 0) {
    errors.push("Epoch must be a non-negative integer observation index.");
  }
  if (typeof state.embed !== "boolean") {
    errors.push("Embed must be true or false.");
  }

  return errors;
}

export function parseDeepLink(
  search: string,
  defaults: DeepLinkState,
): DeepLinkResult {
  const params = new URLSearchParams(search);
  const errors: string[] = [];

  const single = (name: string): string | undefined => {
    const values = params.getAll(name);
    if (values.length > 1) {
      errors.push(`The ${name} parameter must appear only once.`);
    }
    return values[0];
  };

  const number = (name: string, fallback: number): number => {
    const raw = single(name);
    if (raw === undefined) return fallback;
    if (!DECIMAL.test(raw)) {
      errors.push(`The ${name} parameter must be a decimal number.`);
      return Number.NaN;
    }
    return Number(raw);
  };

  const ra = number("ra", defaults.ra);
  const dec = number("dec", defaults.dec);
  const fov = number("fov", defaults.fov);
  const epoch = number("epoch", defaults.epoch);
  const sourceText = single("source") ?? defaults.source;
  const embedText = single("embed");

  if (!isDataSource(sourceText)) {
    errors.push("Source must be qr3, synthetic, mast, or vizier.");
  }
  if (
    embedText !== undefined &&
    embedText !== "true" &&
    embedText !== "false"
  ) {
    errors.push("The embed parameter must be true or false.");
  }

  if (errors.length > 0 || !isDataSource(sourceText)) {
    return { ok: false, errors };
  }

  const state: DeepLinkState = {
    ra,
    dec,
    fov,
    epoch,
    source: sourceText,
    embed: embedText === undefined ? defaults.embed : embedText === "true",
  };

  const validation = validateDeepLink(state);
  return validation.length > 0
    ? { ok: false, errors: validation }
    : { ok: true, state };
}

export function createDeepLink(
  base: string,
  state: DeepLinkState,
): string {
  const errors = validateDeepLink(state);
  if (errors.length > 0) throw new Error(errors.join(" "));

  const url = new URL(base);
  url.searchParams.set("ra", String(state.ra));
  url.searchParams.set("dec", String(state.dec));
  url.searchParams.set("fov", String(state.fov));
  url.searchParams.set("source", state.source);
  url.searchParams.set("epoch", String(state.epoch));
  url.searchParams.set("embed", String(state.embed));

  // Playback is deliberately excluded from the public share contract.
  url.searchParams.delete("play");
  url.searchParams.delete("playing");
  url.searchParams.delete("isPlaying");
  url.searchParams.delete("autoplay");
  url.searchParams.delete("fps");

  return url.toString();
}