import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Telescope, Share2, Code, Check } from "lucide-react";
import CoordinateForm from "./CoordinateForm";
import SourceBadge from "./SourceBadge";
import { useStore } from "../../store/useStore";
import type { SearchQuery } from "../../types/cids";

interface Props {
  onSearch?: (q: SearchQuery) => void;
  showSearchBar?: boolean;
}

export default function TopBar({ onSearch, showSearchBar = false }: Props) {
  const activeSource = useStore((s) => s.activeSource);
  const location = useLocation();

  const [copiedShare, setCopiedShare] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const getEmbedSnippet = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("embed", "true");
    return `<iframe src="${url.toString()}" width="100%" height="600" frameborder="0" allowfullscreen style="border:1px solid #1e293b; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);"></iframe>`;
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(getEmbedSnippet());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2500);
  };

  return (
    <>
      <header
        className="flex items-center gap-4 px-5 py-2.5 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl shrink-0 flex-wrap z-20 shadow-lg"
        style={{ minHeight: 56 }}
      >
        {/* Modern Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group shrink-0"
          aria-label="ORBIT-LENS home"
        >
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 group-hover:border-cyan-400/50 group-hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all">
            <Telescope size={18} className="text-cyan-400 group-hover:rotate-12 transition-transform duration-300" aria-hidden />
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400">
            Orbit-Lens
          </span>
        </Link>

        {/* Search bar (Explore page) */}
        {showSearchBar && onSearch && (
          <div className="flex-1 min-w-0">
            <CoordinateForm onSearch={onSearch} />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2.5">
          {/* Active Source Badge */}
          <SourceBadge source={activeSource} />

          {/* Share Deep-Link Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-white/10 transition-all shadow-sm"
            title="Copy shareable link with current coordinates & settings"
            aria-label="Share deep-link"
          >
            {copiedShare ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            <span>{copiedShare ? "Copied" : "Share"}</span>
          </button>

          {/* Embed Snippet Button */}
          <button
            onClick={() => setShowEmbedModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-white/10 transition-all shadow-sm"
            title="Get embeddable iframe snippet"
            aria-label="Embed on another site"
          >
            <Code size={13} />
            <span>Embed</span>
          </button>

          {/* Modern Navigation Links */}
          <nav className="flex items-center gap-1.5 text-xs font-mono border-l border-white/10 pl-3">
            <Link
              to="/explore"
              className={`px-2.5 py-1 rounded-md transition-colors ${
                location.pathname === "/explore"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Explore
            </Link>
            <Link
              to="/demo"
              className={`px-2.5 py-1 rounded-md transition-colors ${
                location.pathname === "/demo"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                  : "text-amber-400/80 hover:text-amber-300"
              }`}
            >
              Demo
            </Link>
            <Link
              to="/about"
              className={`px-2.5 py-1 rounded-md transition-colors ${
                location.pathname === "/about"
                  ? "bg-white/10 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              About
            </Link>
          </nav>
        </div>
      </header>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-cyan-400 font-mono tracking-wide flex items-center gap-2">
                <Code size={16} /> Embed Interactive Viewer
              </h3>
              <button
                onClick={() => setShowEmbedModal(false)}
                className="text-xs text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Paste this responsive snippet into your website, paper, or NASA Space Apps submission page:
            </p>
            <textarea
              readOnly
              value={getEmbedSnippet()}
              rows={4}
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs font-mono text-cyan-300/90 select-all focus:outline-none focus:border-cyan-400/50"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleCopyEmbed}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:brightness-110 active:scale-95 transition-all"
              >
                {copiedEmbed ? <Check size={14} /> : <Code size={14} />}
                <span>{copiedEmbed ? "Snippet Copied!" : "Copy HTML Snippet"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
