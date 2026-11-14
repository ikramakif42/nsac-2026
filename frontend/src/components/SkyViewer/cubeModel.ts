import type {
  CubeAxis,
  DataSource,
  ObservationRecord,
} from "../../types/cids";

export const SOURCE_LABELS: Record<DataSource, string> = {
  qr3: "SPHEREx QR3",
  synthetic: "SYNTHETIC",
  mast: "MAST",
  vizier: "VizieR",
  wiseview: "WiseView",
  gaia: "Gaia DR3",
};

export const MAX_CUBE_FRAMES = 128;
export const MIN_FRAME_INTERVAL_MS = 1000 / 3;

export function safeFps(value: number): number {
  return Number.isFinite(value) ? Math.min(3, Math.max(0.1, value)) : 0.5;
}

export function frameIndex(value: number, count: number): number {
  if (count <= 0 || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(value)));
}

/** Selection uses observation metadata only; no celestial transforms occur here. */
export function selectCubeRecords(
  records: ObservationRecord[],
  anchorId: string,
  axis: CubeAxis,
  source: DataSource,
): ObservationRecord[] {
  const anchor = records.find(
    (record) => record.id === anchorId && record.source === source,
  );
  if (!anchor) throw new Error("Choose an anchor observation from the active source.");

  const selected = records.filter((record) => {
    if (record.source !== source) return false;
    if (axis === "time") {
      return (
        record.band === anchor.band &&
        record.array_id === anchor.array_id &&
        Math.abs(record.wavelength_um - anchor.wavelength_um) <=
          1e-8 + 1e-7 * Math.abs(anchor.wavelength_um)
      );
    }
    return Math.abs(record.epoch_mjd - anchor.epoch_mjd) <= 1e-7;
  });

  const coordinate = (record: ObservationRecord) =>
    axis === "time" ? record.epoch_mjd : record.wavelength_um;

  selected.sort(
    (a, b) => coordinate(a) - coordinate(b) || a.id.localeCompare(b.id),
  );

  if (selected.length > MAX_CUBE_FRAMES) {
    throw new Error(
      `This selection contains ${selected.length} slices; narrow it to at most ${MAX_CUBE_FRAMES}.`,
    );
  }
  if (new Set(selected.map((record) => coordinate(record))).size !== selected.length) {
    throw new Error(
      "Multiple observations occupy the same epoch/channel. Select one exposure per axis coordinate.",
    );
  }
  return selected;
}

export function wheelPixels(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  if (!Number.isFinite(deltaY)) return 0;
  const scale = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1;
  return Math.max(-240, Math.min(240, deltaY * scale));
}

export class SliceGate {
  private last = Number.NEGATIVE_INFINITY;

  accept(now: number): boolean {
    if (!Number.isFinite(now) || now - this.last < MIN_FRAME_INTERVAL_MS) {
      return false;
    }
    this.last = now;
    return true;
  }
}