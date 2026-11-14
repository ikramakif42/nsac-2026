import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStore } from "../../store/useStore";
import type { ObservationRecord } from "../../types/cids";
import type { CubeRenderResponse } from "../../types/cubeRender";
import { fetchCubeRender } from "./cubeApi";
import {
  frameIndex,
  safeFps,
  selectCubeRecords,
  SliceGate,
  SOURCE_LABELS,
} from "./cubeModel";
import { createThreeCubeScene, type SceneHandle } from "./ThreeCubeScene";

interface Props {
  records: ObservationRecord[];
  mode: "cube" | "sphere";
}

const buttonClass =
  "rounded border border-[var(--ol-border)] px-2 py-1 text-xs " +
  "disabled:opacity-40 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-[var(--ol-accent)]";

export default function Scientific3DViewer({ records, mode }: Props) {
  const source = useStore((state) => state.activeSource);
  const axis = useStore((state) => state.cubeAxis);
  const epochIndex = useStore((state) => state.playback.epochIndex);
  const isPlaying = useStore((state) => state.playback.isPlaying);
  const fps = useStore((state) => state.playback.fps);
  const stretch = useStore((state) => state.displaySettings.stretch);
  const colormap = useStore((state) => state.displaySettings.colormap);
  const contrastLow = useStore((state) => state.displaySettings.contrastLow);
  const contrastHigh = useStore((state) => state.displaySettings.contrastHigh);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const gateRef = useRef(new SliceGate());
  const requestSequence = useRef(0);
  const [anchorId, setAnchorId] = useState(
    () => useStore.getState().activeRecord?.id ?? "",
  );
  const [data, setData] = useState<CubeRenderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [showStack, setShowStack] = useState(false);
  const [requestedIndex, setRequestedIndex] = useState(epochIndex);
  const controlsId = useId();

  const available = useMemo(
    () => records.filter((record) => record.source === source),
    [records, source],
  );
  const effectiveAnchor = available.some((record) => record.id === anchorId)
    ? anchorId
    : available[0]?.id ?? "";

  const selection = useMemo(() => {
    try {
      return {
        records: effectiveAnchor
          ? selectCubeRecords(records, effectiveAnchor, axis, source)
          : [],
        error: null,
      };
    } catch (cause) {
      return {
        records: [],
        error: cause instanceof Error ? cause.message : "Invalid cube selection.",
      };
    }
  }, [records, effectiveAnchor, axis, source]);

  const count = data?.frames.length ?? 0;
  const selected = frameIndex(epochIndex, count);

  const requestSlice = useCallback((index: number) => {
    useStore.getState().setPlaying(false);
    setRequestedIndex(index);
  }, []);

  const step = useCallback((delta: number) => {
    useStore.getState().setPlaying(false);
    setRequestedIndex((current) =>
      frameIndex(current + delta, data?.frames.length ?? 0),
    );
  }, [data]);

  useEffect(() => {
    useStore.getState().setPlaying(false);
    const onVisibility = () => {
      if (document.hidden) useStore.getState().setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      useStore.getState().setPlaying(false);
    };
  }, []);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    let active = true;
    useStore.getState().setPlaying(false);
    setData(null);
    setError(selection.error);
    setLoading(selection.records.length > 0 && !selection.error);

    if (selection.records.length && !selection.error) {
      fetchCubeRender(
        selection.records,
        effectiveAnchor,
        axis,
        source,
        { stretch, colormap, contrastLow, contrastHigh },
        controller.signal,
      ).then((result) => {
        if (!active || sequence !== requestSequence.current) return;
        setData(result);
        const index = frameIndex(
          useStore.getState().playback.epochIndex,
          result.frames.length,
        );
        setRequestedIndex(index);
        useStore.getState().setEpochIndex(index);
      }).catch((cause: unknown) => {
        if (!active || sequence !== requestSequence.current) return;
        setError(
          controller.signal.aborted
            ? "Cube loading timed out. Retry or request smaller cutouts."
            : cause instanceof Error
              ? cause.message
              : "Cube loading failed.",
        );
        controller.abort();
      }).finally(() => {
        clearTimeout(timeout);
        if (active && sequence === requestSequence.current) setLoading(false);
      });
    } else {
      clearTimeout(timeout);
    }

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    selection,
    effectiveAnchor,
    axis,
    source,
    stretch,
    colormap,
    contrastLow,
    contrastHigh,
    retry,
  ]);

  useEffect(() => {
    if (!data || !hostRef.current) return;
    let handle: SceneHandle | null = null;
    try {
      handle = createThreeCubeScene({
        host: hostRef.current,
        data,
        mode,
        initialIndex: useStore.getState().playback.epochIndex,
        onStep: step,
        onError: (message) => {
          useStore.getState().setPlaying(false);
          setError(message);
        },
      });
      sceneRef.current = handle;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "3D rendering failed.");
    }
    return () => {
      handle?.dispose();
      if (sceneRef.current === handle) sceneRef.current = null;
    };
  }, [data, mode, step]);

  useEffect(() => {
    sceneRef.current?.setStack(showStack);
  }, [showStack, data, mode]);

  useEffect(() => {
    if (!data) return;
    let animation = 0;
    let lastVisible = frameIndex(
      useStore.getState().playback.epochIndex,
      data.frames.length,
    );

    const update = (now: number) => {
      const next = frameIndex(
        useStore.getState().playback.epochIndex,
        data.frames.length,
      );
      if (next !== lastVisible && gateRef.current.accept(now)) {
        sceneRef.current?.setSlice(next);
        lastVisible = next;
      }
      animation = requestAnimationFrame(update);
    };
    animation = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animation);
  }, [data]);

  useEffect(() => {
    if (!data || isPlaying) return;
    const timer = window.setInterval(() => {
      const state = useStore.getState();
      const next = frameIndex(requestedIndex, data.frames.length);
      if (state.playback.epochIndex !== next) state.setEpochIndex(next);
    }, 1000 / 3);
    return () => clearInterval(timer);
  }, [requestedIndex, data, isPlaying]);

  useEffect(() => {
    if (!data || !isPlaying || data.frames.length < 2) return;
    const interval = 1000 / safeFps(fps);
    let timer: number;
    const advance = () => {
      const state = useStore.getState();
      if (document.hidden || !state.playback.isPlaying) return;
      const next = (
        frameIndex(state.playback.epochIndex, data.frames.length) + 1
      ) % data.frames.length;
      state.setEpochIndex(next);
      setRequestedIndex(next);
      timer = window.setTimeout(advance, interval);
    };
    timer = window.setTimeout(advance, interval);
    return () => clearTimeout(timer);
  }, [data, isPlaying, fps]);

  useEffect(() => {
    if (!data) return;
    const recordId = data.record_ids[selected];
    const record = records.find((item) => item.id === recordId);
    if (record && useStore.getState().activeRecord?.id !== record.id) {
      useStore.getState().setActiveRecord(record);
    }
  }, [data, selected, records]);

  useEffect(() => {
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set("epoch", String(selected));
    url.searchParams.set("axis", axis);
    url.searchParams.set("view", mode === "cube" ? "3d_cube" : "3d_sphere");
    url.searchParams.set("cubeAnchor", effectiveAnchor);
    window.history.replaceState(window.history.state, "", url);
  }, [data, selected, axis, mode, effectiveAnchor]);

  useEffect(() => {
    const readAnchor = () => {
      const value = new URL(window.location.href).searchParams.get("cubeAnchor");
      if (value) setAnchorId(value);
    };
    readAnchor();
    window.addEventListener("popstate", readAnchor);
    return () => window.removeEventListener("popstate", readAnchor);
  }, []);

  const slice = data?.metadata.slices[selected];
  const frame = data?.frames[selected];
  const activeLabel = SOURCE_LABELS[data?.metadata.source ?? source];

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-[var(--ol-bg)] text-[var(--ol-text)]"
      aria-label={mode === "cube" ? "3D data cube" : "3D celestial sphere"}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ol-border)] p-2">
        <span
          className="rounded border border-[var(--ol-border)] px-2 py-1 text-xs font-mono"
          aria-label={`Active data source: ${activeLabel}`}
          data-testid="source-badge"
        >
          {activeLabel}
        </span>

        <label className="text-xs" htmlFor={`${controlsId}-axis`}>Axis</label>
        <select
          id={`${controlsId}-axis`}
          className={buttonClass}
          value={axis}
          onChange={(event) => {
            useStore.getState().setPlaying(false);
            useStore.getState().setCubeAxis(
              event.target.value === "wavelength" ? "wavelength" : "time",
            );
          }}
        >
          <option value="time">Time · MJD</option>
          <option value="wavelength">Wavelength · μm</option>
        </select>

        <label className="text-xs" htmlFor={`${controlsId}-anchor`}>Anchor</label>
        <select
          id={`${controlsId}-anchor`}
          className={`${buttonClass} max-w-64`}
          value={effectiveAnchor}
          disabled={!available.length}
          onChange={(event) => {
            useStore.getState().setPlaying(false);
            setAnchorId(event.target.value);
          }}
        >
          {!available.length && <option value="">No observations</option>}
          {available.map((record) => (
            <option key={record.id} value={record.id}>
              {record.epoch_label} · {record.wavelength_um.toFixed(4)} μm · {record.band}
            </option>
          ))}
        </select>

        {mode === "cube" && (
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={showStack}
              onChange={(event) => setShowStack(event.target.checked)}
            />
            Show faint slice stack
          </label>
        )}
        <button
          className={buttonClass}
          disabled={!data || !!error}
          onClick={() => sceneRef.current?.resetCamera()}
        >
          Reset camera
        </button>
      </div>

      <div className="relative min-h-48 flex-1">
        <div
          ref={hostRef}
          className="absolute inset-0"
          aria-busy={loading}
          style={{ visibility: error ? "hidden" : "visible" }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-sm" role="status">
            Loading {activeLabel} observations and registering their WCS…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <p role="alert" className="max-w-xl text-center text-sm">{error}</p>
            <p className="text-xs text-[var(--ol-muted)]">
              No replacement data has been generated.
            </p>
            <button className={buttonClass} onClick={() => setRetry((value) => value + 1)}>
              Retry 3D view
            </button>
          </div>
        )}
        {!loading && !error && !data && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-sm" role="status">
            No {SOURCE_LABELS[source]} observations are available for this view.
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-[var(--ol-border)] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={buttonClass}
            disabled={count < 2 || !!error}
            aria-pressed={isPlaying}
            onClick={() => {
              setRequestedIndex(selected);
              useStore.getState().setPlaying(!isPlaying);
            }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            className={buttonClass}
            disabled={!count || selected === 0 || !!error}
            onClick={() => requestSlice(selected - 1)}
          >
            Previous
          </button>
          <button
            className={buttonClass}
            disabled={!count || selected === count - 1 || !!error}
            onClick={() => requestSlice(selected + 1)}
          >
            Next
          </button>

          <label className="flex items-center gap-1 text-xs">
            fps
            <input
              type="number"
              min={0.1}
              max={3}
              step={0.1}
              value={safeFps(fps)}
              className={`${buttonClass} w-16`}
              onChange={(event) => {
                useStore.getState().setFps(safeFps(event.target.valueAsNumber));
              }}
            />
          </label>

          <label className="sr-only" htmlFor={`${controlsId}-slice`}>
            Selected {axis === "time" ? "epoch" : "wavelength"} slice
          </label>
          <input
            id={`${controlsId}-slice`}
            type="range"
            min={0}
            max={Math.max(0, count - 1)}
            step={1}
            value={frameIndex(requestedIndex, count)}
            disabled={count < 2 || !!error}
            className="min-w-32 flex-1"
            aria-valuetext={slice?.label ?? "No slice"}
            onChange={(event) => requestSlice(event.target.valueAsNumber)}
          />
          <span className="text-xs font-mono">
            {count ? selected + 1 : 0}/{count}
          </span>
        </div>

        {slice && frame && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
            <span>{slice.label}</span>
            <span>Valid pixels: {(frame.valid_fraction * 100).toFixed(1)}%</span>
            <span>
              Median pixel SNR: {frame.median_snr === null ? "unavailable" : frame.median_snr.toFixed(2)}
            </span>
            <span>
              Flux: {slice.min_flux.toPrecision(4)}–{slice.max_flux.toPrecision(4)}
              {data?.unit ? ` ${data.unit}` : ""}
            </span>
          </div>
        )}

        <p className="text-xs text-[var(--ol-muted)]">
          Drag to orbit. Scroll/trackpad or arrow keys scrub slices at no more than
          3 updates/s. Playback starts paused.
          {mode === "sphere" && " The wireframe is an orientation aid, not survey coverage."}
        </p>
        {data && (
          <details className="text-xs text-[var(--ol-muted)]">
            <summary className="cursor-pointer">Registration and science notes</summary>
            <ul className="list-disc space-y-1 py-2 pl-5">
              {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              <li>
                Images share one backend Astropy WCS grid. No frontend WCS,
                celestial coordinate conversion, or SNR calculation is performed.
              </li>
              <li>
                The slice stack uses opacity for context; only the selected slice
                is displayed at full opacity.
              </li>
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}