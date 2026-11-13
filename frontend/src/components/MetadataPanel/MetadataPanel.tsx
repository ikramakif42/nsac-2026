import { X } from "lucide-react";
import { useStore } from "../../store/useStore";

/** Metadata inspector panel — Phase 2/3 populates FITS headers */
export default function MetadataPanel() {
  const { metaOpen, toggleMeta, activeRecord } = useStore((s) => ({
    metaOpen:     s.metaOpen,
    toggleMeta:   s.toggleMeta,
    activeRecord: s.activeRecord,
  }));

  if (!metaOpen) return null;

  return (
    <aside
      className="w-72 shrink-0 border-l border-[var(--ol-border)] bg-[var(--ol-surface)] flex flex-col overflow-hidden"
      aria-label="Metadata inspector"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ol-border)]">
        <span className="text-xs font-mono font-semibold text-[var(--ol-accent)]">Inspector</span>
        <button onClick={toggleMeta} aria-label="Close inspector" className="text-[var(--ol-muted)] hover:text-[var(--ol-text)]">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
        {activeRecord ? (
          <>
            <MetaRow label="ID"           value={activeRecord.id} />
            <MetaRow label="Source"       value={activeRecord.source} />
            <MetaRow label="Band"         value={activeRecord.band} />
            <MetaRow label="λ"            value={`${activeRecord.wavelength_um.toFixed(3)} μm`} />
            <MetaRow label="Epoch MJD"    value={String(activeRecord.epoch_mjd)} />
            <MetaRow label="RA"           value={`${activeRecord.ra_center.toFixed(5)}°`} />
            <MetaRow label="Dec"          value={`${activeRecord.dec_center.toFixed(5)}°`} />
            <MetaRow label="SNR"          value={activeRecord.snr?.toFixed(1) ?? "—"} />
            <MetaRow label="Quality"      value={activeRecord.quality_ok ? "✓ PASS" : "✗ FAIL"} />
            {activeRecord.quality_flags !== undefined && (
              <MetaRow label="Flags"      value={`0x${activeRecord.quality_flags.toString(16).toUpperCase()}`} />
            )}
            <div className="pt-2 text-[var(--ol-muted)]">WCS Parameters</div>
            <MetaRow label="NAXIS"        value={`${activeRecord.wcs.naxis1} × ${activeRecord.wcs.naxis2}`} />
            <MetaRow label="CRPIX"        value={`${activeRecord.wcs.crpix1}, ${activeRecord.wcs.crpix2}`} />
            <MetaRow label="CRVAL"        value={`${activeRecord.wcs.crval1.toFixed(4)}, ${activeRecord.wcs.crval2.toFixed(4)}`} />
            <MetaRow label="CDELT"        value={`${(activeRecord.wcs.cdelt1 * 3600).toFixed(3)}"` } />
          </>
        ) : (
          <span className="text-[var(--ol-muted)]">No record selected</span>
        )}
      </div>
    </aside>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--ol-muted)] w-20 shrink-0">{label}</span>
      <span className="text-[var(--ol-text)] break-all">{value}</span>
    </div>
  );
}

