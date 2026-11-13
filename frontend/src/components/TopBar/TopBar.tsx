import { useState } from "react";
import { Link } from "react-router-dom";
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
  const { activeSource } = useStore((s) => ({
    activeSource: s.activeSource,
  }));

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
    return `<iframe src="${url.toString()}" width="100%" height="600" frameborder="0" allowfullscreen style="border:1px solid #2a3a52; border-radius:8px;"></iframe>`;
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(getEmbedSnippet());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2500);
  };

  return (
    <>
      <header
        className="flex items-center gap-3 px-4 py-2 border-b border-[var(--ol-border)] bg-[var(--ol-surface)] shrink-0 flex-wrap"
        style={{ minHeight: 52 }}
      >
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 text-[var(--ol-accent)] font-bold tracking-widest shrink-0 hover:opacity-80 transition-opacity"
          aria-label="ORBIT-LENS home"
        >
          <Telescope size={18} aria-hidden />
          <span className="text-xs font-mono uppercase tracking-wider">Orbit-Lens</span>
        </Link>

        {/* Search bar (Explore page) */}
        {showSearchBar && onSearch && (
          <div className="flex-1 min-w-0">
            <CoordinateForm onSearch={onSearch} />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Active Source Badge */}
          <SourceBadge source={activeSource} />

          {/* Share Deep-Link Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono rounded border border-[var(--ol-border)] text-[var(--ol-muted)] hover:text-[var(--ol-accent)] hover:border-[var(--ol-accent)] transition-colors"
            title="Copy shareable link with current coordinates & settings"
            aria-label="Share deep-link"
          >
            {copiedShare ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            <span>{copiedShare ? "Copied!" : "Share"}</span>
          </button>

          {/* Embed Snippet Button */}
          <button
            onClick={() => setShowEmbedModal(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono rounded border border-[var(--ol-border)] text-[var(--ol-muted)] hover:text-[var(--ol-accent)] hover:border-[var(--ol-accent)] transition-colors"
            title="Get embeddable iframe snippet"
            aria-label="Embed on another site"
          >
            <Code size={13} />
            <span>Embed</span>
          </button>

          <nav className="flex gap-3 text-xs text-[var(--ol-muted)] ml-1 border-l border-[var(--ol-border)] pl-2">
            <Link to="/explore" className="hover:text-[var(--ol-accent)] transition-colors">Explore</Link>
            <Link to="/about" className="hover:text-[var(--ol-accent)] transition-colors">About</Link>
            <Link to="/methodology" className="hover:text-[var(--ol-accent)] transition-colors">Methods</Link>
          </nav>
        </div>
      </header>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--ol-surface)] border border-[var(--ol-border)] rounded-lg p-5 max-w-lg w-full space-y-3 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-[var(--ol-accent)] font-mono">Embed Interactive Viewer</h3>
              <button
                onClick={() => setShowEmbedModal(false)}
                className="text-xs text-[var(--ol-muted)] hover:text-white"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-xs text-[var(--ol-muted)]">
              Paste this HTML snippet into your website, blog, or Space Apps project page:
            </p>
            <textarea
              readOnly
              value={getEmbedSnippet()}
              rows={4}
              className="w-full bg-[var(--ol-bg)] border border-[var(--ol-border)] rounded p-2 text-xs font-mono text-[var(--ol-text)] select-all"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCopyEmbed}
                className="px-3 py-1.5 rounded bg-[var(--ol-accent)] text-[var(--ol-bg)] font-semibold text-xs flex items-center gap-1"
              >
                {copiedEmbed ? <Check size={14} /> : <Code size={14} />}
                {copiedEmbed ? "Snippet Copied!" : "Copy HTML Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
