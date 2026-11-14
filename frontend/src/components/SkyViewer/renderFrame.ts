export interface RenderAnnotations {
  /** Backend-derived unit directions in screen coordinates. */
  north: [number, number];
  east: [number, number];
  scalePixels: number;
  scaleLabel: string;
}

export interface RenderFrame {
  recordId: string;
  width: number;
  height: number;
  lowPercentile: number;
  highPercentile: number;
  intensity: number[];
  valid: number[];
  referenceId: string | null;
  difference: number[] | null;
  differenceValid: number[] | null;
  differenceScale: number | null;
  differenceScaleMode?: "per-frame" | "shared";
  annotations?: RenderAnnotations;
}

export type Stretch = "linear" | "sqrt" | "log" | "asinh";

export interface RenderStyle {
  stretch: Stretch;
  colormap: string;
  difference: boolean;
}

export const MAX_FRAME_RATE = 3;
export const MIN_FRAME_INTERVAL_MS = 1000 / MAX_FRAME_RATE;
export const MAX_RENDER_PIXELS = 16_777_216;

export function safeFps(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_FRAME_RATE, Math.max(0.1, value))
    : 0.5;
}

export function boundedIndex(value: number, count: number): number {
  if (!Number.isFinite(value) || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(value)));
}

export function nextDrawDelay(now: number, lastDraw: number): number {
  return Math.max(0, MIN_FRAME_INTERVAL_MS - (now - lastDraw));
}

export function wheelPixels(
  deltaY: number,
  deltaMode: number,
  pageHeight: number,
): number {
  if (!Number.isFinite(deltaY)) return 0;
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * Math.max(1, pageHeight);
  return deltaY;
}

export class WheelAccumulator {
  private residual = 0;

  push(pixels: number): number {
    if (!Number.isFinite(pixels)) return 0;
    this.residual += pixels;
    const steps = Math.trunc(this.residual / 80);
    this.residual -= steps * 80;
    return steps === 0 ? 0 : steps;
  }

  reset(): void {
    this.residual = 0;
  }
}

function validatePlane(
  values: number[],
  mask: number[],
  size: number,
  signed: boolean,
): void {
  if (!Array.isArray(values) || !Array.isArray(mask)) {
    throw new Error("Render pixels and validity must be JSON arrays.");
  }
  if (values.length !== size || mask.length !== size) {
    throw new Error("Render plane dimensions do not match its pixel arrays.");
  }

  for (let i = 0; i < size; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value) || value < (signed ? -1 : 0) || value > 1) {
      throw new Error("Render pixels must be finite backend-normalized values.");
    }
    if (mask[i] !== 0 && mask[i] !== 1) {
      throw new Error("Render validity must contain only 0 or 1.");
    }
  }
}

export function validateRenderFrame(
  frame: RenderFrame,
  expectedRecordId: string,
): RenderFrame {
  if (frame.recordId !== expectedRecordId) {
    throw new Error("Render product belongs to a different observation.");
  }

  if (
    !Number.isSafeInteger(frame.width) ||
    !Number.isSafeInteger(frame.height) ||
    frame.width <= 0 ||
    frame.height <= 0 ||
    frame.width * frame.height > MAX_RENDER_PIXELS
  ) {
    throw new Error("Render product has invalid or unsupported dimensions.");
  }

  if (
    !Number.isFinite(frame.lowPercentile) ||
    !Number.isFinite(frame.highPercentile) ||
    frame.lowPercentile < 0 ||
    frame.lowPercentile >= frame.highPercentile ||
    frame.highPercentile > 100
  ) {
    throw new Error("Render product has invalid percentile metadata.");
  }

  const size = frame.width * frame.height;
  validatePlane(frame.intensity, frame.valid, size, false);

  const fields = [
    frame.referenceId,
    frame.difference,
    frame.differenceValid,
    frame.differenceScale,
  ];
  const noDifference = fields.every((value) => value === null);
  if (!noDifference) {
    if (
      typeof frame.referenceId !== "string" ||
      !frame.referenceId.trim() ||
      frame.difference === null ||
      frame.differenceValid === null ||
      typeof frame.differenceScale !== "number" ||
      !Number.isFinite(frame.differenceScale) ||
      frame.differenceScale < 0
    ) {
      throw new Error("Difference product is incomplete or invalid.");
    }

    validatePlane(frame.difference, frame.differenceValid, size, true);

    if (
      frame.differenceScale === 0 &&
      frame.difference.some((value) => value !== 0)
    ) {
      throw new Error("A zero-scale difference product must contain only zeros.");
    }
  }

  if (
    frame.differenceScaleMode !== undefined &&
    frame.differenceScaleMode !== "per-frame" &&
    frame.differenceScaleMode !== "shared"
  ) {
    throw new Error("Unknown difference scaling mode.");
  }

  const annotations = frame.annotations;
  if (annotations) {
    for (const direction of [annotations.north, annotations.east]) {
      if (
        !Array.isArray(direction) ||
        direction.length !== 2 ||
        !direction.every(Number.isFinite) ||
        Math.abs(Math.hypot(...direction) - 1) > 0.001
      ) {
        throw new Error("Invalid backend compass annotation.");
      }
    }
    if (
      !Number.isFinite(annotations.scalePixels) ||
      annotations.scalePixels <= 0 ||
      typeof annotations.scaleLabel !== "string" ||
      !annotations.scaleLabel.trim()
    ) {
      throw new Error("Invalid backend scale annotation.");
    }
  }

  return frame;
}

/** Packing only: no WCS, percentile, subtraction, mask policy, or SNR math. */
export function packRenderPlane(
  frame: RenderFrame,
  difference: boolean,
): Float32Array {
  const values = difference ? frame.difference : frame.intensity;
  const mask = difference ? frame.differenceValid : frame.valid;
  if (!values || !mask) {
    throw new Error("A backend difference product is required.");
  }

  const packed = new Float32Array(values.length * 2);
  for (let i = 0; i < values.length; i += 1) {
    packed[i * 2] = values[i];
    packed[i * 2 + 1] = mask[i];
  }
  return packed;
}