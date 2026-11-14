import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useStore } from "../../store/useStore";
import { BENCHMARK_TARGETS } from "../../types/cids";
import type { DataSource, SearchQuery } from "../../types/cids";
import {
  SOURCE_LABELS,
  validateSearchQuery,
} from "../../lib/exploreState";

interface Props {
  onSearch: (query: SearchQuery) => void;
}

const SOURCES: DataSource[] = [
  "qr3", "synthetic", "mast", "vizier", "wiseview", "gaia",
];

export default function CoordinateForm({ onSearch }: Props) {
  const status = useStore((s) => s.status);
  const activeSource = useStore((s) => s.activeSource);
  const centerRa = useStore((s) => s.fov.centerRa);
  const centerDec = useStore((s) => s.fov.centerDec);
  const storeFov = useStore((s) => s.fov.fovDeg);

  const [ra, setRa] = useState(String(centerRa));
  const [dec, setDec] = useState(String(centerDec));
  const [fov, setFov] = useState(String(storeFov));
  const [source, setSource] = useState<DataSource>(activeSource);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setRa(String(centerRa)); }, [centerRa]);
  useEffect(() => { setDec(String(centerDec)); }, [centerDec]);
  useEffect(() => { setFov(String(storeFov)); }, [storeFov]);
  useEffect(() => { setSource(activeSource); }, [activeSource]);

  const submit = (target?: { ra: number; dec: number }) => {
    try {
      if (!target && (ra.trim() === "" || dec.trim() === "")) {
        throw new Error("Enter both RA and declination.");
      }
      if (fov.trim() === "") throw new Error("Enter a field of view.");
      const query = validateSearchQuery({
        ra: target?.ra ?? Number(ra),
        dec: target?.dec ?? Number(dec),
        radius_arcsec: Number(fov) * 1800,
        source,
      });
      setError(null);
      onSearch(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const inputClass =
    "w-24 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300";

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-1">
        RA (degrees)
        <input
          type="number"
          step="any"
          min={0}
          max={360}
          required
          value={ra}
          onChange={(e) => setRa(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        Dec (degrees)
        <input
          type="number"
          step="any"
          min={-90}
          max={90}
          required
          value={dec}
          onChange={(e) => setDec(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        FOV diameter (degrees)
        <input
          type="number"
          step="any"
          min={1 / 1800}
          max={10}
          required
          value={fov}
          onChange={(e) => setFov(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        Source
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as DataSource)}
          className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
        >
          {SOURCES.map((item) => (
            <option key={item} value={item}>
              {SOURCE_LABELS[item]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={status === "searching"}
        className="rounded border border-cyan-300 px-3 py-1 text-cyan-200 disabled:opacity-50"
      >
        {status === "searching" ? "Searching…" : "Search"}
      </button>
      <details className="relative">
        <summary className="cursor-pointer rounded border border-slate-600 px-2 py-1">
          Targets
        </summary>
        <div className="absolute right-0 top-full z-50 mt-1 flex w-56 flex-col gap-1 rounded border border-slate-600 bg-slate-950 p-2">
          {BENCHMARK_TARGETS.map((target) => (
            <button
              key={target.label}
              type="button"
              title={target.description}
              onClick={() => submit(target)}
              className="rounded px-2 py-2 text-left text-slate-100 hover:bg-slate-800"
            >
              {target.label}
            </button>
          ))}
        </div>
      </details>
      {error && <p role="alert" className="w-full text-red-300">{error}</p>}
    </form>
  );
}