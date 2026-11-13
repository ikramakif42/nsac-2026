import { AlertCircle, Loader2, SearchX, Info, RefreshCw } from "lucide-react";
import type { AppStatus } from "../store/useStore";

interface Props {
  status: AppStatus;
  errorMessage?: string | null;
  hasResults?: boolean;
  onSwitchToSynthetic?: () => void;
}

export default function StatusNotice({
  status,
  errorMessage,
  hasResults,
  onSwitchToSynthetic,
}: Props) {
  if (status === "ready" && hasResults) return null;

  if (status === "idle") {
    return (
      <Notice icon={<Info size={18} />} color="muted">
        Enter sky coordinates or select a benchmark target above to begin.
      </Notice>
    );
  }

  if (status === "searching" || status === "loading_cutout") {
    return (
      <Notice icon={<Loader2 size={18} className="animate-spin" />} color="accent">
        {status === "searching" ? "Querying observations across SPHEREx detector arrays…" : "Fetching FITS cutout…"}
      </Notice>
    );
  }

  if (status === "ready" && !hasResults) {
    return (
      <Notice icon={<SearchX size={18} />} color="muted">
        No observations found for this position in the current data release.
      </Notice>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-rose-950/40 border-b border-rose-800/40 text-[var(--ol-danger)] text-xs">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMessage ?? "An error occurred fetching observations."}</span>
        </div>
        {onSwitchToSynthetic && (
          <button
            onClick={onSwitchToSynthetic}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--ol-warning)] text-[var(--ol-bg)] font-semibold text-xs hover:opacity-90 transition-opacity ml-4 shrink-0"
          >
            <RefreshCw size={12} />
            <span>Switch to Synthetic 6-Array Demo</span>
          </button>
        )}
      </div>
    );
  }

  return null;
}

function Notice({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: "accent" | "muted" | "danger";
  children: React.ReactNode;
}) {
  const colorMap = {
    accent: "text-[var(--ol-accent)] bg-[var(--ol-surface)]",
    muted:  "text-[var(--ol-muted)] bg-[var(--ol-surface)]",
    danger: "text-[var(--ol-danger)] bg-rose-950/30",
  };
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 border-b border-[var(--ol-border)] ${colorMap[color]} text-xs`} role="status">
      {icon}
      <span>{children}</span>
    </div>
  );
}
