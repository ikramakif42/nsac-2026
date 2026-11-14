import type { ObservationRecord } from "../types/cids";
import type { QualityProducts } from "../types/quality";

const MAX_FITS_BYTES = 64 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 96 * 1024 * 1024;
const MAX_PIXELS = 1024 * 1024;

export function qualityRecordKey(
  record: Pick<ObservationRecord, "id" | "source" | "fits_url"> | null,
): string | null {
  return record
    ? JSON.stringify([record.id, record.source, record.fits_url])
    : null;
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid quality response object.");
  }
  return value as Record<string, unknown>;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableFinite(value: unknown): boolean {
  return value === null || finite(value);
}

function integer(value: unknown, low: number, high: number): value is number {
  return (
    finite(value) &&
    Number.isInteger(value) &&
    value >= low &&
    value <= high
  );
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function decodeBase64Bytes(
  encoded: string,
  expectedLength: number,
): Uint8Array {
  if (encoded.length !== 4 * Math.ceil(expectedLength / 3)) {
    throw new Error("Quality texture has an incorrect encoded length.");
  }

  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error("Quality texture contains invalid base64.");
  }

  if (binary.length !== expectedLength) {
    throw new Error("Quality texture has an incorrect byte length.");
  }

  const result = new Uint8Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}

/** Validate transport integrity, without recomputing scientific quantities. */
export function parseQualityProducts(
  value: unknown,
  identity: Pick<ObservationRecord, "id" | "source">,
): QualityProducts {
  const data = object(value);
  if (
    data.version !== 1 ||
    data.record_id !== identity.id ||
    data.source !== identity.source ||
    data.orientation !== "fits-row-zero-bottom" ||
    !integer(data.width, 1, 4096) ||
    !integer(data.height, 1, 4096)
  ) {
    throw new Error("Quality response identity or dimensions do not match.");
  }

  const pixels = data.width * data.height;
  if (pixels > MAX_PIXELS) {
    throw new Error("Quality response exceeds the supported image size.");
  }

  const summary = object(data.summary);
  const scienceDisplay = object(data.science_display);
  const snrDisplay = object(data.snr_display);

  if (
    !["pass", "warn", "fail"].includes(String(data.status)) ||
    typeof data.policy !== "string" ||
    typeof data.notes !== "string" ||
    !stringArray(data.flags_decoded) ||
    !nullableFinite(summary.snr) ||
    !integer(summary.quality_flags, 0, 65535) ||
    typeof summary.quality_ok !== "boolean" ||
    !integer(data.eligible_pixels, 0, pixels) ||
    !integer(data.rejected_pixels, 0, pixels) ||
    data.eligible_pixels + data.rejected_pixels !== pixels ||
    !finite(data.eligible_fraction) ||
    data.eligible_fraction < 0 ||
    data.eligible_fraction > 1 ||
    !Array.isArray(data.snr_map) ||
    data.snr_map.length !== pixels ||
    !data.snr_map.every(nullableFinite) ||
    scienceDisplay.stretch !== "asinh" ||
    !finite(scienceDisplay.percentile_low) ||
    !finite(scienceDisplay.percentile_high) ||
    !nullableFinite(scienceDisplay.low) ||
    !nullableFinite(scienceDisplay.high) ||
    !finite(snrDisplay.low) ||
    !finite(snrDisplay.high) ||
    snrDisplay.low >= snrDisplay.high ||
    snrDisplay.negative !== "blue" ||
    snrDisplay.zero !== "white" ||
    snrDisplay.positive !== "red"
  ) {
    throw new Error("Quality response contains invalid values.");
  }

  if (data.report !== null) {
    const report = object(data.report);
    if (
      !["pass", "warn", "fail"].includes(String(report.status)) ||
      !finite(report.snr) ||
      !stringArray(report.flags_decoded) ||
      typeof report.notes !== "string"
    ) {
      throw new Error("Quality response contains an invalid CIDS report.");
    }
  }

  for (const name of ["science_rgba_base64", "snr_rgba_base64"] as const) {
    if (typeof data[name] !== "string") {
      throw new Error("Quality response is missing a display texture.");
    }
    decodeBase64Bytes(data[name], pixels * 4);
  }

  if (typeof data.eligible_base64 !== "string") {
    throw new Error("Quality response is missing its eligibility map.");
  }
  const eligibility = decodeBase64Bytes(data.eligible_base64, pixels);
  if (!eligibility.every((item) => item === 0 || item === 1)) {
    throw new Error("Quality response contains an invalid eligibility map.");
  }

  return value as QualityProducts;
}

async function readBounded(
  response: Response,
  maximum: number,
): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0 || length > maximum) {
      await response.body?.cancel();
      throw new Error("Response exceeds the permitted transfer size.");
    }
  }

  if (!response.body) {
    throw new Error("The server returned no readable response body.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new Error("Response exceeds the permitted transfer size.");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function serverError(response: Response): Promise<string> {
  try {
    const bytes = await readBounded(response, 64 * 1024);
    const payload = object(JSON.parse(new TextDecoder().decode(bytes)));
    if (typeof payload.detail === "string") return payload.detail;
  } catch {
    // The HTTP status remains useful when an intermediary returns non-JSON.
  }
  return `Quality request failed with HTTP ${response.status}.`;
}

export async function fetchQualityProducts(
  record: Pick<ObservationRecord, "id" | "source" | "fits_url">,
  signal: AbortSignal,
): Promise<QualityProducts> {
  if (!record.fits_url.trim()) {
    throw new Error("This record has no FITS URL. Quality is unavailable.");
  }

  const url = new URL(record.fits_url, window.location.href);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("The FITS URL must be an HTTP(S) URL without credentials.");
  }
  if (window.location.protocol === "https:" && url.protocol !== "https:") {
    throw new Error("An HTTPS page cannot inspect an insecure FITS URL.");
  }

  const fitsResponse = await fetch(url.href, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/fits, image/fits, application/octet-stream" },
  });
  if (!fitsResponse.ok) {
    throw new Error(`FITS download failed with HTTP ${fitsResponse.status}.`);
  }

  // Transport only: all FITS interpretation happens in Astropy.
  const fitsBytes = await readBounded(fitsResponse, MAX_FITS_BYTES);
  if (fitsBytes.length === 0) {
    throw new Error("The FITS download was empty.");
  }

  const params = new URLSearchParams({
    record_id: record.id,
    source: record.source,
  });
  const response = await fetch(`/api/quality?${params.toString()}`, {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: {
      "Content-Type": "application/fits",
      Accept: "application/json",
    },
    body: new Blob([new Uint8Array(fitsBytes)], {
      type: "application/fits",
    }),
  });

  if (!response.ok) {
    throw new Error(await serverError(response));
  }

  const raw = await readBounded(response, MAX_RESPONSE_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("The quality endpoint did not return valid JSON.");
  }
  return parseQualityProducts(parsed, record);
}