import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useStore } from "../../store/useStore";
import type {
  ArrayId,
  SpectrumResponse,
} from "../../types/cids";
import SEDChart from "./SEDChart";
import {
  ARRAY_IDS,
  FEATURES,
  SOURCE_LABELS,
  parseSpectrum,
  sampleOwners,
  spectrumCSV,
} from "./spectrum";
import "./sed.css";

const BASE = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

type LoadState =
  | { key: string; status: "loading" }
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ready"; spectrum: SpectrumResponse };

export default function SEDDrawer() {
  const sedOpen = useStore((state) => state.sedOpen);
  const toggleSED = useStore((state) => state.toggleSED);
  const activeRecord = useStore((state) => state.activeRecord);
  const activeSource = useStore((state) => state.activeSource);
  const panelId = useId();
  const headingId = useId();

  const [load, setLoad] = useState<LoadState | null>(null);
  const [retry, setRetry] = useState(0);
  const [enabled, setEnabled] = useState<ReadonlySet<ArrayId>>(
    () => new Set(ARRAY_IDS),
  );
  const [showFeatures, setShowFeatures] = useState(true);
  const [showErrors, setShowErrors] = useState(true);

  // Record provenance is authoritative. Never relabel a retained record.
  const source = activeRecord?.source ?? activeSource;
  const recordId = activeRecord?.id;
  const epoch = activeRecord?.epoch_mjd;
  const key = JSON.stringify([source, recordId, epoch]);
  const current = load?.key === key ? load : null;

  useEffect(() => {
    if (!sedOpen || !recordId) return;

    const controller = new AbortController();
    let alive = true;
    let timedOut = false;
    setLoad({ key, status: "loading" });

    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    const request = async () => {
      try {
        const params = new URLSearchParams({
          record_id: recordId,
          source,
        });
        const response = await fetch(`${BASE}/spectrum?${params}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(
            `Spectrum request failed (HTTP ${response.status}). No fallback was used.`,
          );
        }
        const spectrum = parseSpectrum(await response.json());
        if (alive) setLoad({ key, status: "ready", spectrum });
      } catch (error) {
        if (!alive) return;
        setLoad({
          key,
          status: "error",
          message: timedOut
            ? "Spectrum request timed out. No fallback was used."
            : error instanceof Error
              ? error.message
              : "Spectrum request failed. No fallback was used.",
        });
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void request();
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [sedOpen, recordId, source, key, retry]);

  const spectrum = current?.status === "ready" ? current.spectrum : null;
  const owners = useMemo(
    () => spectrum ? sampleOwners(spectrum) : [],
    [spectrum],
  );

  const download = () => {
    if (!spectrum || !activeRecord) return;
    const blob = new Blob(
      [spectrumCSV(spectrum, source, activeRecord.id, activeRecord.epoch_mjd)],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `orbit-lens-${source}-sed.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="ol-sed">
      <div className="ol-sed-heading">
        <button
          type="button"
          id={headingId}
          onClick={toggleSED}
          aria-expanded={sedOpen}
          aria-controls={panelId}
          className="ol-sed-toggle"
        >
          <span>Spectral Energy Distribution (102-band)</span>
          {sedOpen
            ? <ChevronDown size={16} aria-hidden="true" />
            : <ChevronUp size={16} aria-hidden="true" />}
        </button>
        <span
          className="ol-source-badge"
          data-source={source}
          aria-label={`Spectrum source: ${SOURCE_LABELS[source]}`}
        >
          {SOURCE_LABELS[source]}
        </span>
      </div>

      <div
        id={panelId}
        hidden={!sedOpen}
        role="region"
        aria-labelledby={headingId}
        className="ol-sed-panel"
      >
        {sedOpen && (
          <>
            {!activeRecord && <p>Search for a target to view its SED.</p>}

            {activeRecord && (
              <>
                <p>
                  Record: {activeRecord.id} · Epoch MJD {activeRecord.epoch_mjd}
                </p>
                {activeRecord.source !== activeSource && (
                  <p role="status">
                    Showing the selected record’s {SOURCE_LABELS[source]} spectrum.
                    The current search source is {SOURCE_LABELS[activeSource]}.
                  </p>
                )}
                {source === "synthetic" && (
                  <p className="ol-sed-notice">
                    SYNTHETIC demonstration spectrum — not archive measurements.
                  </p>
                )}
                {(!current || current.status === "loading") && (
                  <p role="status">Loading spectrum…</p>
                )}
                {current?.status === "error" && (
                  <div role="alert">
                    <p>{current.message}</p>
                    <button type="button" onClick={() => setRetry((n) => n + 1)}>
                      Retry spectrum
                    </button>
                  </div>
                )}
              </>
            )}

            {spectrum && spectrum.wavelengths.length === 0 && (
              <p role="status">No spectral measurements exist for this record.</p>
            )}

            {spectrum && spectrum.wavelengths.length > 0 && (
              <>
                <p role="status">
                  {spectrum.wavelengths.length} returned channels
                  {source === "qr3" || source === "synthetic"
                    ? " / 102 nominal SPHEREx channels"
                    : ""}
                  . Native backend samples; no interpolation or missing-channel fill.
                </p>

                <div className="ol-sed-controls">
                  <fieldset>
                    <legend>Detector arrays</legend>
                    {ARRAY_IDS.map((array) => {
                      const count = spectrum.array_contributions?.[array]?.length ?? 0;
                      return (
                        <label key={array}>
                          <input
                            type="checkbox"
                            checked={enabled.has(array)}
                            disabled={count === 0}
                            onChange={() => {
                              setEnabled((previous) => {
                                const next = new Set(previous);
                                if (next.has(array)) next.delete(array);
                                else next.add(array);
                                return next;
                              });
                            }}
                          />
                          {array.replace("Array", "Array ")} ({count})
                        </label>
                      );
                    })}
                  </fieldset>
                  <label>
                    <input
                      type="checkbox"
                      checked={showErrors}
                      onChange={(event) => setShowErrors(event.target.checked)}
                    />
                    ±1σ error bars
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showFeatures}
                      onChange={(event) => setShowFeatures(event.target.checked)}
                    />
                    Molecular reference markers
                  </label>
                  <button type="button" onClick={download}>
                    Download complete CSV
                  </button>
                </div>

                {owners.some((owner) => owner === null) && (
                  <p>
                    Samples without backend detector attribution remain visible.
                  </p>
                )}

                <SEDChart
                  spectrum={spectrum}
                  enabled={enabled}
                  showFeatures={showFeatures}
                  showErrors={showErrors}
                />

                {showFeatures && (
                  <ul className="ol-sed-features" aria-label="Reference wavelengths">
                    {FEATURES.map((feature) => (
                      <li key={feature.wavelength} style={{ color: feature.color }}>
                        {feature.label}: {feature.wavelength.toFixed(2)} μm
                      </li>
                    ))}
                  </ul>
                )}
                <p>
                  Reference markers are not detections. Flux units and extraction
                  aperture are not specified by CIDS. Error bars display the square
                  root of backend variance; no fitting or SNR is computed here.
                </p>

                <details>
                  <summary>Accessible data table — all returned channels</summary>
                  <div className="ol-sed-table-scroll" tabIndex={0}>
                    <table>
                      <caption>
                        {SOURCE_LABELS[source]} native spectrum; variance is in
                        squared backend flux units.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Channel</th>
                          <th scope="col">Array</th>
                          <th scope="col">Wavelength (μm)</th>
                          <th scope="col">Flux</th>
                          <th scope="col">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spectrum.wavelengths.map((wavelength, index) => (
                          <tr key={index}>
                            <th scope="row">{index + 1}</th>
                            <td>{owners[index] ?? "Unattributed"}</td>
                            <td>{wavelength.toFixed(6)}</td>
                            <td>{spectrum.flux[index].toExponential(6)}</td>
                            <td>{spectrum.variance[index].toExponential(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}