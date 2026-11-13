import { useState } from "react";
import { Search } from "lucide-react";
import { BENCHMARK_TARGETS } from "../../types/cids";
import { useStore } from "../../store/useStore";
import type { SearchQuery } from "../../types/cids";

interface Props {
  onSearch: (q: SearchQuery) => void;
}

export default function CoordinateForm({ onSearch }: Props) {
  const status = useStore((s) => s.status);
  const [ra, setRa] = useState("");
  const [dec, setDec] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raNum = parseFloat(ra);
    const decNum = parseFloat(dec);
    if (isNaN(raNum) || isNaN(decNum)) return;
    onSearch({ ra: raNum, dec: decNum, radius_arcsec: 30 });
  };

  const loadBenchmark = (idx: number) => {
    const t = BENCHMARK_TARGETS[idx];
    setRa(String(t.ra));
    setDec(String(t.dec));
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <label className="sr-only" htmlFor="ra-input">Right Ascension (degrees)</label>
      <input
        id="ra-input"
        type="number"
        step="any"
        placeholder="RA (°)"
        value={ra}
        onChange={(e) => setRa(e.target.value)}
        className="w-28 bg-[var(--ol-surface2)] border border-[var(--ol-border)] rounded px-2 py-1 text-sm font-mono text-[var(--ol-text)] placeholder:text-[var(--ol-muted)]"
        required
      />
      <label className="sr-only" htmlFor="dec-input">Declination (degrees)</label>
      <input
        id="dec-input"
        type="number"
        step="any"
        placeholder="Dec (°)"
        value={dec}
        onChange={(e) => setDec(e.target.value)}
        className="w-28 bg-[var(--ol-surface2)] border border-[var(--ol-border)] rounded px-2 py-1 text-sm font-mono text-[var(--ol-text)] placeholder:text-[var(--ol-muted)]"
        required
      />
      <button
        type="submit"
        disabled={status === "searching"}
        className="flex items-center gap-1 px-3 py-1 rounded bg-[var(--ol-accent)] text-[var(--ol-bg)] text-sm font-semibold disabled:opacity-50"
        aria-label="Search sky coordinates"
      >
        <Search size={14} />
        {status === "searching" ? "Searching…" : "Search"}
      </button>

      {/* Benchmark presets */}
      <div className="flex gap-1 flex-wrap">
        {BENCHMARK_TARGETS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => loadBenchmark(i)}
            className="px-2 py-0.5 text-xs rounded border border-[var(--ol-border)] text-[var(--ol-muted)] hover:border-[var(--ol-accent)] hover:text-[var(--ol-accent)] transition-colors"
            title={`${t.label} — ${t.description}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </form>
  );
}

