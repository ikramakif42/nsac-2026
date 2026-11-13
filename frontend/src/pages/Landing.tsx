import { Link } from "react-router-dom";
import { Telescope, ArrowRight } from "lucide-react";
import { BENCHMARK_TARGETS } from "../types/cids";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";

export default function Landing() {
  const navigate = useNavigate();
  const setQuery  = useStore((s) => s.setQuery);

  const handleBenchmark = (ra: number, dec: number) => {
    setQuery({ ra, dec, radius_arcsec: 30 });
    navigate(`/explore?ra=${ra}&dec=${dec}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--ol-bg)] text-[var(--ol-text)]">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 py-20">
        <div className="flex items-center gap-3 text-[var(--ol-accent)]">
          <Telescope size={48} strokeWidth={1.5} aria-hidden />
        </div>
        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-[var(--ol-accent)]">ORBIT</span>
          <span className="text-[var(--ol-text)]">-LENS</span>
        </h1>
        <p className="text-lg text-[var(--ol-muted)] max-w-xl">
          Explore multi-epoch infrared sky observations from SPHEREx. 
          Visualize stellar variability, spectral energy distributions, 
          and time-domain phenomena across 102 photometric bands.
        </p>

        <Link
          to="/explore"
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--ol-accent)] text-[var(--ol-bg)] font-semibold hover:opacity-90 transition-opacity"
        >
          Open Explorer <ArrowRight size={18} aria-hidden />
        </Link>

        {/* Benchmark quick-launch */}
        <div className="mt-4">
          <p className="text-xs text-[var(--ol-muted)] mb-3 uppercase tracking-wider">Quick targets</p>
          <div className="flex flex-wrap justify-center gap-2">
            {BENCHMARK_TARGETS.map((t) => (
              <button
                key={t.label}
                onClick={() => handleBenchmark(t.ra, t.dec)}
                className="px-3 py-1.5 text-sm rounded border border-[var(--ol-border)] text-[var(--ol-muted)] hover:border-[var(--ol-accent)] hover:text-[var(--ol-accent)] transition-colors"
                title={t.description}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Disclaimer footer */}
      <footer className="text-center px-6 py-4 text-xs text-[var(--ol-muted)] border-t border-[var(--ol-border)]">
        ORBIT-LENS is an independent project by Team Schwarzschildren. 
        Not affiliated with or endorsed by NASA or SPHEREx. 
        Data sourced from IRSA/NASA public archives. · 
        <Link to="/terms" className="underline hover:text-[var(--ol-accent)]">Terms</Link> · 
        <Link to="/privacy" className="underline hover:text-[var(--ol-accent)] ml-1">Privacy</Link>
      </footer>
    </div>
  );
}

