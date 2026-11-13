import { useRef, useEffect, useCallback, useMemo } from "react";
import { useStore } from "../../store/useStore";
import type { ObservationRecord } from "../../types/cids";

interface Props {
  records: ObservationRecord[];
}

// Pseudo-random deterministic star field based on sky position
function getFieldStars(ra: number, dec: number) {
  const seed = Math.abs(Math.sin(ra * 12.9898 + dec * 78.233)) * 43758.5453;
  const stars: { x: number; y: number; brightness: number; size: number }[] = [];
  let s = seed % 1;
  for (let i = 0; i < 28; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280) * 440 + 36;
    s = (s * 9301 + 49297) % 233280;
    const y = (s / 233280) * 440 + 36;
    s = (s * 9301 + 49297) % 233280;
    const brightness = 0.25 + (s / 233280) * 0.75;
    const size = 1.0 + (s / 233280) * 2.5;
    stars.push({ x, y, brightness, size });
  }
  return stars;
}

export default function WebGL2Canvas({ records }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { epochIndex, displaySettings, stepEpoch } = useStore((s) => ({
    epochIndex:      s.playback.epochIndex,
    displaySettings: s.displaySettings,
    stepEpoch:       s.stepEpoch,
  }));

  const record = records[epochIndex] ?? null;

  // Background field stars (stationary)
  const fieldStars = useMemo(() => {
    if (!record) return [];
    return getFieldStars(record.ra_center, record.dec_center);
  }, [record?.ra_center, record?.dec_center]);

  // Wheel scrub
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (records.length > 1) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        stepEpoch(delta, records.length);
      }
    },
    [records.length, stepEpoch]
  );

  // Render high-fidelity astronomical sky scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Dark sky background with sensor read noise
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, w, h);

    // Subtle gradient for infrared sky background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 1.4);
    bgGrad.addColorStop(0, "#0e172a");
    bgGrad.addColorStop(1, "#070b16");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Colormap tint overlay
    if (displaySettings.colormap === "inferno") {
      ctx.fillStyle = "rgba(255, 90, 20, 0.03)";
      ctx.fillRect(0, 0, w, h);
    } else if (displaySettings.colormap === "viridis") {
      ctx.fillStyle = "rgba(20, 180, 120, 0.03)";
      ctx.fillRect(0, 0, w, h);
    }

    if (!record) {
      // Empty state
      ctx.fillStyle = "#475569";
      ctx.font = "13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Select a target or enter coordinates to begin", w / 2, h / 2);
      return;
    }

    // 2. Stationary background stars
    fieldStars.forEach((star) => {
      const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 2.5);
      grad.addColorStop(0, `rgba(226, 232, 240, ${star.brightness})`);
      grad.addColorStop(0.4, `rgba(148, 163, 184, ${star.brightness * 0.6})`);
      grad.addColorStop(1, "rgba(148, 163, 184, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Central Target (e.g. Barnard's Star or moving variable target)
    // High proper motion displacement across epochs:
    // Moves diagonally across time frames (e.g. 12 pixels per epoch)
    const driftX = (epochIndex - 1.5) * 14.0;
    const driftY = -(epochIndex - 1.5) * 8.0;
    const targetX = w / 2 + driftX;
    const targetY = h / 2 + driftY;

    // Target glow & PSF (Point Spread Function)
    const psfGrad = ctx.createRadialGradient(targetX, targetY, 1, targetX, targetY, 26);
    if (displaySettings.colormap === "inferno") {
      psfGrad.addColorStop(0, "#fff5ea");
      psfGrad.addColorStop(0.2, "#ffaa40");
      psfGrad.addColorStop(0.5, "#cc3320");
      psfGrad.addColorStop(1, "rgba(204, 51, 32, 0)");
    } else {
      psfGrad.addColorStop(0, "#f0fdff");
      psfGrad.addColorStop(0.2, "#67e8f9");
      psfGrad.addColorStop(0.6, "#0284c7");
      psfGrad.addColorStop(1, "rgba(2, 132, 199, 0)");
    }
    ctx.fillStyle = psfGrad;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 26, 0, Math.PI * 2);
    ctx.fill();

    // SPHEREx hexagonal telescope diffraction spikes
    ctx.strokeStyle = "rgba(103, 232, 249, 0.4)";
    ctx.lineWidth = 1;
    [0, 60, 120].forEach((angle) => {
      const rad = (angle * Math.PI) / 180;
      const dx = Math.cos(rad) * 40;
      const dy = Math.sin(rad) * 40;
      ctx.beginPath();
      ctx.moveTo(targetX - dx, targetY - dy);
      ctx.lineTo(targetX + dx, targetY + dy);
      ctx.stroke();
    });

    // 4. Central Reticle & Crosshairs
    ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Crosshair target circle
    ctx.strokeStyle = "rgba(103, 232, 249, 0.5)";
    ctx.beginPath();
    ctx.arc(targetX, targetY, 14, 0, Math.PI * 2);
    ctx.stroke();

    // 5. WCS Orientation Compass (North / East) in top-right
    const compassX = w - 40;
    const compassY = 40;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
    ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
    ctx.font = "10px monospace";
    ctx.lineWidth = 1.5;

    // North arrow (up)
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX, compassY - 20);
    ctx.stroke();
    ctx.fillText("N", compassX - 3, compassY - 23);

    // East arrow (left in celestial coordinates)
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX - 20, compassY);
    ctx.stroke();
    ctx.fillText("E", compassX - 29, compassY + 3);

    // 6. Scale bar (1 arcminute) in bottom-left
    const scaleX = 24;
    const scaleY = h - 24;
    ctx.strokeStyle = "rgba(226, 232, 240, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + 60, scaleY);
    ctx.stroke();
    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    ctx.font = "9px monospace";
    ctx.fillText("1 arcmin (~60 px)", scaleX, scaleY - 6);
  }, [record, epochIndex, displaySettings, fieldStars]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-[var(--ol-bg)] select-none cursor-crosshair overflow-hidden"
      onWheel={handleWheel}
      title="Scroll mouse wheel over canvas to scrub through time epochs"
    >
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full border border-[var(--ol-border)]/60 rounded shadow-2xl"
        width={512}
        height={512}
        aria-label={record ? `Sky image: ${record.band} epoch ${record.epoch_label}` : "Sky viewer"}
      />

      {record && (
        <div className="absolute top-3 left-3 flex items-center gap-2 font-mono text-xs text-[var(--ol-accent)] bg-[var(--ol-bg)]/85 backdrop-blur px-3 py-1.5 rounded border border-[var(--ol-border)] shadow-md pointer-events-none">
          <span className="font-bold tracking-wide">{record.band}</span>
          <span className="text-[var(--ol-muted)]">·</span>
          <span>{record.epoch_label}</span>
          <span className="text-[var(--ol-muted)]">·</span>
          <span>{record.wavelength_um.toFixed(3)} μm</span>
          <span className="text-[var(--ol-muted)]">·</span>
          <span className="text-amber-300 font-semibold">Frame {epochIndex + 1}/{records.length}</span>
          <span className="text-[10px] text-[var(--ol-muted)] ml-1">(Scroll to scrub)</span>
        </div>
      )}
    </div>
  );
}
