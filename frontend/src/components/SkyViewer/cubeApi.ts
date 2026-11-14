import type { ObservationRecord } from "../../types/cids";
import type {
  CubeDisplayOptions,
  CubeRenderResponse,
} from "../../types/cubeRender";
import type { CubeAxis, DataSource } from "../../types/cids";

const MAX_REQUEST_BYTES = 48 * 1024 * 1024;
const MAX_FITS_BYTES = 32 * 1024 * 1024;
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

function base64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 32768) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + 32768)));
  }
  return btoa(chunks.join(""));
}

function finiteArray(array: Float32Array): Array<number | null> {
  return Array.from(array, (value) => Number.isFinite(value) ? value : null);
}

async function readLimited(
  response: Response,
  limit: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    throw new Error("The FITS cutout exceeds the 32 MiB limit.");
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > limit) throw new Error("The FITS cutout is too large.");
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("The FITS cutout exceeds the 32 MiB limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function prepareFrame(
  record: ObservationRecord,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const { fits_hdus: hdus, ...metadata } = record;
  if (hdus) {
    return {
      record: metadata,
      hdus: {
        science: finiteArray(hdus.hdu1_science),
        variance: hdus.hdu2_variance ? finiteArray(hdus.hdu2_variance) : null,
        mask: hdus.hdu3_mask ? Array.from(hdus.hdu3_mask) : null,
        header: hdus.hdu0_header,
      },
    };
  }

  if (!record.fits_url) {
    throw new Error(`Observation ${record.id} has neither loaded HDUs nor a FITS URL.`);
  }
  const url = new URL(record.fits_url, window.location.href);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Only HTTP(S) FITS URLs are supported.");
  }
  if (url.origin !== window.location.origin && url.protocol !== "https:") {
    throw new Error("Remote FITS downloads must use HTTPS.");
  }

  const response = await fetch(url, {
    signal,
    credentials: url.origin === window.location.origin ? "same-origin" : "omit",
    headers: { Accept: "application/fits, application/octet-stream" },
  });
  if (!response.ok) {
    throw new Error(`FITS download for ${record.id} failed: HTTP ${response.status}.`);
  }
  const bytes = await readLimited(response, MAX_FITS_BYTES, signal);
  return { record: metadata, fits_base64: base64(bytes) };
}

function validateResponse(
  value: unknown,
  records: ObservationRecord[],
  source: DataSource,
  axis: CubeAxis,
): CubeRenderResponse {
  const result = value as CubeRenderResponse;
  const count = records.length;
  if (
    !result ||
    result.metadata?.source !== source ||
    result.metadata?.axis !== axis ||
    result.frames?.length !== count ||
    result.record_ids?.length !== count ||
    !Number.isInteger(result.texture_width) ||
    !Number.isInteger(result.texture_height) ||
    result.texture_width < 2 ||
    result.texture_height < 2 ||
    result.texture_width > 128 ||
    result.texture_height > 128 ||
    result.metadata?.slices?.length !== count ||
    result.cube?.z_positions?.length !== count
  ) {
    throw new Error("The backend returned an inconsistent cube response.");
  }

  const expected = new Set(records.map((record) => record.id));
  if (
    new Set(result.record_ids).size !== count ||
    result.record_ids.some((id) => !expected.has(id)) ||
    result.frames.some((frame, index) => frame.record_id !== result.record_ids[index])
  ) {
    throw new Error("The cube response contains unexpected observation IDs.");
  }

  const sphere = result.sphere;
  if (
    !sphere ||
    !Array.isArray(sphere.positions) ||
    sphere.positions.length < 12 ||
    sphere.positions.length > 25 * 25 * 3 ||
    sphere.positions.length % 3 !== 0 ||
    sphere.uv?.length !== (sphere.positions.length / 3) * 2 ||
    !Array.isArray(sphere.indices) ||
    sphere.indices.length % 3 !== 0 ||
    sphere.center?.length !== 3 ||
    sphere.north?.length !== 3 ||
    !Number.isFinite(sphere.angular_radius_rad) ||
    sphere.angular_radius_rad <= 0
  ) {
    throw new Error("The backend returned invalid celestial geometry.");
  }
  const vertexCount = sphere.positions.length / 3;
  if (
    [...sphere.positions, ...sphere.uv, ...sphere.center, ...sphere.north,
      ...result.cube.z_positions, result.cube.width, result.cube.height]
      .some((number) => !Number.isFinite(number)) ||
    sphere.indices.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= vertexCount,
    )
  ) {
    throw new Error("The backend geometry contains invalid numeric values.");
  }

  const expectedTextureBytes = result.texture_width * result.texture_height * 4;
  for (const frame of result.frames) {
    if (atob(frame.rgba_base64).length !== expectedTextureBytes) {
      throw new Error("A cube texture has an invalid byte length.");
    }
  }
  return result;
}

export async function fetchCubeRender(
  records: ObservationRecord[],
  anchorId: string,
  axis: CubeAxis,
  source: DataSource,
  display: CubeDisplayOptions,
  signal: AbortSignal,
): Promise<CubeRenderResponse> {
  const frames: Record<string, unknown>[] = new Array(records.length);
  let cursor = 0;
  let serializedSize = 0;

  async function worker() {
    while (cursor < records.length) {
      const index = cursor++;
      const frame = await prepareFrame(records[index], signal);
      serializedSize += new TextEncoder().encode(JSON.stringify(frame)).length;
      if (serializedSize > MAX_REQUEST_BYTES - 4096) {
        throw new Error("This cube exceeds 48 MiB. Request smaller FITS cutouts.");
      }
      frames[index] = frame;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(3, records.length) }, () => worker()),
  );
  const colormap = ["inferno", "viridis", "gray"].includes(display.colormap)
    ? display.colormap
    : "inferno";
  const body = JSON.stringify({
    axis,
    source,
    anchor_id: anchorId,
    frames,
    size: 96,
    stretch: display.stretch,
    colormap,
    contrast_low: display.contrastLow,
    contrast_high: display.contrastHigh,
  });
  if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) {
    throw new Error("This cube exceeds the request size limit.");
  }

  const response = await fetch(`${API_BASE}/cube/render`, {
    method: "POST",
    signal,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : `Cube registration failed: HTTP ${response.status}.`,
    );
  }
  return validateResponse(await response.json(), records, source, axis);
}