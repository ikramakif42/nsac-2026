import type { DataSource } from "../../types/cids";
import { Sparkles, Flame, Orbit, Cpu, Compass } from "lucide-react";

export const SOURCE_LABELS: Record<DataSource, string> = {
  qr3:       "SPHEREx QR3",
  wiseview:  "WiseView (AllWISE)",
  gaia:      "ESA Gaia DR3",
  synthetic: "6-Array Demo",
  mast:      "MAST Archive",
  vizier:    "CDS VizieR",
};

interface Props {
  source: DataSource;
  className?: string;
}

export default function SourceBadge({ source, className = "" }: Props) {
  const badgeStyles: Record<DataSource, string> = {
    qr3:       "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]",
    wiseview:  "bg-orange-500/15 text-orange-300 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]",
    gaia:      "bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]",
    synthetic: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
    mast:      "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.15)]",
    vizier:    "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };

  const getIcon = () => {
    switch (source) {
      case "qr3":       return <Orbit size={12} className="animate-spin-slow" />;
      case "wiseview":  return <Flame size={12} />;
      case "gaia":      return <Compass size={12} />;
      case "synthetic": return <Cpu size={12} />;
      default:          return <Sparkles size={12} />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wide border backdrop-blur-sm ${badgeStyles[source] || badgeStyles.qr3} ${className}`}
      aria-label={`Data source: ${SOURCE_LABELS[source]}`}
    >
      {getIcon()}
      <span>{SOURCE_LABELS[source]}</span>
    </span>
  );
}
