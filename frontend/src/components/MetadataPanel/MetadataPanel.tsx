import { X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useQualityInspection } from "../../hooks/useQualityInspection";
import QualityInspector, {
  qualityStatusLabel,
  SourceBadge,
} from "./QualityInspector";

function finiteLabel(
  value: number | null | undefined,
  digits: number,
): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "Unavailable";
}

export default function MetadataPanel() {
  const metaOpen = useStore((state) => state.metaOpen);
  const toggleMeta = useStore((state) => state.toggleMeta);
  const activeRecord = useStore((state) => state.activeRecord);

  useQualityInspection();

  if (!metaOpen) return null;

  const rawFlags = activeRecord?.quality_flags;
  const flagsAvailable =
    typeof rawFlags === "number" &&
    Number.isInteger(rawFlags) &&
    rawFlags >= 0 &&
    rawFlags <= 65535;

  return (
    <aside
      className="w-80 shrink-0 border-l border-[var(--ol-border)] bg-[var(--ol-surface)] flex flex-col overflow-hidden"
      aria-label="Metadata inspector"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ol-border)]">
        <span className="text-xs font-mono font-semibold text-[var(--ol-accent)]">
          Inspector
        </span>
        <button
          type="button"
          onClick={toggleMeta}
          aria-label="Close inspector"
          className="p-2 text-[var(--ol-muted)] hover:text-[var(--ol-text)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
        {activeRecord ? (
          <>
            <div className="pb-2">
              <SourceBadge source={activeRecord.source} />
            </div>
            <MetaRow label="ID" value={activeRecord.id} />
            <MetaRow label="Band" value={activeRecord.band} />
            {activeRecord.array_id && (
              <MetaRow label="Array" value={activeRecord.array_id} />
            )}
            <MetaRow
              label="λ"
              value={`${finiteLabel(activeRecord.wavelength_um, 3)} μm`}
            />
            <MetaRow label="Epoch MJD" value={String(activeRecord.epoch_mjd)} />
            <MetaRow label="Epoch" value={activeRecord.epoch_label} />
            <MetaRow
              label="RA"
              value={`${finiteLabel(activeRecord.ra_center, 5)}°`}
            />
            <MetaRow
              label="Dec"
              value={`${finiteLabel(activeRecord.dec_center, 5)}°`}
            />

            <h2 className="pt-3 font-semibold">Archive metadata</h2>
            <MetaRow
              label="SNR"
              value={finiteLabel(activeRecord.snr, 2)}
            />
            <MetaRow
              label="Quality"
              value={qualityStatusLabel(activeRecord.quality_ok)}
            />
            <MetaRow
              label="Flags"
              value={
                flagsAvailable
                  ? `0x${rawFlags.toString(16).toUpperCase().padStart(4, "0")}`
                  : "Unavailable"
              }
            />
            <p className="pt-1 text-[var(--ol-muted)]">
              Archive summaries remain separate from the cutout inspection below.
            </p>

            <h2 className="pt-3 font-semibold">WCS parameters</h2>
            <MetaRow
              label="NAXIS"
              value={`${activeRecord.wcs.naxis1} × ${activeRecord.wcs.naxis2}`}
            />
            <MetaRow
              label="CRPIX"
              value={`${activeRecord.wcs.crpix1}, ${activeRecord.wcs.crpix2}`}
            />
            <MetaRow
              label="CRVAL"
              value={`${finiteLabel(activeRecord.wcs.crval1, 4)}, ${finiteLabel(activeRecord.wcs.crval2, 4)}`}
            />
            <MetaRow
              label="CDELT °"
              value={`${activeRecord.wcs.cdelt1}, ${activeRecord.wcs.cdelt2}`}
            />
            {activeRecord.wcs.crota2 != null && (
              <MetaRow
                label="CROTA2 °"
                value={String(activeRecord.wcs.crota2)}
              />
            )}
            {activeRecord.wcs.cd1_1 != null &&
              activeRecord.wcs.cd1_2 != null &&
              activeRecord.wcs.cd2_1 != null &&
              activeRecord.wcs.cd2_2 != null && (
                <>
                  <MetaRow
                    label="CD row 1"
                    value={`${activeRecord.wcs.cd1_1}, ${activeRecord.wcs.cd1_2}`}
                  />
                  <MetaRow
                    label="CD row 2"
                    value={`${activeRecord.wcs.cd2_1}, ${activeRecord.wcs.cd2_2}`}
                  />
                </>
              )}

            <QualityInspector
              key={JSON.stringify([
                activeRecord.id,
                activeRecord.source,
                activeRecord.fits_url,
              ])}
              record={activeRecord}
            />
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