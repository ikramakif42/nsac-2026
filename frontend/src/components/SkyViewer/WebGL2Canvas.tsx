import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useStore } from "../../store/useStore";
import type { DataSource, ObservationRecord } from "../../types/cids";
import { ScienceRenderer } from "./ScienceRenderer";
import { getSyntheticRenderFrame } from "./syntheticRenderFrame";
import {
  boundedIndex,
  MIN_FRAME_INTERVAL_MS,
  nextDrawDelay,
  safeFps,
  validateRenderFrame,
  WheelAccumulator,
  wheelPixels,
  type RenderFrame,
} from "./renderFrame";

export type { RenderFrame } from "./renderFrame";

interface Props {
  records: ObservationRecord[];
  /**
   * Immutable backend products keyed by CIDS observation ID.
   * Replace a product object when its percentile preparation changes.
   */
  frames?: Readonly<Record<string, RenderFrame>>;
}

const SOURCE_LABEL: Record<DataSource, string> = {
  qr3:       "SPHEREx QR3",
  wiseview:  "WiseView (AllWISE)",
  gaia:      "ESA Gaia DR3",
  synthetic: "SYNTHETIC",
  mast:      "MAST",
  vizier:    "VizieR",
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Presentation {
  width: number;
  height: number;
  frame: RenderFrame | null;
  recordId: string | null;
  difference: boolean;
}

const INITIAL_PRESENTATION: Presentation = {
  width: 512,
  height: 512,
  frame: null,
  recordId: null,
  difference: false,
};

export default function WebGL2Canvas({ records, frames }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ScienceRenderer | null>(null);
  const lastDrawRef = useRef(Number.NEGATIVE_INFINITY);

  const [difference, setDifference] = useState(false);
  const [rendererVersion, setRendererVersion] = useState(0);
  const [resizeVersion, setResizeVersion] = useState(0);
  const [gpuError, setGpuError] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [presentation, setPresentation] =
    useState<Presentation>(INITIAL_PRESENTATION);

  // Separate selectors avoid unstable object snapshots with Zustand 5.
  const epochIndex = useStore((state) => state.playback.epochIndex);
  const isPlaying = useStore((state) => state.playback.isPlaying);
  const fps = useStore((state) => state.playback.fps);
  const displaySettings = useStore((state) => state.displaySettings);
  const activeSource = useStore((state) => state.activeSource);

  const index = boundedIndex(epochIndex, records.length);
  const record = records[index] ?? null;
  const suppliedFrame = useMemo(() => {
    if (!record) return undefined;
    if (frames?.[record.id]) return frames[record.id];
    // Synthesize display pixels for demo/simulation, WiseView, or Gaia astrometry if raw FITS cutouts not loaded
    if (
      record.source === "synthetic" ||
      activeSource === "synthetic" ||
      record.source === "wiseview" ||
      record.source === "gaia"
    ) {
      return getSyntheticRenderFrame(
        record,
        index,
        records,
        displaySettings.contrastLow,
        displaySettings.contrastHigh,
      );
    }
    return undefined;
  }, [record, frames, index, records, activeSource, displaySettings.contrastLow, displaySettings.contrastHigh]);

  const product = useMemo(() => {
    if (!record) {
      return {
        frame: null,
        error: "Select a target or enter coordinates to begin.",
      };
    }
    if (!suppliedFrame) {
      return {
        frame: null,
        error: "Awaiting backend render pixels. No substitute image is displayed.",
      };
    }

    try {
      const frame = validateRenderFrame(suppliedFrame, record.id);
      if (
        frame.lowPercentile !== displaySettings.contrastLow ||
        frame.highPercentile !== displaySettings.contrastHigh
      ) {
        return {
          frame: null,
          error:
            "Awaiting backend pixels for the selected contrast percentiles.",
        };
      }
      return { frame, error: null };
    } catch (error) {
      return { frame: null, error: errorText(error) };
    }
  }, [
    suppliedFrame,
    record?.id,
    displaySettings.contrastLow,
    displaySettings.contrastHigh,
  ]);

  const requestedError =
    product.error ??
    (difference && product.frame?.difference === null
      ? "No compatible backend reference product is available for this epoch."
      : null);

  const requestedFrame = requestedError ? null : product.frame;

  // Mounting, including embedded/deep-linked mounting, never starts playback.
  useEffect(() => {
    useStore.getState().setPlaying(false);
    return () => useStore.getState().setPlaying(false);
  }, []);

  useEffect(() => {
    if (epochIndex !== index) useStore.getState().setEpochIndex(index);
  }, [epochIndex, index]);

  // Each elapsed interval advances once; background-tab delays never catch up.
  useEffect(() => {
    if (!isPlaying || records.length < 2) return;

    const interval = Math.max(MIN_FRAME_INTERVAL_MS, 1000 / safeFps(fps));
    const timer = window.setInterval(() => {
      const state = useStore.getState();
      if (!state.playback.isPlaying || document.hidden) return;
      const current = boundedIndex(state.playback.epochIndex, records.length);
      state.setEpochIndex((current + 1) % records.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [isPlaying, fps, records.length]);

  useEffect(() => {
    if (records.length < 2 || requestedError || gpuError) {
      useStore.getState().setPlaying(false);
    }
  }, [records.length, requestedError, gpuError]);

  useEffect(() => {
    const pause = () => useStore.getState().setPlaying(false);
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pause);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let alive = true;
    const initialize = () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      try {
        rendererRef.current = new ScienceRenderer(canvas);
        if (alive) {
          setGpuError(null);
          setRendererVersion((value) => value + 1);
        }
      } catch (error) {
        if (alive) setGpuError(errorText(error));
      }
    };

    const onLost = (event: Event) => {
      event.preventDefault();
      useStore.getState().setPlaying(false);
      setGpuError("WebGL context lost. Playback is paused while it recovers.");
    };

    const onRestored = () => {
      useStore.getState().setPlaying(false);
      lastDrawRef.current = Number.NEGATIVE_INFINITY;
      initialize();
    };

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    initialize();

    return () => {
      alive = false;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const changed = () => setResizeVersion((value) => value + 1);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(changed);

    observer?.observe(container);
    window.addEventListener("resize", changed);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", changed);
    };
  }, []);

  // Coalesce rendering requests, including externally driven epoch changes.
  // Never present more than three new image states per second.
  useEffect(() => {
    const delay = nextDrawDelay(performance.now(), lastDrawRef.current);

    const timer = window.setTimeout(() => {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!renderer || !canvas || !container || gpuError) return;

      const frame = requestedFrame;
      const imageWidth = frame?.width ?? 512;
      const imageHeight = frame?.height ?? 512;
      const availableWidth = Math.max(1, container.clientWidth);
      const availableHeight = Math.max(1, container.clientHeight);
      const fit = Math.min(
        availableWidth / imageWidth,
        availableHeight / imageHeight,
      );
      const width = Math.max(1, imageWidth * fit);
      const height = Math.max(1, imageHeight * fit);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      try {
        renderer.resize(width, height, window.devicePixelRatio);
        if (frame) {
          renderer.render(frame, {
            difference,
            stretch: displaySettings.stretch,
            colormap: displaySettings.colormap,
          });
        } else {
          renderer.clear();
        }

        setDrawError(null);
        setPresentation({
          width,
          height,
          frame,
          recordId: frame ? record?.id ?? null : null,
          difference,
        });
      } catch (error) {
        renderer.clear();
        setDrawError(errorText(error));
        setPresentation({
          width,
          height,
          frame: null,
          recordId: null,
          difference,
        });
        useStore.getState().setPlaying(false);
      } finally {
        lastDrawRef.current = performance.now();
      }
    }, Math.ceil(delay));

    return () => window.clearTimeout(timer);
  }, [
    requestedFrame,
    record?.id,
    difference,
    displaySettings.stretch,
    displaySettings.colormap,
    rendererVersion,
    resizeVersion,
    gpuError,
  ]);

  // A native, non-passive listener permits canvas-only trackpad scrubbing.
  // Fractional deltas accumulate instead of advancing an epoch per event.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const accumulator = new WheelAccumulator();
    let pendingSteps = 0;
    let timer: number | null = null;
    let lastStep = Number.NEGATIVE_INFINITY;

    const flush = () => {
      timer = null;
      if (pendingSteps === 0) return;

      const state = useStore.getState();
      const current = boundedIndex(state.playback.epochIndex, records.length);
      state.setEpochIndex(
        boundedIndex(current + pendingSteps, records.length),
      );
      pendingSteps = 0;
      lastStep = performance.now();
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || records.length < 2 || event.deltaY === 0) return;
      event.preventDefault();
      useStore.getState().setPlaying(false);

      pendingSteps += accumulator.push(
        wheelPixels(event.deltaY, event.deltaMode, canvas.clientHeight),
      );

      if (pendingSteps !== 0 && timer === null) {
        timer = window.setTimeout(
          flush,
          Math.ceil(nextDrawDelay(performance.now(), lastStep)),
        );
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      if (timer !== null) window.clearTimeout(timer);
      accumulator.reset();
    };
  }, [records.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;

    if (direction !== 0) {
      event.preventDefault();
      const state = useStore.getState();
      state.setPlaying(false);
      state.setEpochIndex(
        boundedIndex(
          boundedIndex(state.playback.epochIndex, records.length) + direction,
          records.length,
        ),
      );
    } else if (event.key === " " && records.length > 1) {
      event.preventDefault();
      if (!requestedError && !gpuError && !drawError) {
        const state = useStore.getState();
        state.setPlaying(!state.playback.isPlaying);
      }
    }
  };

  const visibleRecord =
    records.find((item) => item.id === presentation.recordId) ?? record;
  const visibleIndex = visibleRecord
    ? records.findIndex((item) => item.id === visibleRecord.id)
    : -1;

  const source = visibleRecord?.source ?? activeSource;
  const annotations = presentation.frame?.annotations;
  const scaleFactor = presentation.frame
    ? presentation.width / presentation.frame.width
    : 1;
  const scaleWidth = annotations
    ? annotations.scalePixels * scaleFactor
    : 0;

  const statusMessage = gpuError ?? drawError ?? requestedError;
  const canPlay =
    records.length > 1 && !requestedError && !gpuError && !drawError;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-64 flex items-center justify-center overflow-hidden select-none bg-[#070b16]"
    >
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="block cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        aria-label={
          visibleRecord
            ? `${SOURCE_LABEL[source]}: ${visibleRecord.band}, ${
                visibleRecord.epoch_label
              }, ${presentation.difference ? "signed difference" : "intensity"} image`
            : "Sky viewer"
        }
        aria-describedby="orbit-lens-canvas-help"
      />

      <span id="orbit-lens-canvas-help" className="sr-only">
        Scroll vertically or use arrow keys to scrub observation epochs.
        Space starts or pauses playback. Playback starts paused and is capped
        at three frames per second. Blue differences are negative; orange
        differences are positive.
      </span>

      {presentation.frame && !gpuError && !drawError && (
        <svg
          aria-hidden="true"
          className="absolute pointer-events-none"
          width={presentation.width}
          height={presentation.height}
          viewBox={`0 0 ${presentation.width} ${presentation.height}`}
        >
          {displaySettings.showGrid && (
            <g stroke="#94a3b8" opacity="0.35" strokeDasharray="4 4">
              <line
                x1={presentation.width / 2}
                y1={0}
                x2={presentation.width / 2}
                y2={presentation.height}
              />
              <line
                x1={0}
                y1={presentation.height / 2}
                x2={presentation.width}
                y2={presentation.height / 2}
              />
            </g>
          )}

          {annotations && presentation.width >= 180 && (
            <g
              transform={`translate(${presentation.width - 48}, 105)`}
              stroke="#cbd5e1"
              fill="#e2e8f0"
              strokeWidth="1.5"
              fontSize="11"
              fontFamily="monospace"
            >
              <line
                x1="0"
                y1="0"
                x2={annotations.north[0] * 24}
                y2={annotations.north[1] * 24}
              />
              <text
                x={annotations.north[0] * 35}
                y={annotations.north[1] * 35}
                textAnchor="middle"
                dominantBaseline="middle"
                stroke="none"
              >
                N
              </text>
              <line
                x1="0"
                y1="0"
                x2={annotations.east[0] * 24}
                y2={annotations.east[1] * 24}
              />
              <text
                x={annotations.east[0] * 35}
                y={annotations.east[1] * 35}
                textAnchor="middle"
                dominantBaseline="middle"
                stroke="none"
              >
                E
              </text>
            </g>
          )}

          {annotations &&
            scaleWidth >= 8 &&
            scaleWidth <= presentation.width - 48 && (
              <g
                transform={`translate(24, ${presentation.height - 100})`}
                stroke="#e2e8f0"
                fill="#e2e8f0"
                strokeWidth="2"
                fontSize="10"
                fontFamily="monospace"
              >
                <line x1="0" y1="0" x2={scaleWidth} y2="0" />
                <line x1="0" y1="-4" x2="0" y2="4" />
                <line
                  x1={scaleWidth}
                  y1="-4"
                  x2={scaleWidth}
                  y2="4"
                />
                <text x="0" y="-9" stroke="none">
                  {annotations.scaleLabel}
                </text>
              </g>
            )}
        </svg>
      )}

      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-black/85 px-3 py-2 text-xs font-mono text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="source-badge"
            aria-label={`Active source: ${SOURCE_LABEL[source]}`}
            className="font-bold text-cyan-300"
          >
            {SOURCE_LABEL[source]}
          </span>

          {visibleRecord && (
            <>
              <span className="text-amber-300">{visibleRecord.band}</span>
              <span>{visibleRecord.epoch_label}</span>
              <span>{visibleRecord.wavelength_um.toFixed(3)} μm</span>
              <span className="text-slate-300">
                Frame {visibleIndex + 1}/{records.length}
              </span>
            </>
          )}
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={difference}
            onChange={(event) => {
              useStore.getState().setPlaying(false);
              setDifference(event.target.checked);
            }}
            className="accent-cyan-300"
          />
          Difference View
        </label>
      </div>

      {statusMessage && (
        <div
          role={gpuError || drawError ? "alert" : "status"}
          className="absolute left-6 right-6 top-1/2 -translate-y-1/2 rounded border border-slate-700 bg-black/90 p-4 text-center text-sm text-slate-200"
        >
          {statusMessage}
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 rounded border border-slate-700 bg-black/85 p-2 text-xs font-mono text-white">
        {presentation.difference && presentation.frame?.referenceId && (
          <div className="mb-2 text-slate-200">
            Current − reference{" "}
            <span className="break-all">
              {presentation.frame.referenceId}
            </span>
            {" · "}
            <span className="text-sky-400">Blue: negative</span>
            {" · "}
            <span className="text-orange-400">Orange: positive</span>
            {" · "}
            {presentation.frame.differenceScaleMode ?? "per-frame"} scale
            <div className="mt-1 text-[10px] text-slate-400">
              Visual residual only; no PSF matching. Stationary sources cancel
              only when registration and photometry agree.
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canPlay && !isPlaying}
            aria-pressed={isPlaying}
            onClick={() => {
              const state = useStore.getState();
              state.setPlaying(!state.playback.isPlaying);
            }}
            className="rounded border border-slate-500 px-3 py-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          <label className="flex items-center gap-2">
            FPS
            <input
              type="number"
              min={0.1}
              max={3}
              step={0.1}
              value={safeFps(fps)}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value)) {
                  useStore.getState().setFps(safeFps(value));
                }
              }}
              className="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-1"
            />
          </label>

          <label className="flex items-center gap-2">
            Stretch
            <select
              value={displaySettings.stretch}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "linear" ||
                  value === "sqrt" ||
                  value === "log" ||
                  value === "asinh"
                ) {
                  useStore.getState().updateDisplay({ stretch: value });
                }
              }}
              className="rounded border border-slate-600 bg-slate-950 px-1 py-1"
            >
              <option value="linear">Linear</option>
              <option value="sqrt">Square root</option>
              <option value="log">Log</option>
              <option value="asinh">Asinh</option>
            </select>
          </label>

          <span className="text-[10px] text-slate-400">
            Starts paused · maximum 3 fps · scroll to scrub
          </span>
        </div>
      </div>
    </div>
  );
}