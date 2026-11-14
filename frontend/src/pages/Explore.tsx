import { useCallback, useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ExternalLink, Info } from "lucide-react";
import TopBar from "../components/TopBar/TopBar";
import ViewportTabs from "../components/SkyViewer/ViewportTabs";
import TimelineControls from "../components/Timeline/TimelineControls";
import SEDDrawer from "../components/SEDDrawer/SEDDrawer";
import MetadataPanel from "../components/MetadataPanel/MetadataPanel";
import StatusNotice from "../components/StatusNotice";
import { useStore } from "../store/useStore";
import { getConnector } from "../connectors";
import {
  assertObservationSourceAvailable,
  boundEpoch,
  parseExploreLocation,
  SOURCE_LABELS,
  validateSearchQuery,
  writeExploreLocation,
} from "../lib/exploreState";
import type { DataSource, SearchQuery } from "../types/cids";

interface Props {
  defaultSource?: DataSource;
}

export default function Explore({ defaultSource }: Props = {}) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requestId = useRef(0);
  const alive = useRef(true);
  const paramsRef = useRef(params);
  const lastAppliedLocation = useRef<string | null>(null);
  paramsRef.current = params;

  const result = useStore((s) => s.result);
  const status = useStore((s) => s.status);
  const errorMessage = useStore((s) => s.errorMessage);
  const activeSource = useStore((s) => s.activeSource);
  const epochIndex = useStore((s) => s.playback.epochIndex);
  const fov = useStore((s) => s.fov);
  const metaOpen = useStore((s) => s.metaOpen);
  const isEmbed = params.get("embed") === "true";

  const records =
    status === "ready" && result?.source_used === activeSource
      ? result.records
      : [];

  useEffect(() => {
    alive.current = true;
    useStore.getState().setPlaying(false);
    return () => {
      alive.current = false;
      requestId.current += 1;
      useStore.getState().setPlaying(false);
    };
  }, []);

  const runSearch = useCallback(async (
    input: SearchQuery,
    requestedEpoch: number,
  ) => {
    const ticket = ++requestId.current;
    const store = useStore.getState();
    store.setPlaying(false);
    store.setActiveRecord(null);
    store.setEpochIndex(0);

    try {
      const query = validateSearchQuery(input, store.activeSource);
      const source = query.source!;
      store.setActiveSource(source);
      store.setQuery(query);
      store.setFOV({
        centerRa: query.ra,
        centerDec: query.dec,
        fovDeg: query.radius_arcsec! / 1800,
        activeTile: null,
        prefetchTiles: [],
      });
      store.setStatus("searching");
      assertObservationSourceAvailable(source);

      const response = await getConnector(source).search(query);
      if (!alive.current || ticket !== requestId.current) return;

      if (
        response.source_used !== source ||
        response.records.some((record) => record.source !== source)
      ) {
        throw new Error(
          "The connector returned a different source. No substitute data was accepted.",
        );
      }

      const index = boundEpoch(requestedEpoch, response.records.length);
      const current = useStore.getState();
      current.setResult(response);
      current.setEpochIndex(index);
      current.setActiveRecord(response.records[index] ?? null);
      current.setStatus("ready");
    } catch (error) {
      if (!alive.current || ticket !== requestId.current) return;
      useStore.getState().setStatus(
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }, []);

  const handleSearch = useCallback((input: SearchQuery) => {
    try {
      const query = validateSearchQuery(
        input,
        useStore.getState().activeSource,
      );
      const next = writeExploreLocation(paramsRef.current, query, 0);
      lastAppliedLocation.current = next.toString();
      setParams(next, { replace: true });
      void runSearch(query, 0);
    } catch (error) {
      requestId.current += 1;
      useStore.getState().setActiveRecord(null);
      useStore.getState().setStatus(
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [runSearch, setParams]);

  useEffect(() => {
    const key = params.toString();
    if (lastAppliedLocation.current === key) return;
    lastAppliedLocation.current = key;

    try {
      const fallback =
        location.pathname.startsWith("/demo")
          ? "synthetic"
          : defaultSource ?? "qr3";
      const parsed = parseExploreLocation(params, fallback);
      void runSearch(parsed.query, parsed.epoch);
    } catch (error) {
      requestId.current += 1;
      useStore.getState().setActiveRecord(null);
      useStore.getState().setStatus(
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [params, location.pathname, defaultSource, runSearch]);

  useEffect(() => {
    if (status !== "ready" || !result || result.source_used !== activeSource) {
      return;
    }
    const index = boundEpoch(epochIndex, result.records.length);
    const store = useStore.getState();
    if (index !== epochIndex) store.setEpochIndex(index);
    store.setActiveRecord(result.records[index] ?? null);

    const next = writeExploreLocation(
      paramsRef.current,
      { ...result.query, source: result.source_used },
      index,
    );
    if (next.toString() !== paramsRef.current.toString()) {
      lastAppliedLocation.current = next.toString();
      setParams(next, { replace: true });
    }
  }, [epochIndex, result, status, activeSource, setParams]);

  const appParams = new URLSearchParams(params);
  appParams.delete("embed");
  const appHref = `${location.pathname}?${appParams.toString()}`;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--ol-bg)]">
      {!isEmbed && <TopBar onSearch={handleSearch} showSearchBar />}

      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          {isEmbed && <strong>ORBIT-LENS</strong>}
          <span
            data-testid="source-badge"
            aria-label={`Active source: ${SOURCE_LABELS[activeSource]}`}
            className="font-semibold text-cyan-300"
          >
            {SOURCE_LABELS[activeSource]}
          </span>
          <span>
            RA {fov.centerRa}° · Dec {fov.centerDec}° · {fov.fovDeg}° FOV
          </span>
        </div>
        {isEmbed && (
          <a
            href={appHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cyan-300 underline"
          >
            Open in app <ExternalLink size={12} />
          </a>
        )}
      </header>

      <StatusNotice
        status={status}
        errorMessage={errorMessage}
        hasResults={records.length > 0}
        onSwitchToSynthetic={() => handleSearch({
          ra: fov.centerRa,
          dec: fov.centerDec,
          radius_arcsec: fov.fovDeg * 1800,
          source: "synthetic",
        })}
      />

      {status === "ready" && result?.warning && (
        <p role="status" className="border-b border-amber-800 bg-slate-950 px-3 py-2 text-sm text-amber-200">
          {result.warning}
        </p>
      )}

      <main className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <ViewportTabs records={records} onSearch={handleSearch} />
          </div>
          <TimelineControls totalFrames={records.length} />
          <SEDDrawer />
        </div>
        {!isEmbed && <MetadataPanel />}
      </main>

      {!isEmbed && (
        <button
          type="button"
          onClick={() => useStore.getState().toggleMeta()}
          className="fixed bottom-12 right-4 z-30 rounded border border-slate-600 bg-slate-950 p-2 text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          aria-label={metaOpen ? "Close metadata inspector" : "Open metadata inspector"}
          aria-pressed={metaOpen}
        >
          <Info size={18} />
        </button>
      )}

      <footer className="border-t border-slate-700 bg-slate-950 py-1 text-center text-xs text-slate-300">
        ORBIT-LENS · Team Schwarzschildren · Not affiliated with NASA
      </footer>
    </div>
  );
}