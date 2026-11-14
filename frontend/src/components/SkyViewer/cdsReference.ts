import type { CDSOverlay, WCSParameters } from "../../types/cids";

export type SupportedOverlay = Exclude<CDSOverlay, "none" | "panstarrs">;

export const OVERLAY_LABELS: Record<SupportedOverlay, string> = {
  "2mass": "2MASS J/H/Ks",
  allwise: "AllWISE W1/W2",
  gaia_dr3: "Gaia DR3",
};

export interface ReferenceRequest {
  overlay: SupportedOverlay;
  wcs?: WCSParameters;
  ra: number;
  dec: number;
  fov_deg: number;
  width: number;
  height: number;
}

export interface ReferenceMetadata {
  overlay: SupportedOverlay;
  survey: string;
  hips_url: string;
  provider: string;
  width: number;
  height: number;
  pixel_origin: string;
  wcs_header: Record<string, string | number>;
  links: {
    simbad: string;
    vizier: string;
    aladin: string;
  };
  warning: string;
}

export function supportedOverlay(value: unknown): value is SupportedOverlay {
  return value === "2mass" || value === "allwise" || value === "gaia_dr3";
}

export function readOverlay(search: string): CDSOverlay {
  const value = new URLSearchParams(search).get("overlay");
  return supportedOverlay(value) ? value : "none";
}

export function overlayURL(href: string, overlay: CDSOverlay): URL {
  const url = new URL(href);
  if (overlay === "none") url.searchParams.delete("overlay");
  else url.searchParams.set("overlay", overlay);
  return url;
}

export async function checkedResponse(response: Response): Promise<Response> {
  if (response.ok) return response;
  let message = `CDS request failed (${response.status}).`;
  try {
    const body: unknown = await response.json();
    if (
      body !== null &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
    ) {
      message = body.detail;
    }
  } catch {
    // A non-JSON upstream response retains the HTTP status message.
  }
  throw new Error(message);
}

/**
 * Display-only grayscale stretch. No WCS, coordinates, quality classification,
 * SNR, or photometry is calculated here.
 *
 * Array rows use FITS ordering; browser image rows run in the opposite direction.
 */
export function scienceRGBA(
  science: Float32Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 2048 ||
    height > 2048 ||
    science.length !== width * height
  ) {
    throw new Error("Science pixels do not match the reference image dimensions.");
  }

  const sample: number[] = [];
  const stride = Math.max(1, Math.floor(science.length / 32768));
  for (let i = 0; i < science.length; i += stride) {
    if (Number.isFinite(science[i])) sample.push(science[i]);
  }
  sample.sort((a, b) => a - b);
  const low = sample[Math.floor(sample.length * 0.01)] ?? 0;
  const high = sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.99))] ?? 1;
  const span = high > low ? high - low : 1;
  const output = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = science[(height - 1 - y) * width + x];
      const offset = (y * width + x) * 4;
      if (!Number.isFinite(value)) continue;
      const normalized = Math.max(0, Math.min(1, (value - low) / span));
      const shade = Math.round(255 * Math.asinh(10 * normalized) / Math.asinh(10));
      output[offset] = shade;
      output[offset + 1] = shade;
      output[offset + 2] = shade;
      output[offset + 3] = 255;
    }
  }
  return output;
}