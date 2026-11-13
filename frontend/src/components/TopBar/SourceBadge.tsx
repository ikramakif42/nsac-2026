import type { DataSource } from "../../types/cids";

const SOURCE_LABELS: Record<DataSource, string> = {
  qr3:       "SPHEREx QR3",
  synthetic: "SYNTHETIC",
  mast:      "MAST",
  vizier:    "VizieR",
};

interface Props {
  source: DataSource;
  className?: string;
}

/** Always visible — never hidden. CIDS requirement. */
export default function SourceBadge({ source, className = "" }: Props) {
  return (
    <span
      className={`badge-${source} inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wide ${className}`}
      aria-label={`Data source: ${SOURCE_LABELS[source]}`}
    >
      {source === "synthetic" && <span aria-hidden>⚠</span>}
      {SOURCE_LABELS[source]}
    </span>
  );
}

