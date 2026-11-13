import { useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Info, ExternalLink } from "lucide-react";
import TopBar from "../components/TopBar/TopBar";
import ViewportTabs from "../components/SkyViewer/ViewportTabs";
import TimelineControls from "../components/Timeline/TimelineControls";
import SEDDrawer from "../components/SEDDrawer/SEDDrawer";
import MetadataPanel from "../components/MetadataPanel/MetadataPanel";
import StatusNotice from "../components/StatusNotice";
import { useStore } from "../store/useStore";
import { getConnector } from "../connectors";
import type { SearchQuery, DataSource } from "../types/cids";

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    result,
    status,
    errorMessage,
    activeSource,
    playback,
    fov,
    metaOpen,
    setQuery,
    setResult,
    setStatus,
    setActiveRecord,
    setEpochIndex,
    toggleMeta,
    setFOV,
  } = useStore((s) => ({
    result:          s.result,
    status:          s.status,
    errorMessage:    s.errorMessage,
    activeSource:    s.activeSource,
    playback:        s.playback,
    fov:             s.fov,
    metaOpen:        s.metaOpen,
    setQuery:        s.setQuery,
    setResult:       s.setResult,
    setStatus:       s.setStatus,
    setActiveRecord: s.setActiveRecord,
    setEpochIndex:   s.setEpochIndex,
    toggleMeta:      s.toggleMeta,
    setFOV:          s.setFOV,
  }));

  const records = result?.records ?? [];
  const isEmbed = searchParams.get("embed") === "true";

  const handleSearch = useCallback(
    async (q: SearchQuery) => {
      const sourceToUse = q.source || activeSource || "synthetic";
      setQuery(q);
      setStatus("searching");

      // Bi-directional URL synchronization
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("ra", q.ra.toFixed(4));
          next.set("dec", q.dec.toFixed(4));
          if (q.radius_arcsec) {
            next.set("fov", ((q.radius_arcsec * 2) / 3600).toFixed(1));
          }
          next.set("source", sourceToUse);
          return next;
        },
        { replace: true }
      );

      setFOV({
        centerRa: q.ra,
        centerDec: q.dec,
        fovDeg: q.radius_arcsec ? (q.radius_arcsec * 2) / 3600 : 5.0,
      });

      try {
        const connector = getConnector(sourceToUse);
        const res = await connector.search(q);
        setResult(res);
        setActiveRecord(res.records[0] ?? null);
        setStatus("ready");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus("error", msg);
      }
    },
    [activeSource, setQuery, setStatus, setSearchParams, setFOV, setResult, setActiveRecord]
  );

  // Sync epoch index changes to URL
  useEffect(() => {
    if (records.length > 0) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("epoch", String(playback.epochIndex));
          return next;
        },
        { replace: true }
      );
    }
  }, [playback.epochIndex, records.length, setSearchParams]);

  // Deep-link: on mount, parse URL params or load default target
  useEffect(() => {
    const raParam = searchParams.get("ra");
    const decParam = searchParams.get("dec");
    const fovParam = searchParams.get("fov");
    const sourceParam = (searchParams.get("source") as DataSource) || "synthetic";
    const epochParam = searchParams.get("epoch");

    const ra = raParam ? parseFloat(raParam) : 269.4521; // Default to Barnard's Star
    const dec = decParam ? parseFloat(decParam) : 4.6934;
    const fovDeg = fovParam ? parseFloat(fovParam) : 5.0;

    handleSearch({
      ra,
      dec,
      radius_arcsec: (fovDeg * 3600) / 2,
      source: sourceParam,
    });

    if (epochParam) {
      const ep = parseInt(epochParam, 10);
      if (!isNaN(ep)) setEpochIndex(ep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--ol-bg)]">
      {/* Top bar (hidden in iframe embed mode) */}
      {!isEmbed && <TopBar onSearch={handleSearch} showSearchBar />}

      {/* Embed header pill */}
      {isEmbed && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--ol-surface)] border-b border-[var(--ol-border)] text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--ol-accent)]">ORBIT-LENS</span>
            <span className="text-[var(--ol-muted)]">
              RA: {fov.centerRa.toFixed(4)}° Dec: {fov.centerDec.toFixed(4)}°
            </span>
          </div>
          <a
            href={window.location.href.replace("&embed=true", "").replace("embed=true", "")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--ol-accent)] hover:underline"
          >
            <span>Open in App</span>
            <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* Status notice (idle / searching / error / empty) */}
      <StatusNotice
        status={status}
        errorMessage={errorMessage}
        hasResults={records.length > 0}
        onSwitchToSynthetic={() => {
          handleSearch({
            ra: fov.centerRa,
            dec: fov.centerDec,
            radius_arcsec: (fov.fovDeg * 3600) / 2,
            source: "synthetic",
          });
        }}
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

          {/* SED drawer (hidden in compact embed unless expanded) */}
          <SEDDrawer />
        </div>

        {/* Metadata panel */}
        {!isEmbed && <MetadataPanel />}
      </div>

      {/* Meta toggle button */}
      {!isEmbed && (
        <button
          onClick={toggleMeta}
          className="fixed bottom-4 right-4 p-2 rounded-full bg-[var(--ol-surface)] border border-[var(--ol-border)] text-[var(--ol-muted)] hover:text-[var(--ol-accent)] transition-colors shadow-lg z-30"
          aria-label={metaOpen ? "Close metadata inspector" : "Open metadata inspector"}
          aria-pressed={metaOpen}
        >
          <Info size={18} />
        </button>
      )}

      {/* Footer disclaimer (compact in embed) */}
      <div className="text-center py-1 text-[11px] text-[var(--ol-muted)]/60 bg-[var(--ol-surface)] border-t border-[var(--ol-border)]/50">
        ORBIT-LENS · Independent project by Team Schwarzschildren · Not affiliated with NASA
      </div>
    </div>
  );
}
