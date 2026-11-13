import { Play, Pause, SkipBack, SkipForward, ChevronFirst, ChevronLast } from "lucide-react";
import { useStore } from "../../store/useStore";

interface Props {
  totalFrames: number;
}

const FPS_OPTIONS = [0.1, 0.25, 0.5, 1.0, 2.0, 3.0];

export default function TimelineControls({ totalFrames }: Props) {
  const { epochIndex, isPlaying, fps, setEpochIndex, setPlaying, setFps } = useStore((s) => ({
    epochIndex:    s.playback.epochIndex,
    isPlaying:     s.playback.isPlaying,
    fps:           s.playback.fps,
    setEpochIndex: s.setEpochIndex,
    setPlaying:    s.setPlaying,
    setFps:        s.setFps,
  }));

  const canPrev = epochIndex > 0;
  const canNext = epochIndex < totalFrames - 1;

  const togglePlay = () => {
    // If at last frame, pressing play rewinds first
    if (!isPlaying && epochIndex >= totalFrames - 1) {
      setEpochIndex(0);
    }
    setPlaying(!isPlaying);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 bg-[var(--ol-surface)] border-t border-[var(--ol-border)]"
      role="toolbar"
      aria-label="Epoch playback controls"
    >
      {/* Frame counter */}
      <span className="font-mono text-xs text-[var(--ol-muted)] w-20 shrink-0">
        {totalFrames === 0 ? "—" : `${epochIndex + 1} / ${totalFrames}`}
      </span>

      {/* Transport buttons */}
      <button onClick={() => setEpochIndex(0)} disabled={!canPrev} aria-label="First frame" className="ctrl-btn">
        <ChevronFirst size={16} />
      </button>
      <button onClick={() => setEpochIndex(epochIndex - 1)} disabled={!canPrev} aria-label="Previous frame" className="ctrl-btn">
        <SkipBack size={16} />
      </button>
      <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="ctrl-btn text-[var(--ol-accent)]">
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button onClick={() => setEpochIndex(epochIndex + 1)} disabled={!canNext} aria-label="Next frame" className="ctrl-btn">
        <SkipForward size={16} />
      </button>
      <button onClick={() => setEpochIndex(totalFrames - 1)} disabled={!canNext} aria-label="Last frame" className="ctrl-btn">
        <ChevronLast size={16} />
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(0, totalFrames - 1)}
        value={epochIndex}
        onChange={(e) => { setPlaying(false); setEpochIndex(Number(e.target.value)); }}
        className="flex-1 accent-[var(--ol-accent)]"
        aria-label="Epoch scrubber"
      />

      {/* Speed selector */}
      <label className="flex items-center gap-1 text-xs text-[var(--ol-muted)] shrink-0">
        <span>Speed</span>
        <select
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
          className="bg-[var(--ol-surface2)] border border-[var(--ol-border)] rounded px-1 py-0.5 text-xs font-mono text-[var(--ol-text)]"
          aria-label="Playback speed (frames per second)"
        >
          {FPS_OPTIONS.map((v) => (
            <option key={v} value={v}>{v} fps</option>
          ))}
        </select>
      </label>
    </div>
  );
}

