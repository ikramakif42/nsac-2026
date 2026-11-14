import type { RenderFrame } from "./renderFrame";
import type { ObservationRecord } from "../../types/cids";

/**
 * Generates a physically structured synthetic RenderFrame for demo and offline exploration
 * when backend FITS cutouts have not yet been fetched.
 * Includes stationary field stars, central target with proper motion drift across epochs,
 * and dual-epoch difference plane where stationary stars cancel out.
 */
export function getSyntheticRenderFrame(
  record: ObservationRecord,
  epochIndex: number,
  records: ObservationRecord[],
  lowPercentile: number = 1,
  highPercentile: number = 99,
): RenderFrame {
  const width = 128;
  const height = 128;
  const size = width * height;

  const intensity = new Array<number>(size).fill(0);
  const valid = new Array<number>(size).fill(1);
  const difference = new Array<number>(size).fill(0);
  const differenceValid = new Array<number>(size).fill(1);

  // 1. Seeded stationary background field stars
  const seed = Math.abs(Math.sin(record.ra_center * 12.9898 + record.dec_center * 78.233)) * 43758.5453;
  let s = seed % 1;
  const stars: { x: number; y: number; peak: number; sigma: number }[] = [];
  for (let i = 0; i < 20; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = Math.floor((s / 233280) * (width - 20) + 10);
    s = (s * 9301 + 49297) % 233280;
    const y = Math.floor((s / 233280) * (height - 20) + 10);
    s = (s * 9301 + 49297) % 233280;
    const peak = 0.3 + (s / 233280) * 0.5;
    stars.push({ x, y, peak, sigma: 1.5 });
  }

  // 2. Central target position with proper motion drift
  const maxEp = Math.max(1, records.length - 1);
  const normEpoch = epochIndex / maxEp; // 0 to 1
  const driftX = (normEpoch - 0.5) * 24.0;
  const driftY = -(normEpoch - 0.5) * 14.0;
  const targetX = width / 2 + driftX;
  const targetY = height / 2 + driftY;

  // Reference target position (epoch 0)
  const refNormEpoch = 0;
  const refDriftX = (refNormEpoch - 0.5) * 24.0;
  const refDriftY = -(refNormEpoch - 0.5) * 14.0;
  const refTargetX = width / 2 + refDriftX;
  const refTargetY = height / 2 + refDriftY;

  // 3. Render Gaussian PSFs into intensity & difference planes
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Subtle background noise
      let val = 0.04 + ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 0.02;

      // Draw stationary stars
      for (const star of stars) {
        const dx = x - star.x;
        const dy = y - star.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 25) {
          val += star.peak * Math.exp(-distSq / (2 * star.sigma * star.sigma));
        }
      }

      // Draw current target PSF
      const tdx = x - targetX;
      const tdy = y - targetY;
      const tDistSq = tdx * tdx + tdy * tdy;
      let targetVal = 0;
      if (tDistSq < 49) {
        targetVal = 0.95 * Math.exp(-tDistSq / (2 * 2.2 * 2.2));
        val += targetVal;
      }

      intensity[idx] = Math.min(1, Math.max(0, val));

      // In difference mode: stationary stars cancel out to 0!
      // Only moving target leaves positive (current) and negative (reference) signatures
      const rdx = x - refTargetX;
      const rdy = y - refTargetY;
      const rDistSq = rdx * rdx + rdy * rdy;
      let refVal = 0;
      if (rDistSq < 49) {
        refVal = 0.95 * Math.exp(-rDistSq / (2 * 2.2 * 2.2));
      }
      difference[idx] = Math.min(1, Math.max(-1, targetVal - refVal));
    }
  }

  const refRecord = records[0] ?? record;

  return {
    recordId: record.id,
    width,
    height,
    lowPercentile: Math.min(lowPercentile, highPercentile - 0.1),
    highPercentile,
    intensity,
    valid,
    referenceId: refRecord.id,
    difference,
    differenceValid,
    differenceScale: 1.0,
    differenceScaleMode: "per-frame",
    annotations: {
      north: [0, -1],
      east: [-1, 0],
      scalePixels: 32,
      scaleLabel: "1' arcmin",
    },
  };
}

