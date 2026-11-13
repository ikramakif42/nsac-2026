import { useState } from "react";
import { Search } from "lucide-react";
import { BENCHMARK_TARGETS } from "../../types/cids";
import { useStore } from "../../store/useStore";
import type { SearchQuery, DataSource } from "../../types/cids";

interface Props {
  onSearch: (q: SearchQuery) => void;
}

const FOV_OPTIONS = [0.1, 0.5, 1.0, 2.5, 5.0, 10.0];

export default function CoordinateForm({ onSearch }: Props) {
  const { status, activeSource, fov } = useStore((s) => ({
    status:       s.status,
    activeSource: s.activeSource,
    fov:          s.fov,
  }));

  const [ra, setRa] = useState(String(fov.centerRa));
  const [dec, setDec] = useState(String(fov.centerDec));
  const [source, setSource] = useState<DataSource>(activeSource);
  const [fovDeg, setFovDeg] = useState(fov.fovDeg);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raNum = parseFloat(ra);
    const decNum = parseFloat(dec);
    if (isNaN(raNum) || isNaN(decNum)) return;
    onSearch({
      ra: raNum,
      dec: decNum,
      radius_arcsec: fovDeg * 3600 / 2,
      source,
    });
  };

  const loadBenchmark = (idx: number) => {
    const t = BENCHMARK_TARGETS[idx];
    setRa(String(t.ra));
    setDec(String(t.dec));
    onSearch({
      ra: t.ra,
      dec: t.dec,
      radius_arcsec: fovDeg * 3600 / 2,
      source,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      {/* RA Input */}
      <label className="sr-only" htmlFor="ra-input">Right Ascension (degrees)</label>
      <input
        id="ra-input"
        type="number"
        step="any"
        placeholder="RA (°)"
        value={ra}
        onChange={(e) => setRa(e.target.value)}
        className="w-24 bg-[var(--ol-surface2)] border border-[var(--ol-border)] rounded px-2 py-1 text-xs font-mono text-[var(--ol-text)] placeholder:text-[var(--ol-muted)]"
        required
      />

      {/* Dec Input */}
      <label className="sr-only" htmlFor="dec-input">Declination (degrees)</label>
      <input
        id="dec-input"
        type="number"
        step="any"
        placeholder="Dec (°)"
        value={dec}
        onChange={(e) => setDec(e.target.value)}
        className="w-24 bg-[var(--ol-surface2)] border border-[var(--ol-border)] rounded px-2 py-1 text-xs font-mono text-[var(--ol-text)] placeholder:text-[var(--ol-muted)]"
        required
      />

      {/* FOV Selector */}
      <label className="sr-only" htmlFor="fov-select">Field of view</label>
      <select
        id="fov-select"
        value={fovDeg}
        onChange={(e) => setFovDeg(parseFloat(e.target.value))}
        className="bg-[var(--ol-surface2)] border border-[var(--ol-border)] rounded px-1.5 py-1 text-xs font-mono text-[var(--ol-text)]"
        title="Field of View (degrees)"
      >
        {FOV_OPTIONS.map((f) => (
          <option key={f} value={f}>{f}° FOV</option>
        ))}
      </select>

      {/* Data Source Selector */}
      <label className="sr-only" htmlFor="source-select">Data source</label>
      <select
        id="source-select"
        value={source}
        onChange={(e) => setSource(e.target.value as DataSource)}
        className="bg-[var(--ol-surface2)] border border-[var(--ol-border)] rounded px-1.5 py-1 text-xs font-mono text-[var(--ol-text)]"
        title="Data Source"
      >
        <option value="synthetic">Synthetic (6 Arrays)</option>
        <option value="qr3">SPHEREx QR3 (IRSA)</option>
      </select>

      <button
        type="submit"
        disabled={status === "searching"}
        className="flex items-center gap-1 px-3 py-1 rounded bg-[var(--ol-accent)] text-[var(--ol-bg)] text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
        aria-label="Search sky coordinates"
      >
        <Search size={13} />
        {status === "searching" ? "Searching…" : "Search"}
      </button>

      {/* Benchmark presets */}
      <div className="flex gap-1 flex-wrap items-center ml-1">
        <span className="text-[10px] uppercase text-[var(--ol-muted)] font-mono">Targets:</span>
        {BENCHMARK_TARGETS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => loadBenchmark(i)}
            className="px-2 py-0.5 text-[11px] rounded border border-[var(--ol-border)] text-[var(--ol-muted)] hover:border-[var(--ol-accent)] hover:text-[var(--ol-accent)] transition-colors"
            title={`${t.label} — ${t.description}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </form>
  );
}
