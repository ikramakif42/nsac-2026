import { lazy, Suspense } from "react";
import { useStore } from "../../store/useStore";
import WebGL2Canvas from "./WebGL2Canvas";
import type { ObservationRecord } from "../../types/cids";

// Three.js viewers lazy-loaded (Phase 6)
const SphereViewer = lazy(() => import("./SphereViewer"));
const CubeViewer   = lazy(() => import("./CubeViewer"));

interface Props {
  records: ObservationRecord[];
}

const TAB_LABELS = {
  "2d":        "2D Image",
  "3d_sphere": "3D Sphere",
  "3d_cube":   "3D Cube",
} as const;

export default function ViewportTabs({ records }: Props) {
  const { viewMode, setViewMode } = useStore((s) => ({
    viewMode:    s.viewMode,
    setViewMode: s.setViewMode,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex border-b border-[var(--ol-border)] bg-[var(--ol-surface)] shrink-0"
        role="tablist"
        aria-label="Viewer mode"
      >
        {(["2d", "3d_sphere", "3d_cube"] as const).map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={viewMode === mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-xs font-mono transition-colors border-b-2 ${
              viewMode === mode
                ? "border-[var(--ol-accent)] text-[var(--ol-accent)]"
                : "border-transparent text-[var(--ol-muted)] hover:text-[var(--ol-text)]"
            }`}
          >
            {TAB_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Viewport */}
      <div className="flex-1 min-h-0">
        {viewMode === "2d" && <WebGL2Canvas records={records} />}
        {viewMode === "3d_sphere" && (
          <Suspense fallback={<ViewerLoading label="Loading 3D sphere…" />}>
            <SphereViewer records={records} />
          </Suspense>
        )}
        {viewMode === "3d_cube" && (
          <Suspense fallback={<ViewerLoading label="Loading 3D cube…" />}>
            <CubeViewer records={records} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function ViewerLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full text-[var(--ol-muted)] text-sm">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}

