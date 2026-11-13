import { ChevronDown, ChevronUp } from "lucide-react";
import { useStore } from "../../store/useStore";

/** SED drawer skeleton — Phase 5 adds uPlot chart */
export default function SEDDrawer() {
  const { sedOpen, toggleSED, activeRecord } = useStore((s) => ({
    sedOpen:      s.sedOpen,
    toggleSED:    s.toggleSED,
    activeRecord: s.activeRecord,
  }));

  return (
    <div className="border-t border-[var(--ol-border)] bg-[var(--ol-surface)] shrink-0">
      <button
        onClick={toggleSED}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-mono text-[var(--ol-muted)] hover:text-[var(--ol-text)] transition-colors"
        aria-expanded={sedOpen}
        aria-controls="sed-panel"
      >
        <span>Spectral Energy Distribution (102-band)</span>
        {sedOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {sedOpen && (
        <div
          id="sed-panel"
          className="px-4 pb-4"
          style={{ height: 180 }}
          role="region"
          aria-label="SED chart"
        >
          {activeRecord ? (
            <div className="flex items-center justify-center h-full border border-dashed border-[var(--ol-border)] rounded text-[var(--ol-muted)] text-xs">
              uPlot SED chart — Phase 5
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--ol-muted)] text-xs">
              Search for a target to view SED
            </div>
          )}
        </div>
      )}
    </div>
  );
}

