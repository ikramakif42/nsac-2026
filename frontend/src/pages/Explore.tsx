import { useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Info } from "lucide-react";
import TopBar from "../components/TopBar/TopBar";
import ViewportTabs from "../components/SkyViewer/ViewportTabs";
import TimelineControls from "../components/Timeline/TimelineControls";
import SEDDrawer from "../components/SEDDrawer/SEDDrawer";
import MetadataPanel from "../components/MetadataPanel/MetadataPanel";
import StatusNotice from "../components/StatusNotice";
import { useStore } from "../store/useStore";
import { getConnector } from "../connectors";
import type { SearchQuery } from "../types/cids";

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    result, status, setQuery, setResult, setStatus, setActiveRecord,
    toggleMeta, metaOpen,
  } = useStore((s) => ({
    result:         s.result,
    status:         s.status,
    setQuery:       s.setQuery,
    setResult:      s.setResult,
    setStatus:      s.setStatus,
    setActiveRecord: s.setActiveRecord,
    toggleMeta:     s.toggleMeta,
    metaOpen:       s.metaOpen,
  }));

  const records = result?.records ?? [];

  const handleSearch = useCallback(async (q: SearchQuery) => {
    setQuery(q);
    setStatus("searching");
    // Deep-link: update URL params
    setSearchParams({ ra: String(q.ra), dec: String(q.dec) });
    try {
      const connector = getConnector("qr3");
      const res = await connector.search(q);
      setResult(res);
      setActiveRecord(res.records[0] ?? null);
      setStatus(res.records.length > 0 ? "ready" : "ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("error", msg);
      // CRITICAL: never fall back to synthetic silently
    }
  }, [setQuery, setResult, setStatus, setActiveRecord, setSearchParams]);

  // Deep-link: on mount, if URL has ra/dec, trigger search
  useEffect(() => {
    const ra = parseFloat(searchParams.get("ra") ?? "");
    const dec = parseFloat(searchParams.get("dec") ?? "");
    if (!isNaN(ra) && !isNaN(dec)) {
      handleSearch({ ra, dec, radius_arcsec: 30 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--ol-bg)]">
      {/* Top bar with search */}
      <TopBar onSearch={handleSearch} showSearchBar />

      {/* Status notice (idle / searching / error / empty) */}
      <StatusNotice
        status={status}
        errorMessage={useStore.getState().errorMessage}
        hasResults={records.length > 0}
      />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Viewer + timeline + SED */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Viewport */}
          <div className="flex-1 min-h-0">
            <ViewportTabs records={records} />
          </div>

          {/* Timeline */}
          <TimelineControls totalFrames={records.length} />

          {/* SED drawer */}
          <SEDDrawer />
        </div>

        {/* Metadata panel */}
        <MetadataPanel />
      </div>

      {/* Meta toggle button (always accessible) */}
      <button
        onClick={toggleMeta}
        className="fixed bottom-4 right-4 p-2 rounded-full bg-[var(--ol-surface)] border border-[var(--ol-border)] text-[var(--ol-muted)] hover:text-[var(--ol-accent)] transition-colors shadow-lg"
        aria-label={metaOpen ? "Close metadata inspector" : "Open metadata inspector"}
        aria-pressed={metaOpen}
      >
        <Info size={18} />
      </button>

      {/* Disclaimer */}
      <div className="text-center py-1 text-xs text-[var(--ol-muted)]/50">
        ORBIT-LENS · Independent project by Team Schwarzschildren · Not affiliated with NASA
      </div>
    </div>
  );
}

