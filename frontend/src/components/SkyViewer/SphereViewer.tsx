// Phase 6: Three.js sphere viewer (lazy-loaded)
// Placeholder until Phase 6 implementation
import type { ObservationRecord } from "../../types/cids";

interface Props { records: ObservationRecord[]; }

export default function SphereViewer({ records: _ }: Props) {
  return (
    <div className="flex items-center justify-center h-full text-[var(--ol-muted)] text-sm flex-col gap-2">
      <span className="text-3xl">🌐</span>
      <span>3D Sphere Viewer — Phase 6</span>
      <span className="text-xs opacity-60">Three.js / React Three Fiber</span>
    </div>
  );
}

