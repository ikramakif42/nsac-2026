import { useRef, useEffect, useCallback } from "react";
import { useStore } from "../../store/useStore";
import type { ObservationRecord } from "../../types/cids";

interface Props {
  records: ObservationRecord[];
}

/**
 * WebGL2 canvas for 2D sky image rendering.
 * Supports smooth trackpad/wheel time scrubbing and viewport interaction.
 */
export default function WebGL2Canvas({ records }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { epochIndex, displaySettings, stepEpoch } = useStore((s) => ({
    epochIndex:      s.playback.epochIndex,
    displaySettings: s.displaySettings,
    stepEpoch:       s.stepEpoch,
  }));

  const record = records[epochIndex] ?? null;

  // Wheel / gesture handler: scroll through time
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // If user holds shift or scrolls vertically on canvas, scrub through epochs
      if (records.length > 1) {
        const delta = e.deltaY > 0 ? 1 : -1;
        stepEpoch(delta, records.length);
      }
    },
    [records.length, stepEpoch]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }
    // Placeholder clear
    gl.clearColor(0.043, 0.071, 0.125, 1.0); // --ol-bg
    gl.clear(gl.COLOR_BUFFER_BIT);
    // TODO Phase 3: upload FITS pixels as texture, apply colormap shader
  }, [epochIndex, record, displaySettings]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-[var(--ol-bg)] select-none cursor-crosshair"
      onWheel={handleWheel}
      title="Scroll mouse wheel over canvas to scrub through time epochs"
    >
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full"
        width={512}
        height={512}
        aria-label={record ? `Sky image: ${record.band} epoch ${record.epoch_label}` : "Sky viewer — no data"}
      />
      {!record && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--ol-muted)] text-sm pointer-events-none">
          <span className="text-4xl mb-2">🔭</span>
          <span>Search for a sky position or choose a target</span>
          <span className="text-xs text-[var(--ol-muted)] mt-1">Scroll wheel allows time scrubbing when multiple epochs load</span>
        </div>
      )}
      {record && (
        <div className="absolute top-2 left-2 flex items-center gap-2 font-mono text-xs text-[var(--ol-accent)] bg-[var(--ol-bg)]/80 backdrop-blur px-2.5 py-1 rounded border border-[var(--ol-border)] pointer-events-none">
          <span className="font-semibold">{record.band}</span>
          <span>·</span>
          <span>{record.epoch_label}</span>
          <span>·</span>
          <span>{record.wavelength_um.toFixed(3)} μm</span>
          <span>·</span>
          <span className="text-[var(--ol-muted)]">Frame {epochIndex + 1}/{records.length} (Scroll to scrub)</span>
        </div>
      )}
    </div>
  );
}
