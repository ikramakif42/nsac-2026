import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useStore, type ViewMode } from "../../store/useStore";
import WebGL2Canvas from "./WebGL2Canvas";
import CDSReferencePanel from "./CDSReferencePanel";
import SkyMapViewer from "./SkyMapViewer";
import type { ObservationRecord, SearchQuery } from "../../types/cids";

const SphereViewer = lazy(() => import("./SphereViewer"));
const CubeViewer = lazy(() => import("./CubeViewer"));

interface Props {
  records: ObservationRecord[];
  onSearch?: (q: SearchQuery) => void;
}

const MODES = ["sky_map", "3d_cube", "2d", "3d_sphere"] as const;
const TAB_LABELS: Record<ViewMode, string> = {
  "sky_map": "All-Sky Map (5° Chunks)",
  "3d_cube": "3D Time-Cube",
  "2d": "2D Image",
  "3d_sphere": "3D Sphere",
};

class ViewerBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || "The 3D viewer could not load." };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    useStore.getState().setPlaying(false);
  }

  render() {
    if (this.state.message) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
          <p role="alert" className="text-sm">{this.state.message}</p>
          <button
            type="button"
            className="rounded border border-[var(--ol-border)] px-3 py-1 text-sm"
            onClick={() => useStore.getState().setViewMode("2d")}
          >
            Return to 2D
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ViewportTabs({ records, onSearch }: Props) {
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const activeRecord = useStore((state) => state.activeRecord);
  const epochIndex = useStore((state) => state.playback.epochIndex);
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const readURL = () => {
      const params = new URL(window.location.href).searchParams;
      const view = params.get("view");
      const axis = params.get("axis");
      const epoch = params.get("epoch");
      const state = useStore.getState();

      state.setPlaying(false);
      if (MODES.includes(view as ViewMode)) state.setViewMode(view as ViewMode);
      if (axis === "time" || axis === "wavelength") state.setCubeAxis(axis);
      if (epoch !== null && /^\d+$/.test(epoch)) {
        const index = Number(epoch);
        if (Number.isSafeInteger(index)) state.setEpochIndex(index);
      }
    };
    readURL();
    window.addEventListener("popstate", readURL);
    return () => window.removeEventListener("popstate", readURL);
  }, []);

  const activate = (mode: ViewMode) => {
    useStore.getState().setPlaying(false);
    setViewMode(mode);
    const url = new URL(window.location.href);
    url.searchParams.set("view", mode);
    window.history.replaceState(window.history.state, "", url);
  };

  const referenceRecord =
    activeRecord ??
    records[Math.min(Math.max(0, epochIndex), Math.max(0, records.length - 1))] ??
    null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-slate-950/70 backdrop-blur shrink-0"
        role="tablist"
        aria-label="Viewer mode"
      >
        <div className="flex items-center rounded-xl bg-slate-900/80 border border-white/10 p-1 shadow-inner gap-1">
          {MODES.map((mode, index) => (
            <button
              key={mode}
              ref={(element) => { buttons.current[index] = element; }}
              id={`${id}-${mode}-tab`}
              role="tab"
              type="button"
              aria-selected={viewMode === mode}
              aria-controls={`${id}-${mode}-panel`}
              tabIndex={viewMode === mode ? 0 : -1}
              onClick={() => activate(mode)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === "ArrowRight") next = (index + 1) % MODES.length;
                else if (event.key === "ArrowLeft") next = (index + MODES.length - 1) % MODES.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = MODES.length - 1;
                else return;
                event.preventDefault();
                activate(MODES[next]);
                buttons.current[next]?.focus();
              }}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                viewMode === mode
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
              }`}
            >
              {TAB_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div
        id={`${id}-${viewMode}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${viewMode}-tab`}
        className="min-h-0 flex-1"
      >
        {viewMode === "sky_map" && <SkyMapViewer onSearch={onSearch} />}
        {viewMode === "2d" && <WebGL2Canvas records={records} />}
        {viewMode === "3d_sphere" && (
          <ViewerBoundary key="sphere">
            <Suspense fallback={<ViewerLoading label="Loading 3D sphere…" />}>
              <SphereViewer records={records} />
            </Suspense>
          </ViewerBoundary>
        )}
        {viewMode === "3d_cube" && (
          <ViewerBoundary key="cube">
            <Suspense fallback={<ViewerLoading label="Loading 3D cube…" />}>
              <CubeViewer records={records} />
            </Suspense>
          </ViewerBoundary>
        )}
      </div>

      <div className="max-h-[45%] shrink-0 overflow-auto">
        <CDSReferencePanel record={referenceRecord} />
      </div>
    </div>
  );
}

function ViewerLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center text-sm text-[var(--ol-muted)]"
    >
      {label}
    </div>
  );
}