import { useState } from "react";
import type { DataSource, ObservationRecord } from "../../types/cids";
import { qualityRecordKey } from "../../lib/qualityClient";
import { useQualityStore } from "../../store/useQualityStore";
import QualityMapCanvas from "./QualityMapCanvas";

const SOURCE_LABELS: Record<DataSource, string> = {
  qr3: "SPHEREx QR3",
  synthetic: "SYNTHETIC",
  mast: "MAST",
  vizier: "VizieR",
  wiseview: "WiseView",
  gaia: "Gaia DR3",
};

export function qualityStatusLabel(
  value: boolean | null | undefined,
): string {
  if (value === true) return "PASS";
  if (value === false) return "FAIL";
  return "UNAVAILABLE";
}

export function SourceBadge({ source }: { source: DataSource }) {
  return (
    <span
      aria-label={`Data source: ${SOURCE_LABELS[source]}`}
      className="inline-flex rounded border border-[var(--ol-border)] px-2 py-1 font-semibold"
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

export default function QualityInspector({
  record,
}: {
  record: ObservationRecord;
}) {
  const [view, setView] = useState<"science" | "snr">("science");
  const key = useQualityStore((state) => state.key);
  const status = useQualityStore((state) => state.status);
  const products = useQualityStore((state) => state.products);
  const error = useQualityStore((state) => state.error);
  const retry = useQualityStore((state) => state.retry);
  const matches = key === qualityRecordKey(record);

  return (
    <section
      aria-label="Science quality inspection"
      className="mt-4 space-y-3 border-t border-[var(--ol-border)] pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Science quality</h2>
        <SourceBadge source={record.source} />
      </div>

      {(!matches || status === "idle" || status === "loading") && (
        <p role="status">
          Inspecting HDU 1 science, HDU 2 variance, and HDU 3 bitmask…
        </p>
      )}

      {matches && status === "error" && (
        <div className="space-y-2">
          <p role="alert" className="text-[var(--ol-danger)]">
            Quality unavailable: {error}
          </p>
          <p>No synthetic fallback or replacement image was used.</p>
          <button
            type="button"
            onClick={retry}
            className="rounded border border-[var(--ol-border)] px-3 py-2"
          >
            Retry quality inspection
          </button>
        </div>
      )}

      {matches && status === "ready" && products && (
        <>
          <dl className="space-y-1">
            <Row label="Assessment" value={products.status.toUpperCase()} />
            <Row
              label="Strict gate"
              value={qualityStatusLabel(products.summary.quality_ok)}
            />
            <Row
              label="Median pixel SNR"
              value={
                products.summary.snr === null
                  ? "Unavailable"
                  : products.summary.snr.toPrecision(5)
              }
            />
            <Row
              label="Eligible"
              value={`${products.eligible_pixels} / ${products.width * products.height}`}
            />
            <Row label="Rejected" value={String(products.rejected_pixels)} />
            <Row
              label="HDU 3 OR"
              value={`0x${products.summary.quality_flags
                .toString(16)
                .toUpperCase()
                .padStart(4, "0")}`}
            />
          </dl>

          <p>
            Bits:{" "}
            {products.flags_decoded.length > 0
              ? products.flags_decoded.join(", ")
              : "None set"}
          </p>
          <p className="text-[var(--ol-muted)]">
            Raw bit positions only; release-specific meanings are not assumed.
          </p>

          <fieldset className="space-y-2">
            <legend className="font-semibold">Backend-gated detector view</legend>
            <div className="flex gap-3">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="quality-view"
                  checked={view === "science"}
                  onChange={() => setView("science")}
                />
                Science
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="quality-view"
                  checked={view === "snr"}
                  onChange={() => setView("snr")}
                />
                Signed SNR
              </label>
            </div>
          </fieldset>

          <QualityMapCanvas
            width={products.width}
            height={products.height}
            rgbaBase64={
              view === "science"
                ? products.science_rgba_base64
                : products.snr_rgba_base64
            }
            label={
              view === "science"
                ? "Quality-gated science image. Rejected pixels are transparent."
                : "Signed pixel SNR image. Negative is blue, zero is white, positive is red. Rejected pixels are transparent."
            }
          />

          <p>
            {view === "science"
              ? "Asinh grayscale; 1st–99th percentiles of eligible science pixels."
              : `Blue ≤ ${products.snr_display.low}; white = 0; red ≥ ${products.snr_display.high}.`}
          </p>
          <p className="text-[var(--ol-muted)]">
            Checkerboard means rejected or unavailable, not zero flux.
            Detector pixel view; not a sky reprojection or difference image.
          </p>

          <details>
            <summary className="cursor-pointer">Quality policy and interpretation</summary>
            <p className="mt-2">{products.policy}</p>
            <p className="mt-2">{products.notes}</p>
          </details>
        </>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-[var(--ol-muted)]">{label}</dt>
      <dd className="break-all text-right">{value}</dd>
    </div>
  );
}