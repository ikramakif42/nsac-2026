import { AlertCircle, Loader2, SearchX, Info } from "lucide-react";
import type { AppStatus } from "../store/useStore";

interface Props {
  status: AppStatus;
  errorMessage?: string | null;
  hasResults?: boolean;
}

export default function StatusNotice({ status, errorMessage, hasResults }: Props) {
  if (status === "ready" && hasResults) return null;

  if (status === "idle") {
    return (
      <Notice icon={<Info size={20} />} color="muted">
        Enter sky coordinates or select a benchmark target above to begin.
      </Notice>
    );
  }

  if (status === "searching" || status === "loading_cutout") {
    return (
      <Notice icon={<Loader2 size={20} className="animate-spin" />} color="accent">
        {status === "searching" ? "Querying IRSA archive…" : "Fetching FITS cutout…"}
      </Notice>
    );
  }

  if (status === "ready" && !hasResults) {
    return (
      <Notice icon={<SearchX size={20} />} color="muted">
        No observations found for this position in the current release.
      </Notice>
    );
  }

  if (status === "error") {
    return (
      <Notice icon={<AlertCircle size={20} />} color="danger">
        {errorMessage ?? "An unknown error occurred."}
        {/* CRITICAL: never silently falls back to synthetic. User must see this error. */}
      </Notice>
    );
  }

  return null;
}

function Notice({
  icon, color, children,
}: {
  icon: React.ReactNode;
  color: "accent" | "muted" | "danger";
  children: React.ReactNode;
}) {
  const colorMap = {
    accent: "text-[var(--ol-accent)]",
    muted:  "text-[var(--ol-muted)]",
    danger: "text-[var(--ol-danger)]",
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${colorMap[color]} text-sm`} role="status">
      {icon}
      <span>{children}</span>
    </div>
  );
}

