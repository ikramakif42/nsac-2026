// Phase 6: Three.js data cube viewer (lazy-loaded)
import type { ObservationRecord } from "../../types/cids";

interface Props { records: ObservationRecord[]; }

export default function CubeViewer({ records: _ }: Props) {
  return (
    <div className="flex items-center justify-center h-full text-[var(--ol-muted)] text-sm flex-col gap-2">
      <span className="text-3xl">🧊</span>
      <span>3D Data Cube Viewer — Phase 6</span>
      <span className="text-xs opacity-60">Three.js instanced geometry</span>
    </div>
  );
}

