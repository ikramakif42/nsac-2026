import { Link } from "react-router-dom";
import { Telescope } from "lucide-react";
import CoordinateForm from "./CoordinateForm";
import SourceBadge from "./SourceBadge";
import { useStore } from "../../store/useStore";
import type { SearchQuery } from "../../types/cids";

interface Props {
  onSearch?: (q: SearchQuery) => void;
  showSearchBar?: boolean;
}

export default function TopBar({ onSearch, showSearchBar = false }: Props) {
  const { activeSource, activeRecord } = useStore((s) => ({
    activeSource: s.activeSource,
    activeRecord: s.activeRecord,
  }));

  return (
    <header
      className="flex items-center gap-4 px-4 py-2 border-b border-[var(--ol-border)] bg-[var(--ol-surface)]"
      style={{ minHeight: 52 }}
    >
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center gap-2 text-[var(--ol-accent)] font-bold tracking-widest shrink-0 hover:opacity-80 transition-opacity"
        aria-label="ORBIT-LENS home"
      >
        <Telescope size={20} aria-hidden />
        <span className="text-sm font-mono uppercase">Orbit-Lens</span>
      </Link>

      {/* Search bar (Explore page only) */}
      {showSearchBar && onSearch && (
        <div className="flex-1 min-w-0">
          <CoordinateForm onSearch={onSearch} />
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {/* Source badge — always visible when a record is active */}
        {activeRecord && <SourceBadge source={activeSource} />}

        <nav className="flex gap-3 text-xs text-[var(--ol-muted)]">
          <Link to="/explore"      className="hover:text-[var(--ol-accent)] transition-colors">Explore</Link>
          <Link to="/about"        className="hover:text-[var(--ol-accent)] transition-colors">About</Link>
          <Link to="/methodology"  className="hover:text-[var(--ol-accent)] transition-colors">Methods</Link>
        </nav>
      </div>
    </header>
  );
}

