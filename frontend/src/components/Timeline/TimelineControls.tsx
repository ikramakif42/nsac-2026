import { useEffect } from "react";
import { useStore, normalizeFps } from "../../store/useStore";
import { boundEpoch } from "../../lib/exploreState";

interface Props {
  totalFrames: number;
}

const FPS_OPTIONS = [0.1, 0.25, 0.5, 1, 2, 3];

export default function TimelineControls({ totalFrames }: Props) {
  const epoch = useStore((s) => s.playback.epochIndex);
  const playing = useStore((s) => s.playback.isPlaying);
  const fps = useStore((s) => s.playback.fps);
  const count = Number.isFinite(totalFrames)
    ? Math.max(0, Math.trunc(totalFrames))
    : 0;
  const index = boundEpoch(epoch, count);

  useEffect(() => {
    if (count < 2) useStore.getState().setPlaying(false);
  }, [count]);

  const seek = (next: number) => {
    const state = useStore.getState();
    state.setPlaying(false);
    state.setEpochIndex(boundEpoch(next, count));
  };

  const buttonClass =
    "rounded border border-slate-600 px-2 py-1 text-slate-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300";

  return (
    <div
      role="group"
      aria-label="Epoch playback controls"
      className="flex flex-wrap items-center gap-2 border-t border-slate-700 bg-slate-950 p-2 text-xs"
    >
      <span className="text-slate-100">
        {count ? `Frame ${index + 1} / ${count}` : "No frames"}
      </span>
      <button type="button" className={buttonClass} disabled={index === 0} onClick={() => seek(0)} aria-label="First frame">
        First
      </button>
      <button type="button" className={buttonClass} disabled={index === 0} onClick={() => seek(index - 1)} aria-label="Previous frame">
        Previous
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={count < 2}
        aria-pressed={playing}
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          const state = useStore.getState();
          if (!playing && index === count - 1) state.setEpochIndex(0);
          state.setPlaying(!playing);
        }}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" className={buttonClass} disabled={index >= count - 1} onClick={() => seek(index + 1)} aria-label="Next frame">
        Next
      </button>
      <button type="button" className={buttonClass} disabled={index >= count - 1} onClick={() => seek(count - 1)} aria-label="Last frame">
        Last
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, count - 1)}
        value={index}
        disabled={count < 2}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Epoch scrubber"
        className="min-w-24 flex-1 accent-cyan-300"
      />
      <label className="flex items-center gap-2 text-slate-100">
        FPS
        <select
          aria-label="Playback speed (frames per second)"
          value={normalizeFps(fps)}
          onChange={(e) => useStore.getState().setFps(Number(e.target.value))}
          className="rounded border border-slate-600 bg-slate-950 p-1"
        >
          {[...new Set([...FPS_OPTIONS, normalizeFps(fps)])]
            .sort((a, b) => a - b)
            .map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    </div>
  );
}