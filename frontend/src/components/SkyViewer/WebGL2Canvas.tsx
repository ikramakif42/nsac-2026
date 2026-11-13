import { useRef, useEffect } from "react";
import { useStore } from "../../store/useStore";
import type { ObservationRecord } from "../../types/cids";

interface Props {
  records: ObservationRecord[];
}

/**
 * WebGL2 canvas for 2D sky image rendering.
 * Phase 3 implementation: blink viewer with WCS overlay.
 * This is a skeleton — actual FITS pixel rendering is Phase 3.
 */
export default function WebGL2Canvas({ records }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { epochIndex, displaySettings } = useStore((s) => ({
    epochIndex:      s.playback.epochIndex,
    displaySettings: s.displaySettings,
  }));

  const record = records[epochIndex] ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }
    // Placeholder: clear to bg color
    gl.clearColor(0.043, 0.071, 0.125, 1.0); // --ol-bg
    gl.clear(gl.COLOR_BUFFER_BIT);
    // TODO Phase 3: upload FITS pixels as texture, apply colormap shader
  }, [epochIndex, record, displaySettings]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[var(--ol-bg)]">
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
          <span>Search for a sky position to begin</span>
        </div>
      )}
      {record && (
        <div className="absolute top-2 left-2 font-mono text-xs text-[var(--ol-accent)] bg-[var(--ol-bg)]/80 px-2 py-1 rounded pointer-events-none">
          {record.band} · {record.epoch_label} · {record.wavelength_um.toFixed(2)} μm
        </div>
      )}
    </div>
  );
}

